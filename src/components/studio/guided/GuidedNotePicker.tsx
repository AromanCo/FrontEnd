import { useMemo, useState } from 'react';
import type { Family } from '@/lib/api/client';
import type { GuidedCatalogNote, NoteAffinityStatus } from '@/lib/studio/guided/types';
import { guidedFamilyMood } from '@/lib/studio/guided/presentation';

export function GuidedNotePicker({
  notes,
  families,
  familyPreferenceIds,
  liked,
  avoided,
  status,
  loading,
  error,
  empty,
  onLike,
  onAvoid,
  onSkip,
  onRetry,
  onRemove,
}: {
  notes: readonly GuidedCatalogNote[];
  families: readonly Family[];
  familyPreferenceIds: readonly string[];
  liked: readonly string[];
  avoided: readonly string[];
  status: NoteAffinityStatus | undefined;
  loading: boolean;
  error: string;
  empty: boolean;
  onLike: (id: string) => void;
  onAvoid: (id: string) => void;
  onSkip: () => void;
  onRetry: () => void;
  onRemove: (group: 'liked' | 'avoided', id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [expanded, setExpanded] = useState(false);
  const familyById = useMemo(() => new Map(families.map(family => [family.id.toLowerCase(), family])), [families]);
  const familyPreferenceOrder = useMemo(() => new Map(familyPreferenceIds.map((id, index) => [id.toLowerCase(), index])), [familyPreferenceIds]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fa');
    return notes.filter(note => {
      const familyMatches = !familyId || note.family_id?.toLowerCase() === familyId.toLowerCase();
      const family = note.family_id ? familyById.get(note.family_id.toLowerCase()) : undefined;
      const textMatches = !search || `${note.name} ${note.slug} ${family?.name ?? ''}`.toLocaleLowerCase('fa').includes(search);
      return familyMatches && textMatches;
    }).slice().sort((left, right) => {
      const leftOrder = left.family_id ? familyPreferenceOrder.get(left.family_id.toLowerCase()) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const rightOrder = right.family_id ? familyPreferenceOrder.get(right.family_id.toLowerCase()) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.name.localeCompare(right.name, 'fa') || left.slug.localeCompare(right.slug) || left.id.localeCompare(right.id);
    });
  }, [familyById, familyId, familyPreferenceOrder, notes, query]);

  const act = (note: GuidedCatalogNote, group: 'liked' | 'avoided') => {
    const same = group === 'liked' ? liked : avoided;
    const other = group === 'liked' ? avoided : liked;
    if (same.includes(note.id)) {
      onRemove(group, note.id);
      setFeedback(`«${note.name}» از فهرست انتخاب‌شده برداشته شد.`);
      return;
    }
    if (same.length >= 3) {
      setFeedback('در هر فهرست حداکثر سه نت می‌توانید انتخاب کنید.');
      return;
    }
    if (group === 'liked') onLike(note.id);
    else onAvoid(note.id);
    setFeedback(other.includes(note.id) ? `«${note.name}» به فهرست «${group === 'liked' ? 'دوست دارم' : 'ترجیح می‌دهم نباشد'}» منتقل شد.` : `«${note.name}» انتخاب شد.`);
  };

  return (
    <div className="guided-note-picker">
      <div className="guided-note-toolbar">
        <label className="guided-search-label">
          <span>جست‌وجو در نت‌ها</span>
          <input value={query} onChange={event => { setQuery(event.currentTarget.value); setExpanded(false); }} type="search" placeholder="نام یک نت را بنویسید" />
        </label>
        <label className="guided-family-label">
          <span>خانوادهٔ رایحه</span>
          <select value={familyId} onChange={event => { setFamilyId(event.currentTarget.value); setExpanded(false); }}>
            <option value="">همهٔ خانواده‌ها</option>
            {families.map(family => <option key={family.id} value={family.id}>{family.name}</option>)}
          </select>
        </label>
      </div>

      <div className="guided-affinity-counts" aria-label="شمار نت‌های انتخاب‌شده">
        <span>دوست دارم <b>{new Intl.NumberFormat('fa-IR').format(liked.length)} از ۳</b></span>
        <span>ترجیح می‌دهم نباشد <b>{new Intl.NumberFormat('fa-IR').format(avoided.length)} از ۳</b></span>
      </div>

      {loading && <div className="guided-inline-state" role="status"><span className="guided-spinner" aria-hidden="true" />در حال دریافت نت‌ها…</div>}
      {error && <div className="guided-inline-error" role="alert"><p>{error}</p><button type="button" className="guided-small-action" onClick={onRetry}>تلاش دوباره</button></div>}
      {!loading && !error && empty && <p className="guided-inline-state">در حال حاضر نتی برای انتخاب در دسترس نیست؛ می‌توانید این مرحله را رد کنید.</p>}
      {!loading && !error && !empty && filtered.length === 0 && <p className="guided-inline-state">نتی با این عبارت پیدا نشد.</p>}

      {!loading && !error && filtered.length > 0 && (
        <ul id="guided-note-list" className="guided-note-list" aria-label="نت‌های موجود در کاتالوگ" data-mobile-collapsed={!expanded}>
          {filtered.map(note => {
            const family = note.family_id ? familyById.get(note.family_id.toLowerCase()) : undefined;
            const mood = guidedFamilyMood(family?.slug);
            return (
              <li className="guided-note-item" data-mood={mood} key={note.id}>
                <span className="guided-note-orb" aria-hidden="true">✳</span>
                <span className="guided-note-info"><strong>{note.name}</strong><small>{family?.name ?? 'خانواده مشخص نشده'}</small></span>
                <div className="guided-note-actions">
                  <button type="button" aria-pressed={liked.includes(note.id)} onClick={() => act(note, 'liked')}>دوست دارم</button>
                  <button type="button" aria-pressed={avoided.includes(note.id)} onClick={() => act(note, 'avoided')}>کنار بگذار</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && filtered.length > 10 && <button
        type="button"
        className="guided-note-more"
        aria-controls="guided-note-list"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >{expanded ? 'نمایش نت‌های کمتر' : 'نمایش نت‌های بیشتر'} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span></button>}

      <div className="guided-affinity-selected">
        {liked.length > 0 && <div><strong>دوست دارم</strong>{liked.map(id => notes.find(note => note.id === id)).filter((note): note is GuidedCatalogNote => Boolean(note)).map(note => <span key={note.id}>{note.name}<button type="button" aria-label={`حذف ${note.name} از دوست دارم`} onClick={() => onRemove('liked', note.id)}>×</button></span>)}</div>}
        {avoided.length > 0 && <div><strong>ترجیح می‌دهم نباشد</strong>{avoided.map(id => notes.find(note => note.id === id)).filter((note): note is GuidedCatalogNote => Boolean(note)).map(note => <span key={note.id}>{note.name}<button type="button" aria-label={`حذف ${note.name} از فهرست کنارگذاشته‌ها`} onClick={() => onRemove('avoided', note.id)}>×</button></span>)}</div>}
      </div>

      <p className="guided-live-feedback" aria-live="polite" aria-atomic="true">{feedback}</p>
      <button type="button" className="guided-skip-button" aria-pressed={status === 'skipped'} onClick={onSkip}>
        <span aria-hidden="true">{status === 'skipped' ? '✓' : '○'}</span>فعلاً انتخابی ندارم
      </button>
      <p className="guided-help-copy">نت‌ها از کاتالوگ فعلی آرومان می‌آیند. انتخاب شما دربارهٔ همین نام‌هاست و دربارهٔ ترکیب یا عملکرد محصول واقعی وعده‌ای نمی‌دهد.</p>
    </div>
  );
}
