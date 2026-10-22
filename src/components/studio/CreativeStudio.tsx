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

export function CreativeStudio({ conceptId, fromGuided = false }: { conceptId?: string; fromGuided?: boolean }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { pending: guidedDraft, navigationIntentId, isCurrent: isCurrentGuidedDraft, consume: consumeGuidedDraft } = useStudioDraft();
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
  const [savedId, setSavedId] = useState('');
  const [advisorResult, setAdvisorResult] = useState<AdvisorResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorAccepted, setAdvisorAccepted] = useState(false);
  const [advisorUndo, setAdvisorUndo] = useState<{ name: string; selected: SelectedNote[]; identity: string; routeIntent: string; appliedRevision: number } | null>(null);
  const noteRequest = useRef(0);
  const savingRef = useRef(false);
  const busyRef = useRef(false);
  const advisorRequest = useRef(0);
  const advisorCatalog = useRef<AdvisorCatalog | null>(null);
  const advisorResultRef = useRef<AdvisorResult | null>(null);
  const nameRef = useRef(name);
  const selectedRef = useRef(selected);
  const savedIdRef = useRef(savedId);
  const revisionRef = useRef(0);
  const identitySequence = useRef(0);
  const compositionIdentityRef = useRef('creative-composition-0');
  const importRequest = useRef(0);
  const routeIntent = `${router.bfcacheId}|${conceptId ?? ''}|${fromGuided ? 'guided' : 'ordinary'}`;
  const advisorRouteRef = useRef(routeIntent);
  const routeIntentRef = useRef(routeIntent);
  routeIntentRef.current = routeIntent;
  nameRef.current = name;
  selectedRef.current = selected;
  savedIdRef.current = savedId;
  const initializedTransferIds = useRef(new Set<string>());
  const importedInThisMount = useRef(false);
  const savedConceptLoaded = !conceptId || loadedConceptId === conceptId;
  const savedConceptLoadFailed = Boolean(conceptId && failedConceptId === conceptId);
  const guidedDraftExpired = Boolean(fromGuided && !conceptId && !importedInThisMount.current && (!guidedDraft || navigationIntentId !== guidedDraft.transferId));
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
    if (nameRef.current === value) return;
    nameRef.current = value;
    revisionRef.current += 1;
    invalidateAdvisor();
    setName(value);
  };
  const changeSelected = (update: SelectedNote[] | ((current: SelectedNote[]) => SelectedNote[])) => {
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
  const advisorSourceIsCurrent = (snapshot: CompositionSnapshot, requestId: number) =>
    requestId === advisorRequest.current
    && revisionRef.current === snapshot.revision
    && compositionIdentityRef.current === snapshot.compositionIdentity
    && routeIntentRef.current === snapshot.routeIntent
    && (savedIdRef.current || null) === snapshot.saveTargetId
    && !savingRef.current;

  const requestAdvisor = async () => {
    if (busy || savingRef.current || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))) return;
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
    if (!result || result.status !== 'suggestion' || busy || savingRef.current) return;
    if (savedIdRef.current || (conceptId && (!savedConceptLoaded || savedConceptLoadFailed))) return;
    const source = result.suggestion;
    const liveSnapshot = makeAdvisorSnapshot();
    if (liveSnapshot.revision !== source.sourceRevision
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
    ? 'برای حفظ مفهوم ذخیره‌شده، ساخت نسخهٔ مستقل در مرحلهٔ بعد فعال می‌شود؛ مفهوم اصلی تغییر نمی‌کند.'
    : conceptId && (!savedConceptLoaded || savedConceptLoadFailed)
      ? 'تا پایان بارگذاری مفهوم ذخیره‌شده، امکان اعمال پیشنهاد وجود ندارد.'
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
    if (!conceptId || authLoading || !user) return;
    const savedRouteIntent = routeIntentRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const concept = await concepts.get(conceptId);
        let all: Note[] = [];
        let page = 0;
        for (;;) {
          const chunk = await catalog.notes({ limit: 100, offset: page });
          if (cancelled || routeIntentRef.current !== savedRouteIntent) return;
          all = [...all, ...chunk];
          if (chunk.length < 100) break;
          page += 100;
        }
        if (cancelled || routeIntentRef.current !== savedRouteIntent) return;
        const loadedSelection = [...concept.notes]
          .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer) || a.position - b.position)
          .flatMap(item => {
            const note = all.find(candidate => candidate.id === item.note_id);
            return note ? [{ note, layer: item.layer }] : [];
          });
        replaceComposition(concept.name, loadedSelection);
        changeSavedTarget(concept.id);
        setLoadedConceptId(conceptId);
        setFailedConceptId(null);
      } catch (cause) {
        if (!cancelled && routeIntentRef.current === savedRouteIntent) {
          setError(cause instanceof ApiError ? cause.message : 'بارگذاری مفهوم انجام نشد.');
          setFailedConceptId(conceptId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [conceptId, authLoading, user, replaceComposition, changeSavedTarget]);

  const commitGuidedDraft = (transferId: string, resolution: Extract<DraftResolution, { status: 'ready' | 'missing' }>) => {
    if (!isCurrentGuidedDraft(transferId) || initializedTransferIds.current.has(transferId) || conceptId) return;
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
    replaceComposition(resolution.name, [...resolution.selected]);
    changeSavedTarget('');
    setTab(1);
    setError('');
    setNotice(resolution.status === 'missing'
      ? `${resolution.selected.length} نت موجود وارد شد؛ ${resolution.missingIds.length} نت دیگر در کاتالوگ نیست و وارد نشد.`
      : 'پیشنهاد استودیوی هدایت‌شده برای ویرایش وارد شد.');
    initializedTransferIds.current.add(transferId);
    importedInThisMount.current = true;
    consumeGuidedDraft(transferId);
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
    if (conceptId && (savedConceptLoadFailed || !savedConceptLoaded)) return;
    if (initializedTransferIds.current.has(guidedDraft.transferId)) return;
    const requestRouteIntent = routeIntentRef.current;
    const requestId = ++importRequest.current;
    setGuidedImportState('loading');
    setGuidedImportError('');
    try {
      const all: Note[] = [];
      let offset = 0;
      for (;;) {
        const page = await catalog.notes({ limit: 100, offset });
        if (requestId !== importRequest.current || routeIntentRef.current !== requestRouteIntent) return;
        all.push(...page);
        if (page.length < 100) break;
        offset += page.length;
      }
      const resolution = resolveStudioDraft(guidedDraft, all);
      if (requestId !== importRequest.current || routeIntentRef.current !== requestRouteIntent || !isCurrentGuidedDraft(guidedDraft.transferId)) return;
      if (resolution.status === 'invalid') {
        setGuidedImportState('invalid');
        setGuidedImportError(`${resolution.reason} پیش‌نویس حفظ شده است.`);
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
      setGuidedImportError(cause instanceof ApiError ? cause.message : 'دریافت کاتالوگ برای انتقال انجام نشد. پیش‌نویس حفظ شده است.');
    }
  };

  useEffect(() => {
    importRequest.current += 1;
  }, [routeIntent]);

  useEffect(() => {
    if (advisorRouteRef.current === routeIntent) return;
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
  }, [routeIntent]);
  useEffect(() => () => { advisorRequest.current += 1; }, []);

  useEffect(() => {
    if (conceptId || !fromGuided) return;
    if (importedInThisMount.current) return;
    if (!guidedDraft || navigationIntentId !== guidedDraft.transferId) return;
    const timer = window.setTimeout(() => { void inspectGuidedDraft(false); }, 0);
    return () => { window.clearTimeout(timer); importRequest.current += 1; };
    // The route marker is only an intent hint; transfer data is read from the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, fromGuided, guidedDraft?.transferId, navigationIntentId]);

  const select = (note: Note) => {
    if (selected.length >= 6 && !selectedIds.has(note.id)) {
      setNotice('برای افزودن نت تازه، یکی را از ترکیب بردارید.');
      setTab(1);
      return;
    }
    changeSelected(current => addNote(current, note));
    setNotice('');
  };

  const save = async () => {
    if (savingRef.current) return;
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
    if (!guidedCandidate || guidedCandidate.routeIntent !== routeIntentRef.current || !isCurrentGuidedDraft(guidedCandidate.id)) return;
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

  return <div className="studio-page">
    <header className="studio-intro">
      <div className="container studio-intro-inner">
        <div><p className="eyebrow">AROMAN · کارگاه ساخت رایحه</p><h1>روایت رایحه‌ی شما</h1><p>نت‌ها را برگزینید، در سه لایه بچینید و حال‌وهوای مفهوم خود را تماشا کنید.</p></div>
        <div className="studio-intro-actions"><p className="studio-count-badge" role="status" aria-live="polite" aria-label={`${selected.length} از ۶ نت انتخاب شده`}><strong aria-hidden="true">{selected.length}</strong><span aria-hidden="true">از ۶ نت</span></p><button type="button" className="studio-save-top" onClick={() => void save()} disabled={busy}>{busy ? 'در حال ذخیره…' : savedId ? 'ذخیره تغییرات' : 'ذخیره مفهوم'}</button></div>
      </div>
    </header>

    <div className="container studio-workspace">
      {(guidedImportError || guidedImportState === 'loading' || guidedDraftExpired) && <div className={guidedImportState === 'loading' ? 'studio-global-notice' : 'studio-global-error'} role={guidedImportState === 'loading' ? 'status' : 'alert'}>
        <p>{guidedImportState === 'loading' ? 'پیش‌نویس در حال بررسی با کاتالوگ فعلی است…' : guidedDraftExpired ? 'پیش‌نویس انتقال در حافظه پیدا نشد؛ احتمالاً صفحه تازه‌سازی شده است. پیشنهاد را دوباره بسازید.' : guidedImportError}</p>
        {guidedImportState === 'error' && guidedDraft && <button type="button" onClick={() => void inspectGuidedDraft(fromGuided)} disabled={busy}>تلاش دوباره برای دریافت نت‌ها</button>}
        {(guidedImportState === 'expired' || guidedDraftExpired) && <Link href="/studio/guided">بازگشت به استودیوی هدایت‌شده</Link>}
      </div>}
      {guidedDraft && (!fromGuided || Boolean(conceptId)) && !savedConceptLoadFailed && (!conceptId || savedConceptLoaded) && <div className="studio-global-notice" role="status">
        <p>یک پیش‌نویس ذخیره‌نشده از استودیوی هدایت‌شده در همین برگه آماده است.</p>
        <button type="button" onClick={() => void inspectGuidedDraft(true)} disabled={guidedImportState === 'loading'}>{guidedImportState === 'loading' ? 'در حال بررسی…' : 'بارگذاری پیش‌نویس هدایت‌شده'}</button>
      </div>}
      {conceptId && savedConceptLoadFailed && guidedDraft && <p className="studio-global-notice" role="status">پیش‌نویس هدایت‌شده حفظ شده است؛ ابتدا مفهوم ذخیره‌شده را دوباره بارگذاری کنید.</p>}
      <nav className="studio-mobile-tabs" role="tablist" aria-label="گام‌های استودیو">
        {tabs.map((label, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`studio-panel-${index}`} id={`studio-tab-${index}`} tabIndex={tab === index ? 0 : -1} key={label}
          onKeyDown={event => {
            const next = event.key === 'ArrowLeft' ? (index + 1) % 3 : event.key === 'ArrowRight' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
            if (next !== null) { event.preventDefault(); setTab(next); event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus(); }
          }} onClick={() => setTab(index)}><span className="studio-tab-number" aria-hidden="true">{tabNumbers[index]}</span>{label}{index === 0 && <span className="studio-tab-count" aria-label={`${selected.length} از ۶ نت`}>{selected.length.toLocaleString('fa-IR')}/۶</span>}</button>)}
      </nav>

      {notice && <p role="status" className="studio-global-notice">{notice}</p>}
      {error && <p role="alert" className="studio-global-error">{error}</p>}

      <div className="studio-grid">
        <NoteLibrary notes={notes} families={families} selectedIds={selectedIds} count={selected.length} query={query} familyId={family} loading={loading} noteError={noteError} familyError={familyError} hasMore={hasMore} active={tab === 0}
          onQuery={updateQuery} onFamily={updateFamily} onSelect={select} onRetry={() => void loadNotes(failedOffset)} onRetryFamilies={loadFamilies} onMore={() => void loadNotes(offset)} onContinue={() => setTab(1)} />
        <CompositionWorkspace selected={selected} name={name} active={tab === 1} onName={changeName}
          onLayer={(id, layer) => changeSelected(current => moveNote(current, id, layer))}
          onRemove={id => { changeSelected(current => current.filter(item => item.note.id !== id)); setNotice(''); }}
          onReorder={(id, direction) => changeSelected(current => reorder(current, id, direction))}
          advisor={<BlendAdvisor result={advisorResult} loading={advisorLoading} accepted={advisorAccepted} canUndo={Boolean(advisorUndo)} busy={busy}
            applyBlockedMessage={advisorApplyBlock} requestBlockedMessage={advisorRequestBlock}
            onRequest={() => void requestAdvisor()} onApply={applyAdvisorSuggestion} onReject={rejectAdvisorSuggestion} onUndo={undoAdvisorSuggestion} />} />
        <ConceptPreview selected={selected} families={families} name={name} active={tab === 2} busy={busy} saved={Boolean(savedId)} onSave={() => void save()} />
      </div>
    </div>

    {loginOpen && <Dialog title="ورود برای ذخیره" onClose={() => setLoginOpen(false)}><LoginForm onSuccess={() => { setLoginOpen(false); setNotice('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.'); }} /></Dialog>}
    {guidedCandidate && guidedCandidate.routeIntent === routeIntent && confirmPartialGuided && partialConfirmationRoute === routeIntent && guidedCandidate.resolution.status === 'missing' && <Dialog title="بخشی از نت‌ها در دسترس نیست" onClose={() => setConfirmPartialGuided(false)}>
      <div className="space-y-4"><h2 className="text-xl font-semibold">پیشنهاد کامل وارد نمی‌شود</h2><p>{guidedCandidate.resolution.missingIds.length} نت در کاتالوگ فعلی پیدا نشد. فقط با تأیید شما نت‌های موجود وارد خواهند شد.</p><ul className="list-disc space-y-1 ps-6">{guidedCandidate.resolution.missingIds.map(id => <li key={id} dir="ltr">…{id.slice(-8)}</li>)}</ul><div className="flex flex-wrap gap-3"><button type="button" className="guided-button-secondary" onClick={() => setConfirmPartialGuided(false)}>حفظ پیش‌نویس</button><Link className="guided-button-secondary" href="/studio/guided">بازگشت برای بازبینی</Link><button type="button" className="guided-button-primary" disabled={!guidedCandidate.resolution.selected.length} onClick={() => { setConfirmPartialGuided(false); if (selected.length || savedId) { setReplaceConfirmationRoute(routeIntent); setConfirmGuidedReplace(true); } else commitGuidedDraft(guidedCandidate.id, guidedCandidate.resolution as Extract<DraftResolution, { status: 'missing' }>); }}>ادامه با نت‌های موجود</button></div></div>
    </Dialog>}
    {guidedCandidate && guidedCandidate.routeIntent === routeIntent && confirmGuidedReplace && replaceConfirmationRoute === routeIntent && <Dialog title="جایگزینی ترکیب فعلی" onClose={() => setConfirmGuidedReplace(false)}>
      <div className="space-y-4"><h2 className="text-xl font-semibold">ترکیب فعلی جایگزین شود؟</h2><p>با تأیید، مفهوم ذخیره‌شده از نشانی ویرایش جدا می‌شود و پیشنهاد هدایت‌شده در یک پیش‌نویس تازه بارگذاری خواهد شد. مفهوم قبلی بدون تغییر می‌ماند.</p><div className="flex flex-wrap gap-3"><button type="button" className="guided-button-secondary" onClick={() => setConfirmGuidedReplace(false)}>بازگشت</button><button type="button" className="guided-button-primary" onClick={confirmReplaceWithGuidedDraft} disabled={busy}>جایگزینی و بارگذاری</button></div></div>
    </Dialog>}
    {savedId && <div className="studio-saved-link"><Link href="/account">مفاهیم ذخیره‌شده</Link></div>}
  </div>;
}
