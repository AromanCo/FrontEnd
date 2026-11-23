'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dialog } from '@/components/ui/Dialog';
import {
  clearPlacedCart, type DemoCartItem, maxCartQuantity, quoteDemoCart, readDemoCart,
  submitDemoOrder, writeDemoCart,
} from '@/lib/demo-cart';

const number = new Intl.NumberFormat('fa-IR');
type Quote = Awaited<ReturnType<typeof quoteDemoCart>>;
type Result = { items: DemoCartItem[]; attempt: number; quote?: Quote; error?: string };

export function DemoCart() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<DemoCartItem[] | null>(null);
  const [storageError, setStorageError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [orderError, setOrderError] = useState('');
  const [receipt, setReceipt] = useState<{ userId: string; id: string; subtotal: number } | null>(null);
  const receiptPanel = useRef<HTMLElement>(null);
  const visibleReceipt = receipt?.userId === user?.id ? receipt : null;
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  useEffect(() => { if (visibleReceipt) receiptPanel.current?.focus(); }, [visibleReceipt]);

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
    if (submitLock.current) return;
    try {
      writeDemoCart(next);
      setItems(next);
      setStorageError('');
      setOrderError('');
    } catch {
      setStorageError('ذخیرهٔ تغییرات سبد ممکن نیست.');
    }
  };

  const place = async () => {
    if (!items?.length || !current?.quote || submitLock.current || authLoading) return;
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const userId = user.id;
    submitLock.current = true;
    setSubmitting(true);
    setOrderError('');
    try {
      const order = await submitDemoOrder(userId, items, current.quote.subtotal);
      setReceipt({ userId, id: order.id, subtotal: order.subtotal });
      setItems([]);
      try { clearPlacedCart(userId); }
      catch { setStorageError('سفارش ثبت شد، اما پاک کردن سبد این برگه ممکن نبود.'); }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setLoginOpen(true);
      if (cause instanceof ApiError && cause.status === 409) {
        setOrderError('مبلغ سبد دوباره بررسی می‌شود. پس از دیدن مبلغ، ثبت سفارش را دوباره تأیید کنید.');
        setAttempt(value => value + 1);
      } else {
        setOrderError('نتیجهٔ ثبت سفارش مشخص نشد. برای بررسی، دوباره از همین سبد اقدام کنید.');
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="container section cart-page">
      <h1 className="heading">سبد آزمایشی</h1>
      <p className="mt-3 leading-8">مبالغ به ریال و برای محصولات ساختگی هستند. سفارش آزمایشی موقت است و پرداختی انجام نمی‌شود.</p>
      {storageError && <p role="alert" className="mt-4">{storageError}</p>}
      {visibleReceipt && (
        <section ref={receiptPanel} tabIndex={-1} className="card mt-5 p-5" role="status" aria-label="رسید سفارش آزمایشی">
          <h2 className="font-semibold">سفارش آزمایشی ثبت شد.</h2>
          <p className="mt-2 [overflow-wrap:anywhere]">شمارهٔ سفارش <bdi>{visibleReceipt.id}</bdi></p>
          <p>مبلغ سفارش {number.format(visibleReceipt.subtotal)} ریال</p>
          <Link className="text-link mt-3" href="/account#demo-orders">مشاهدهٔ سفارش‌های آزمایشی</Link>
        </section>
      )}
      {!items && !storageError && <p role="status" className="mt-4">در حال خواندن سبد…</p>}
      {items?.length === 0 && (
        <div className="card mt-5 p-5 sm:p-7">
          <h2>سبد آزمایشی خالی است.</h2>
          <Link className="btn btn-primary mt-4" href="/shop">بازگشت به کاتالوگ</Link>
        </div>
      )}
      {!!items?.length && (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ul className="min-w-0 space-y-3">
            {items.map(item => {
              const line = current?.quote?.items.find(entry => entry.variant_id === item.variant_id);
              return (
                <li className="card flex flex-wrap items-center justify-between gap-4 p-4" key={item.variant_id}>
                  <div className="min-w-0">
                    <h2 className="font-semibold [overflow-wrap:anywhere]">{item.name}</h2>
                    {line && <p className="mt-2 text-sm">قیمت واحد {number.format(line.unit_price)} ریال · جمع {number.format(line.line_total)} ریال</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      تعداد
                      <select
                        className="min-h-11 min-w-11 rounded-lg border border-plum/25 bg-white p-2"
                        aria-label={`تعداد ${item.name}`}
                        value={item.quantity}
                        disabled={submitting}
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
                    <button className="btn btn-secondary" type="button" disabled={submitting} aria-label={`حذف ${item.name}`} onClick={() => change(items.filter(entry => entry !== item))}>حذف</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="demo-cart-summary">
            <h2 id="demo-cart-summary" className="text-lg">خلاصهٔ سبد</h2>
            {orderError && <p role="alert" className="mt-3 rounded-xl bg-blush p-3 leading-7">{orderError}</p>}
            {!current && <p className="mt-3" role="status">در حال دریافت مبلغ سبد…</p>}
            {current?.error && (
              <div className="mt-3">
                <p role="alert">{current.error}</p>
                <button className="btn btn-secondary mt-3" type="button" onClick={() => setAttempt(value => value + 1)}>تلاش دوباره</button>
              </div>
            )}
            {current?.quote && <>
              <p className="mt-3 font-semibold" role="status">جمع سبد {number.format(current.quote.subtotal)} ریال</p>
              <button className="btn btn-primary mt-4 w-full text-center" type="button" disabled={submitting || authLoading} onClick={() => void place()}>
                {submitting ? 'در حال ثبت…' : user ? 'ثبت سفارش آزمایشی' : 'ورود برای ثبت سفارش آزمایشی'}
              </button>
            </>}
          </section>
        </div>
      )}
      {items?.length !== 0 && <Link className="btn btn-secondary mt-6" href="/shop">بازگشت به کاتالوگ</Link>}
      {loginOpen && (
        <Dialog title="ورود برای سفارش آزمایشی" onClose={closeLogin}>
          <LoginForm onSuccess={() => { closeLogin(); setOrderError(''); }} />
        </Dialog>
      )}
    </div>
  );
}
