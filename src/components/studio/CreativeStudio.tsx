'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, catalog, concepts, type Concept, type Family, type Note } from '@/lib/api/client';
import { addNote, layers, moveNote, payload, reorder, type SelectedNote } from '@/lib/studio/composition';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dialog } from '@/components/ui/Dialog';
import { NoteLibrary } from '@/components/studio/NoteLibrary';
import { CompositionWorkspace } from '@/components/studio/CompositionWorkspace';
import { ConceptPreview } from '@/components/studio/ConceptPreview';
import { BlendAdvisor } from '@/components/studio/BlendAdvisor';
import { resolveStudioDraft, useStudioDraft, type DraftResolution } from '@/lib/studio/draft-transfer';
import { recommendAdvisory, validateAdvisoryCandidate } from '@/lib/studio/advisor/recommend';
import type { AdvisorCatalog, AdvisorResult, CompositionSnapshot } from '@/lib/studio/advisor/types';

const tabs = ['نت‌ها', 'ترکیب', 'نتیجه'] as const;
const tabNumbers = ['۰۱', '۰۲', '۰۳'];
type SavedConceptLoadProblem = 'missing-notes' | 'catalog-conflict' | 'invalid-concept';

class SavedConceptLoadError extends Error {
  constructor(readonly problem: SavedConceptLoadProblem) { super(problem); }
}

class AdvisorCatalogImportError extends Error {
  constructor(readonly problem: 'malformed-page' | 'duplicate-id') { super(problem); }
}

function resolveSavedConceptSelection(concept: Concept, catalogNotes: readonly Note[]): SelectedNote[] {
  const catalogById = new Map<string, Note>();
  for (const note of catalogNotes) {
    const id = note.id.toLowerCase();
    if (catalogById.has(id)) throw new SavedConceptLoadError('catalog-conflict');
    catalogById.set(id, note);
  }
  if (!concept.name.trim() || concept.notes.length > 6) throw new SavedConceptLoadError('invalid-concept');
  const selectedIds = concept.notes.map(item => item.note_id.toLowerCase());
  if (new Set(selectedIds).size !== selectedIds.length) throw new SavedConceptLoadError('invalid-concept');
  for (const layer of layers) {
    const positions = concept.notes.filter(item => item.layer === layer).map(item => item.position).sort((a, b) => a - b);
    if (positions.some((position, index) => !Number.isInteger(position) || position !== index)) {
      throw new SavedConceptLoadError('invalid-concept');
    }
  }
  if (concept.notes.some(item => !layers.includes(item.layer) || !Number.isInteger(item.position) || item.position < 0)) {
    throw new SavedConceptLoadError('invalid-concept');
  }
  const missing = concept.notes.some(item => !catalogById.has(item.note_id.toLowerCase()));
  if (missing) throw new SavedConceptLoadError('missing-notes');
  return [...concept.notes]
    .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer) || a.position - b.position)
    .map(item => ({ note: catalogById.get(item.note_id.toLowerCase())!, layer: item.layer }));
}

export function CreativeStudio({ conceptId: requestedConceptId, fromGuided = false, fromAdvisor = false }: { conceptId?: string; fromGuided?: boolean; fromAdvisor?: boolean }) {
  const router = useRouter();
  const { user, loading: authLoading, authEnabled } = useAuth();
  const explorationOnly = !authEnabled;
  const conceptId = explorationOnly ? undefined : requestedConceptId;
  const { pending: guidedDraft, navigationIntentId, isCurrent: isCurrentStudioDraft, consume: consumeStudioDraft, createAdvisorFork } = useStudioDraft();
  const [name, setName] = useState('رایحه من');
  const [selected, setSelected] = useState<SelectedNote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [family, setFamily] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noteError, setNoteError] = useState('');
  const [familyError, setFamilyError] = useState('');
  const [failedOffset, setFailedOffset] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [guidedImportState, setGuidedImportState] = useState<'idle' | 'loading' | 'error' | 'expired' | 'invalid'>('idle');
  const [guidedImportError, setGuidedImportError] = useState('');
  const [guidedCandidate, setGuidedCandidate] = useState<{ id: string; resolution: DraftResolution; routeIntent: string } | null>(null);
  const [confirmGuidedReplace, setConfirmGuidedReplace] = useState(false);
  const [replaceConfirmationRoute, setReplaceConfirmationRoute] = useState('');
  const [confirmPartialGuided, setConfirmPartialGuided] = useState(false);
  const [partialConfirmationRoute, setPartialConfirmationRoute] = useState('');
  const [loadedConceptId, setLoadedConceptId] = useState<string | null>(null);
  const [failedConceptId, setFailedConceptId] = useState<string | null>(null);
  const [savedConceptAttempt, setSavedConceptAttempt] = useState(0);
  const [savedId, setSavedId] = useState('');
  const [advisorResult, setAdvisorResult] = useState<AdvisorResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorAccepted, setAdvisorAccepted] = useState(false);
  const [advisorForkOpen, setAdvisorForkOpen] = useState(false);
  const [advisorForkBusy, setAdvisorForkBusy] = useState(false);
  const [advisorForkError, setAdvisorForkError] = useState('');
  const [advisorUndo, setAdvisorUndo] = useState<{ name: string; selected: SelectedNote[]; identity: string; routeIntent: string; appliedRevision: number } | null>(null);
  const noteRequest = useRef(0);
  const savingRef = useRef(false);
  const advisorForkBusyRef = useRef(false);
  const busyRef = useRef(false);
  const advisorRequest = useRef(0);
  const advisorCatalog = useRef<AdvisorCatalog | null>(null);
  const advisorResultRef = useRef<AdvisorResult | null>(null);
  const loadedConceptIdRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  const selectedRef = useRef(selected);
  const savedIdRef = useRef(savedId);
  const revisionRef = useRef(0);
  const identitySequence = useRef(0);
  const compositionIdentityRef = useRef('creative-composition-0');
  const importRequest = useRef(0);
  const focusFreshStudioAfterAdvisorExit = useRef(false);
  const advisorImportedRouteIntent = useRef<string | null>(null);
  const wasAdvisorRoute = useRef(fromAdvisor && !conceptId);
  const routeIntent = `${router.bfcacheId}|${conceptId ?? ''}|${fromGuided ? 'guided' : fromAdvisor ? 'advisor' : 'ordinary'}`;
  const advisorRouteRef = useRef(routeIntent);
  const routeIntentRef = useRef(routeIntent);
  routeIntentRef.current = routeIntent;
  nameRef.current = name;
  selectedRef.current = selected;
  savedIdRef.current = savedId;
  const initializedTransferIds = useRef(new Set<string>());
  const importedInThisMount = useRef(false);
  const focusAdvisorForkImport = useRef(false);
  const savedConceptLoaded = !conceptId || loadedConceptId === conceptId;
  const savedConceptLoadFailed = Boolean(conceptId && failedConceptId === conceptId);
  const guidedDraftExpired = Boolean(fromGuided && !conceptId && !importedInThisMount.current && (!guidedDraft || guidedDraft.origin === 'advisor-fork' || navigationIntentId !== guidedDraft.transferId));
  const advisorImportAuthorized = Boolean(fromAdvisor && !conceptId && advisorImportedRouteIntent.current === routeIntent);
  const advisorDraftExpired = Boolean(fromAdvisor && !conceptId && !advisorImportAuthorized && (!guidedDraft || guidedDraft.origin !== 'advisor-fork' || navigationIntentId !== guidedDraft.transferId));
  const advisorImportLocked = Boolean(fromAdvisor && !conceptId && !advisorImportAuthorized);
  const savedConceptLocked = Boolean(conceptId && (!savedConceptLoaded || savedConceptLoadFailed));
  const editorLocked = advisorImportLocked || savedConceptLocked;
  const selectedIds = new Set(selected.map(item => item.note.id));

  const setAdvisorState = useCallback((value: AdvisorResult | null) => {
    advisorResultRef.current = value;
    setAdvisorResult(value);
  }, []);
  const invalidateAdvisor = useCallback(() => {
    advisorRequest.current += 1;
    advisorCatalog.current = null;
    setAdvisorState(null);
    setAdvisorLoading(false);
    setAdvisorAccepted(false);
    setAdvisorUndo(null);
  }, [setAdvisorState]);
  const changeName = (value: string) => {
    if (editorLocked) return;
    if (nameRef.current === value) return;
    nameRef.current = value;
    revisionRef.current += 1;
    invalidateAdvisor();
    setName(value);
  };
  const changeSelected = (update: SelectedNote[] | ((current: SelectedNote[]) => SelectedNote[])) => {
    if (editorLocked) return;
    const current = selectedRef.current;
    const next = typeof update === 'function' ? update(current) : update;
    if (next === current) return;
    selectedRef.current = next;
    revisionRef.current += 1;
    invalidateAdvisor();
    setSelected(next);
  };
  const replaceComposition = useCallback((nextName: string, nextSelected: SelectedNote[]) => {
    invalidateAdvisor();
    revisionRef.current += 1;
    identitySequence.current += 1;
    compositionIdentityRef.current = `creative-composition-${identitySequence.current}`;
    nameRef.current = nextName;
    selectedRef.current = nextSelected;
    setName(nextName);
    setSelected(nextSelected);
  }, [invalidateAdvisor]);
  const changeSavedTarget = useCallback((nextId: string) => {
    if (savedIdRef.current === nextId) {
      setSavedId(nextId);
      return;
    }
    savedIdRef.current = nextId;
    revisionRef.current += 1;
    invalidateAdvisor();
    setSavedId(nextId);
  }, [invalidateAdvisor]);
  const makeAdvisorSnapshot = (): CompositionSnapshot => ({
    name: nameRef.current,
    selected: selectedRef.current.map(item => ({ note: { ...item.note }, layer: item.layer })),
    revision: revisionRef.current,
    compositionIdentity: compositionIdentityRef.current,
    routeIntent: routeIntentRef.current,
    saveTargetId: savedIdRef.current || null,
  });
  const advisorSuggestionIsCurrent = (source: { sourceRevision: number; sourceCompositionIdentity: string; sourceRouteIntent: string; sourceSaveTargetId: string | null }) =>
    revisionRef.current === source.sourceRevision
    && compositionIdentityRef.current === source.sourceCompositionIdentity
    && routeIntentRef.current === source.sourceRouteIntent
    && (savedIdRef.current || null) === source.sourceSaveTargetId
    && !savingRef.current
    && !advisorForkBusyRef.current;
  const advisorSourceIsCurrent = (snapshot: CompositionSnapshot, requestId: number) =>
    requestId === advisorRequest.current
    && revisionRef.current === snapshot.revision
    && compositionIdentityRef.current === snapshot.compositionIdentity
    && routeIntentRef.current === snapshot.routeIntent
    && (savedIdRef.current || null) === snapshot.saveTargetId
    && !savingRef.current;

  const requestAdvisor = async () => {
    if (editorLocked || busy || savingRef.current || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))) return;
    invalidateAdvisor();
    const requestId = advisorRequest.current;
    const source = makeAdvisorSnapshot();
    if (!source.selected.length) {
      setAdvisorState({ status: 'no-guidance', reason: 'empty' });
      return;
    }
    setAdvisorLoading(true);
    try {
      const completeNotes: Note[] = [];
      const noteIds = new Set<string>();
      let offset = 0;
      for (;;) {
        const page = await catalog.notes({ limit: 100, offset });
        if (!advisorSourceIsCurrent(source, requestId)) return;
        if (page.length > 100 || page.some(note => noteIds.has(note.id.toLowerCase()))) {
          setAdvisorState({ status: 'unavailable', reason: 'catalog-conflict' });
          return;
        }
        page.forEach(note => noteIds.add(note.id.toLowerCase()));
        completeNotes.push(...page);
        if (page.length < 100) break;
        offset += page.length;
      }
      if (!advisorSourceIsCurrent(source, requestId)) return;
      const catalogSnapshot: AdvisorCatalog = { status: 'ready', completeness: 'complete', notes: completeNotes };
      advisorCatalog.current = catalogSnapshot;
      setAdvisorState(recommendAdvisory(source, catalogSnapshot));
    } catch {
      if (advisorSourceIsCurrent(source, requestId)) {
        advisorCatalog.current = { status: 'failed' };
        setAdvisorState({ status: 'unavailable', reason: 'catalog-failed' });
      }
    } finally {
      if (requestId === advisorRequest.current) setAdvisorLoading(false);
    }
  };

  const applyAdvisorSuggestion = () => {
    const result = advisorResultRef.current;
    if (editorLocked || !result || result.status !== 'suggestion' || busy || savingRef.current || advisorForkBusyRef.current) return;
    if (savedIdRef.current || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))) return;
    const source = result.suggestion;
    const liveSnapshot = makeAdvisorSnapshot();
    if (!advisorSuggestionIsCurrent(source)
      || liveSnapshot.revision !== source.sourceRevision
      || liveSnapshot.compositionIdentity !== source.sourceCompositionIdentity
      || liveSnapshot.routeIntent !== source.sourceRouteIntent
      || liveSnapshot.saveTargetId !== source.sourceSaveTargetId) return;
    const authoritativeCatalog = advisorCatalog.current;
    if (!authoritativeCatalog || authoritativeCatalog.status !== 'ready') return;
    const validation = validateAdvisoryCandidate(source.original, source.proposed, authoritativeCatalog);
    if (validation.status !== 'valid') {
      setAdvisorState(validation.status === 'unavailable'
        ? { status: 'unavailable', reason: validation.reason }
        : { status: 'invalid', reason: 'invalid-candidate', issues: validation.issues });
      return;
    }
    const previous = { name: nameRef.current, selected: selectedRef.current.map(item => ({ ...item, note: { ...item.note } })) };
    const nextSelected = source.proposed.selected.map(item => ({ note: { ...item.note }, layer: item.layer }));
    advisorRequest.current += 1;
    revisionRef.current += 1;
    nameRef.current = source.proposed.name;
    selectedRef.current = nextSelected;
    setName(source.proposed.name);
    setSelected(nextSelected);
    setAdvisorUndo({ ...previous, identity: compositionIdentityRef.current, routeIntent: routeIntentRef.current, appliedRevision: revisionRef.current });
    setAdvisorAccepted(true);
  };
  const openAdvisorForkConfirmation = () => {
    if (explorationOnly) return;
    if (editorLocked || advisorForkBlock || busy || savingRef.current || !savedIdRef.current || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))) return;
    const current = advisorResultRef.current;
    if (!current || current.status !== 'suggestion' || !advisorSuggestionIsCurrent(current.suggestion)) return;
    setAdvisorForkError('');
    setAdvisorForkOpen(true);
  };
  const confirmAdvisorFork = () => {
    if (explorationOnly) return;
    if (editorLocked || advisorForkBusyRef.current || savingRef.current || busy) return;
    const current = advisorResultRef.current;
    if (!current || current.status !== 'suggestion' || !savedIdRef.current
      || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))
      || !advisorSuggestionIsCurrent(current.suggestion)) {
      setAdvisorForkError('پیشنهاد تغییر کرده است. پنجره را ببندید و دوباره پیشنهاد بگیرید؛ مفهوم اصلی محفوظ است.');
      return;
    }
    const catalogSnapshot = advisorCatalog.current;
    if (!catalogSnapshot || catalogSnapshot.status !== 'ready') {
      setAdvisorForkError('کاتالوگ کامل برای بررسی در دسترس نیست. مفهوم اصلی محفوظ است.');
      return;
    }
    const validation = validateAdvisoryCandidate(current.suggestion.original, current.suggestion.proposed, catalogSnapshot);
    if (validation.status !== 'valid') {
      setAdvisorForkError(validation.status === 'unavailable'
        ? 'نت‌های پیشنهاد در کاتالوگ فعلی تأیید نشدند. مفهوم اصلی محفوظ است.'
        : 'پیشنهاد دیگر با ترکیب فعلی سازگار نیست. دوباره راهنمایی بگیرید؛ مفهوم اصلی محفوظ است.');
      return;
    }
    const created = createAdvisorFork(current.suggestion.proposed.name, (current.suggestion.payload.notes ?? []).map(note => ({
      noteId: note.note_id,
      layer: note.layer,
      position: note.position,
    })), {
      compositionIdentity: current.suggestion.sourceCompositionIdentity,
      conceptId: savedIdRef.current,
    });
    if (created.status !== 'created') {
      setAdvisorForkError(created.status === 'blocked'
        ? 'یک پیش‌نویس هدایت‌شده یا انتقال دیگر در انتظار است. ابتدا آن را بازیابی کنید؛ نسخهٔ اصلی تغییر نمی‌کند.'
        : created.reason === 'invalid-name'
          ? 'نام مفهوم برای انتقال معتبر نیست. نام را بررسی کنید؛ هیچ بخشی از آن حذف نشده است.'
          : 'پیشنهاد برای انتقال معتبر نیست. مفهوم اصلی محفوظ است.');
      return;
    }
    advisorForkBusyRef.current = true;
    setAdvisorForkBusy(true);
    setAdvisorForkError('');
    setAdvisorForkOpen(false);
    setNotice('نسخهٔ پیشنهادی در حال انتقال به پیش‌نویس مستقل است؛ هنوز ذخیره نشده است.');
    router.replace('/studio/creative?from=advisor');
  };
  const rejectAdvisorSuggestion = () => {
    invalidateAdvisor();
  };
  const undoAdvisorSuggestion = () => {
    const previous = advisorUndo;
    if (!previous || busy || savingRef.current || savedIdRef.current
      || previous.identity !== compositionIdentityRef.current || previous.routeIntent !== routeIntentRef.current
      || previous.appliedRevision !== revisionRef.current) return;
    advisorRequest.current += 1;
    revisionRef.current += 1;
    nameRef.current = previous.name;
    selectedRef.current = previous.selected;
    setName(previous.name);
    setSelected(previous.selected);
    advisorCatalog.current = null;
    setAdvisorState(null);
    setAdvisorAccepted(false);
    setAdvisorUndo(null);
  };

  const advisorApplyBlock = savedId
    ? 'این مفهوم ذخیره‌شده فقط با ذخیرهٔ تغییرات ویرایش می‌شود. برای پیشنهاد، نسخه‌ای مستقل بسازید؛ مفهوم اصلی دست‌نخورده می‌ماند.'
    : conceptId && (!savedConceptLoaded || savedConceptLoadFailed)
      ? 'تا پایان بارگذاری مفهوم ذخیره‌شده، امکان اعمال پیشنهاد وجود ندارد.'
      : null;
  const advisorForkBlock = savingRef.current || busy || advisorForkBusy
    ? 'هنگام ذخیره یا انتقال، ساخت نسخهٔ مستقل در دسترس نیست.'
    : guidedDraft || navigationIntentId
      ? 'یک پیش‌نویس انتقال دیگر در انتظار است. ابتدا آن را در استودیوی خلاق بازیابی کنید؛ انتقال هدایت‌شده جایگزین نمی‌شود.'
      : !savedId
        ? 'ابتدا مفهوم ذخیره‌شده را کامل بارگذاری کنید تا نسخهٔ مستقل با اطمینان ساخته شود.'
        : null;
  const advisorRequestBlock = conceptId && (!savedConceptLoaded || savedConceptLoadFailed)
    ? savedConceptLoadFailed ? 'بارگذاری مفهوم ذخیره‌شده کامل نشد؛ ابتدا آن را دوباره بارگذاری کنید.' : 'پس از بارگذاری کامل مفهوم ذخیره‌شده می‌توانید پیشنهاد بگیرید.'
    : null;

  const loadNotes = useCallback(async (currentOffset = 0) => {
    const requestId = ++noteRequest.current;
    setLoading(true);
    setNoteError('');
    if (currentOffset === 0) setHasMore(false);
    try {
      const list = await catalog.notes({ q: query, family_id: family || undefined, limit: 50, offset: currentOffset });
      if (requestId !== noteRequest.current) return;
      setNotes(previous => currentOffset === 0 ? list : [...previous, ...list]);
      setOffset(currentOffset + list.length);
      setHasMore(list.length === 50);
    } catch (cause) {
      if (requestId === noteRequest.current) {
        setFailedOffset(currentOffset);
        setNoteError(cause instanceof ApiError ? cause.message : 'دریافت نت‌ها انجام نشد.');
      }
    } finally {
      if (requestId === noteRequest.current) setLoading(false);
    }
  }, [query, family]);

  const loadFamilies = useCallback(() => {
    setFamilyError('');
    void catalog.families('', 100).then(setFamilies).catch(() => setFamilyError('دریافت خانواده‌های رایحه انجام نشد.'));
  }, []);

  useEffect(() => {
    void catalog.families('', 100).then(setFamilies).catch(() => setFamilyError('دریافت خانواده‌های رایحه انجام نشد.'));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void loadNotes(0); }, 250);
    return () => clearTimeout(timer);
  }, [loadNotes]);

  useEffect(() => {
    if (explorationOnly || !conceptId || authLoading || !user) return;
    const savedRouteIntent = routeIntentRef.current;
    let cancelled = false;
    if (loadedConceptIdRef.current !== conceptId) {
      loadedConceptIdRef.current = null;
      changeSavedTarget('');
      replaceComposition('رایحه من', []);
    }
    void (async () => {
      try {
        const concept = await concepts.get(conceptId);
        let all: Note[] = [];
        let page = 0;
        for (;;) {
          const chunk = await catalog.notes({ limit: 100, offset: page });
          if (cancelled || routeIntentRef.current !== savedRouteIntent) return;
          if (chunk.length > 100) throw new SavedConceptLoadError('catalog-conflict');
          const pageIds = new Set<string>();
          for (const note of chunk) {
            const id = note.id.toLowerCase();
            if (pageIds.has(id) || all.some(existing => existing.id.toLowerCase() === id)) {
              throw new SavedConceptLoadError('catalog-conflict');
            }
            pageIds.add(id);
          }
          all = [...all, ...chunk];
          if (chunk.length < 100) break;
          page += 100;
        }
        if (cancelled || routeIntentRef.current !== savedRouteIntent) return;
        const loadedSelection = resolveSavedConceptSelection(concept, all);
        replaceComposition(concept.name, loadedSelection);
        changeSavedTarget(concept.id);
        setError('');
        loadedConceptIdRef.current = conceptId;
        setLoadedConceptId(conceptId);
        setFailedConceptId(null);
      } catch (cause) {
        if (!cancelled && routeIntentRef.current === savedRouteIntent) {
          const message = cause instanceof SavedConceptLoadError
            ? cause.problem === 'missing-notes'
              ? 'مفهوم ذخیره‌شده کامل بارگذاری نشد؛ برخی نت‌های آن در کاتالوگ فعلی پیدا نشدند. نسخهٔ اصلی روی سرور محفوظ است. می‌توانید دوباره تلاش کنید.'
              : cause.problem === 'catalog-conflict'
                ? 'مفهوم ذخیره‌شده کامل بارگذاری نشد؛ اطلاعات کاتالوگ تکراری یا ناسازگار است. نسخهٔ اصلی روی سرور محفوظ است. می‌توانید دوباره تلاش کنید.'
                : 'ساختار مفهوم ذخیره‌شده معتبر نیست؛ نسخهٔ اصلی روی سرور محفوظ است و بارگذاری کامل متوقف شد.'
            : cause instanceof ApiError ? cause.message : 'بارگذاری کامل مفهوم انجام نشد. نسخهٔ اصلی روی سرور محفوظ است؛ می‌توانید دوباره تلاش کنید.';
          changeSavedTarget('');
          loadedConceptIdRef.current = null;
          setLoadedConceptId(null);
          setError(message);
          setFailedConceptId(conceptId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [conceptId, authLoading, user, explorationOnly, replaceComposition, changeSavedTarget, savedConceptAttempt]);

  const commitGuidedDraft = (transferId: string, resolution: Extract<DraftResolution, { status: 'ready' | 'missing' }>) => {
    if (!isCurrentStudioDraft(transferId) || initializedTransferIds.current.has(transferId) || conceptId) return;
    const isAdvisorFork = guidedDraft?.transferId === transferId && guidedDraft.origin === 'advisor-fork';
    if (isAdvisorFork && !fromAdvisor) return;
    if (isAdvisorFork && resolution.status !== 'ready') {
      setGuidedImportState('error');
      setGuidedImportError('همهٔ نت‌های نسخهٔ پیشنهادی در کاتالوگ فعلی پیدا نشدند. نسخهٔ اصلی تغییر نکرده و پیش‌نویس برای تلاش دوباره حفظ شده است.');
      return;
    }
    if (savingRef.current) {
      setGuidedImportState('error');
      setGuidedImportError('ذخیرهٔ ترکیب فعلی هنوز در جریان است. پس از پایان ذخیره، دوباره برای دریافت پیش‌نویس تلاش کنید.');
      return;
    }
    if (!resolution.selected.length) {
      setGuidedImportError('هیچ‌کدام از نت‌های این پیشنهاد در کاتالوگ فعلی نیستند. پیش‌نویس حفظ شده است؛ به استودیوی هدایت‌شده برگردید.');
      setGuidedImportState('invalid');
      return;
    }
    if (isAdvisorFork) {
      advisorImportedRouteIntent.current = routeIntentRef.current;
      focusAdvisorForkImport.current = true;
    }
    replaceComposition(resolution.name, [...resolution.selected]);
    changeSavedTarget('');
    setTab(1);
    setError('');
    setNotice(isAdvisorFork
      ? 'نسخهٔ مستقل برای ویرایش آماده است؛ نسخهٔ اصلی محفوظ مانده و این پیش‌نویس هنوز ذخیره نشده است.'
      : resolution.status === 'missing'
        ? `${resolution.selected.length} نت موجود وارد شد؛ ${resolution.missingIds.length} نت دیگر در کاتالوگ نیست و وارد نشد.`
        : 'پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.');
    initializedTransferIds.current.add(transferId);
    importedInThisMount.current = true;
    if (isAdvisorFork) {
      advisorForkBusyRef.current = false;
      setAdvisorForkBusy(false);
    }
    consumeStudioDraft(transferId);
    setGuidedCandidate(null);
    setGuidedImportState('idle');
    setGuidedImportError('');
  };

  const inspectGuidedDraft = async (explicit = false) => {
    if (savingRef.current) {
      setGuidedImportState('error');
      setGuidedImportError('ذخیرهٔ ترکیب فعلی هنوز در جریان است. پس از پایان ذخیره، دوباره برای دریافت پیش‌نویس تلاش کنید.');
      return;
    }
    if (!guidedDraft) {
      setGuidedImportState('expired');
      setGuidedImportError('پیش‌نویس در حافظهٔ این برگه پیدا نشد. احتمالاً صفحه تازه‌سازی شده است.');
      return;
    }
    const isAdvisorFork = guidedDraft.origin === 'advisor-fork';
    if (isAdvisorFork !== fromAdvisor || (fromAdvisor && conceptId)) return;
    if (conceptId && (savedConceptLoadFailed || !savedConceptLoaded)) return;
    if (initializedTransferIds.current.has(guidedDraft.transferId)) return;
    const requestRouteIntent = routeIntentRef.current;
    const requestId = ++importRequest.current;
    setGuidedImportState('loading');
    setGuidedImportError('');
    try {
      const all: Note[] = [];
      const catalogIds = new Set<string>();
      let offset = 0;
      for (;;) {
        const page: unknown = await catalog.notes({ limit: 100, offset });
        if (requestId !== importRequest.current || routeIntentRef.current !== requestRouteIntent) return;
        if (!Array.isArray(page) || page.length > 100) throw new AdvisorCatalogImportError('malformed-page');
        if (isAdvisorFork) {
          for (const item of page as unknown[]) {
            if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !item.id.trim()) {
              throw new AdvisorCatalogImportError('malformed-page');
            }
            const id = item.id.toLowerCase();
            if (catalogIds.has(id)) throw new AdvisorCatalogImportError('duplicate-id');
            catalogIds.add(id);
          }
        }
        all.push(...page);
        if (page.length < 100) break;
        offset += page.length;
      }
      const resolution = resolveStudioDraft(guidedDraft, all);
      if (requestId !== importRequest.current || routeIntentRef.current !== requestRouteIntent || !isCurrentStudioDraft(guidedDraft.transferId)) return;
      if (resolution.status === 'invalid') {
        setGuidedImportState('invalid');
        setGuidedImportError(`${resolution.reason} پیش‌نویس حفظ شده است.`);
        return;
      }
      if (isAdvisorFork && resolution.status === 'missing') {
        setGuidedImportState('error');
        setGuidedImportError('همهٔ نت‌های نسخهٔ پیشنهادی در کاتالوگ فعلی پیدا نشدند. نسخهٔ اصلی تغییر نکرده و پیش‌نویس برای تلاش دوباره حفظ شده است.');
        return;
      }
      setGuidedCandidate({ id: guidedDraft.transferId, resolution, routeIntent: requestRouteIntent });
      if (resolution.status === 'missing') {
        setGuidedImportState('idle');
        setPartialConfirmationRoute(requestRouteIntent);
        setConfirmPartialGuided(true);
      } else if (explicit && (selected.length > 0 || Boolean(savedId))) {
        setGuidedImportState('idle');
        setReplaceConfirmationRoute(requestRouteIntent);
        setConfirmGuidedReplace(true);
      } else {
        commitGuidedDraft(guidedDraft.transferId, resolution);
      }
    } catch (cause) {
      if (requestId !== importRequest.current || routeIntentRef.current !== requestRouteIntent) return;
      setGuidedImportState('error');
      setGuidedImportError(cause instanceof AdvisorCatalogImportError
        ? cause.problem === 'duplicate-id'
          ? 'کاتالوگ نت‌های تکراری یا متناقض دارد؛ نسخهٔ مستقل بارگذاری نشد و پیش‌نویس برای تلاش دوباره محفوظ است.'
          : 'ساختار صفحه‌های کاتالوگ معتبر نبود؛ نسخهٔ مستقل بارگذاری نشد و پیش‌نویس برای تلاش دوباره محفوظ است.'
        : cause instanceof ApiError ? cause.message : 'دریافت کاتالوگ برای انتقال انجام نشد. پیش‌نویس حفظ شده است.');
    }
  };

  useEffect(() => {
    importRequest.current += 1;
  }, [routeIntent]);

  useEffect(() => {
    if (!focusAdvisorForkImport.current || !importedInThisMount.current) return;
    focusAdvisorForkImport.current = false;
    document.querySelector<HTMLInputElement>('.concept-name-field input')?.focus();
  }, [name, selected]);

  useEffect(() => {
    if (!focusFreshStudioAfterAdvisorExit.current || fromAdvisor || conceptId) return;
    focusFreshStudioAfterAdvisorExit.current = false;
    document.getElementById('studio-tab-0')?.focus();
  }, [routeIntent, fromAdvisor, conceptId]);

  useEffect(() => {
    if (advisorRouteRef.current === routeIntent) return;
    const activeAdvisorRoute = fromAdvisor && !conceptId;
    if (wasAdvisorRoute.current && (!activeAdvisorRoute || advisorRouteRef.current !== routeIntent)) {
      advisorImportedRouteIntent.current = null;
      importedInThisMount.current = false;
      advisorForkBusyRef.current = false;
      setAdvisorForkBusy(false);
      advisorRequest.current += 1;
      advisorCatalog.current = null;
      setAdvisorLoading(false);
      setAdvisorState(null);
      setAdvisorAccepted(false);
      setAdvisorUndo(null);
    }
    wasAdvisorRoute.current = activeAdvisorRoute;
    advisorRouteRef.current = routeIntent;
    revisionRef.current += 1;
    identitySequence.current += 1;
    compositionIdentityRef.current = `creative-composition-${identitySequence.current}`;
    advisorRequest.current += 1;
    advisorCatalog.current = null;
    advisorResultRef.current = null;
    setAdvisorResult(null);
    setAdvisorLoading(false);
    setAdvisorAccepted(false);
    setAdvisorUndo(null);
  }, [routeIntent, fromAdvisor, conceptId, setAdvisorState]);
  useEffect(() => () => { advisorRequest.current += 1; }, []);

  useEffect(() => {
    if (conceptId || (!fromGuided && !fromAdvisor)) return;
    if (importedInThisMount.current) return;
    if (!guidedDraft || navigationIntentId !== guidedDraft.transferId) return;
    if ((guidedDraft.origin === 'advisor-fork') !== fromAdvisor) return;
    const timer = window.setTimeout(() => { void inspectGuidedDraft(false); }, 0);
    return () => { window.clearTimeout(timer); importRequest.current += 1; };
    // The route marker is only an intent hint; transfer data is read from the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, fromGuided, fromAdvisor, guidedDraft?.transferId, navigationIntentId]);

  const select = (note: Note) => {
    if (editorLocked) return;
    if (selected.length >= 6 && !selectedIds.has(note.id)) {
      setNotice('برای افزودن نت تازه، یکی را از ترکیب بردارید.');
      setTab(1);
      return;
    }
    changeSelected(current => addNote(current, note));
    setNotice('');
  };

  const save = async () => {
    if (explorationOnly) return;
    if (savingRef.current) return;
    if (editorLocked) return;
    if (fromAdvisor && !conceptId && !importedInThisMount.current) {
      setError('پیش‌نویس مستقل هنوز با کاتالوگ بررسی نشده است. مفهوم ذخیره‌شدهٔ اصلی محفوظ است.');
      return;
    }
    invalidateAdvisor();
    if (!name.trim()) { setError('برای مفهوم خود نامی انتخاب کنید.'); return; }
    if (!user) {
      setLoginOpen(true);
      setNotice('ترکیب شما روی صفحه حفظ شده است. پس از ورود، ذخیره را کامل کنید.');
      return;
    }
    if (conceptId && !savedConceptLoaded) {
      setError(savedConceptLoadFailed ? 'مفهوم ذخیره‌شده بارگذاری نشد؛ برای جلوگیری از تغییر اشتباه دوباره بارگذاری کنید.' : 'مفهوم ذخیره‌شده هنوز در حال بارگذاری است.');
      return;
    }
    savingRef.current = true;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const saveContext = {
      compositionIdentity: compositionIdentityRef.current,
      routeIntent: routeIntentRef.current,
      revision: revisionRef.current,
      saveTargetId: savedIdRef.current || null,
      snapshot: JSON.stringify({
        name: nameRef.current,
        selected: selectedRef.current.map(item => ({ noteId: item.note.id, layer: item.layer })),
        saveTargetId: savedIdRef.current || null,
      }),
    };
    const saveContextIsCurrent = () => saveContext.compositionIdentity === compositionIdentityRef.current
      && saveContext.routeIntent === routeIntentRef.current
      && saveContext.revision === revisionRef.current
      && saveContext.saveTargetId === (savedIdRef.current || null)
      && saveContext.snapshot === JSON.stringify({
        name: nameRef.current,
        selected: selectedRef.current.map(item => ({ noteId: item.note.id, layer: item.layer })),
        saveTargetId: savedIdRef.current || null,
      });
    try {
      const body = payload(name, selected);
      const result: Concept = savedId ? await concepts.update(savedId, body) : await concepts.create(body);
      if (!saveContextIsCurrent()) return;
      changeSavedTarget(result.id);
      setNotice('مفهوم رایحه با موفقیت ذخیره شد.');
    } catch (cause) {
      if (saveContextIsCurrent()) {
        setError(cause instanceof ApiError ? cause.message : 'ذخیره انجام نشد.');
        if (cause instanceof ApiError && cause.status === 401) setLoginOpen(true);
      }
    } finally {
      savingRef.current = false;
      busyRef.current = false;
      setBusy(false);
    }
  };

  const confirmReplaceWithGuidedDraft = () => {
    if (savingRef.current) return;
    if (!guidedCandidate || guidedCandidate.routeIntent !== routeIntentRef.current || !isCurrentStudioDraft(guidedCandidate.id)) return;
    if (!conceptId) {
      const resolution = guidedCandidate.resolution;
      if (resolution.status === 'ready' || resolution.status === 'missing') commitGuidedDraft(guidedCandidate.id, resolution);
      setConfirmGuidedReplace(false);
      return;
    }
    if (!savedConceptLoaded || savedConceptLoadFailed) return;
    // The root provider survives route changes; the pending draft is the recovery source
    // if this page component is remounted while the saved-concept query is removed.
    importRequest.current += 1;
    setGuidedImportState('idle');
    setConfirmGuidedReplace(false);
    setConfirmPartialGuided(false);
    changeSavedTarget('');
    setLoadedConceptId(null);
    replaceComposition('رایحه من', []);
    setNotice('پیش‌نویس در حال انتقال به فضای ویرایش مستقل است.');
    router.replace('/studio/creative?from=guided');
  };

  const updateQuery = (value: string) => {
    noteRequest.current++;
    setQuery(value.slice(0, 100));
    setNotes([]);
    setLoading(true);
    setHasMore(false);
  };
  const updateFamily = (value: string) => {
    noteRequest.current++;
    setFamily(value);
    setNotes([]);
    setLoading(true);
    setHasMore(false);
  };

  const retrySavedConceptLoad = () => {
    if (!conceptId || busy) return;
    setError('');
    setFailedConceptId(null);
    loadedConceptIdRef.current = null;
    setLoadedConceptId(null);
    changeSavedTarget('');
    setSavedConceptAttempt(value => value + 1);
  };

  const leaveUnresolvedAdvisorTransfer = () => {
    if (!advisorImportLocked) return;
    importRequest.current += 1;
    advisorRequest.current += 1;
    advisorCatalog.current = null;
    advisorImportedRouteIntent.current = null;
    importedInThisMount.current = false;
    advisorForkBusyRef.current = false;
    setAdvisorForkBusy(false);
    setAdvisorLoading(false);
    setAdvisorState(null);
    setAdvisorAccepted(false);
    setAdvisorUndo(null);
    const pendingId = guidedDraft?.transferId;
    if (guidedDraft?.origin === 'advisor-fork' && pendingId && navigationIntentId === pendingId && isCurrentStudioDraft(pendingId)) {
      consumeStudioDraft(pendingId);
    }
    changeSavedTarget('');
    setLoadedConceptId(null);
    replaceComposition('رایحه من', []);
    setGuidedImportState('idle');
    setGuidedImportError('');
    setError('');
    setNotice('پیش‌نویس انتقال در دسترس نبود؛ یک ترکیب تازه آغاز شد. هیچ مفهوم ذخیره‌شده‌ای تغییر نکرد.');
    focusFreshStudioAfterAdvisorExit.current = true;
    router.replace('/studio/creative');
  };

  return <div className="studio-page">
    <header className="studio-intro">
      <div className="container studio-intro-inner">
        <div><p className="eyebrow">{explorationOnly ? 'AROMAN · کاوش مفهومی' : 'AROMAN · کارگاه ساخت رایحه'}</p><h1>روایت رایحه‌ی شما</h1><p>نت‌ها را برگزینید، در سه لایه بچینید و حال‌وهوای مفهوم خود را تماشا کنید.</p></div>
        <div className="studio-intro-actions"><p className="studio-count-badge" role="status" aria-live="polite" aria-label={`${selected.length} از ۶ نت انتخاب شده`}><strong aria-hidden="true">{selected.length}</strong><span aria-hidden="true">از ۶ نت</span></p>{!explorationOnly && <button type="button" className="studio-save-top" onClick={() => void save()} disabled={busy || editorLocked}>{busy ? 'در حال ذخیره…' : savedId ? 'ذخیره تغییرات' : 'ذخیره مفهوم'}</button>}</div>
      </div>
    </header>

    <div className="container studio-workspace">
      {(guidedImportError || guidedImportState === 'loading' || guidedImportState === 'invalid' || guidedDraftExpired || advisorDraftExpired || (advisorImportLocked && guidedDraft?.origin === 'advisor-fork' && guidedImportState === 'idle')) && <div className={guidedImportState === 'loading' || (advisorImportLocked && guidedDraft?.origin === 'advisor-fork' && guidedImportState === 'idle' && !advisorDraftExpired) ? 'studio-global-notice' : 'studio-global-error'} role={guidedImportState === 'loading' || (advisorImportLocked && guidedDraft?.origin === 'advisor-fork' && guidedImportState === 'idle' && !advisorDraftExpired) ? 'status' : 'alert'}>
        <p>{guidedImportState === 'loading' ? 'پیش‌نویس در حال بررسی با کاتالوگ فعلی است…' : advisorImportLocked && guidedDraft?.origin === 'advisor-fork' && guidedImportState === 'idle' && !advisorDraftExpired ? 'پیش‌نویس مستقل در حال بررسی است؛ تا تأیید کامل کاتالوگ، ترکیب و ذخیره مسدود می‌ماند.' : advisorDraftExpired ? 'انتقال نسخهٔ مستقل در حافظهٔ این برگه پیدا نشد یا با این نشانی هم‌خوان نیست؛ احتمالاً صفحه تازه‌سازی شده است. مفهوم ذخیره‌شده حذف نشده است.' : guidedDraftExpired ? 'پیش‌نویس انتقال در حافظه پیدا نشد؛ احتمالاً صفحه تازه‌سازی شده است. پیشنهاد را دوباره بسازید.' : guidedImportError}</p>
        {guidedImportState === 'error' && guidedDraft && (!fromAdvisor || (guidedDraft.origin === 'advisor-fork' && navigationIntentId === guidedDraft.transferId && isCurrentStudioDraft(guidedDraft.transferId))) && <button type="button" onClick={() => void inspectGuidedDraft(fromGuided)} disabled={busy}>تلاش دوباره برای دریافت نت‌ها</button>}
        {advisorImportLocked && <button type="button" className="guided-button-secondary" onClick={leaveUnresolvedAdvisorTransfer}>ترک انتقال و شروع استودیوی تازه</button>}
        {(guidedImportState === 'expired' || guidedDraftExpired) && <Link href="/studio/guided">بازگشت به استودیوی هدایت‌شده</Link>}
      </div>}
      {guidedDraft?.origin !== 'advisor-fork' && guidedDraft && (!fromGuided || Boolean(conceptId)) && !savedConceptLoadFailed && (!conceptId || savedConceptLoaded) && <div className="studio-global-notice" role="status">
        <p>یک پیش‌نویس ذخیره‌نشده از استودیوی هدایت‌شده در همین برگه آماده است.</p>
        <button type="button" onClick={() => void inspectGuidedDraft(true)} disabled={guidedImportState === 'loading'}>{guidedImportState === 'loading' ? 'در حال بررسی…' : 'بارگذاری پیش‌نویس هدایت‌شده'}</button>
      </div>}
      {conceptId && savedConceptLoadFailed && guidedDraft && <p className="studio-global-notice" role="status">{guidedDraft.origin === 'advisor-fork' ? 'نسخهٔ مستقل در حافظه حفظ شده است؛ بارگذاری ناموفق مفهوم ذخیره‌شده باعث جایگزینی یا حذف آن نمی‌شود.' : 'پیش‌نویس هدایت‌شده حفظ شده است؛ ابتدا مفهوم ذخیره‌شده را دوباره بارگذاری کنید.'}</p>}
      {conceptId && savedConceptLoaded && guidedDraft?.origin === 'advisor-fork' && <p className="studio-global-notice" role="status">مفهوم ذخیره‌شدهٔ این نشانی اولویت دارد؛ نسخهٔ مستقل در حافظه محفوظ است و تا جداشدن صریح نشانی بارگذاری نمی‌شود.</p>}
      {conceptId && !savedConceptLoaded && !savedConceptLoadFailed && (authLoading || user) && <p className="studio-global-notice" role="status">{authLoading ? 'در حال بررسی نشست و بارگذاری مفهوم ذخیره‌شده…' : 'در حال بارگذاری کامل مفهوم ذخیره‌شده…'}</p>}
      {conceptId && !savedConceptLoaded && !savedConceptLoadFailed && !authLoading && !user && <div className="studio-global-error" role="alert"><p>برای بارگذاری کامل این مفهوم ذخیره‌شده وارد حساب خود شوید. ترکیب تا آن زمان قابل ویرایش یا ذخیره نیست.</p><Link href="/login">ورود برای بارگذاری مفهوم</Link></div>}
      <nav className="studio-mobile-tabs" role="tablist" aria-label="گام‌های استودیو">
        {tabs.map((label, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`studio-panel-${index}`} id={`studio-tab-${index}`} tabIndex={tab === index ? 0 : -1} key={label}
          onKeyDown={event => {
            const next = event.key === 'ArrowLeft' ? (index + 1) % 3 : event.key === 'ArrowRight' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
            if (next !== null) { event.preventDefault(); setTab(next); event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus(); }
          }} onClick={() => setTab(index)}><span className="studio-tab-number" aria-hidden="true">{tabNumbers[index]}</span>{label}{index === 0 && <span className="studio-tab-count" aria-label={`${selected.length} از ۶ نت`}>{selected.length.toLocaleString('fa-IR')}/۶</span>}</button>)}
      </nav>

      {notice && <p role="status" className="studio-global-notice">{notice}</p>}
      {error && <div role="alert" className="studio-global-error"><p>{error}</p>{conceptId && savedConceptLoadFailed && <button type="button" className="guided-button-secondary" onClick={retrySavedConceptLoad} disabled={busy}>تلاش دوباره برای بارگذاری مفهوم</button>}</div>}

      <div className="studio-grid" inert={editorLocked} aria-busy={Boolean(editorLocked || guidedImportState === 'loading')}>
        <NoteLibrary notes={notes} families={families} selectedIds={selectedIds} count={selected.length} query={query} familyId={family} loading={loading} noteError={noteError} familyError={familyError} hasMore={hasMore} active={tab === 0}
          onQuery={updateQuery} onFamily={updateFamily} onSelect={select} onRetry={() => void loadNotes(failedOffset)} onRetryFamilies={loadFamilies} onMore={() => void loadNotes(offset)} onContinue={() => setTab(1)} />
        <CompositionWorkspace selected={selected} name={name} active={tab === 1} onName={changeName}
          onLayer={(id, layer) => changeSelected(current => moveNote(current, id, layer))}
          onRemove={id => { changeSelected(current => current.filter(item => item.note.id !== id)); setNotice(''); }}
          onReorder={(id, direction) => changeSelected(current => reorder(current, id, direction))}
          advisor={<BlendAdvisor result={advisorResult} loading={advisorLoading} accepted={advisorAccepted} canUndo={Boolean(advisorUndo)} busy={busy || advisorForkBusy}
            applyBlockedMessage={advisorApplyBlock} forkBlockedMessage={advisorForkBlock} requestBlockedMessage={advisorRequestBlock}
            allowFork={authEnabled} onRequest={() => void requestAdvisor()} onApply={applyAdvisorSuggestion} onFork={openAdvisorForkConfirmation} onReject={rejectAdvisorSuggestion} onUndo={undoAdvisorSuggestion} />} />
        <ConceptPreview selected={selected} families={families} name={name} active={tab === 2} busy={busy || editorLocked} saved={Boolean(savedId)} onSave={() => void save()} allowSaving={authEnabled} />
      </div>
    </div>

    {authEnabled && loginOpen && <Dialog title="ورود برای ذخیره" onClose={() => setLoginOpen(false)}><LoginForm onSuccess={() => { setLoginOpen(false); setNotice('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.'); }} /></Dialog>}
    {authEnabled && advisorForkOpen && <Dialog title="ساخت نسخهٔ مستقل" onClose={() => { setAdvisorForkOpen(false); setAdvisorForkError(''); }}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">یک نسخهٔ جداگانه بسازیم؟</h2>
        <p>ترکیب پیشنهادی در یک پیش‌نویس مستقل باز می‌شود و مفهوم ذخیره‌شدهٔ فعلی بدون تغییر می‌ماند.</p>
        <p>نسخهٔ تازه خودکار ذخیره نمی‌شود؛ می‌توانید پیش از ذخیره آن را ویرایش کنید. بازگشت به ترکیب قبلی در این انتقال در دسترس نیست.</p>
        {advisorForkError && <p role="alert" className="studio-global-error">{advisorForkError}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="guided-button-secondary" onClick={() => { setAdvisorForkOpen(false); setAdvisorForkError(''); }}>انصراف</button>
          <button type="button" className="guided-button-primary" onClick={confirmAdvisorFork} disabled={busy || advisorForkBusy || Boolean(advisorForkBlock)}>ساخت نسخهٔ مستقل</button>
        </div>
      </div>
    </Dialog>}
    {guidedCandidate && guidedCandidate.routeIntent === routeIntent && confirmPartialGuided && partialConfirmationRoute === routeIntent && guidedCandidate.resolution.status === 'missing' && <Dialog title="بخشی از نت‌ها در دسترس نیست" onClose={() => setConfirmPartialGuided(false)}>
      <div className="space-y-4"><h2 className="text-xl font-semibold">پیشنهاد کامل وارد نمی‌شود</h2><p>{guidedCandidate.resolution.missingIds.length} نت در کاتالوگ فعلی پیدا نشد. فقط با تأیید شما نت‌های موجود وارد خواهند شد.</p><ul className="list-disc space-y-1 ps-6">{guidedCandidate.resolution.missingIds.map(id => <li key={id} dir="ltr">…{id.slice(-8)}</li>)}</ul><div className="flex flex-wrap gap-3"><button type="button" className="guided-button-secondary" onClick={() => setConfirmPartialGuided(false)}>حفظ پیش‌نویس</button><Link className="guided-button-secondary" href="/studio/guided">بازگشت برای بازبینی</Link><button type="button" className="guided-button-primary" disabled={!guidedCandidate.resolution.selected.length} onClick={() => { setConfirmPartialGuided(false); if (selected.length || savedId) { setReplaceConfirmationRoute(routeIntent); setConfirmGuidedReplace(true); } else commitGuidedDraft(guidedCandidate.id, guidedCandidate.resolution as Extract<DraftResolution, { status: 'missing' }>); }}>ادامه با نت‌های موجود</button></div></div>
    </Dialog>}
    {guidedCandidate && guidedCandidate.routeIntent === routeIntent && confirmGuidedReplace && replaceConfirmationRoute === routeIntent && <Dialog title="جایگزینی ترکیب فعلی" onClose={() => setConfirmGuidedReplace(false)}>
      <div className="space-y-4"><h2 className="text-xl font-semibold">ترکیب فعلی جایگزین شود؟</h2><p>با تأیید، مفهوم ذخیره‌شده از نشانی ویرایش جدا می‌شود و پیشنهاد هدایت‌شده در یک پیش‌نویس تازه بارگذاری خواهد شد. مفهوم قبلی بدون تغییر می‌ماند.</p><div className="flex flex-wrap gap-3"><button type="button" className="guided-button-secondary" onClick={() => setConfirmGuidedReplace(false)}>بازگشت</button><button type="button" className="guided-button-primary" onClick={confirmReplaceWithGuidedDraft} disabled={busy}>جایگزینی و بارگذاری</button></div></div>
    </Dialog>}
    {authEnabled && savedId && <div className="studio-saved-link"><Link href="/account">مفاهیم ذخیره‌شده</Link></div>}
  </div>;
}
