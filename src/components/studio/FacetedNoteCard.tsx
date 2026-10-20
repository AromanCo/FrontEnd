import type { Family, Note } from '@/lib/api/client';
import { familyMood } from '@/lib/studio/presentation';

export function FacetedNoteCard({
  note,
  family,
  selected,
  atLimit,
  onSelect,
}: {
  note: Note;
  family?: Family;
  selected: boolean;
  atLimit: boolean;
  onSelect: () => void;
}) {
  const mood = familyMood(family?.name);
  return (
    <div className="faceted-note-frame" data-selected={selected} data-limit={atLimit && !selected}>
      <button
        type="button"
        className="faceted-note"
        data-note-id={note.id}
        data-mood={mood}
        aria-pressed={selected}
        aria-label={`${note.name}، خانواده ${family?.name || 'نامشخص'}${selected ? '، انتخاب‌شده' : ''}${atLimit && !selected ? '، سقف انتخاب پر است' : ''}`}
        disabled={selected}
        onClick={onSelect}
      >
        <span className="faceted-note-glyph" aria-hidden="true"><span /></span>
        <span className="faceted-note-name">{note.name}</span>
        <span className="faceted-note-family">{family?.name || 'خانواده رایحه'}</span>
        <span className="faceted-note-action" aria-hidden="true">{selected ? '✓' : '＋'}</span>
      </button>
    </div>
  );
}
