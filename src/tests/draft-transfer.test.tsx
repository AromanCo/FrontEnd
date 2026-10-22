import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { StudioDraftProvider, resolveStudioDraft, useStudioDraft } from '@/lib/studio/draft-transfer';
import type { Note } from '@/lib/api/client';

function Controls() {
  const { pending, navigationIntentId, createDraft, consume } = useStudioDraft();
  return <div>
    <output data-testid="pending">{JSON.stringify(pending)}</output>
    <output data-testid="intent">{navigationIntentId}</output>
    <button onClick={() => createDraft('رایحهٔ من', [{ noteId: '00000000-0000-4000-8000-000000000001', layer: 'top', position: 0 }])}>create</button>
    <button onClick={() => consume('stale-transfer')}>consume stale</button>
    <button onClick={() => pending && consume(pending.transferId)}>consume current</button>
  </div>;
}

describe('in-memory Studio draft transfer', () => {
  it('keeps only composition fields, creates unique IDs and replaces only on explicit creation', () => {
    const { getByText } = render(<StudioDraftProvider><Controls /></StudioDraftProvider>);
    fireEvent.click(getByText('create'));
    const first = JSON.parse(screen.getByTestId('pending').textContent ?? 'null');
    expect(first).toMatchObject({ name: 'رایحهٔ من', notes: [{ noteId: '00000000-0000-4000-8000-000000000001', layer: 'top', position: 0 }] });
    expect(Object.keys(first).sort()).toEqual(['name', 'notes', 'transferId']);
    expect(screen.getByTestId('intent')).toHaveTextContent(first.transferId);
    fireEvent.click(getByText('create'));
    const second = JSON.parse(screen.getByTestId('pending').textContent ?? 'null');
    expect(second.transferId).not.toBe(first.transferId);
    expect(screen.getByTestId('intent')).toHaveTextContent(second.transferId);
  });

  it('does not let a stale consumption request clear a newer draft and consumes a matching ID once', () => {
    render(<StudioDraftProvider><Controls /></StudioDraftProvider>);
    fireEvent.click(screen.getByText('create'));
    const transfer = JSON.parse(screen.getByTestId('pending').textContent ?? 'null');
    fireEvent.click(screen.getByText('consume stale'));
    expect(screen.getByTestId('pending')).toHaveTextContent(transfer.transferId);
    act(() => fireEvent.click(screen.getByText('consume current')));
    expect(screen.getByTestId('pending')).toHaveTextContent('null');
    expect(screen.getByTestId('intent')).toBeEmptyDOMElement();
  });
});

const catalogNote = (id: string, slug: string): Note => ({
  id, slug, name: slug, description: null, is_demo: true, family_id: '',
});

describe('Guided draft catalog resolution', () => {
  const base = { transferId: 'transfer-1', name: 'باغ', notes: [
    { noteId: '00000000-0000-4000-8000-000000000002', layer: 'heart' as const, position: 0 },
    { noteId: '00000000-0000-4000-8000-000000000001', layer: 'top' as const, position: 0 },
    { noteId: '00000000-0000-4000-8000-000000000003', layer: 'heart' as const, position: 1 },
  ] };

  it('resolves real note records and preserves layer and layer-local order deterministically', () => {
    const notes = [catalogNote('00000000-0000-4000-8000-000000000001', 'alpha'), catalogNote('00000000-0000-4000-8000-000000000002', 'beta'), catalogNote('00000000-0000-4000-8000-000000000003', 'gamma')];
    const result = resolveStudioDraft(base, notes);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.selected.map(item => [item.note.id, item.layer])).toEqual([
      ['00000000-0000-4000-8000-000000000001', 'top'], ['00000000-0000-4000-8000-000000000002', 'heart'], ['00000000-0000-4000-8000-000000000003', 'heart'],
    ]);
  });

  it('reports unavailable UUIDs without inventing replacement notes', () => {
    const result = resolveStudioDraft(base, [catalogNote('00000000-0000-4000-8000-000000000001', 'alpha')]);
    expect(result.status).toBe('missing');
    if (result.status === 'missing') {
      expect(result.missingIds).toEqual(['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']);
      expect(result.selected.map(item => item.note.id)).toEqual(['00000000-0000-4000-8000-000000000001']);
    }
  });

  it('rejects duplicate IDs, invalid layers, excessive note count and invalid positions', () => {
    expect(resolveStudioDraft({ ...base, notes: [base.notes[0]!, base.notes[0]!] }, []).status).toBe('invalid');
    expect(resolveStudioDraft({ ...base, notes: [{ noteId: 'x', layer: 'middle' as never, position: 0 }] }, []).status).toBe('invalid');
    expect(resolveStudioDraft({ ...base, notes: Array.from({ length: 7 }, (_, index) => ({ noteId: `n${index}`, layer: 'top' as const, position: index })) }, []).status).toBe('invalid');
    expect(resolveStudioDraft({ ...base, notes: [{ noteId: 'x', layer: 'top', position: 1 }] }, []).status).toBe('invalid');
  });
});
