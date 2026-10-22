import { describe, expect, it } from 'vitest';
import { GUIDED_RECOMMENDATION_CONFIG } from '@/lib/studio/guided/config';
import { recommend, scoreFamilies } from '@/lib/studio/guided/recommendation';
import type { Family } from '@/lib/api/client';
import type { GuidedCatalogNote } from '@/lib/studio/guided/types';
import {
  answer,
  noteBySlug,
  seedFamilies,
  seedNotes,
  selectedSlugs,
  selectionTuples,
  uuid,
} from './guided-fixtures';

const ready = (value: ReturnType<typeof recommend>) => {
  expect(value.status).toBe('ready');
  if (value.status !== 'ready') throw new Error(`Expected ready, received ${value.status}`);
  return value;
};
const scoresBySlug = (scores: readonly { slug: string; score: number }[]) => Object.fromEntries(scores.map(item => [item.slug, item.score]));
const tuples = (result: ReturnType<typeof recommend>) => selectionTuples(ready(result));
const note = (id: number, slug: string, familyId: string | null, name = slug): GuidedCatalogNote => ({
  id: uuid(id), slug, name, description: null, is_demo: true, family_id: familyId,
});

describe('Guided editorial configuration and scoring', () => {
  it('matches every approved feeling, temperature, and scene mapping row', () => {
    expect(GUIDED_RECOMMENDATION_CONFIG.feeling).toEqual({
      calm: { floral: 2, fresh: 1 }, bright: { fresh: 2, citrus: 2 },
      confident: { woody: 2, amber: 1 }, intimate: { floral: 1, gourmand: 2, amber: 1 },
      curious: { citrus: 1, woody: 1, gourmand: 1, amber: 1 },
    });
    expect(GUIDED_RECOMMENDATION_CONFIG.temperature).toEqual({
      bright: { fresh: 3, citrus: 2 }, soft: { floral: 1, fresh: 1, woody: 1 }, warm: { amber: 3, woody: 2, gourmand: 1 },
    });
    expect(GUIDED_RECOMMENDATION_CONFIG.scene).toEqual({
      rainGarden: { fresh: 2, floral: 1 }, citrusMorning: { citrus: 2, fresh: 1 }, quietFlowers: { floral: 2 },
      woodland: { woody: 2, fresh: 1 }, warmEvening: { amber: 2, woody: 1 }, coffeePause: { gourmand: 2, amber: 1 },
    });
  });
  it('applies selected +8 and discovery adjustments only to returned known families', () => {
    const input = answer({ feeling: 'bright', familyIds: [uuid(1)], temperature: 'warm', scene: 'quietFlowers', discovery: 'balanced' });
    const scores = scoresBySlug(scoreFamilies(input, seedFamilies));
    expect(scores).toEqual({ amber: 1, citrus: 0, floral: 10, fresh: 0, gourmand: -1, woody: 0 });
    const unknownSlug: Family = { id: uuid(50), slug: 'unmapped-family', name: 'ناشناخته', description: null, is_demo: true };
    const unknownScore = scoreFamilies(input, [...seedFamilies, unknownSlug]).find(item => item.familyId === uuid(50));
    expect(unknownScore?.score).toBe(-2);
    expect(scoreFamilies(answer({ familyIds: [uuid(50)] }), [unknownSlug])[0]?.score).toBe(8);
  });
  it('keeps Example 4 corrected score vector exact', () => {
    const result = recommend(answer({ feeling: 'bright', familyIds: [uuid(1), uuid(3)], temperature: 'warm', scene: 'quietFlowers' }), seedFamilies, seedNotes);
    expect(scoresBySlug(ready(result).familyScores)).toEqual({ amber: 1, citrus: 0, floral: 10, fresh: 0, gourmand: -1, woody: 10 });
  });
});

describe('Guided selection, exclusions, and discovery behavior', () => {
  it('preserves explicit liked notes in input order, including an outside-family note', () => {
    const likes = [noteBySlug('coffee'), noteBySlug('rose')].map(item => item.id);
    const result = ready(recommend(answer({ likedNoteIds: likes, noteAffinityStatus: 'selected' }), seedFamilies, seedNotes));
    expect(result.selections.slice(0, 2).map(item => item.note.id)).toEqual(likes);
  });
  it('familiar permits liked outside and unresolved notes, but no ordinary outside candidates', () => {
    const unresolved = note(500, 'liked-unresolved', null, 'نت با خانواده نامشخص');
    const catalog = [...seedNotes, unresolved];
    const result = ready(recommend(answer({ discovery: 'familiar', likedNoteIds: [noteBySlug('coffee').id, unresolved.id], noteAffinityStatus: 'selected' }), seedFamilies, catalog));
    expect(result.selections.slice(0, 2).map(item => item.note.id)).toEqual([noteBySlug('coffee').id, unresolved.id]);
    expect(result.explanation.join(' ')).toContain('نت با خانواده نامشخص');
    expect(result.selections.some(item => item.note.slug === 'bergamot')).toBe(false);
  });
  it('hard exclusions win and overlapping liked/avoided answers are invalid', () => {
    const coffee = noteBySlug('coffee');
    const rejected = recommend(answer({ likedNoteIds: [coffee.id], avoidedNoteIds: [coffee.id], noteAffinityStatus: 'selected' }), seedFamilies, seedNotes);
    expect(rejected.status).toBe('invalid');
    const result = ready(recommend(answer({ discovery: 'exploratory', avoidedNoteIds: [noteBySlug('green-tea').id] }), seedFamilies, seedNotes));
    expect(result.selections.some(item => item.note.slug === 'green-tea')).toBe(false);
  });
  it('Balanced stays within selected families when there are enough candidates (Example 4)', () => {
    const result = ready(recommend(answer({ feeling: 'bright', familyIds: [uuid(1), uuid(3)], temperature: 'warm', scene: 'quietFlowers', discovery: 'balanced' }), seedFamilies, seedNotes));
    expect(selectedSlugs(result)).toEqual(['iris', 'cedar', 'jasmine', 'pine']);
    expect(result.selections.every(item => [uuid(1), uuid(3)].includes(item.note.family_id ?? ''))).toBe(true);
    expect(result.usedBalancedFallback).toBe(false);
  });
  it('Balanced falls back when selected notes are insufficient and does not label this guaranteed exploration', () => {
    const result = ready(recommend(answer({ discovery: 'balanced', avoidedNoteIds: [noteBySlug('rose').id, noteBySlug('jasmine').id, noteBySlug('lavender').id] }), seedFamilies, seedNotes));
    expect(selectedSlugs(result)).toEqual(['iris', 'orange-blossom', 'violet', 'green-tea']);
    expect(result.usedBalancedFallback).toBe(true);
    expect(result.explanation.join(' ')).toContain('محدودیت نت‌های خانواده‌های انتخابی');
  });
  it('Exploratory reserves the highest-ranked known outside-family note and leaves liked notes first', () => {
    const result = ready(recommend(answer({ discovery: 'exploratory', avoidedNoteIds: [noteBySlug('rose').id, noteBySlug('jasmine').id, noteBySlug('lavender').id] }), seedFamilies, seedNotes));
    expect(selectedSlugs(result)).toEqual(['green-tea', 'iris', 'orange-blossom', 'violet']);
    expect(result.exploratoryReservedNoteId).toBe(noteBySlug('green-tea').id);
    expect(result.explanation.join(' ')).toContain('برای کمی کشف بیشتر');
  });
  it('an explicitly liked known outside-family note satisfies exploratory reservation', () => {
    const result = ready(recommend(answer({ discovery: 'exploratory', likedNoteIds: [noteBySlug('coffee').id], noteAffinityStatus: 'selected' }), seedFamilies, seedNotes));
    expect(result.selections[0]?.note.slug).toBe('coffee');
    expect(result.exploratoryReservedNoteId).toBeUndefined();
    expect(result.explanation.join(' ')).not.toContain('برای کمی کشف بیشتر');
  });
  it('never treats null or unknown family relationships as exploratory expansion', () => {
    const nullNote = note(501, 'null-note', null);
    const unknownNote = note(502, 'unknown-note', uuid(99));
    const catalog = [...seedNotes.filter(item => item.family_id === uuid(1)).slice(0, 4), nullNote, unknownNote];
    const result = ready(recommend(answer({ discovery: 'exploratory' }), seedFamilies, catalog));
    expect(result.exploratoryReservedNoteId).toBeUndefined();
    expect(result.explanation.join(' ')).toContain('نتِ دیگری از خانواده‌های متفاوت');
  });
  it('orders null family bucket, unknown UUID buckets, then slug and note UUID deterministically', () => {
    const firstUnknown = uuid(98);
    const secondUnknown = uuid(99);
    const unresolved = [
      note(800, 'z-null', null), note(801, 'a-null', null),
      note(802, 'b-unknown-first', firstUnknown), note(803, 'a-unknown-first', firstUnknown),
      note(804, 'a-unknown-second', secondUnknown),
    ];
    const result = ready(recommend(answer({ discovery: 'balanced' }), seedFamilies, unresolved));
    expect(selectedSlugs(result)).toEqual(['a-null', 'z-null', 'a-unknown-first', 'b-unknown-first']);
    expect(result.selections.some(item => item.note.family_id === secondUnknown)).toBe(false);
  });
  it('returns honest no-match states for empty catalog, all excluded, and familiar scope', () => {
    expect(recommend(answer(), seedFamilies, []).status).toBe('no-match');
    const all = seedNotes.map(item => item.id);
    const excluded = recommend(answer({ avoidedNoteIds: all.slice(0, 3), discovery: 'familiar' }), seedFamilies, seedNotes.slice(0, 3));
    expect(excluded).toMatchObject({ status: 'no-match', reason: 'all-excluded' });
    const outside = seedNotes.filter(item => item.family_id === uuid(2));
    expect(recommend(answer({ discovery: 'familiar' }), seedFamilies, outside)).toMatchObject({ status: 'no-match', reason: 'familiar-scope-empty' });
  });
  it('returns fewer than four when only fewer unique catalog notes are eligible', () => {
    const two = seedNotes.filter(item => ['rose', 'iris'].includes(item.slug));
    expect(ready(recommend(answer({ discovery: 'familiar' }), seedFamilies, two)).selections).toHaveLength(2);
  });
});

describe('Worked recommendation examples', () => {
  it('matches Example 1 — floral and calm', () => {
    const result = ready(recommend(answer({ feeling: 'calm', familyIds: [uuid(1)], temperature: 'soft', scene: 'quietFlowers', likedNoteIds: [noteBySlug('rose').id, noteBySlug('lavender').id], noteAffinityStatus: 'selected', discovery: 'familiar' }), seedFamilies, seedNotes));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: 0, citrus: 0, floral: 13, fresh: 2, gourmand: 0, woody: 1 });
    expect(tuples(result)).toEqual([['rose', 'top', 0], ['lavender', 'heart', 0], ['iris', 'base', 0], ['jasmine', 'heart', 1]]);
  });
  it('matches Example 2 — fresh and bright', () => {
    const result = ready(recommend(answer({ feeling: 'bright', familyIds: [uuid(5), uuid(2)], temperature: 'bright', scene: 'rainGarden', discovery: 'balanced' }), seedFamilies, seedNotes));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: -2, citrus: 12, floral: -1, fresh: 15, gourmand: -2, woody: -2 });
    expect(tuples(result)).toEqual([['green-tea', 'top', 0], ['bergamot', 'heart', 0], ['mint', 'base', 0], ['grapefruit', 'heart', 1]]);
  });
  it('matches Example 3 — warm and woody', () => {
    const result = ready(recommend(answer({ feeling: 'confident', familyIds: [uuid(3), uuid(4)], temperature: 'warm', scene: 'woodland', likedNoteIds: [noteBySlug('cedar').id], noteAffinityStatus: 'selected', discovery: 'familiar' }), seedFamilies, seedNotes));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: 12, citrus: 0, floral: 0, fresh: 1, gourmand: 1, woody: 14 });
    expect(tuples(result)).toEqual([['cedar', 'top', 0], ['pine', 'heart', 0], ['amber', 'base', 0], ['incense', 'heart', 1]]);
  });
  it('matches Example 4 — different selected families, exact corrected scores, Balanced stays selected', () => {
    const result = ready(recommend(answer({ feeling: 'bright', familyIds: [uuid(1), uuid(3)], temperature: 'warm', scene: 'quietFlowers', discovery: 'balanced' }), seedFamilies, seedNotes));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: 1, citrus: 0, floral: 10, fresh: 0, gourmand: -1, woody: 10 });
    expect(tuples(result)).toEqual([['iris', 'top', 0], ['cedar', 'heart', 0], ['jasmine', 'base', 0], ['pine', 'heart', 1]]);
  });
  it('matches Example 5 — explicit hard exclusions', () => {
    const result = ready(recommend(answer({ feeling: 'intimate', familyIds: [uuid(6), uuid(4)], temperature: 'warm', scene: 'coffeePause', likedNoteIds: [noteBySlug('cocoa').id], avoidedNoteIds: [noteBySlug('vanilla').id, noteBySlug('coffee').id], noteAffinityStatus: 'selected', discovery: 'balanced' }), seedFamilies, seedNotes));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: 13, citrus: -2, floral: -1, fresh: -2, gourmand: 13, woody: 0 });
    expect(tuples(result)).toEqual([['cocoa', 'top', 0], ['amber', 'heart', 0], ['incense', 'base', 0], ['saffron', 'heart', 1]]);
    expect(result.selections.some(item => ['vanilla', 'coffee'].includes(item.note.slug))).toBe(false);
  });
  it('matches Example 6 — incomplete catalog without padding', () => {
    const incomplete = [note(900, 'rose', uuid(1), 'رز'), note(901, 'cedar', uuid(90), 'سدر')];
    const result = ready(recommend(answer({ feeling: 'calm', familyIds: [uuid(1)], temperature: 'soft', scene: 'quietFlowers', discovery: 'balanced' }), seedFamilies, incomplete));
    expect(scoresBySlug(result.familyScores)).toEqual({ amber: -2, citrus: -2, floral: 13, fresh: 0, gourmand: -2, woody: -1 });
    expect(tuples(result)).toEqual([['rose', 'top', 0], ['cedar', 'heart', 0]]);
    expect(result.explanation.join(' ')).toContain('اطلاعات خانوادهٔ برخی نت‌های کاتالوگ');
  });
  it('matches Example 7 — familiar, balanced fallback, exploratory reservation', () => {
    const common = { feeling: 'calm' as const, familyIds: [uuid(1)], temperature: 'soft' as const, scene: 'quietFlowers' as const, avoidedNoteIds: [noteBySlug('rose').id, noteBySlug('jasmine').id, noteBySlug('lavender').id] };
    const familiar = ready(recommend(answer({ ...common, discovery: 'familiar' }), seedFamilies, seedNotes));
    const balanced = ready(recommend(answer({ ...common, discovery: 'balanced' }), seedFamilies, seedNotes));
    const exploratory = ready(recommend(answer({ ...common, discovery: 'exploratory' }), seedFamilies, seedNotes));
    expect(scoresBySlug(familiar.familyScores)).toEqual({ amber: 0, citrus: 0, floral: 13, fresh: 2, gourmand: 0, woody: 1 });
    expect(scoresBySlug(balanced.familyScores)).toEqual({ amber: -2, citrus: -2, floral: 13, fresh: 0, gourmand: -2, woody: -1 });
    expect(scoresBySlug(exploratory.familyScores)).toEqual({ amber: 2, citrus: 2, floral: 13, fresh: 4, gourmand: 2, woody: 3 });
    expect(selectedSlugs(familiar)).toEqual(['iris', 'orange-blossom', 'violet']);
    expect(selectedSlugs(balanced)).toEqual(['iris', 'orange-blossom', 'violet', 'green-tea']);
    expect(selectedSlugs(exploratory)).toEqual(['green-tea', 'iris', 'orange-blossom', 'violet']);
    expect(tuples(familiar)).toEqual([['iris', 'top', 0], ['orange-blossom', 'heart', 0], ['violet', 'base', 0]]);
    expect(tuples(balanced)).toEqual([['iris', 'top', 0], ['orange-blossom', 'heart', 0], ['violet', 'base', 0], ['green-tea', 'heart', 1]]);
    expect(tuples(exploratory)).toEqual([['green-tea', 'top', 0], ['iris', 'heart', 0], ['orange-blossom', 'base', 0], ['violet', 'heart', 1]]);
    expect(balanced.usedBalancedFallback).toBe(true);
    expect(exploratory.exploratoryReservedNoteId).toBe(noteBySlug('green-tea').id);
  });
});

describe('Determinism, stable ties, and conceptual layers', () => {
  it('is invariant to family and note API array ordering', () => {
    const input = answer({ discovery: 'exploratory', familyIds: [uuid(3), uuid(1)] });
    const first = recommend(input, seedFamilies, seedNotes);
    const second = recommend(input, [...seedFamilies].reverse(), [...seedNotes].reverse());
    expect(second).toMatchObject({ status: first.status });
    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status === 'ready' && second.status === 'ready') {
      expect(second.selections.map(item => [item.note.id, item.layer, item.position])).toEqual(first.selections.map(item => [item.note.id, item.layer, item.position]));
      expect(second.explanation).toEqual(first.explanation);
      expect(second.familyScores).toEqual(first.familyScores);
    }
  });
  it('uses family tap order for equal selected-family scores and slug then UUID for note ties', () => {
    const customFamilies: Family[] = [
      { id: uuid(11), slug: 'zeta', name: 'زتا', description: null, is_demo: true },
      { id: uuid(12), slug: 'alpha', name: 'آلفا', description: null, is_demo: true },
    ];
    const customNotes = [note(120, 'same', uuid(11)), note(119, 'same', uuid(11)), note(121, 'beta', uuid(11)), note(122, 'alpha', uuid(12))];
    const result = ready(recommend(answer({ familyIds: [uuid(11), uuid(12)], feeling: 'calm', temperature: 'bright', scene: 'citrusMorning', discovery: 'familiar' }), customFamilies, customNotes));
    expect(selectedSlugs(result)).toEqual(['beta', 'alpha', 'same', 'same']);
    expect(result.selections.slice(0, 2).map(item => item.note.family_id)).toEqual([uuid(11), uuid(12)]);
    expect(result.selections.slice(2).map(item => item.note.id)).toEqual([uuid(119), uuid(120)]);
  });
  it('uses the fixed conceptual layer sequence and contiguous layer-local positions', () => {
    const result = ready(recommend(answer({ discovery: 'familiar' }), seedFamilies, seedNotes));
    expect(result.selections.map(item => [item.layer, item.position])).toEqual([['top', 0], ['heart', 0], ['base', 0], ['heart', 1]]);
    expect(new Set(result.selections.map(item => item.note.id)).size).toBe(result.selections.length);
  });
  it('reports stale liked records honestly and does not substitute a similarly named note', () => {
    const missing = uuid(9999);
    const result = recommend(answer({ likedNoteIds: [missing], noteAffinityStatus: 'selected' }), seedFamilies, seedNotes);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.selections.some(item => item.note.id === missing)).toBe(false);
      expect(result.notices.join(' ')).toContain('دیگر در کاتالوگ نیست');
    }
  });
  it('grounds Persian explanations in returned family and note names without performance or safety claims', () => {
    const result = ready(recommend(answer({ likedNoteIds: [noteBySlug('rose').id], noteAffinityStatus: 'selected' }), seedFamilies, seedNotes));
    const explanation = result.explanation.join(' ');
    expect(explanation).toContain('گلی');
    expect(explanation).toContain('رز');
    expect(explanation).toContain('پیشنهاد مفهومی');
    expect(explanation).not.toMatch(/۱۲ ساعت|ماندگاری|پخش بو|ضدحساسیت|ایمن|سازگار شیمیایی/);
  });
  it('rejects duplicate catalog note identities and invalid family references in answers', () => {
    const duplicate = [seedNotes[0]!, { ...seedNotes[1]!, id: seedNotes[0]!.id }];
    expect(recommend(answer(), seedFamilies, duplicate)).toMatchObject({ status: 'invalid', reason: 'invalid-catalog' });
    expect(recommend(answer({ familyIds: [uuid(999)] }), seedFamilies, seedNotes)).toMatchObject({ status: 'invalid', reason: 'missing-family' });
  });
});
