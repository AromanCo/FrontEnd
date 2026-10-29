'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Concept, Family } from '@/lib/api/client';
import { ApiError, catalog, concepts } from '@/lib/api/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dialog } from '@/components/ui/Dialog';
import { validateConceptName, validateDiscovery, validateFamilyIds, validateFeeling, validateGuidedAnswers, validateNoteAffinity, validateScene, validateTemperature } from '@/lib/studio/guided/answers';
import { DEFAULT_CONCEPT_NAME } from '@/lib/studio/guided/config';
import { recommend } from '@/lib/studio/guided/recommendation';
import { toConceptInput } from '@/lib/studio/guided/payload';
import { useStudioDraft } from '@/lib/studio/draft-transfer';
import type { Feeling, GuidedAnswersDraft, GuidedCatalogNote, NoteAffinityStatus, RecommendationResult, Scene, Temperature } from '@/lib/studio/guided/types';
import { GuidedProgress } from './GuidedProgress';
import { GuidedResult } from './GuidedResult';
import { GuidedReview } from './GuidedReview';
import { GuidedStep } from './GuidedStep';

type LoadState = 'loading' | 'ready' | 'error';
type View = 'questionnaire' | 'result';
type SaveSnapshotState = Readonly<{ status: 'pending' | 'saved' | 'error'; id?: string; message?: string }>;

const stepForField = (field: string): number => {
  if (field === 'familyIds') return 1;
  if (field === 'temperature') return 2;
  if (field === 'scene') return 3;
  if (field.toLowerCase().includes('note')) return 4;
  if (field === 'discovery' || field === 'conceptName') return 5;
  return 0;
};

export function GuidedStudio() {
  const router = useRouter();
  const { user, loading: authLoading, authEnabled } = useAuth();
  const { pending: pendingTransfer, createDraft } = useStudioDraft();
  const [families, setFamilies] = useState<Family[]>([]);
  const [notes, setNotes] = useState<GuidedCatalogNote[]>([]);
  const [familyState, setFamilyState] = useState<LoadState>('loading');
  const [noteState, setNoteState] = useState<LoadState>('loading');
  const [familyError, setFamilyError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [answers, setAnswers] = useState<GuidedAnswersDraft>({});
  const [conceptName, setConceptName] = useState(DEFAULT_CONCEPT_NAME);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View>('questionnaire');
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [stepError, setStepError] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [replaceTransferOpen, setReplaceTransferOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, SaveSnapshotState>>({});
  const [authSaveMessage, setAuthSaveMessage] = useState('');
  const restartOpener = useRef<HTMLElement | null>(null);
  const restoreFocusAfterRestartClose = useRef(false);
  const restartDialog = useRef<HTMLElement | null>(null);
  const cancelRestartButton = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(false);
  const familyRequest = useRef(0);
  const noteRequest = useRef(0);
  const inFlightSaveKeys = useRef(new Set<string>());
  const saveStatesRef = useRef<Record<string, SaveSnapshotState>>({});
  const navigatingRef = useRef(false);

  const readyRecommendation = recommendation?.status === 'ready' ? recommendation : null;
  const resultName = validateConceptName(conceptName).value ?? DEFAULT_CONCEPT_NAME;
  const resultSnapshotKey = readyRecommendation
    ? JSON.stringify({ name: resultName, notes: readyRecommendation.selections.map(item => [item.note.id, item.layer, item.position]) })
    : '';
  const currentSaveState = resultSnapshotKey ? saveStates[resultSnapshotKey] : undefined;
  const isCurrentResultSaved = currentSaveState?.status === 'saved';
  const saveBusy = currentSaveState?.status === 'pending';
  const saveMessage = currentSaveState?.status === 'saved'
    ? 'مفهوم رایحهٔ شما ذخیره شد.'
    : authSaveMessage;
  const saveError = currentSaveState?.status === 'error' ? currentSaveState.message ?? 'ذخیره انجام نشد.' : '';
  const updateSaveState = (key: string, value: SaveSnapshotState) => {
    saveStatesRef.current = { ...saveStatesRef.current, [key]: value };
    if (mounted.current) setSaveStates(saveStatesRef.current);
  };
  const closeLogin = useCallback(() => setLoginOpen(false), []);
  const loginSucceeded = useCallback(() => {
    setLoginOpen(false);
    setAuthSaveMessage('وارد شدید. برای ذخیرهٔ این پیشنهاد، دوباره دکمهٔ ذخیره را بزنید.');
  }, []);

  const saveResult = async () => {
    if (!authEnabled) return;
    const submittedSnapshotKey = resultSnapshotKey;
    if (!readyRecommendation || !submittedSnapshotKey || inFlightSaveKeys.current.has(submittedSnapshotKey)) return;
    if (saveStatesRef.current[submittedSnapshotKey]?.status === 'saved') return;
    setAuthSaveMessage('');
    if (authLoading) {
      setAuthSaveMessage('در حال بررسی وضعیت ورود هستیم. کمی بعد دوباره ذخیره را بزنید.');
      return;
    }
    if (!user) {
      setLoginOpen(true);
      setAuthSaveMessage('برای ذخیره وارد شوید؛ پیشنهاد شما تا پایان این صفحه حفظ می‌شود.');
      return;
    }
    const currentNoteIds = new Set(notes.map(note => note.id.toLowerCase()));
    if (readyRecommendation.selections.some(item => !currentNoteIds.has(item.note.id.toLowerCase()))) {
      updateSaveState(submittedSnapshotKey, { status: 'error', message: 'یکی از نت‌های پیشنهاد دیگر در کاتالوگ فعلی نیست. نت‌ها را دوباره دریافت یا پیشنهاد را بازبینی کنید.' });
      return;
    }
    const converted = toConceptInput(readyRecommendation, conceptName, notes);
    if (converted.status !== 'ready') {
      updateSaveState(submittedSnapshotKey, { status: 'error', message: converted.issues[0]?.message ?? 'پیشنهاد فعلی برای ذخیره آماده نیست.' });
      return;
    }
    inFlightSaveKeys.current.add(submittedSnapshotKey);
    updateSaveState(submittedSnapshotKey, { status: 'pending' });
    try {
      const saved: Concept = await concepts.create(converted.payload);
      updateSaveState(submittedSnapshotKey, { status: 'saved', id: saved.id });
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setLoginOpen(true);
        updateSaveState(submittedSnapshotKey, { status: 'error', message: 'نشست شما پایان یافته است. دوباره وارد شوید و سپس ذخیره را دوباره بزنید.' });
      } else if (cause instanceof ApiError && cause.status === 422) {
        updateSaveState(submittedSnapshotKey, { status: 'error', message: 'کاتالوگ یا جایگاه یکی از نت‌ها تغییر کرده است. پیشنهاد را بازبینی کنید و دوباره تلاش کنید.' });
      } else {
        updateSaveState(submittedSnapshotKey, { status: 'error', message: cause instanceof ApiError ? cause.message : 'ذخیره انجام نشد؛ پیشنهاد شما همچنان در همین صفحه حفظ شده است.' });
      }
    } finally {
      inFlightSaveKeys.current.delete(submittedSnapshotKey);
    }
  };

  const navigateWithDraft = () => {
    if (!readyRecommendation || navigatingRef.current) return;
    navigatingRef.current = true;
    setTransferBusy(true);
    const transfer = createDraft(resultName, readyRecommendation.selections.map(item => ({
      noteId: item.note.id,
      layer: item.layer,
      position: item.position,
    })));
    if (!transfer.transferId) {
      navigatingRef.current = false;
      setTransferBusy(false);
      return;
    }
    router.push('/studio/creative?from=guided');
  };

  const openRestart = useCallback(() => {
    restartOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restoreFocusAfterRestartClose.current = false;
    setConfirmRestart(true);
  }, []);

  const cancelRestart = useCallback(() => {
    restoreFocusAfterRestartClose.current = true;
    setConfirmRestart(false);
  }, []);

  const loadFamilies = useCallback(async () => {
    const requestId = ++familyRequest.current;
    setFamilyState('loading');
    setFamilyError('');
    try {
      const all: Family[] = [];
      let offset = 0;
      for (;;) {
        const page = await catalog.families('', 100, offset);
        if (!mounted.current || requestId !== familyRequest.current) return;
        all.push(...page);
        if (page.length < 100) break;
        offset += page.length;
      }
      if (!mounted.current || requestId !== familyRequest.current) return;
      setFamilies(all);
      setFamilyState('ready');
    } catch {
      if (!mounted.current || requestId !== familyRequest.current) return;
      setFamilyError('دریافت خانواده‌های رایحه انجام نشد. اتصال را بررسی و دوباره تلاش کنید.');
      setFamilyState('error');
    }
  }, []);

  const loadNotes = useCallback(async () => {
    const requestId = ++noteRequest.current;
    setNoteState('loading');
    setNoteError('');
    try {
      const all: GuidedCatalogNote[] = [];
      let offset = 0;
      for (;;) {
        const page = await catalog.notes({ limit: 100, offset });
        if (!mounted.current || requestId !== noteRequest.current) return;
        all.push(...page as GuidedCatalogNote[]);
        if (page.length < 100) break;
        offset += page.length;
      }
      if (!mounted.current || requestId !== noteRequest.current) return;
      setNotes(all);
      setNoteState('ready');
    } catch {
      if (!mounted.current || requestId !== noteRequest.current) return;
      setNoteError('دریافت نت‌ها انجام نشد. اتصال را بررسی و دوباره تلاش کنید.');
      setNoteState('error');
    }
  }, []);

  const invalidatePendingRequests = useCallback(() => {
    familyRequest.current += 1;
    noteRequest.current += 1;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadFamilies();
      void loadNotes();
    });
    return () => {
      active = false;
      mounted.current = false;
      invalidatePendingRequests();
    };
  }, [invalidatePendingRequests, loadFamilies, loadNotes]);

  useEffect(() => {
    const heading = document.getElementById(view === 'result' ? 'guided-result-heading' : 'guided-step-heading');
    heading?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (window.scrollY > 0) window.scrollTo?.({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [step, view]);

  useEffect(() => {
    if (!confirmRestart) {
      if (restoreFocusAfterRestartClose.current) {
        restartOpener.current?.focus();
        restoreFocusAfterRestartClose.current = false;
      }
      return;
    }

    const dialog = restartDialog.current;
    const getControls = () => dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')] : [];
    cancelRestartButton.current?.focus();
    const keepFocusInside = (event: FocusEvent) => {
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) cancelRestartButton.current?.focus();
    };
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRestart();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = getControls();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last || !dialog) return;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('focusin', keepFocusInside);
    window.addEventListener('keydown', handleKeys);
    return () => {
      document.removeEventListener('focusin', keepFocusInside);
      window.removeEventListener('keydown', handleKeys);
    };
  }, [cancelRestart, confirmRestart]);

  const setAnswer = useCallback((key: keyof GuidedAnswersDraft, value: unknown) => {
    setAnswers(current => ({ ...current, [key]: value }));
    setStepError('');
    setFeedback('');
    setRecommendation(null);
  }, []);

  const familyIds = Array.isArray(answers.familyIds) ? answers.familyIds as string[] : [];
  const likedNoteIds = Array.isArray(answers.likedNoteIds) ? answers.likedNoteIds as string[] : [];
  const avoidedNoteIds = Array.isArray(answers.avoidedNoteIds) ? answers.avoidedNoteIds as string[] : [];
  const noteAffinityStatus = answers.noteAffinityStatus as NoteAffinityStatus | undefined;
  const familyIdSet = useMemo(() => new Set(families.map(family => family.id.toLowerCase())), [families]);
  const staleFamilyIds = familyState === 'ready' ? familyIds.filter(id => !familyIdSet.has(id.toLowerCase())) : [];
  const staleLikedIds = noteState === 'ready' ? likedNoteIds.filter(id => !notes.some(note => note.id.toLowerCase() === id.toLowerCase())) : [];
  const staleAvoidedIds = noteState === 'ready' ? avoidedNoteIds.filter(id => !notes.some(note => note.id.toLowerCase() === id.toLowerCase())) : [];

  const familySelection = (id: string) => {
    if (familyIds.includes(id)) {
      setAnswer('familyIds', familyIds.filter(selected => selected !== id));
      return;
    }
    if (familyIds.length >= 2) {
      setFeedback('برای دقیق‌تر شدن پیشنهاد، حداکثر دو خانواده انتخاب کنید.');
      return;
    }
    setAnswer('familyIds', [...familyIds, id]);
  };

  const toggleNote = (id: string, group: 'liked' | 'avoided') => {
    const target = group === 'liked' ? likedNoteIds : avoidedNoteIds;
    const other = group === 'liked' ? avoidedNoteIds : likedNoteIds;
    if (target.includes(id)) return;
    if (target.length >= 3) {
      setFeedback('در هر فهرست حداکثر سه نت می‌توانید انتخاب کنید.');
      return;
    }
    setAnswers(current => ({
      ...current,
      likedNoteIds: group === 'liked' ? [...likedNoteIds, id] : likedNoteIds.filter(value => value !== id),
      avoidedNoteIds: group === 'avoided' ? [...avoidedNoteIds, id] : avoidedNoteIds.filter(value => value !== id),
      noteAffinityStatus: 'selected',
    }));
    setRecommendation(null);
    setFeedback(other.includes(id) ? `نت به فهرست «${group === 'liked' ? 'دوست دارم' : 'ترجیح می‌دهم نباشد'}» منتقل شد.` : 'انتخاب شما ثبت شد.');
  };

  const removeNote = (group: 'liked' | 'avoided', id: string) => {
    setAnswers(current => ({
      ...current,
      likedNoteIds: group === 'liked' ? likedNoteIds.filter(value => value !== id) : likedNoteIds,
      avoidedNoteIds: group === 'avoided' ? avoidedNoteIds.filter(value => value !== id) : avoidedNoteIds,
    }));
    setRecommendation(null);
  };

  const skipNotes = () => {
    setAnswers(current => ({ ...current, likedNoteIds: [], avoidedNoteIds: [], noteAffinityStatus: 'skipped' }));
    setRecommendation(null);
    setStepError('');
    setFeedback('این مرحله رد شد؛ در صورت تمایل بعداً می‌توانید انتخاب‌های نت را اضافه کنید.');
  };

  const stepValidation = (): { valid: boolean; message: string } => {
    if (step === 0) {
      const checked = validateFeeling(answers.feeling);
      return { valid: checked.valid, message: checked.issues[0]?.message ?? 'یک حال‌وهوا را انتخاب کنید تا ادامه دهیم.' };
    }
    if (step === 1) {
      if (familyState !== 'ready') return { valid: false, message: 'برای ادامه، دریافت خانواده‌های رایحه را کامل کنید.' };
      if (!families.length) return { valid: false, message: 'تا زمانی که خانواده‌ای در کاتالوگ نیست، پیشنهاد هدایت‌شده ساخته نمی‌شود.' };
      const checked = validateFamilyIds(answers.familyIds, families);
      return { valid: checked.valid && staleFamilyIds.length === 0, message: checked.issues[0]?.message ?? 'یک یا دو خانواده را انتخاب کنید.' };
    }
    if (step === 2) {
      const checked = validateTemperature(answers.temperature);
      return { valid: checked.valid, message: checked.issues[0]?.message ?? 'یکی از سه حال‌وهوا را انتخاب کنید.' };
    }
    if (step === 3) {
      const checked = validateScene(answers.scene);
      return { valid: checked.valid, message: checked.issues[0]?.message ?? 'یک تصویر را انتخاب کنید تا ادامه دهیم.' };
    }
    if (step === 4) {
      if (noteState !== 'ready') return { valid: false, message: 'برای ادامه، دریافت کاتالوگ نت‌ها را کامل کنید یا دوباره تلاش کنید.' };
      const checked = validateNoteAffinity(noteAffinityStatus, answers.likedNoteIds, answers.avoidedNoteIds, notes);
      return { valid: checked.valid, message: checked.issues[0]?.message ?? 'یک نت انتخاب کنید یا گزینهٔ رد این مرحله را بزنید.' };
    }
    const discovery = validateDiscovery(answers.discovery);
    const name = validateConceptName(conceptName);
    return { valid: discovery.valid && name.valid, message: name.issues[0]?.message ?? discovery.issues[0]?.message ?? 'میزان کشف را انتخاب کنید.' };
  };

  const continueStep = () => {
    const validation = stepValidation();
    if (!validation.valid) {
      setStepError(validation.message);
      return;
    }
    setStepError('');
    setFeedback('');
    if (step < 5) {
      setStep(current => current + 1);
      return;
    }

    if (familyState !== 'ready' || noteState !== 'ready') {
      setStepError('برای ساخت پیشنهاد، دریافت خانواده‌ها و نت‌ها را کامل کنید.');
      return;
    }
    const validated = validateGuidedAnswers(answers, families, notes);
    const nameValidation = validateConceptName(conceptName);
    if (!validated.valid || !validated.value) {
      const issue = validated.issues[0];
      setStep(stepForField(issue?.field ?? 'answers'));
      setStepError(issue?.message ?? 'پاسخ‌ها کامل نیستند؛ انتخاب‌ها را بازبینی کنید.');
      return;
    }
    if (!nameValidation.valid || !nameValidation.value) {
      setStepError(nameValidation.issues[0]?.message ?? 'نام مفهوم را بازبینی کنید.');
      return;
    }
    const result = recommend(validated.value, families, notes);
    setRecommendation(result);
    setAuthSaveMessage('');
    setView('result');
  };

  const continueToCreative = () => {
    if (pendingTransfer) setReplaceTransferOpen(true);
    else navigateWithDraft();
  };

  const openReview = () => { setStep(5); setView('questionnaire'); setStepError(''); };
  const restart = () => {
    setAnswers({});
    setConceptName(DEFAULT_CONCEPT_NAME);
    setStep(0);
    setStepError('');
    setFeedback('');
    setRecommendation(null);
    setAuthSaveMessage('');
    setView('questionnaire');
    restoreFocusAfterRestartClose.current = false;
    setConfirmRestart(false);
  };

  const currentValidation = stepValidation();
  const busyCatalog = familyState === 'loading' || noteState === 'loading';

  return (
    <div className="guided-page" dir="rtl">
      <div className="guided-container">
        <div className="guided-content" inert={confirmRestart}>
        <header className="guided-masthead">
          <div><p className="guided-brand-kicker">AROMAN <span aria-hidden="true">/</span> PERSONAL ATELIER</p><p>کشف رایحه، قدم‌به‌قدم</p></div>
          <span className="guided-masthead-mark" aria-hidden="true">✳</span>
        </header>

        {view === 'questionnaire' ? <>
          <GuidedProgress step={step} />
          <div className="guided-question-layout" aria-busy={busyCatalog}>
            <div className="guided-question-main">
              {step === 5
                ? <GuidedReview answers={answers} families={families} notes={notes} conceptName={conceptName} onName={setConceptName} onDiscovery={value => setAnswer('discovery', value)} onEdit={target => { setStep(target); setStepError(''); }} />
                : <GuidedStep
                    step={step} answers={answers} families={families} notes={notes}
                    familyLoading={familyState === 'loading'} familyError={familyState === 'error' ? familyError : ''}
                    noteLoading={noteState === 'loading'} noteError={noteState === 'error' ? noteError : ''}
                    onFeeling={(value: Feeling) => setAnswer('feeling', value)} onFamily={familySelection}
                    onTemperature={(value: Temperature) => setAnswer('temperature', value)} onScene={(value: Scene) => setAnswer('scene', value)}
                    onLike={id => toggleNote(id, 'liked')} onAvoid={id => toggleNote(id, 'avoided')}
                    onRemoveNote={removeNote} onSkipNotes={skipNotes} onRetryNotes={() => void loadNotes()} onRetryFamilies={() => void loadFamilies()} feedback={feedback}
                  />}
              {stepError && <p className="guided-step-error" role="alert">{stepError}</p>}
              {staleFamilyIds.length > 0 && <div className="guided-stale-alert" role="alert"><p>یکی از خانواده‌های انتخابی دیگر در کاتالوگ نیست؛ خانوادهٔ جایگزین را خودتان انتخاب کنید.</p><button type="button" onClick={() => setStep(1)}>بازبینی خانواده‌ها</button></div>}
              {staleLikedIds.length > 0 && step === 4 && <div className="guided-stale-alert" role="status"><p>یکی از نت‌هایی که پسندیده بودید دیگر در کاتالوگ نیست و در پیشنهاد استفاده نمی‌شود.</p><button type="button" onClick={() => removeNote('liked', staleLikedIds[0]!)}>حذف انتخاب قدیمی</button></div>}
              {staleAvoidedIds.length > 0 && step === 4 && <div className="guided-stale-alert" role="alert"><p>یکی از نت‌های کنارگذاشته‌شده دیگر در کاتالوگ نیست؛ برای ادامه انتخاب قدیمی را پاک کنید.</p><button type="button" onClick={() => removeNote('avoided', staleAvoidedIds[0]!)}>پاک‌کردن انتخاب قدیمی</button></div>}

              <nav className="guided-step-navigation" aria-label="حرکت میان مرحله‌ها">
                {step === 0
                  ? <Link className="guided-exit-link" href="/studio/creative">بازگشت به استودیوها</Link>
                  : <button type="button" className="guided-button-secondary" onClick={() => { setStep(current => Math.max(0, current - 1)); setStepError(''); }}>بازگشت</button>}
                <div className="guided-next-wrap">
                  {!currentValidation.valid && <span className="guided-validation-hint" aria-live="polite">{currentValidation.message}</span>}
                  <button type="button" className="guided-button-primary" onClick={continueStep} disabled={!currentValidation.valid || busyCatalog}>
                    {step === 5 ? 'دیدن پیشنهاد من' : 'ادامه'} <span aria-hidden="true">←</span>
                  </button>
                </div>
              </nav>
            </div>
            <aside className="guided-atmosphere" aria-hidden="true" data-step={step + 1}>
              <div className="guided-atmosphere-orbit guided-atmosphere-orbit-one" />
              <div className="guided-atmosphere-orbit guided-atmosphere-orbit-two" />
              <div className="guided-atmosphere-glow" />
              <svg viewBox="0 0 300 320" focusable="false">
                <path d="M46 286C94 218 83 132 152 41M134 170c39-48 76-58 121-51M111 216c-33-26-60-28-83-17M147 140c-12-34-6-59 16-84" />
                <path d="M89 146c-39 4-56-10-68-29 29-8 53 2 68 29ZM141 146c35-6 52-22 62-44-29 1-50 17-62 44ZM111 221c-30 0-47-14-59-34 28 0 47 13 59 34ZM158 120c-20-27-17-48-2-68 18 22 19 45 2 68Z" />
                <circle cx="226" cy="91" r="7" /><circle className="guided-atmosphere-ring" cx="226" cy="91" r="24" />
              </svg>
              <p>{step === 0 ? 'از یک حس شروع کنیم' : step === 1 ? 'جهان‌هایی از کاتالوگ واقعی' : step === 2 ? 'یک تصویر، نه اندازه‌گیری' : step === 3 ? 'فضایی برای خیال' : step === 4 ? 'نام‌هایی از نت‌های موجود' : 'انتخاب‌هایتان را مرور کنید'}</p>
              <small>پیشنهادها برداشت‌های مفهومی و سلیقه‌ای‌اند.</small>
            </aside>
          </div>
        </> : recommendation && <GuidedResult
          result={recommendation} answers={answers} conceptName={validateConceptName(conceptName).value ?? DEFAULT_CONCEPT_NAME}
          families={families} notes={notes} onReview={openReview} onRestart={openRestart}
          onSave={() => void saveResult()} onContinueCreative={continueToCreative}
          saveBusy={saveBusy} saved={isCurrentResultSaved} saveMessage={saveMessage} saveError={saveError}
          transferBusy={transferBusy}
          savedConceptId={isCurrentResultSaved ? currentSaveState?.id : undefined}
          allowSaving={authEnabled}
          onInvalidStep={target => { setStep(target); setView('questionnaire'); }}
        />}

        {view === 'result' && !recommendation && <p role="alert" className="guided-step-error">پیشنهاد در دسترس نیست؛ پاسخ‌ها را دوباره بررسی کنید.</p>}
        <footer className="guided-footer-note"><span aria-hidden="true">✧</span> انتخاب‌های شما فقط در همین صفحه نگه داشته می‌شوند و با تازه‌سازی پاک خواهند شد.</footer>
        </div>
      </div>

      {confirmRestart && <div className="guided-dialog-backdrop"><section ref={restartDialog} className="guided-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="guided-restart-title" aria-describedby="guided-restart-description" tabIndex={-1}>
        <span className="guided-dialog-mark" aria-hidden="true">↺</span><h2 id="guided-restart-title">از ابتدا شروع کنیم؟</h2><p id="guided-restart-description">پاسخ‌ها و پیشنهاد فعلی از این صفحه پاک می‌شوند. این کار قابل بازگشت نیست.</p>
        <div><button ref={cancelRestartButton} type="button" className="guided-button-secondary" onClick={cancelRestart}>ادامهٔ مسیر</button><button type="button" className="guided-button-primary" onClick={restart}>پاک‌کردن و شروع دوباره</button></div>
      </section></div>}

      {loginOpen && <Dialog title="ورود برای ذخیرهٔ مفهوم" onClose={closeLogin}><LoginForm onSuccess={loginSucceeded} /></Dialog>}
      {replaceTransferOpen && <Dialog title="جایگزینی پیش‌نویس استودیو" onClose={() => setReplaceTransferOpen(false)}>
        <div className="space-y-4"><h2 className="text-xl font-semibold">پیش‌نویس قبلی جایگزین شود؟</h2><p>یک پیشنهاد ذخیره‌نشده از استودیوی هدایت‌شده در همین برگه وجود دارد. با ادامه، پیش‌نویس قبلی کنار گذاشته می‌شود.</p><div className="flex flex-wrap gap-3"><button type="button" className="guided-button-secondary" onClick={() => setReplaceTransferOpen(false)}>بازگشت</button><button type="button" className="guided-button-primary" onClick={() => { setReplaceTransferOpen(false); navigateWithDraft(); }}>جایگزینی و ادامه</button></div></div>
      </Dialog>}
    </div>
  );
}
