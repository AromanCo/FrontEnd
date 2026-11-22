'use client';
import type { Family } from '@/lib/api/client';
import type { SelectedNote } from '@/lib/studio/composition';
import { layerLabels, layers } from '@/lib/studio/composition';
import { compositionMood, moodCopy } from '@/lib/studio/presentation';
import { FragranceVessel } from '@/components/studio/FragranceVessel';

const formatCount = new Intl.NumberFormat('fa-IR');

export function ConceptPreview({
  selected, families, name, active, busy, saved, onSave, onEdit, allowSaving = true,
}: {
  selected: SelectedNote[]; families: Family[]; name: string; active: boolean; busy: boolean; saved: boolean; onSave: () => void; onEdit: () => void; allowSaving?: boolean;
}) {
  const mood = compositionMood(selected, families);
  return (
    <section className="studio-panel studio-preview" data-active={active} aria-label="پیش‌نمایش مفهوم" role="tabpanel" id="studio-panel-2" aria-labelledby="studio-tab-2">
      <header className="studio-panel-heading">
        <div><h2 id="studio-panel-2-heading" tabIndex={-1}>تصویر رایحه</h2><p>برداشتی تصویری از انتخاب‌های شما</p></div>
      </header>
      {selected.length === 0 ? (
        <div className="preview-empty">
          <p>با انتخاب اولین نت، تصویر رایحه و چیدمان لایه‌ها را اینجا می‌بینید.</p>
          <button type="button" className="guided-button-primary" onClick={onEdit}>انتخاب اولین نت</button>
        </div>
      ) : <>
        <div className="preview-atmosphere" data-mood={mood}>
          <span className="preview-orbit preview-orbit-one" aria-hidden="true" />
          <span className="preview-orbit preview-orbit-two" aria-hidden="true" />
          <span className="preview-botanical preview-botanical-one" aria-hidden="true">❋</span>
          <span className="preview-botanical preview-botanical-two" aria-hidden="true">✳</span>
          <FragranceVessel mood={mood} decorative />
          <span className="preview-mood-label">{moodCopy[mood]}</span>
        </div>
        <div className="preview-copy">
          <h3>{name.trim() || 'رایحه من'}</h3>
          <p>{formatCount.format(selected.length)} نت در ترکیب</p>
        </div>
        <dl className="preview-note-map" aria-label="نت‌های انتخاب‌شده در لایه‌ها">
          {layers.map(layer => {
            const notes = selected.filter(item => item.layer === layer);
            return <div className="preview-note-layer" data-layer={layer} key={layer}>
              <dt>{layerLabels[layer]}</dt>
              <dd>
                {notes.length ? (
                  <ul>{notes.map(item => <li className="preview-note-chip" key={item.note.id} data-preview-note-id={item.note.id}>{item.note.name}</li>)}</ul>
                ) : <span className="preview-note-muted">بدون نت</span>}
              </dd>
            </div>;
          })}
        </dl>
        <p className="preview-disclaimer">تصویر و توصیف، برداشت مفهومی هستند؛ نه فرمول تولید، ادعای ایمنی یا سنجه‌ی عملکرد.</p>
        <div className="studio-mobile-panel-actions">
          <button type="button" className="guided-button-secondary" onClick={onEdit}>برگشت به ترکیب</button>
        </div>
        {allowSaving && <button type="button" className="preview-save-button" onClick={onSave} disabled={busy}>{busy ? 'در حال ذخیره…' : saved ? 'ذخیره تغییرات' : 'ذخیره مفهوم'}<span aria-hidden="true">↗</span></button>}
      </>}
    </section>
  );
}
