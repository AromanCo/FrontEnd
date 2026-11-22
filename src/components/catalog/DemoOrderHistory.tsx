'use client';

import Link from 'next/link';
import { normalizeSearch } from '@/lib/normalize-search';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { addDemoCartItems, type DemoOrderAction, type DemoOrderReceipt, listDemoOrders, updateDemoOrder } from '@/lib/demo-cart';

const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });

type History = { status: 'loading' | 'error' } | { status: 'ready'; orders: DemoOrderReceipt[] };
type StatusFilter = 'all' | DemoOrderReceipt['status'];
const statusLabels: Record<DemoOrderReceipt['status'], string> = {
  placed: 'در انتظار پرداخت آزمایشی',
  paid: 'پرداخت آزمایشی تأیید شد',
  cancelled: 'سفارش لغو شد',
  preparing: 'در حال آماده‌سازی آزمایشی',
  shipped: 'ارسال آزمایشی ثبت شد',
  delivered: 'تحویل آزمایشی ثبت شد',
};
const filterLabels: Record<DemoOrderReceipt['status'], string> = {
  placed: 'در انتظار پرداخت',
  paid: 'پرداخت‌شده',
  cancelled: 'لغوشده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
};
const eventLabels: Record<DemoOrderReceipt['status'], string> = {
  placed: 'ثبت سفارش',
  paid: 'تأیید پرداخت آزمایشی',
  cancelled: 'لغو سفارش',
  preparing: 'شروع آماده‌سازی',
  shipped: 'ارسال سفارش',
  delivered: 'تحویل سفارش',
};
const nextSimulation: Partial<Record<DemoOrderReceipt['status'], [DemoOrderAction, string]>> = {
  paid: ['simulate-preparation', 'شبیه‌سازی آماده‌سازی'],
  preparing: ['simulate-shipping', 'شبیه‌سازی ارسال'],
  shipped: ['simulate-delivery', 'شبیه‌سازی تحویل'],
};

export function DemoOrderHistory() {
  const { user, loading } = useAuth();
  return user && !loading ? <OrderHistory key={user.id} /> : null;
}

function OrderHistory() {
  const [history, setHistory] = useState<History>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const activeOrder = useRef<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [addedOrders, setAddedOrders] = useState<string[]>([]);
  const [cartNotice, setCartNotice] = useState<{ orderId: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const query = normalizeSearch(search);
  const visibleOrders = history.status === 'ready'
    ? history.orders.filter(order =>
      (statusFilter === 'all' || order.status === statusFilter)
      && (!query || normalizeSearch(order.id).includes(query)
        || order.items.some(item => normalizeSearch(`${item.product_name} ${item.variant_label}`).includes(query))),
    )
    : [];

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void listDemoOrders(controller.signal).then(orders => {
        if (!controller.signal.aborted) setHistory({ status: 'ready', orders });
      }).catch(() => {
        if (!controller.signal.aborted) setHistory({ status: 'error' });
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const reload = () => {
    setHistory({ status: 'loading' });
    setAttempt(value => value + 1);
  };

  const actOnOrder = async (orderId: string, action: DemoOrderAction) => {
    if (activeOrder.current) return;
    activeOrder.current = orderId;
    setPendingOrder(orderId);
    setActionError('');
    try {
      const updated = await updateDemoOrder(orderId, action);
      setHistory(previous => previous.status === 'ready'
        ? { status: 'ready', orders: previous.orders.map(order => order.id === updated.id ? updated : order) }
        : previous);
    } catch {
      setActionError('تأیید تغییر وضعیت انجام نشد. وضعیت فعلی از سرور دوباره بررسی می‌شود.');
      reload();
    } finally {
      activeOrder.current = null;
      setPendingOrder(null);
    }
  };

  const addOrderToCart = (order: DemoOrderReceipt) => {
    if (addedOrders.includes(order.id)) return;
    try {
      const limit = addDemoCartItems(order.items.map(item => ({
        variant_id: item.variant_id,
        name: `${item.product_name} · ${item.variant_label}`,
        quantity: item.quantity,
      })));
      const message = limit === 'quantity'
        ? 'با افزودن این سفارش، تعداد یکی از اقلام از سقف ۱۰ عدد بیشتر می‌شود.'
        : limit === 'lines'
          ? 'با افزودن این سفارش، تعداد اقلام متفاوت از سقف ۶ قلم بیشتر می‌شود.'
          : 'اقلام اضافه شدند. مبلغ فعلی را در سبد ببین.';
      setCartNotice({ orderId: order.id, message });
      if (!limit) setAddedOrders(previous => [...previous, order.id]);
    } catch {
      setCartNotice({ orderId: order.id, message: 'افزودن اقلام به سبد ممکن نبود.' });
    }
  };

  return (
    <section id="demo-orders" className="mt-10 scroll-mt-24" aria-labelledby="demo-orders-heading">
      <h2 id="demo-orders-heading" className="text-2xl font-semibold">سفارش‌های آزمایشی</h2>
      <p className="mt-2">این سفارش‌ها در داده‌های پیش‌نمایش آزمایشی ثبت شده‌اند.</p>
      {actionError && <p className="mt-4" role="alert">{actionError}</p>}
      {history.status === 'loading' && <p role="status" className="mt-4">در حال دریافت سفارش‌ها…</p>}
      {history.status === 'error' && (
        <div className="mt-4">
          <p role="alert">دریافت سفارش‌ها انجام نشد.</p>
          <button className="btn btn-secondary mt-2" type="button" onClick={reload}>تلاش دوباره</button>
        </div>
      )}
      {history.status === 'ready' && history.orders.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            جست‌وجوی سفارش
            <input type="search" className="min-w-0 rounded-lg border border-plum/25 bg-white p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="شمارهٔ سفارش یا نام محصول" />
          </label>
          <label className="grid gap-1">
            وضعیت سفارش
            <select className="min-w-0 rounded-lg border border-plum/25 bg-white p-2" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">همهٔ وضعیت‌ها</option>
              {Object.entries(filterLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
          </label>
        </div>
      )}
      {history.status === 'ready' && history.orders.length === 0 && (
        <p className="mt-4">هنوز سفارش آزمایشی ثبت نکرده‌ای.</p>
      )}
      {history.status === 'ready' && history.orders.length > 0 && visibleOrders.length === 0 && (
        <div className="mt-4">
          <p role="status">سفارشی با این جست‌وجو و فیلتر پیدا نشد.</p>
          <button className="btn btn-secondary mt-2" type="button" onClick={() => {
            setSearch('');
            setStatusFilter('all');
          }}>پاک کردن جست‌وجو و فیلتر</button>
        </div>
      )}
      {visibleOrders.length > 0 && (
        <ul className="mt-4 space-y-3">
          {visibleOrders.map(order => {
            const simulation = nextSimulation[order.status];
            return (
              <li className="card p-4" key={order.id}>
                <p className="break-all font-semibold">شمارهٔ سفارش <bdi>{order.id}</bdi></p>
                <time className="mt-1 block text-sm" dateTime={order.created_at}>{date.format(new Date(order.created_at))}</time>
                <ul className="mt-3 space-y-1">
                  {order.items.map(item => (
                    <li key={item.variant_id}>{item.product_name} · {item.variant_label} · {number.format(item.quantity)} عدد</li>
                  ))}
                </ul>
                <p className="mt-3 font-semibold">مبلغ سفارش {number.format(order.subtotal)} ریال</p>
                <p className="mt-2" role="status">{pendingOrder === order.id ? 'در حال تغییر وضعیت…' : statusLabels[order.status]}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer font-medium">خط زمانی سفارش</summary>
                  <ol className="mt-2 space-y-2 border-s-2 border-plum/20 ps-4 text-sm">
                    {order.events.map(event => (
                      <li key={event.status}>
                        <p>{eventLabels[event.status]}</p>
                        {event.occurred_at ? (
                          <time dateTime={event.occurred_at}>{date.format(new Date(event.occurred_at))}</time>
                        ) : <p>زمان این تغییر ثبت نشده بود.</p>}
                      </li>
                    ))}
                  </ol>
                </details>
                {order.status === 'placed' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" disabled={pendingOrder !== null} onClick={() => void actOnOrder(order.id, 'simulate-payment')}>شبیه‌سازی پرداخت</button>
                    <button type="button" className="btn btn-secondary" disabled={pendingOrder !== null} onClick={() => void actOnOrder(order.id, 'cancel')}>لغو سفارش آزمایشی</button>
                  </div>
                )}
                {simulation && (
                  <button type="button" className="btn btn-secondary mt-3" disabled={pendingOrder !== null} onClick={() => void actOnOrder(order.id, simulation[0])}>{simulation[1]}</button>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btn-secondary" disabled={addedOrders.includes(order.id)} onClick={() => addOrderToCart(order)}>افزودن دوباره به سبد</button>
                  {addedOrders.includes(order.id) && <Link className="text-link" href="/cart">مشاهدهٔ سبد آزمایشی</Link>}
                  {cartNotice?.orderId === order.id && <span className="text-sm" role="status">{cartNotice.message}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
