// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { addDemoCartItems, readDemoCart, writeDemoCart } from './demo-cart';

function item(index: number, quantity = 1) {
  return {
    variant_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Product ${index}`,
    quantity,
  };
}

describe('adding demo cart items', () => {
  beforeEach(() => sessionStorage.clear());

  it('combines quantities and preserves other cart items', () => {
    writeDemoCart([item(1, 2), item(2)]);
    expect(addDemoCartItems([item(1, 3), item(3)])).toBeNull();
    expect(readDemoCart()).toEqual([item(1, 5), item(2), item(3)]);
  });

  it('preserves the original cart if any item exceeds the quantity limit', () => {
    writeDemoCart([item(1, 9)]);
    expect(addDemoCartItems([item(2), item(1, 2)])).toBe('quantity');
    expect(readDemoCart()).toEqual([item(1, 9)]);
  });

  it('preserves the original cart if merging would add too many distinct items', () => {
    const existing = Array.from({ length: 6 }, (_, index) => item(index + 1));
    writeDemoCart(existing);
    expect(addDemoCartItems([item(1), item(7)])).toBe('lines');
    expect(readDemoCart()).toEqual(existing);
  });
});
