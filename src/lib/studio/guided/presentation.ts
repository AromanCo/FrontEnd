import type { ScentMood } from '@/lib/studio/presentation';
import type { Feeling } from './types';

export const feelingOptions: { value: Feeling; label: string; description: string; tone: string }[] = [
  { value: 'calm', label: 'آرام و آسوده', description: 'مثل مکثی کوتاه میان روز.', tone: 'sage' },
  { value: 'bright', label: 'سرزنده و روشن', description: 'برای شروعی سبک و پرانرژی.', tone: 'champagne' },
  { value: 'confident', label: 'استوار و باوقار', description: 'حسی جمع‌وجور، گرم و مطمئن.', tone: 'plum' },
  { value: 'intimate', label: 'نزدیک و لطیف', description: 'فضایی نرم و شخصی.', tone: 'blush' },
  { value: 'curious', label: 'کنجکاو و ماجراجو', description: 'برای حال‌وهوایی با پیچ‌وخم بیشتر.', tone: 'lilac' },
];

/** Visual palette mapping only; unfamiliar catalog slugs remain neutral. */
const familyPalette: Readonly<Record<string, ScentMood>> = {
  floral: 'floral',
  citrus: 'fresh',
  woody: 'woody',
  amber: 'warm',
  fresh: 'fresh',
};

export function guidedFamilyMood(slug: string | undefined): ScentMood {
  return slug ? familyPalette[slug] ?? 'neutral' : 'neutral';
}
