'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  type DemoCartItem, maxCartQuantity, quoteDemoCart, readDemoCart, writeDemoCart,
} from '@/lib/demo-cart';

const number = new Intl.NumberFormat('fa-IR');
type Quote = Awaited<ReturnType<typeof quoteDemoCart>>;
type Result = { items: DemoCartItem[]; attempt: number; quote?: Quote; error?: string };

export function DemoCart() {
  const [items, setItems] = useState<DemoCartItem[] | null>(null);
  const [storageError, setStorageError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setItems(readDemoCart()); }
      catch { setStorageError('خواندن سبد در این برگه ممکن نیست.'); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!items?.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void quoteDemoCart(items, controller.signal).then(quote => {
        if (!controller.signal.aborted) setResult({ items, attempt, quote });
      }).catch(cause => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ApiError && cause.status === 404
          ? 'محاسبهٔ سبد انجام نشد. ممکن است یکی از اقلام دیگر در کاتالوگ آزمایشی موجود نباشد.'
          : 'دریافت مبلغ آزمایشی انجام نشد.';
        setResult({ items, attempt, error });
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [items, attempt]);

  const current = result?.items === items && result.attempt === attempt ? result : null;

  const change = (next: DemoCartItem[]) => {
    try {
      writeDemoCart(next);
      setItems(next);
      setStorageError('');
    } catch {
      setStorageError('ذخیرهٔ تغییرات سبد ممکن نیست.');
    }
  };

  return (
    <div className="container section">
      <h1 className="heading">سبد آزمایشی</h1>
      <p className="mt-3 leading-8">مبالغ به ریال و برای محصولات ساختگی هستند. ثبت سفارش و پرداخت در دسترس نیست.</p>
      {storageError && <p role="alert" className="mt-4">{storageError}</p>}
      {!items && !storageError && <p role="status" className="mt-4">در حال خواندن سبد…</p>}
      {items?.length === 0 && <p className="mt-5">سبد آزمایشی خالی است.</p>}
      {!!items?.length && (
        <>
          <ul className="mt-6 space-y-3">
            {items.map(item => {
              const line = current?.quote?.items.find(entry => entry.variant_id === item.variant_id);
              return (
                <li className="card flex flex-wrap items-center justify-between gap-4 p-4" key={item.variant_id}>
                  <div>
                    <h2 className="font-semibold">{item.name}</h2>
                    {line && <p className="mt-2 text-sm">قیمت واحد {number.format(line.unit_price)} ریال · جمع {number.format(line.line_total)} ریال</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      تعداد
                      <select
                        className="rounded-lg border border-plum/25 bg-white p-2"
                        aria-label={`تعداد ${item.name}`}
                        value={item.quantity}
                        onChange={event => {
                          const quantity = Number(event.target.value);
                          change(items.map(entry => entry === item ? { ...entry, quantity } : entry));
                        }}
                      >
                        {Array.from({ length: maxCartQuantity }, (_, index) => (
                          <option value={index + 1} key={index + 1}>{number.format(index + 1)}</option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn-secondary" type="button" aria-label={`حذف ${item.name}`} onClick={() => change(items.filter(entry => entry !== item))}>حذف</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {!current && <p className="mt-5" role="status">در حال دریافت مبلغ سبد…</p>}
          {current?.error && (
            <div className="mt-5">
              <p role="alert">{current.error}</p>
              <button className="btn btn-secondary mt-3" type="button" onClick={() => setAttempt(value => value + 1)}>تلاش دوباره</button>
            </div>
          )}
          {current?.quote && <p className="mt-5 font-semibold" role="status">جمع سبد {number.format(current.quote.subtotal)} ریال</p>}
        </>
      )}
      <Link className="btn btn-secondary mt-6" href="/shop">بازگشت به کاتالوگ</Link>
    </div>
  );
}
