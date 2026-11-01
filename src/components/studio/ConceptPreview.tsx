'use client';
import type { Family } from '@/lib/api/client';
import type { SelectedNote } from '@/lib/studio/composition';
import { layerLabels, layers, summary } from '@/lib/studio/composition';
import { compositionMood, moodCopy } from '@/lib/studio/presentation';
import { FragranceVessel } from '@/components/studio/FragranceVessel';

export function ConceptPreview({
  selected, families, name, active, busy, saved, onSave, allowSaving = true,
}: {
  selected: SelectedNote[]; families: Family[]; name: string; active: boolean; busy: boolean; saved: boolean; onSave: () => void; allowSaving?: boolean;
}) {
  const mood = compositionMood(selected, families);
  return (
    <section className="studio-panel studio-preview" data-active={active} aria-label="پیش‌نمایش مفهوم" role="tabpanel" id="studio-panel-2" aria-labelledby="studio-tab-2">
      <header className="studio-panel-heading">
        <div><span className="studio-step-index">۰۳ / تجربه</span><h2>تصویر رایحه</h2><p>برداشتی تصویری از انتخاب‌های شما</p></div>
        <span className="preview-live-indicator"><i /> زنده</span>
      </header>
      <div className="preview-atmosphere" data-mood={mood}>
        <span className="preview-orbit preview-orbit-one" aria-hidden="true" />
        <span className="preview-orbit preview-orbit-two" aria-hidden="true" />
        <span className="preview-botanical preview-botanical-one" aria-hidden="true">❋</span>
        <span className="preview-botanical preview-botanical-two" aria-hidden="true">✳</span>
        <FragranceVessel mood={mood} title={`بطری مفهومی، ${moodCopy[mood]}`} />
        <span className="preview-mood-label">{moodCopy[mood]}</span>
      </div>
      <div className="preview-copy">
        <span className="studio-step-index">روایت شما</span>
        <h3>{name.trim() || 'رایحه من'}</h3>
        <p>{summary(selected)}</p>
      </div>
      <div className="preview-note-map" aria-label="نت‌های انتخاب‌شده در لایه‌ها">
        {layers.map(layer => {
          const notes = selected.filter(item => item.layer === layer);
          return <div className="preview-note-layer" data-layer={layer} key={layer}>
            <span>{layerLabels[layer]}</span><div>{notes.length ? notes.map(item => <span className="preview-note-chip" key={item.note.id}>{item.note.name}</span>) : <span className="preview-note-muted">—</span>}</div>
          </div>;
        })}
      </div>
      <p className="preview-disclaimer">تصویر و توصیف، برداشت مفهومی هستند؛ نه فرمول تولید، ادعای ایمنی یا سنجه‌ی عملکرد.</p>
      {allowSaving && <button type="button" className="preview-save-button" onClick={onSave} disabled={busy}>{busy ? 'در حال ذخیره…' : saved ? 'ذخیره تغییرات' : 'ذخیره مفهوم'}<span aria-hidden="true">↗</span></button>}
    </section>
  );
}
