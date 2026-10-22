import type { Family } from '@/lib/api/client';
import type { Discovery, GuidedAnswersDraft, GuidedCatalogNote } from '@/lib/studio/guided/types';
import { validateConceptName } from '@/lib/studio/guided/answers';
import { MAX_CONCEPT_NAME_LENGTH } from '@/lib/studio/guided/config';
import { GuidedOptionCard } from './GuidedOptionCard';

const discoveryOptions: { value: Discovery; label: string; description: string; tone: string }[] = [
  { value: 'familiar', label: 'نزدیک به انتخاب‌هایم', description: 'پیشنهاد بیشتر از خانواده‌های انتخابی من باشد؛ نت‌هایی که خودم پسندیدم حفظ شوند.', tone: 'sage' },
  { value: 'balanced', label: 'کمی آشنا، کمی تازه', description: 'انتخاب‌هایم اولویت داشته باشند؛ خانواده‌های دیگر هم فرصت داشته باشند.', tone: 'lilac' },
  { value: 'exploratory', label: 'دوست دارم کشف کنم', description: 'در کنار علاقه‌هایم، نت‌هایی از خانواده‌های دیگر هم وارد پیشنهاد شوند.', tone: 'champagne' },
];

const feelingLabels: Record<string, string> = {
  calm: 'آرام و آسوده', bright: 'سرزنده و روشن', confident: 'استوار و باوقار', intimate: 'نزدیک و لطیف', curious: 'کنجکاو و ماجراجو',
};
const temperatureLabels: Record<string, string> = { bright: 'روشن و تازه', soft: 'نرم و متعادل', warm: 'گرم و دربرگیرنده' };
const sceneLabels: Record<string, string> = {
  rainGarden: 'باغ پس از باران', citrusMorning: 'صبحی روشن', quietFlowers: 'گوشه‌ای پر از گل', woodland: 'مسیر میان درختان', warmEvening: 'غروب گرم', coffeePause: 'مکث کنار فنجان',
};

export function GuidedReview({
  answers,
  families,
  notes,
  conceptName,
  onName,
  onDiscovery,
  onEdit,
}: {
  answers: GuidedAnswersDraft;
  families: readonly Family[];
  notes: readonly GuidedCatalogNote[];
  conceptName: string;
  onName: (value: string) => void;
  onDiscovery: (value: Discovery) => void;
  onEdit: (step: number) => void;
}) {
  const familyIds = Array.isArray(answers.familyIds) ? answers.familyIds as string[] : [];
  const likedIds = Array.isArray(answers.likedNoteIds) ? answers.likedNoteIds as string[] : [];
  const avoidedIds = Array.isArray(answers.avoidedNoteIds) ? answers.avoidedNoteIds as string[] : [];
  const familyLabels = familyIds.map(id => families.find(family => family.id.toLowerCase() === id.toLowerCase())?.name ?? 'خانوادهٔ انتخابی در کاتالوگ پیدا نشد');
  const noteLabels = (ids: readonly string[]) => ids.map(id => notes.find(note => note.id.toLowerCase() === id.toLowerCase())?.name ?? 'نت انتخابی دیگر در کاتالوگ نیست');
  const nameValidation = validateConceptName(conceptName);
  const summaryRows: { label: string; value: string; step: number }[] = [
    { label: 'حال‌وهوا', value: feelingLabels[String(answers.feeling)] ?? 'انتخاب نشده', step: 0 },
    { label: 'جهان‌های رایحه', value: familyLabels.length ? familyLabels.join('، ') : 'انتخاب نشده', step: 1 },
    { label: 'دمای حسی', value: temperatureLabels[String(answers.temperature)] ?? 'انتخاب نشده', step: 2 },
    { label: 'تصویر', value: sceneLabels[String(answers.scene)] ?? 'انتخاب نشده', step: 3 },
    { label: 'نت‌های دلخواه', value: likedIds.length ? noteLabels(likedIds).join('، ') : 'انتخابی ندارم', step: 4 },
    { label: 'نت‌های کنارگذاشته‌شده', value: avoidedIds.length ? noteLabels(avoidedIds).join('، ') : 'موردی انتخاب نشده', step: 4 },
  ];

  return (
    <section className="guided-step guided-review" aria-labelledby="guided-step-heading">
      <div className="guided-step-heading">
        <p className="guided-step-kicker">استودیوی هدایت‌شده <span aria-hidden="true">·</span> مرور مسیر</p>
        <h1 id="guided-step-heading" tabIndex={-1}>بازبینی و میزان کشف</h1>
        <p>انتخاب‌هایتان را مرور کنید و بگویید پیشنهاد چقدر آشنا یا تازه باشد.</p>
      </div>
      <div className="guided-question-row"><span className="guided-question-index" aria-hidden="true">۰۶</span><h2>پیشنهاد چقدر به جهان‌هایی که انتخاب کردید نزدیک بماند؟</h2></div>

      <div className="guided-review-card" aria-label="خلاصهٔ انتخاب‌های شما">
        <div className="guided-review-card-heading"><div><span>مسیر انتخاب شما</span><p>هر بخش را می‌توانید دوباره بازبینی کنید.</p></div><span aria-hidden="true">✧</span></div>
        <dl className="guided-review-list">
          {summaryRows.map(row => <div key={`${row.step}-${row.label}`}><dt>{row.label}</dt><dd>{row.value}</dd><button type="button" onClick={() => onEdit(row.step)} aria-label={`ویرایش ${row.label}`}>ویرایش</button></div>)}
        </dl>
      </div>

      <fieldset className="guided-choice-grid guided-choice-grid-discovery">
        <legend className="guided-fieldset-title">چه اندازه‌ای از کشف را دوست دارید؟</legend>
        {discoveryOptions.map(option => <GuidedOptionCard key={option.value} type="radio" name="discovery" value={option.value} checked={answers.discovery === option.value} title={option.label} description={option.description} tone={option.tone} onChange={() => onDiscovery(option.value)} />)}
      </fieldset>

      <div className="guided-name-field">
        <label htmlFor="guided-concept-name">برای این تصویر چه نامی دوست دارید؟</label>
        <input id="guided-concept-name" value={conceptName} maxLength={MAX_CONCEPT_NAME_LENGTH} onChange={event => onName(event.currentTarget.value)} aria-describedby="guided-name-help guided-name-error" />
        <div className="guided-name-meta"><span id="guided-name-help">نام را می‌توانید تغییر دهید؛ در پیشنهاد نت‌ها نقشی ندارد.</span><span>{new Intl.NumberFormat('fa-IR').format([...conceptName.trim()].length)} از {new Intl.NumberFormat('fa-IR').format(MAX_CONCEPT_NAME_LENGTH)}</span></div>
        {nameValidation.issues.map(item => <p id="guided-name-error" className="guided-feedback" role="alert" key={item.code}>{item.message}</p>)}
      </div>
      <p className="guided-help-copy">نت‌هایی را که خودتان پسندیده‌اید حفظ می‌کنیم؛ میزان کشف فقط روی نت‌های دیگر اثر می‌گذارد و کیفیت یا مناسب‌بودن عطر را پیش‌بینی نمی‌کند.</p>
    </section>
  );
}
