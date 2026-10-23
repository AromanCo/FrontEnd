import { describe, expect, it } from 'vitest';
import type { Note } from '@/lib/api/client';
import type { CompositionSnapshot } from '@/lib/studio/advisor/types';
import { ADVISOR_RULESET } from '@/lib/studio/advisor/rules';
import { recommendAdvisory, validateAdvisoryCandidate, validateConceptPayload } from '@/lib/studio/advisor/recommend';
import type { SelectedNote } from '@/lib/studio/composition';

// Synthetic catalog records for domain tests; they do not represent physical formulations.
const ids = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006',
];
const note = (index: number): Note => ({
  id: ids[index], slug: `synthetic-note-${index + 1}`, name: `نت آزمایشی ${index + 1}`,
  description: null, family_id: '20000000-0000-4000-8000-000000000001', is_demo: true,
});
const selected = (indexes: readonly number[], layers: readonly SelectedNote['layer'][]): SelectedNote[] =>
  indexes.map((index, offset) => ({ note: note(index), layer: layers[offset] }));
const snapshot = (items: readonly SelectedNote[], overrides: Partial<CompositionSnapshot> = {}): CompositionSnapshot => ({
  name: 'رایحهٔ آزمایشی', selected: items, revision: 4, compositionIdentity: 'composition-test-1',
  routeIntent: '/studio/creative', saveTargetId: null, ...overrides,
});
const fullCatalog = (items: readonly number[] = [0, 1, 2, 3, 4, 5]) => ({
  status: 'ready' as const, completeness: 'complete' as const, notes: items.map(note),
});

describe('Smart Perfumer pure editorial advisor', () => {
  it('returns byte-stable suggestion, rationale, provenance and ID for identical inputs', () => {
    const input = snapshot(selected([0, 1], ['heart', 'heart']));
    const first = recommendAdvisory(input, fullCatalog());
    const second = recommendAdvisory(input, fullCatalog());
    expect(first).toEqual(second);
    expect(first.status).toBe('suggestion');
    if (first.status === 'suggestion') {
      expect(first.suggestion.provenance).toEqual({ ...ADVISOR_RULESET, ruleId: 'explore-empty-layer' });
      expect(first.suggestion.id).toMatch(/^advisor:1\.0\.0:explore-empty-layer:/);
    }
  });

  it('does not depend on catalog response order and uses the fixed first empty layer', () => {
    const input = snapshot(selected([0, 1], ['heart', 'base']));
    const forward = recommendAdvisory(input, fullCatalog([0, 1, 2, 3]));
    const reverse = recommendAdvisory(input, fullCatalog([3, 2, 1, 0]));
    expect(forward).toEqual(reverse);
    expect(forward.status).toBe('suggestion');
    if (forward.status === 'suggestion') {
      expect(forward.suggestion.proposed.selected[0].layer).toBe('top');
      expect(forward.suggestion.changedNoteIds).toEqual([ids[0]]);
    }
  });

  it('returns typed no-guidance for an empty composition', () => {
    expect(recommendAdvisory(snapshot([]), { status: 'ready', completeness: 'complete', notes: [] }))
      .toEqual({ status: 'no-guidance', reason: 'empty' });
  });

  it('handles one-note and partial-layer compositions without adding or dropping records', () => {
    for (const arrangement of [selected([0], ['heart']), selected([0, 1, 2], ['top', 'heart', 'heart'])]) {
      const result = recommendAdvisory(snapshot(arrangement), fullCatalog());
      expect(result.status).toBe('suggestion');
      if (result.status === 'suggestion') {
        expect(result.suggestion.proposed.selected.map(item => item.note.id).sort())
          .toEqual(arrangement.map(item => item.note.id).sort());
        expect(result.suggestion.proposed.name).toBe('رایحهٔ آزمایشی');
      }
    }
  });

  it('swaps the first two notes in the first eligible occupied layer when all layers exist', () => {
    const items = selected([0, 1, 2, 3], ['top', 'top', 'heart', 'base']);
    const result = recommendAdvisory(snapshot(items), fullCatalog());
    expect(result.status).toBe('suggestion');
    if (result.status === 'suggestion') {
      expect(result.suggestion.provenance.ruleId).toBe('explore-layer-sequence');
      expect(result.suggestion.proposed.selected.map(item => item.note.id)).toEqual([ids[1], ids[0], ids[2], ids[3]]);
      expect(result.suggestion.changedNoteIds).toEqual([ids[0], ids[1]]);
    }
  });

  it('supports a full six-note concept without truncation or invented records', () => {
    const items = selected([0, 1, 2, 3, 4, 5], ['top', 'top', 'heart', 'heart', 'base', 'base']);
    const result = recommendAdvisory(snapshot(items), fullCatalog());
    expect(result.status).toBe('suggestion');
    if (result.status === 'suggestion') {
      expect(result.suggestion.proposed.selected).toHaveLength(6);
      expect(new Set(result.suggestion.proposed.selected.map(item => item.note.id)).size).toBe(6);
      expect(result.suggestion.payload.notes).toHaveLength(6);
      expect(result.suggestion.proposed.selected.map(item => item.note.id).sort()).toEqual(items.map(item => item.note.id).sort());
      expect(result.suggestion.proposed.selected.slice(0, 2).map(item => item.note.id)).toEqual([ids[1], ids[0]]);
    }
  });

  it('returns no guidance when each layer has one note and no structural rule applies', () => {
    expect(recommendAdvisory(snapshot(selected([0, 1, 2], ['top', 'heart', 'base'])), fullCatalog()))
      .toEqual({ status: 'no-guidance', reason: 'no-structural-rule' });
  });

  it('rejects duplicate selected IDs, invalid layers and malformed source names', () => {
    const duplicate = selected([0, 0], ['heart', 'base']);
    expect(recommendAdvisory(snapshot(duplicate), fullCatalog()).status).toBe('invalid');
    const invalidLayer = selected([0], ['heart']);
    (invalidLayer[0] as { layer: string }).layer = 'middle';
    const invalid = recommendAdvisory(snapshot(invalidLayer), fullCatalog());
    expect(invalid).toMatchObject({ status: 'invalid', reason: 'invalid-source', issues: ['invalid-layer'] });
    expect(recommendAdvisory(snapshot(selected([0], ['heart']), { name: '  ' }), fullCatalog()))
      .toMatchObject({ status: 'invalid', issues: ['empty-name'] });
  });

  it('distinguishes unknown catalog IDs, stale IDs and incomplete catalog snapshots', () => {
    expect(recommendAdvisory(snapshot(selected([0], ['heart'])), { ...fullCatalog(), completeness: 'partial' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-incomplete' });
    expect(recommendAdvisory(snapshot(selected([0], ['heart'])), fullCatalog([1, 2])))
      .toEqual({ status: 'unavailable', reason: 'stale-selection' });
    expect(recommendAdvisory(snapshot(selected([0], ['heart'])), { status: 'loading' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-loading' });
    expect(recommendAdvisory(snapshot(selected([0], ['heart'])), { status: 'failed' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-failed' });
  });

  it('fails closed on conflicting catalog records for a selected UUID', () => {
    const conflicting = { ...note(0), name: 'دادهٔ متناقض' };
    const result = recommendAdvisory(snapshot(selected([0], ['heart'])), {
      ...fullCatalog(), notes: [...fullCatalog().notes, conflicting],
    });
    expect(result).toEqual({ status: 'unavailable', reason: 'catalog-conflict' });
  });

  it('keeps the source snapshot and its records immutable while returning detached snapshots', () => {
    const items = selected([0, 1], ['heart', 'heart']);
    const input = snapshot(items);
    const before = JSON.stringify(input);
    const result = recommendAdvisory(input, fullCatalog());
    expect(JSON.stringify(input)).toBe(before);
    expect(result.status).toBe('suggestion');
    if (result.status === 'suggestion') {
      expect(result.suggestion.original).not.toBe(input);
      expect(result.suggestion.proposed.selected).not.toBe(input.selected);
      expect(Object.isFrozen(result.suggestion.proposed.selected)).toBe(true);
      expect(Object.isFrozen(result.suggestion.proposed.selected[0].note)).toBe(true);
      expect(result.suggestion.original.name).toBe(input.name);
    }
  });

  it('derives valid contiguous payload positions and preserves selected note identities', () => {
    const input = snapshot(selected([0, 1, 2], ['heart', 'heart', 'base']));
    const result = recommendAdvisory(input, fullCatalog());
    expect(result.status).toBe('suggestion');
    if (result.status === 'suggestion') {
      expect(result.suggestion.payload).toEqual({
        name: 'رایحهٔ آزمایشی',
        notes: [
          { note_id: ids[0], layer: 'top', position: 0 },
          { note_id: ids[1], layer: 'heart', position: 0 },
          { note_id: ids[2], layer: 'base', position: 0 },
        ],
      });
      expect(validateAdvisoryCandidate(input, result.suggestion.proposed, fullCatalog())).toEqual({ status: 'valid' });
    }
  });

  it('validates negative, duplicate and non-contiguous layer-local payload positions', () => {
    const catalog = [note(0), note(1), note(2)];
    expect(validateConceptPayload({ name: 'x', notes: [{ note_id: ids[0], layer: 'top', position: -1 }] }, catalog))
      .toContain('invalid-position');
    expect(validateConceptPayload({ name: 'x', notes: [
      { note_id: ids[0], layer: 'top', position: 0 }, { note_id: ids[1], layer: 'top', position: 0 },
    ] }, catalog)).toContain('duplicate-layer-position');
    expect(validateConceptPayload({ name: 'x', notes: [
      { note_id: ids[0], layer: 'top', position: 1 },
    ] }, catalog)).toContain('non-contiguous-position');
  });

  it('carries editorial-only Persian rationale without compatibility, safety, or production claims', () => {
    const result = recommendAdvisory(snapshot(selected([0], ['heart'])), fullCatalog());
    expect(result.status).toBe('suggestion');
    if (result.status === 'suggestion') {
      const copy = `${result.suggestion.titleFa} ${result.suggestion.rationaleFa} ${result.suggestion.limitationsFa.join(' ')}`;
      expect(copy).toContain('مفهومی');
      expect(copy).not.toMatch(/سازگاری|هماهنگی|خوشبو|بدبو|ماندگاری|فرمول تولید/);
      expect(result.suggestion.provenance.labelFa).toBe('راهنمای ویرایشی آرومان');
    }
  });

  it('does not allow a candidate to change the customer name or silently drop notes', () => {
    const original = snapshot(selected([0, 1], ['heart', 'base']));
    const renamed = snapshot(selected([0, 1], ['top', 'base']), { name: 'نام دیگر' });
    expect(validateAdvisoryCandidate(original, renamed, fullCatalog())).toMatchObject({ status: 'invalid', issues: ['name-changed'] });
    const dropped = snapshot(selected([0], ['top']));
    expect(validateAdvisoryCandidate(original, dropped, fullCatalog())).toMatchObject({ status: 'invalid', issues: ['selection-changed'] });
    const staleSource = snapshot(selected([0, 1], ['top', 'base']), { revision: original.revision + 1 });
    expect(validateAdvisoryCandidate(original, staleSource, fullCatalog())).toMatchObject({ status: 'invalid', issues: ['source-token-changed'] });
  });

  it('rejects candidate note metadata substitution even when the UUID is unchanged', () => {
    const original = snapshot(selected([0, 1], ['heart', 'base']));
    const candidateNotes = selected([0, 1], ['top', 'base']);
    candidateNotes[0] = { ...candidateNotes[0], note: { ...candidateNotes[0].note, name: 'نام جایگزین' } };
    const candidate = snapshot(candidateNotes);
    expect(validateAdvisoryCandidate(original, candidate, fullCatalog())).toEqual({
      status: 'invalid', issues: ['note-metadata-mismatch'],
    });
  });

  it('checks the original selected note metadata against the authoritative catalog too', () => {
    const sourceNotes = selected([0, 1], ['heart', 'base']);
    sourceNotes[0] = { ...sourceNotes[0], note: { ...sourceNotes[0].note, description: 'توضیح جایگزین' } };
    const original = snapshot(sourceNotes);
    const candidate = snapshot(selected([0, 1], ['top', 'base']));
    expect(validateAdvisoryCandidate(original, candidate, fullCatalog())).toEqual({
      status: 'invalid', issues: ['note-metadata-mismatch'],
    });
  });

  it('does not validate an Apply candidate against a partial, loading, or failed catalog', () => {
    const original = snapshot(selected([0, 1], ['heart', 'base']));
    const candidate = snapshot(selected([0, 1], ['top', 'base']));
    expect(validateAdvisoryCandidate(original, candidate, { ...fullCatalog(), completeness: 'partial' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-incomplete' });
    expect(validateAdvisoryCandidate(original, candidate, { status: 'loading' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-loading' });
    expect(validateAdvisoryCandidate(original, candidate, { status: 'failed' }))
      .toEqual({ status: 'unavailable', reason: 'catalog-failed' });
  });

  it('accepts a complete catalog when both snapshots contain matching authoritative note records', () => {
    const original = snapshot(selected([0, 1], ['heart', 'base']));
    const candidate = snapshot(selected([0, 1], ['top', 'base']));
    expect(validateAdvisoryCandidate(original, candidate, fullCatalog())).toEqual({ status: 'valid' });
  });
});
