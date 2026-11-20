import { ApiError, authenticated, request } from '@/lib/api/client';

const storageKey = 'aroman-demo-cart-v1';
const variantIdPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
export const maxCartLines = 6;
export const maxCartQuantity = 10;

type CartLine = { variant_id: string; quantity: number };
export type DemoCartItem = CartLine & { name: string };
type DemoQuote = {
  mode: 'demo';
  currency: 'IRR';
  items: (CartLine & { unit_price: number; line_total: number })[];
  subtotal: number;
};
type DemoOrderReceipt = DemoQuote & { id: string; status: 'placed' };
type StoredAttempt = { cart: string; id: string; subtotal: number };

function cartLines(items: DemoCartItem[]): CartLine[] {
  return items.map(({ variant_id, quantity }) => ({ variant_id, quantity }));
}

export function readDemoCart(): DemoCartItem[] {
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const items: unknown = JSON.parse(stored);
    if (!Array.isArray(items) || items.length > maxCartLines) return [];
    const ids = new Set<string>();
    for (const item of items) {
      if (!item || typeof item.variant_id !== 'string' || !variantIdPattern.test(item.variant_id)
        || ids.has(item.variant_id) || !Number.isInteger(item.quantity)
        || item.quantity < 1 || item.quantity > maxCartQuantity
        || typeof item.name !== 'string') return [];
      ids.add(item.variant_id);
    }
    return items;
  } catch {
    return [];
  }
}

export function writeDemoCart(items: DemoCartItem[]) {
  sessionStorage.setItem(storageKey, JSON.stringify(items));
}

export function quoteDemoCart(items: DemoCartItem[], signal: AbortSignal) {
  return request<DemoQuote>('/demo-checkout/quote', {
    method: 'POST',
    body: JSON.stringify({ items: cartLines(items) }),
    signal,
  });
}

export async function submitDemoOrder(userId: string, items: DemoCartItem[], subtotal: number) {
  const key = `${storageKey}:order:${userId}`;
  const lines = cartLines(items);
  const cart = JSON.stringify(lines);
  let stored: StoredAttempt | null = null;
  const raw = sessionStorage.getItem(key);
  if (raw) {
    try { stored = JSON.parse(raw); } catch { /* Start an attempt for the current cart. */ }
  }
  const attempt = stored?.cart === cart && variantIdPattern.test(stored.id)
    && Number.isSafeInteger(stored.subtotal) && stored.subtotal > 0
    ? stored
    : { cart, id: crypto.randomUUID(), subtotal };
  sessionStorage.setItem(key, JSON.stringify(attempt));
  try {
    return await authenticated<DemoOrderReceipt>('/demo-checkout/orders', 'POST', {
      items: lines,
      attempt_id: attempt.id,
      expected_subtotal: attempt.subtotal,
    });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) sessionStorage.removeItem(key);
    throw cause;
  }
}

export function clearPlacedCart(userId: string) {
  writeDemoCart([]);
  sessionStorage.removeItem(`${storageKey}:order:${userId}`);
}
