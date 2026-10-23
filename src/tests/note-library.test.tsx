import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import type { Family, Note } from '@/lib/api/client';
import { NoteLibrary } from '@/components/studio/NoteLibrary';

const family: Family = { id: 'family-1', slug: 'floral', name: 'گلی', description: null, is_demo: true };
const notes: Note[] = Array.from({ length: 24 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  slug: `note-${index + 1}`,
  name: `نت ${index + 1}`,
  description: null,
  is_demo: true,
  family_id: family.id,
}));

function Harness() {
  const [query, setQuery] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = notes.filter(note => (!query || note.name.includes(query)) && (!familyId || note.family_id === familyId));
  return <NoteLibrary
    notes={filtered} families={[family]} selectedIds={selected} count={selected.size} query={query} familyId={familyId}
    loading={false} noteError="" familyError="" hasMore={false} active onQuery={setQuery} onFamily={setFamilyId}
    onSelect={note => setSelected(current => new Set(current).add(note.id))} onRetry={vi.fn()} onRetryFamilies={vi.fn()}
    onMore={vi.fn()} onContinue={vi.fn()}
  />;
}

describe('Creative Studio note library progressive disclosure', () => {
  it('starts collapsed on the mobile presentation, keeps all loaded notes available, and expands by button', () => {
    render(<Harness />);
    const results = screen.getByRole('tabpanel', { name: 'کتابخانه نت‌ها' }).querySelector('.faceted-note-grid');
    expect(results).toHaveAttribute('data-mobile-collapsed', 'true');
    expect(results?.querySelectorAll('.faceted-note-frame')).toHaveLength(24);
    const more = screen.getByRole('button', { name: 'نمایش ۱۴ نت دیگر' });
    expect(more).toHaveAttribute('aria-controls', 'studio-note-results');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(results).toHaveAttribute('data-mobile-collapsed', 'false');
    expect(screen.getByRole('button', { name: 'نمایش نت‌های کمتر' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('resets expansion after search or family changes and keeps filtered loaded notes discoverable', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'نمایش ۱۴ نت دیگر' }));
    const search = screen.getByRole('textbox', { name: 'جستجوی نت' });
    fireEvent.change(search, { target: { value: 'نت 24' } });
    expect(screen.getByRole('button', { name: /نت 24، خانواده گلی/ })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'نمایش ۱۴ نت دیگر' })).toHaveAttribute('aria-expanded', 'false'));
    fireEvent.click(screen.getByRole('button', { name: 'نمایش ۱۴ نت دیگر' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'خانواده رایحه' }), { target: { value: family.id } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'نمایش ۱۴ نت دیگر' })).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.getAllByRole('button', { name: /خانواده گلی/ })).toHaveLength(24);
  });
});
