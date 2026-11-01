import type { ScentMood } from '@/lib/studio/presentation';

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
