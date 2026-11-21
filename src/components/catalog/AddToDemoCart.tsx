'use client';

import Link from 'next/link';
import { useState } from 'react';
import { addDemoCartItems } from '@/lib/demo-cart';

export function AddToDemoCart({ variantId, name }: { variantId: string; name: string }) {
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);

  const add = () => {
    setAdded(false);
    try {
      const limit = addDemoCartItems([{ variant_id: variantId, name, quantity: 1 }]);
      if (limit === 'quantity') {
        setMessage('تعداد این محصول به سقف ۱۰ عدد رسیده است.');
        return;
      }
      if (limit === 'lines') {
        setMessage('سبد آزمایشی حداکثر ۶ محصول متفاوت می‌پذیرد.');
        return;
      }
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
