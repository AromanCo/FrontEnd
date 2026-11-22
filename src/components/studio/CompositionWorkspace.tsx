'use client';
import type { Layer } from '@/lib/api/client';
import type { ReactNode } from 'react';
import type { SelectedNote } from '@/lib/studio/composition';
import { layerLabels, layers } from '@/lib/studio/composition';

export function CompositionWorkspace({
  selected, name, active, advisor, onName, onLayer, onRemove, onReorder, onBrowse, onPreview,
}: {
  selected: SelectedNote[]; name: string; active: boolean; onName: (value: string) => void;
  advisor?: ReactNode;
  onBrowse: () => void;
  onPreview: () => void;
  onLayer: (id: string, layer: Layer) => void; onRemove: (id: string) => void; onReorder: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <section className="studio-panel studio-composition" data-active={active} aria-label="ترکیب رایحه" role="tabpanel" id="studio-panel-1" aria-labelledby="studio-tab-1">
      <header className="studio-panel-heading">
        <div><h2 id="studio-panel-1-heading" tabIndex={-1}>بوم رایحه شما</h2><p>{selected.length ? 'نام ترکیب را ویرایش کنید یا لایهٔ هر نت را تغییر دهید.' : 'با انتخاب اولین نت، ترکیب شما اینجا شکل می‌گیرد.'}</p></div>
        <span className="studio-composition-count">{selected.length}<span> / ۶</span></span>
      </header>

      <label className="concept-name-field"><span>نام مفهوم</span><input aria-label="نام مفهوم" maxLength={120} value={name} onChange={event => onName(event.target.value)} placeholder="نامی برای روایت شما" /></label>

      <div className="composition-pyramid" aria-label="سه لایه عطر">
        {layers.map((layer, index) => {
          const notes = selected.filter(item => item.layer === layer);
          return <section className="composition-layer" data-layer={layer} key={layer} aria-labelledby={`layer-${layer}-heading`}>
            <div className="composition-layer-heading">
              <span className="composition-layer-number">۰{index + 1}</span>
              <div><h3 id={`layer-${layer}-heading`}>{layerLabels[layer]}</h3><p>{layer === 'top' ? 'نخستین برخورد' : layer === 'heart' ? 'قلب روایت' : 'ردّ پای آرام'}</p></div>
              <span className="composition-layer-count">{notes.length}</span>
            </div>
            {notes.length ? <ol className="composition-note-list">
              {notes.map((item, noteIndex) => <li className="composition-note" data-selected-note-id={item.note.id} key={item.note.id}>
                <span className="composition-note-mark" aria-hidden="true" />
                <strong>{item.note.name}</strong>
                <label className="sr-only" htmlFor={`layer-select-${item.note.id}`}>لایه‌ی {item.note.name}</label>
                <select id={`layer-select-${item.note.id}`} aria-label={`لایه ${item.note.name}`} value={item.layer} onChange={event => onLayer(item.note.id, event.target.value as Layer)}>
                  {layers.map(value => <option key={value} value={value}>{layerLabels[value]}</option>)}
                </select>
                <div className="composition-note-actions">
                  <button type="button" aria-label={`جابجایی ${item.note.name} به بالا`} disabled={noteIndex === 0} onClick={() => onReorder(item.note.id, -1)}>↑</button>
                  <button type="button" aria-label={`جابجایی ${item.note.name} به پایین`} disabled={noteIndex === notes.length - 1} onClick={() => onReorder(item.note.id, 1)}>↓</button>
                </div>
                <button type="button" className="composition-remove" onClick={() => onRemove(item.note.id)}>حذف</button>
              </li>)}
            </ol> : <div className="composition-empty"><span aria-hidden="true">＋</span><p>این لایه هنوز نتی ندارد.</p><small>از کتابخانه، نت دلخواه را اضافه کنید.</small></div>}
          </section>;
        })}
      </div>
      <p className="composition-note-disclaimer">این چیدمان، روایت مفهومی شماست و فرمول ساخت عطر نیست.</p>
      <div className="studio-mobile-panel-actions">
        {selected.length > 0 ? (
          <button type="button" className="guided-button-primary" onClick={onPreview}>دیدن پیش‌نمایش رایحه <span aria-hidden="true">←</span></button>
        ) : (
          <button type="button" className="guided-button-primary" onClick={onBrowse}>انتخاب اولین نت <span aria-hidden="true">←</span></button>
        )}
      </div>
      {advisor}
    </section>
  );
}
