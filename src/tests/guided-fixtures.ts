import type { Family } from '@/lib/api/client';
import type { GuidedAnswers, GuidedCatalogNote } from '@/lib/studio/guided/types';

export const uuid = (number: number) => `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;

export const seedFamilies: readonly Family[] = [
  { id: uuid(1), slug: 'floral', name: 'گلی', description: null, is_demo: true },
  { id: uuid(2), slug: 'citrus', name: 'مرکباتی', description: null, is_demo: true },
  { id: uuid(3), slug: 'woody', name: 'چوبی', description: null, is_demo: true },
  { id: uuid(4), slug: 'amber', name: 'کهربایی', description: null, is_demo: true },
  { id: uuid(5), slug: 'fresh', name: 'تازه', description: null, is_demo: true },
  { id: uuid(6), slug: 'gourmand', name: 'خوراکی', description: null, is_demo: true },
];

const familyNumber: Readonly<Record<string, number>> = {
  floral: 1, citrus: 2, woody: 3, amber: 4, fresh: 5, gourmand: 6,
};

const seedNoteRows: readonly [string, string, string][] = [
  ['rose', 'رز', 'floral'], ['jasmine', 'یاس', 'floral'], ['orange-blossom', 'شکوفه پرتقال', 'floral'],
  ['violet', 'بنفشه', 'floral'], ['iris', 'زنبق', 'floral'], ['lavender', 'اسطوخودوس', 'floral'],
  ['bergamot', 'ترنج', 'citrus'], ['lemon', 'لیمو', 'citrus'], ['mandarin', 'نارنگی', 'citrus'], ['grapefruit', 'گریپ‌فروت', 'citrus'],
  ['cedar', 'سدر', 'woody'], ['sandalwood', 'چوب صندل', 'woody'], ['vetiver', 'وتیور', 'woody'], ['pine', 'کاج', 'woody'],
  ['amber', 'کهربا', 'amber'], ['vanilla', 'وانیل', 'amber'], ['incense', 'بخور', 'amber'], ['saffron', 'زعفران', 'amber'],
  ['mint', 'نعناع', 'fresh'], ['green-tea', 'چای سبز', 'fresh'], ['sea-breeze', 'نسیم دریا', 'fresh'], ['rain', 'باران', 'fresh'],
  ['cocoa', 'کاکائو', 'gourmand'], ['coffee', 'قهوه', 'gourmand'],
];

export const seedNotes: readonly GuidedCatalogNote[] = seedNoteRows.map(([slug, name, family], index) => ({
  id: uuid(100 + index), slug, name, description: null, is_demo: true, family_id: uuid(familyNumber[family]),
}));

export const noteBySlug = (slug: string, notes: readonly GuidedCatalogNote[] = seedNotes) => {
  const note = notes.find(item => item.slug === slug);
  if (!note) throw new Error(`Missing fixture note ${slug}`);
  return note;
};

export function answer(overrides: Partial<GuidedAnswers> = {}): GuidedAnswers {
  const result: GuidedAnswers = {
    feeling: 'calm',
    familyIds: [uuid(1)],
    temperature: 'soft',
    scene: 'quietFlowers',
    likedNoteIds: [],
    avoidedNoteIds: [],
    noteAffinityStatus: 'skipped',
    discovery: 'balanced',
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'noteAffinityStatus') && (result.likedNoteIds.length || result.avoidedNoteIds.length)) {
    return { ...result, noteAffinityStatus: 'selected' };
  }
  return result;
}

export const selectedIds = (result: { selections?: readonly { note: GuidedCatalogNote }[] }) =>
  result.selections?.map(selection => selection.note.id) ?? [];

export const selectedSlugs = (result: { selections?: readonly { note: GuidedCatalogNote }[] }) =>
  result.selections?.map(selection => selection.note.slug) ?? [];

export const selectionTuples = (result: { selections?: readonly { note: GuidedCatalogNote; layer: string; position: number }[] }) =>
  result.selections?.map(selection => [selection.note.slug, selection.layer, selection.position]);
