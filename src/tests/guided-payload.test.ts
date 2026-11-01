import { describe, expect, it } from 'vitest';
import { toConceptInput } from '@/lib/studio/guided/payload';
import { recommend } from '@/lib/studio/guided/recommendation';
import type { GuidedSelection, RecommendationResult } from '@/lib/studio/guided/types';
import { answer, seedFamilies, seedNotes, uuid } from './guided-fixtures';

const ready = (result: RecommendationResult) => {
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('Expected ready recommendation');
  return result;
};

describe('Guided concept payload conversion', () => {
  it('emits exactly the existing concept schema with actual current API UUIDs', () => {
    const recommendation = ready(recommend(answer(), seedFamilies, seedNotes));
    const converted = toConceptInput(recommendation, '  باغ من  ', seedNotes);
    expect(converted).toEqual({
      status: 'ready',
      payload: {
        name: 'باغ من',
        notes: [
          { note_id: recommendation.selections[0]!.note.id, layer: 'top', position: 0 },
          { note_id: recommendation.selections[1]!.note.id, layer: 'heart', position: 0 },
          { note_id: recommendation.selections[2]!.note.id, layer: 'base', position: 0 },
          { note_id: recommendation.selections[3]!.note.id, layer: 'heart', position: 1 },
        ],
      },
    });
    if (converted.status === 'ready') {
      expect(Object.keys(converted.payload).sort()).toEqual(['name', 'notes']);
      expect(Object.keys(converted.payload.notes![0]!).sort()).toEqual(['layer', 'note_id', 'position']);
    }
  });
  it('uses the approved default name and rejects overlong names or stale notes', () => {
    const recommendation = ready(recommend(answer(), seedFamilies, seedNotes));
    expect(toConceptInput(recommendation, ' ', seedNotes)).toMatchObject({ status: 'ready', payload: { name: 'رایحهٔ من' } });
    expect(toConceptInput(recommendation, 'ا'.repeat(61), seedNotes).status).toBe('invalid');
    expect(toConceptInput(recommendation, 'نام', seedNotes.slice(0, 1))).toMatchObject({ status: 'invalid', issues: expect.arrayContaining([expect.objectContaining({ code: 'stale-note' })]) });
  });
  it('never serializes no-match or invalid recommendations as successful concepts', () => {
    const noMatch = recommend(answer(), seedFamilies, []);
    const invalid: RecommendationResult = { status: 'invalid', reason: 'invalid-answers', issues: [], notices: [], explanation: [] };
    expect(toConceptInput(noMatch, 'نام', seedNotes).status).toBe('invalid');
    expect(toConceptInput(invalid, 'نام', seedNotes).status).toBe('invalid');
  });
  it('supports the existing six-note concept cap while requiring contiguous layer-local positions', () => {
    const layers = ['top', 'heart', 'base', 'heart', 'top', 'base'] as const;
    const counts = new Map<string, number>();
    const selections: GuidedSelection[] = seedNotes.slice(0, 6).map((note, index) => {
      const layer = layers[index]!;
      const position = counts.get(layer) ?? 0;
      counts.set(layer, position + 1);
      return { note, layer, position };
    });
    const synthetic: RecommendationResult = {
      status: 'ready', selections, explanation: [], notices: [], familyScores: [], usedBalancedFallback: false,
    };
    const converted = toConceptInput(synthetic, 'نام', seedNotes);
    expect(converted.status).toBe('ready');
    expect(converted.status === 'ready' && converted.payload.notes).toHaveLength(6);
    const malformed: RecommendationResult = {
      ...synthetic,
      selections: selections.map((selection, index) => index === 1 ? { ...selection, position: 2 } : selection),
    };
    expect(toConceptInput(malformed, 'نام', seedNotes)).toMatchObject({ status: 'invalid', issues: expect.arrayContaining([expect.objectContaining({ code: 'invalid-position' })]) });
  });
  it('rejects repeated IDs even if the result is otherwise ready', () => {
    const recommendation = ready(recommend(answer(), seedFamilies, seedNotes));
    const duplicate: RecommendationResult = {
      ...recommendation,
      selections: [...recommendation.selections, { ...recommendation.selections[0]!, layer: 'base', position: 1 }],
    };
    expect(toConceptInput(duplicate, 'نام', seedNotes)).toMatchObject({ status: 'invalid', issues: expect.arrayContaining([expect.objectContaining({ code: 'duplicate' })]) });
  });
  it('does not send editorial or answer data', () => {
    const recommendation = ready(recommend(answer({ likedNoteIds: [seedNotes[0]!.id], noteAffinityStatus: 'selected' }), seedFamilies, seedNotes));
    const converted = toConceptInput(recommendation, 'نام', seedNotes);
    if (converted.status !== 'ready') throw new Error('Expected valid payload');
    expect(JSON.stringify(converted.payload)).not.toMatch(/feeling|familyIds|discovery|score|explanation|noteAffinity/i);
    expect(converted.payload.notes?.every(item => [uuid(1), uuid(2), uuid(3), uuid(4), uuid(5), uuid(6)].includes(seedNotes.find(note => note.id === item.note_id)?.family_id ?? ''))).toBe(true);
  });
});
