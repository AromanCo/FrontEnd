import { describe, expect, it } from 'vitest';
import { familyMood } from '@/lib/studio/presentation';

describe('presentation-only fragrance family mood mapping', () => {
  it.each([
    ['گلی', 'floral'],
    ['تازه', 'fresh'],
    ['چوبی', 'woody'],
    ['کهربایی', 'warm'],
  ] as const)('maps the backend family %s to %s', (family, mood) => {
    expect(familyMood(family)).toBe(mood);
  });

  it('leaves unknown family labels neutral', () => {
    expect(familyMood('خانواده ناشناخته')).toBe('neutral');
  });
});
