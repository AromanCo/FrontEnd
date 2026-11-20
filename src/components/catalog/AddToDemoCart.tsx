'use client';

import Link from 'next/link';
import { useState } from 'react';
import { maxCartLines, maxCartQuantity, readDemoCart, writeDemoCart } from '@/lib/demo-cart';

export function AddToDemoCart({ variantId, name }: { variantId: string; name: string }) {
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);

  const add = () => {
    setAdded(false);
    try {
      const items = readDemoCart();
      const existing = items.find(item => item.variant_id === variantId);
      if (existing && existing.quantity >= maxCartQuantity) {
        setMessage('تعداد این محصول به سقف ۱۰ عدد رسیده است.');
        return;
      }
      if (!existing && items.length >= maxCartLines) {
        setMessage('سبد آزمایشی حداکثر ۶ محصول متفاوت می‌پذیرد.');
        return;
      }
      if (existing) existing.quantity += 1;
      else items.push({ variant_id: variantId, name, quantity: 1 });
      writeDemoCart(items);
      setAdded(true);
      setMessage('به سبد آزمایشی اضافه شد.');
    } catch {
      setMessage('ذخیرهٔ سبد در این برگه ممکن نیست.');
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-primary" onClick={add}>افزودن به سبد آزمایشی</button>
      {added && <Link className="text-link" href="/cart">مشاهدهٔ سبد آزمایشی</Link>}
      <span role="status" className="text-sm">{message}</span>
    </div>
  );
}
