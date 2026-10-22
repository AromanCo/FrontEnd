import { describe, expect, it } from 'vitest';
import { guidedFamilyMood } from '@/lib/studio/guided/presentation';

describe('Guided Studio presentation palette', () => {
  it('maps only recognized API slugs and leaves unknown or unresolved families neutral', () => {
    expect(guidedFamilyMood('floral')).toBe('floral');
    expect(guidedFamilyMood('citrus')).toBe('fresh');
    expect(guidedFamilyMood('woody')).toBe('woody');
    expect(guidedFamilyMood('amber')).toBe('warm');
    expect(guidedFamilyMood('fresh')).toBe('fresh');
    expect(guidedFamilyMood('future-family')).toBe('neutral');
    expect(guidedFamilyMood(undefined)).toBe('neutral');
  });
});
