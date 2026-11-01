import type { Discovery, Feeling, Scene, Temperature } from './types';

export const DEFAULT_CONCEPT_NAME = 'رایحهٔ من';
export const MAX_CONCEPT_NAME_LENGTH = 60;
export const RECOMMENDATION_TARGET = 4;
export const MAX_CONCEPT_NOTES = 6;

export type EditorialConfig = Readonly<{
  selectedFamilyWeight: number;
  balancedOutsideAdjustment: number;
  exploratoryOutsideAdjustment: number;
  target: number;
  familyCapPerSweep: number;
  layerSequence: readonly ('top' | 'heart' | 'base')[];
  feeling: Readonly<Record<Feeling, Readonly<Record<string, number>>>>;
  temperature: Readonly<Record<Temperature, Readonly<Record<string, number>>>>;
  scene: Readonly<Record<Scene, Readonly<Record<string, number>>>>;
  discovery: Readonly<Record<Discovery, number>>;
}>;

/** Editorial mappings only; they are not verified scent, safety, or performance properties. */
export const GUIDED_RECOMMENDATION_CONFIG: EditorialConfig = {
  selectedFamilyWeight: 8,
  balancedOutsideAdjustment: -2,
  exploratoryOutsideAdjustment: 2,
  target: RECOMMENDATION_TARGET,
  familyCapPerSweep: 2,
  layerSequence: ['top', 'heart', 'base', 'heart', 'top', 'base'],
  feeling: {
    calm: { floral: 2, fresh: 1 },
    bright: { fresh: 2, citrus: 2 },
    confident: { woody: 2, amber: 1 },
    intimate: { floral: 1, gourmand: 2, amber: 1 },
    curious: { citrus: 1, woody: 1, gourmand: 1, amber: 1 },
  },
  temperature: {
    bright: { fresh: 3, citrus: 2 },
    soft: { floral: 1, fresh: 1, woody: 1 },
    warm: { amber: 3, woody: 2, gourmand: 1 },
  },
  scene: {
    rainGarden: { fresh: 2, floral: 1 },
    citrusMorning: { citrus: 2, fresh: 1 },
    quietFlowers: { floral: 2 },
    woodland: { woody: 2, fresh: 1 },
    warmEvening: { amber: 2, woody: 1 },
    coffeePause: { gourmand: 2, amber: 1 },
  },
  discovery: { familiar: 0, balanced: -2, exploratory: 2 },
};

export const ANSWER_PERSIAN_COPY = {
  feeling: {
    calm: 'آرامی', bright: 'روشنایی', confident: 'استواری', intimate: 'صمیمیت', curious: 'کنجکاوی',
  } satisfies Record<Feeling, string>,
  temperature: {
    bright: 'حال‌وهوای روشن و تازه', soft: 'حال‌وهوای نرم و متعادل', warm: 'حال‌وهوای گرم',
  } satisfies Record<Temperature, string>,
  scene: {
    rainGarden: 'تصویر باغ پس از باران',
    citrusMorning: 'تصویر صبح روشن',
    quietFlowers: 'تصویر گوشه‌ای پر از گل',
    woodland: 'تصویر مسیر میان درختان',
    warmEvening: 'تصویر غروب گرم',
    coffeePause: 'تصویر مکث کنار فنجان',
  } satisfies Record<Scene, string>,
} as const;
