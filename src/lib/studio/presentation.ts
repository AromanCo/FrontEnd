import type { Family, Layer } from '@/lib/api/client';
import type { SelectedNote } from '@/lib/studio/composition';

export type ScentMood = 'floral' | 'fresh' | 'woody' | 'warm' | 'green' | 'neutral';

/** Presentation-only interpretation of the backend family label; it adds no catalog data. */
export function familyMood(name: string | undefined): ScentMood {
  const family = (name || '').toLocaleLowerCase('fa');
  if (/گل|رز|یاس|شکوفه|floral/.test(family)) return 'floral';
  if (/مرکبات|ترش|تازه|fresh|citrus/.test(family)) return 'fresh';
  if (/چوب|عود|چرمی|woody|wood/.test(family)) return 'woody';
  if (/ادویه|شرقی|گرم|کهربا|spice|amber/.test(family)) return 'warm';
  if (/سبز|گیاه|علف|herbal|green/.test(family)) return 'green';
  return 'neutral';
}

export function compositionMood(selected: SelectedNote[], families: Family[]): ScentMood {
  for (const layer of ['base', 'heart', 'top'] satisfies Layer[]) {
    const note = selected.find(item => item.layer === layer);
    if (!note) continue;
    const family = families.find(item => item.id === note.note.family_id);
    if (family) return familyMood(family.name);
  }
  return 'neutral';
}

export const moodCopy: Record<ScentMood, string> = {
  floral: 'روشنایی لطیف و گلبرگ‌های مفهومی',
  fresh: 'درخشش خنک و هوای شفاف',
  woody: 'سایه‌های عمیق و بافت گرم',
  warm: 'هاله‌ای گرم با بازتاب کهربایی',
  green: 'طراوت سبز و حال‌وهوای گیاهی',
  neutral: 'شفاف و آماده برای روایت شما',
};

export const layerAtmosphere: Record<Layer, string> = {
  top: 'top',
  heart: 'heart',
  base: 'base',
};
