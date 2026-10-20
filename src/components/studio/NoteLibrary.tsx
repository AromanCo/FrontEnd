'use client';
import type { Family, Note } from '@/lib/api/client';
import { FacetedNoteCard } from '@/components/studio/FacetedNoteCard';
import { familyMood } from '@/lib/studio/presentation';

export function NoteLibrary({
  notes, families, selectedIds, count, query, familyId, loading, noteError, familyError, hasMore, active,
  onQuery, onFamily, onSelect, onRetry, onRetryFamilies, onMore,
}: {
  notes: Note[]; families: Family[]; selectedIds: Set<string>; count: number; query: string; familyId: string;
  loading: boolean; noteError: string; familyError: string; hasMore: boolean; active: boolean;
  onQuery: (value: string) => void; onFamily: (value: string) => void; onSelect: (note: Note) => void;
  onRetry: () => void; onRetryFamilies: () => void; onMore: () => void;
}) {
  const atLimit = count >= 6;
  return (
    <section className="studio-panel studio-library" data-active={active} data-note-status={loading ? 'loading' : noteError ? 'error' : 'ready'} data-note-count={notes.length} aria-label="کتابخانه نت‌ها" role="tabpanel" id="studio-panel-0" aria-labelledby="studio-tab-0">
      <header className="studio-panel-heading">
        <div><span className="studio-step-index">۰۱ / انتخاب</span><h2>کتابخانه نت‌ها</h2><p>نت‌هایی را انتخاب کنید که به روایت شما نزدیک‌اند.</p></div>
        <span className="studio-count-badge" aria-label={`${count} از ۶ نت انتخاب شده`}><strong>{count}</strong><span>از ۶ نت</span></span>
      </header>

      <div className="studio-filters">
        <label className="studio-search">
          <span className="sr-only">جستجوی نت</span><span aria-hidden="true">⌕</span>
          <input value={query} maxLength={100} onChange={event => onQuery(event.target.value)} placeholder="جستجو میان نت‌ها…" />
        </label>
        <label className="studio-family-filter">
          <span className="sr-only">خانواده رایحه</span>
          <select aria-label="خانواده رایحه" value={familyId} onChange={event => onFamily(event.target.value)}>
            <option value="">همه خانواده‌ها</option>{families.map(family => <option key={family.id} value={family.id}>{family.name}</option>)}
          </select>
          <span aria-hidden="true">⌄</span>
        </label>
      </div>

      {familyError && <div role="alert" className="studio-inline-error">{familyError}<button type="button" onClick={onRetryFamilies}>تلاش دوباره</button></div>}
      {atLimit && <p className="studio-limit-hint" role="status">شش نت انتخاب شده است؛ برای افزودن نت تازه، یکی را از ترکیب بردارید.</p>}
      {loading && <p className="studio-state" role="status" aria-live="polite"><span className="studio-loader-mark" aria-hidden="true">✳</span> در حال دریافت نت‌های آرومان…</p>}
      {noteError && <div role="alert" className="studio-error-card"><span aria-hidden="true">!</span><div><strong>کتابخانه نت‌ها در دسترس نیست</strong><p>{noteError} ترکیب شما حفظ شده است.</p><button type="button" onClick={onRetry}>تلاش دوباره</button></div></div>}
      {!loading && !noteError && notes.length === 0 && <div className="studio-empty"><span aria-hidden="true">⌕</span><strong>نتی پیدا نشد</strong><p>نام دیگری را جستجو کنید یا خانواده رایحه را تغییر دهید.</p></div>}

      {!loading && !noteError && notes.length > 0 && <div className="faceted-note-grid" aria-label="نت‌های موجود">
        {notes.map(note => <FacetedNoteCard key={note.id} note={note} family={families.find(item => item.id === note.family_id)} selected={selectedIds.has(note.id)} atLimit={atLimit} onSelect={() => onSelect(note)} />)}
      </div>}
      {hasMore && !loading && !noteError && <button className="studio-more-button" type="button" onClick={onMore}>نمایش نت‌های بیشتر</button>}
      <div className="studio-family-key" aria-hidden="true">{families.slice(0, 4).map(family => <span key={family.id} data-mood={familyMood(family.name)}>{family.name}</span>)}</div>
    </section>
  );
}
