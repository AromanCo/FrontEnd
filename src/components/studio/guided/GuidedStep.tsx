import Link from 'next/link';
import type { Family } from '@/lib/api/client';
import type { Feeling, GuidedAnswersDraft, GuidedCatalogNote, NoteAffinityStatus, Scene, Temperature } from '@/lib/studio/guided/types';
import { guidedFamilyMood } from '@/lib/studio/guided/presentation';
import { GuidedNotePicker } from './GuidedNotePicker';
import { GuidedOptionCard } from './GuidedOptionCard';

const feelingOptions: { value: Feeling; label: string; description: string; tone: string }[] = [
  { value: 'calm', label: 'آرام و آسوده', description: 'مثل مکثی کوتاه میان روز.', tone: 'sage' },
  { value: 'bright', label: 'سرزنده و روشن', description: 'برای شروعی سبک و پرانرژی.', tone: 'champagne' },
  { value: 'confident', label: 'استوار و باوقار', description: 'حسی جمع‌وجور، گرم و مطمئن.', tone: 'plum' },
  { value: 'intimate', label: 'نزدیک و لطیف', description: 'فضایی نرم و شخصی.', tone: 'blush' },
  { value: 'curious', label: 'کنجکاو و ماجراجو', description: 'برای حال‌وهوایی با پیچ‌وخم بیشتر.', tone: 'lilac' },
];
const temperatureOptions: { value: Temperature; label: string; description: string; tone: string }[] = [
  { value: 'bright', label: 'روشن و تازه', description: 'حسی سبک و بیدارکننده در تصور.', tone: 'sage' },
  { value: 'soft', label: 'نرم و متعادل', description: 'میانه‌ای آرام، بدون تأکید بر گرما یا تازگی.', tone: 'lilac' },
  { value: 'warm', label: 'گرم و دربرگیرنده', description: 'فضایی صمیمی و عمیق در تصور.', tone: 'champagne' },
];
const sceneOptions: { value: Scene; label: string; description: string; tone: string; motif: string }[] = [
  { value: 'rainGarden', label: 'باغ پس از باران', description: 'هوای تازه، برگ‌های سبز و سکوت.', tone: 'sage', motif: '≈' },
  { value: 'citrusMorning', label: 'صبحی روشن', description: 'نور نرم و میوه‌ای که تازه پوست گرفته شده.', tone: 'champagne', motif: '☼' },
  { value: 'quietFlowers', label: 'گوشه‌ای پر از گل', description: 'لطافت گل‌ها در فضایی آرام.', tone: 'lilac', motif: '✿' },
  { value: 'woodland', label: 'مسیر میان درختان', description: 'سایه، چوب و قدم‌زدن آرام.', tone: 'green', motif: '⌁' },
  { value: 'warmEvening', label: 'غروب گرم', description: 'نور کم و لحظه‌ای صمیمی.', tone: 'blush', motif: '◒' },
  { value: 'coffeePause', label: 'مکث کنار فنجان', description: 'فضایی دلنشین و کمی شیرین.', tone: 'plum', motif: '∿' },
];

export function GuidedStep({
  step,
  answers,
  families,
  notes,
  noteLoading,
  noteError,
  familyLoading,
  familyError,
  onFeeling,
  onFamily,
  onTemperature,
  onScene,
  onLike,
  onAvoid,
  onRemoveNote,
  onSkipNotes,
  onRetryNotes,
  onRetryFamilies,
  feedback,
}: {
  step: number;
  answers: GuidedAnswersDraft;
  families: readonly Family[];
  notes: readonly GuidedCatalogNote[];
  noteLoading: boolean;
  noteError: string;
  familyLoading: boolean;
  familyError: string;
  onFeeling: (value: Feeling) => void;
  onFamily: (id: string) => void;
  onTemperature: (value: Temperature) => void;
  onScene: (value: Scene) => void;
  onLike: (id: string) => void;
  onAvoid: (id: string) => void;
  onRemoveNote: (group: 'liked' | 'avoided', id: string) => void;
  onSkipNotes: () => void;
  onRetryNotes: () => void;
  onRetryFamilies: () => void;
  feedback: string;
}) {
  const titles = [
    ['حال‌وهوای شما', 'از حسی شروع کنیم که دوست دارید همراه رایحه‌تان باشد.', 'دوست دارید رایحهٔ شخصی‌تان بیشتر چه حسی را تداعی کند؟'],
    ['جهان‌های رایحه', 'از خانواده‌هایی انتخاب کنید که نام یا فضای‌شان برایتان دلنشین است.', 'کدام جهان‌ها را دوست دارید در پیشنهادتان بیشتر ببینید؟'],
    ['دمای حسی', 'نه دمای واقعی؛ فقط تصویری که به سلیقهٔ شما نزدیک‌تر است.', 'کدام توصیف به حال‌وهوای دلخواهتان نزدیک‌تر است؟'],
    ['یک تصویر برای خیال', 'گاهی یک فضا بهتر از نام نت‌ها سلیقه را نشان می‌دهد.', 'کدام تصویر را برای لحظه‌ای انتخاب می‌کنید؟'],
    ['نت‌هایی که به دلتان می‌نشینند', 'می‌توانید نام‌های آشنا را انتخاب کنید یا این مرحله را رد کنید.', 'از میان نت‌های موجود، کدام‌ها را دوست دارید ببینید یا ترجیح می‌دهید کنار بگذارید؟'],
  ] as const;
  if (step < 0 || step > 4) return null;
  const [title, subtitle, question] = titles[step]!;
  const selectedFamilies = Array.isArray(answers.familyIds) ? answers.familyIds as string[] : [];
  const liked = Array.isArray(answers.likedNoteIds) ? answers.likedNoteIds as string[] : [];
  const avoided = Array.isArray(answers.avoidedNoteIds) ? answers.avoidedNoteIds as string[] : [];

  return (
    <section className={`guided-step guided-step-${step + 1}`} aria-labelledby="guided-step-heading">
      <div className="guided-step-heading">
        <p className="guided-step-kicker">استودیوی هدایت‌شده <span aria-hidden="true">·</span> کشف سلیقه</p>
        <h1 id="guided-step-heading" tabIndex={-1}>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="guided-question-row">
        <span className="guided-question-index" aria-hidden="true">{new Intl.NumberFormat('fa-IR').format(step + 1)}</span>
        <h2>{question}</h2>
      </div>

      {step === 0 && <>
        <fieldset className="guided-choice-grid guided-choice-grid-feeling">
          <legend className="sr-only">حال‌وهوای رایحه</legend>
          {feelingOptions.map(option => <GuidedOptionCard key={option.value} type="radio" name="feeling" value={option.value} checked={answers.feeling === option.value} title={option.label} description={option.description} tone={option.tone} onChange={() => onFeeling(option.value)} />)}
        </fieldset>
        <p className="guided-help-copy">این انتخاب فقط جهت سلیقه‌ای پیشنهاد را شکل می‌دهد؛ نتیجه یک برداشت مفهومی است.</p>
      </>}

      {step === 1 && <>
        {familyLoading && <div className="guided-inline-state" role="status"><span className="guided-spinner" aria-hidden="true" />در حال دریافت خانواده‌ها…</div>}
        {familyError && <div className="guided-inline-error" role="alert"><p>{familyError}</p><button type="button" className="guided-small-action" onClick={onRetryFamilies}>تلاش دوباره</button></div>}
        {!familyLoading && !familyError && families.length === 0 && <div className="guided-empty-catalog"><span aria-hidden="true">✧</span><strong>خانواده‌ای در کاتالوگ در دسترس نیست.</strong><p>برای ساخت پیشنهاد هدایت‌شده، ابتدا باید خانواده‌های رایحه دریافت شوند.</p><Link href="/studio/creative">رفتن به استودیوی خلاق</Link></div>}
        {!familyLoading && !familyError && families.length > 0 && <fieldset className="guided-choice-grid guided-choice-grid-families">
          <legend className="sr-only">یک یا دو خانواده انتخاب کنید</legend>
          {families.map(family => <GuidedOptionCard key={family.id} type="checkbox" name="familyIds" value={family.id} checked={selectedFamilies.includes(family.id)} title={family.name} description={family.description ?? undefined} tone={guidedFamilyMood(family.slug)} detail={<small className="guided-option-order">{selectedFamilies.includes(family.id) ? `انتخاب ${new Intl.NumberFormat('fa-IR').format(selectedFamilies.indexOf(family.id) + 1)}` : 'جهان رایحه'}</small>} onChange={() => onFamily(family.id)} />)}
        </fieldset>}
        <div className="guided-step-footnote" aria-live="polite"><span>{new Intl.NumberFormat('fa-IR').format(selectedFamilies.length)} از ۲ خانواده</span><span>خانواده‌ها دسته‌بندی‌های کلی کاتالوگ‌اند؛ نامشان برداشت کلی را نشان می‌دهد و جزئیات هر نت را تضمین نمی‌کند.</span></div>
        {feedback && <p className="guided-feedback" role="status">{feedback}</p>}
      </>}

      {step === 2 && <>
        <fieldset className="guided-choice-grid guided-choice-grid-temperature">
          <legend className="sr-only">دمای حسی</legend>
          {temperatureOptions.map(option => <GuidedOptionCard key={option.value} type="radio" name="temperature" value={option.value} checked={answers.temperature === option.value} title={option.label} description={option.description} tone={option.tone} onChange={() => onTemperature(option.value)} />)}
        </fieldset>
        <p className="guided-help-copy">این واژه‌ها توصیف سلیقه‌ای‌اند، نه اندازه‌گیری ویژگی یا عملکرد عطر.</p>
      </>}

      {step === 3 && <>
        <fieldset className="guided-choice-grid guided-choice-grid-scenes">
          <legend className="sr-only">تصویر ذهنی</legend>
          {sceneOptions.map(option => <GuidedOptionCard key={option.value} type="radio" name="scene" value={option.value} checked={answers.scene === option.value} title={option.label} description={option.description} tone={option.tone} detail={<span className="guided-scene-motif" aria-hidden="true">{option.motif}</span>} onChange={() => onScene(option.value)} />)}
        </fieldset>
        <p className="guided-help-copy">این تصویر یک انتخاب خلاقانه است؛ ویژگی تأییدشده‌ای برای نت‌ها یا عطر واقعی ادعا نمی‌کند.</p>
      </>}

      {step === 4 && <GuidedNotePicker
        notes={notes} families={families} liked={liked} avoided={avoided}
        familyPreferenceIds={selectedFamilies}
        status={answers.noteAffinityStatus as NoteAffinityStatus | undefined}
        loading={noteLoading} error={noteError} empty={notes.length === 0}
        onLike={onLike} onAvoid={onAvoid} onSkip={onSkipNotes} onRetry={onRetryNotes} onRemove={onRemoveNote}
      />}
    </section>
  );
}
