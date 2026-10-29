import type { Family } from '@/lib/api/client';
import type { GuidedAnswersDraft, GuidedCatalogNote, RecommendationResult } from '@/lib/studio/guided/types';
import { guidedFamilyMood } from '@/lib/studio/guided/presentation';
import { FragranceVessel } from '@/components/studio/FragranceVessel';
import Link from 'next/link';

const layerLabels = { top: 'آغازین', heart: 'میانی', base: 'پایه' } as const;
const feelingLabels: Record<string, string> = {
  calm: 'آرام و آسوده', bright: 'سرزنده و روشن', confident: 'استوار و باوقار', intimate: 'نزدیک و لطیف', curious: 'کنجکاو و ماجراجو',
};

export function GuidedResult({
  result,
  answers,
  conceptName,
  families,
  notes,
  onReview,
  onRestart,
  onInvalidStep,
  onSave,
  onContinueCreative,
  saveBusy,
  saved,
  saveMessage,
  saveError,
  savedConceptId,
  transferBusy,
  allowSaving,
}: {
  result: RecommendationResult;
  answers: GuidedAnswersDraft;
  conceptName: string;
  families: readonly Family[];
  notes: readonly GuidedCatalogNote[];
  onReview: () => void;
  onRestart: () => void;
  onInvalidStep: (step: number) => void;
  onSave: () => void;
  onContinueCreative: () => void;
  saveBusy: boolean;
  saved: boolean;
  saveMessage: string;
  saveError: string;
  savedConceptId?: string;
  transferBusy: boolean;
  allowSaving: boolean;
}) {
  if (result.status === 'invalid') {
    const field = result.issues[0]?.field ?? 'answers';
    const step = field === 'familyIds' ? 1 : field.includes('temperature') ? 2 : field === 'scene' ? 3 : field.includes('Note') || field.includes('Affinity') ? 4 : field === 'discovery' ? 5 : 0;
    return (
      <section className="guided-result guided-result-error" aria-labelledby="guided-result-heading">
        <span className="guided-result-mark" aria-hidden="true">!</span>
        <p className="guided-step-kicker">نیاز به بازبینی</p>
        <h1 id="guided-result-heading" tabIndex={-1}>پیش از پیشنهاد، انتخاب‌ها را بررسی کنیم</h1>
        <p role="alert">{result.issues[0]?.message ?? result.explanation[0]}</p>
        <div className="guided-result-actions"><button type="button" className="guided-button-primary" onClick={() => onInvalidStep(step)}>بازبینی انتخاب</button><button type="button" className="guided-button-secondary" onClick={onReview}>مرور پاسخ‌ها</button></div>
      </section>
    );
  }

  if (result.status === 'no-match') {
    return (
      <section className="guided-result guided-result-empty" aria-labelledby="guided-result-heading">
        <div className="guided-result-empty-art" aria-hidden="true"><span>✧</span><i /><i /></div>
        <p className="guided-step-kicker">پیشنهاد مفهومی</p>
        <h1 id="guided-result-heading" tabIndex={-1}>این بار، انتخاب‌ها را کمی تغییر دهیم</h1>
        <p className="guided-result-lede" role="status">{result.explanation.join(' ')}</p>
        {result.notices.map((notice, index) => <p className="guided-result-notice" key={`${notice}-${index}`}>{notice}</p>)}
        <div className="guided-result-actions"><button type="button" className="guided-button-primary" onClick={onReview}>بازبینی انتخاب‌ها</button><button type="button" className="guided-button-secondary" onClick={onRestart}>شروع دوباره</button></div>
      </section>
    );
  }

  const familyById = new Map(families.map(family => [family.id.toLowerCase(), family]));
  const primarySelection = result.selections[0];
  const primaryFamily = primarySelection?.note.family_id ? familyById.get(primarySelection.note.family_id.toLowerCase()) : undefined;
  const mood = guidedFamilyMood(primaryFamily?.slug);
  const noteById = new Map(notes.map(note => [note.id.toLowerCase(), note]));
  const groups = (['top', 'heart', 'base'] as const).map(layer => ({
    layer,
    selections: result.selections.filter(selection => selection.layer === layer).slice().sort((a, b) => a.position - b.position),
  }));
  const selectedFamilies = (Array.isArray(answers.familyIds) ? answers.familyIds as string[] : [])
    .map(id => familyById.get(id.toLowerCase())?.name)
    .filter((name): name is string => Boolean(name));
  const likedNames = (Array.isArray(answers.likedNoteIds) ? answers.likedNoteIds as string[] : [])
    .map(id => noteById.get(id.toLowerCase())?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <section className="guided-result" aria-labelledby="guided-result-heading">
      <div className="guided-result-intro">
        <div className="guided-result-copy">
          <p className="guided-step-kicker">پیشنهاد استودیوی هدایت‌شده <span aria-hidden="true">·</span> تصویر مفهومی</p>
          <h1 id="guided-result-heading" tabIndex={-1}>این تصویرِ رایحهٔ شماست</h1>
          <p className="guided-result-name">{conceptName}</p>
          <p className="guided-result-mood">با الهام از حال‌وهوای «{feelingLabels[String(answers.feeling)] ?? 'انتخاب‌شده'}» که دوست داشتید.</p>
          <div className="guided-result-tags">
            {selectedFamilies.map(name => <span key={name}>{name}</span>)}
            {likedNames.length > 0 && <span>نت‌های پسندیدهٔ شما</span>}
          </div>
          <div className="guided-result-vessel-mobile"><FragranceVessel mood={mood} title="تصویر مفهومی بطری عطر" /></div>
          <p className="guided-result-disclaimer">این پیشنهاد یک تصویر مفهومی از سلیقهٔ شماست، نه فرمول ساخت یا پیش‌بینی عملکرد یک عطر واقعی.</p>
        </div>
        <div className="guided-result-art" data-mood={mood}>
          <div className="guided-result-art-halo" aria-hidden="true" />
          <svg className="guided-result-botanical" viewBox="0 0 360 420" aria-hidden="true" focusable="false">
            <path d="M64 333C124 258 86 173 168 73M169 206c29-58 70-86 118-99M137 254c-42-32-68-31-91-21M193 164c-13-44 0-76 23-103M169 215c49-13 83 0 114 29" />
            <path d="M130 185c-49 8-69-7-83-28 35-9 68-1 83 28ZM193 167c44-4 65-23 78-47-38-1-67 16-78 47ZM115 267c-37 1-58-15-71-38 34 0 57 14 71 38ZM197 211c36-12 63-6 87 12-30 15-61 10-87-12ZM182 103c-20-29-18-54-4-77 20 25 22 49 4 77Z" />
            <circle cx="285" cy="96" r="9" /><circle cx="285" cy="96" r="24" className="guided-orbit" />
          </svg>
          <FragranceVessel mood={mood} decorative />
          <span className="guided-result-art-label">تصویر مفهومی</span>
        </div>
      </div>

      <div className="guided-result-body">
        <div className="guided-result-composition">
          <div className="guided-result-section-title"><span>۰۱</span><div><h2>لایه‌های تصویر شما</h2><p>ترتیب لایه‌ها فقط برای سازمان‌دهی ایده است.</p></div></div>
          <div className="guided-result-layers">
            {groups.map(group => <section className="guided-result-layer" data-layer={group.layer} key={group.layer} aria-label={`لایهٔ ${layerLabels[group.layer]}`}>
              <div className="guided-layer-heading"><span aria-hidden="true">✧</span><h3>{layerLabels[group.layer]}</h3><small>{group.layer === 'top' ? 'آغاز روایت' : group.layer === 'heart' ? 'میانهٔ روایت' : 'پایهٔ روایت'}</small></div>
              {group.selections.length ? <ul>{group.selections.map(selection => {
                const family = selection.note.family_id ? familyById.get(selection.note.family_id.toLowerCase()) : undefined;
                return <li key={selection.note.id} data-note-id={selection.note.id}><span className="guided-result-note-dot" aria-hidden="true" /><div><strong>{selection.note.name}</strong><small>{family?.name ?? 'خانواده مشخص نشده'}</small></div><span className="guided-result-position">{new Intl.NumberFormat('fa-IR').format(selection.position + 1)}</span></li>;
              })}</ul> : <p className="guided-result-layer-empty">هنوز نتی در این لایه نیست.</p>}
            </section>)}
          </div>
        </div>

        <aside className="guided-result-story">
          <div className="guided-result-section-title"><span>۰۲</span><div><h2>چرا این پیشنهاد؟</h2><p>بر پایهٔ انتخاب‌های شما و کاتالوگ فعلی</p></div></div>
          <div className="guided-result-explanations">{result.explanation.map((clause, index) => <p key={`${clause}-${index}`}>{clause}</p>)}</div>
          {result.notices.map((notice, index) => <p className="guided-result-notice" key={`${notice}-${index}`}>{notice}</p>)}
          <p className="guided-result-layer-note">ترتیب لایه‌ها برای تصویرسازی ایده است؛ این ترکیب فرمول یا نسخهٔ ساخت نیست.</p>
        </aside>
      </div>

      <div className="guided-result-actions-panel">
        <div><p className="guided-step-kicker">گام بعدی</p><h2>این تصویر را می‌توانید بعداً کامل‌تر کنید</h2><p>{allowSaving ? 'مفهوم را به حساب خود بسپارید یا برای ویرایش لایه‌ها به استودیوی خلاق ببرید.' : 'این پیشنهاد فقط برای کاوش مفهومی است و در حافظهٔ صفحه می‌ماند؛ برای ویرایش لایه‌ها آن را به استودیوی خلاق ببرید.'}</p></div>
        <div className="guided-result-actions guided-result-actions-grid">
          {allowSaving && <button type="button" className="guided-button-primary" onClick={onSave} disabled={saveBusy || saved} aria-describedby="guided-save-description">{saveBusy ? 'در حال ذخیره…' : saved ? 'ذخیره شد' : 'ذخیرهٔ مفهوم'}</button>}
          <button type="button" className="guided-button-secondary" onClick={onContinueCreative} disabled={transferBusy}>{transferBusy ? 'در حال انتقال…' : 'رفتن به استودیوی خلاق'}</button>
          <button type="button" className="guided-button-secondary" onClick={onReview}>مرور پاسخ‌ها</button>
          <button type="button" className="guided-button-quiet" onClick={onRestart}>شروع دوباره</button>
        </div>
        {allowSaving && <div id="guided-save-description" aria-live="polite" aria-atomic="true">
          {saveMessage && <p role="status" className="guided-actions-pending">{saveMessage}{saved && savedConceptId && <> <Link href="/account">دیدن مفاهیم ذخیره‌شده</Link></>}</p>}
          {saveError && <p role="alert" className="guided-result-notice">{saveError}</p>}
          {transferBusy && <p role="status" className="guided-actions-pending">پیشنهاد در حال انتقال به استودیوی خلاق است.</p>}
        </div>}
      </div>
    </section>
  );
}
