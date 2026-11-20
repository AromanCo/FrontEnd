'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { type DemoOrderAction, type DemoOrderReceipt, listDemoOrders, updateDemoOrder } from '@/lib/demo-cart';

const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });

type History = { status: 'loading' | 'error' } | { status: 'ready'; orders: DemoOrderReceipt[] };
const statusLabels: Record<DemoOrderReceipt['status'], string> = {
  placed: 'در انتظار پرداخت آزمایشی',
  paid: 'پرداخت آزمایشی تأیید شد',
  cancelled: 'سفارش لغو شد',
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
      {history.status === 'ready' && (history.orders.length ? (
        <ul className="mt-4 space-y-3">
          {history.orders.map(order => (
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
              {order.status === 'placed' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" disabled={pendingOrder !== null} onClick={() => void actOnOrder(order.id, 'simulate-payment')}>شبیه‌سازی پرداخت</button>
                  <button type="button" className="btn btn-secondary" disabled={pendingOrder !== null} onClick={() => void actOnOrder(order.id, 'cancel')}>لغو سفارش آزمایشی</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-4">هنوز سفارش آزمایشی ثبت نکرده‌ای.</p>)}
    </section>
  );
}
