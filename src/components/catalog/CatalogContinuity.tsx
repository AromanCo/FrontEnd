'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Brand, Family } from '@/lib/api/client';
import { CatalogControls } from './CatalogControls';

type CatalogFilters = {
  q: string;
  brandId: string;
  familyId: string;
  brands: Brand[];
  families: Family[];
};

export function CatalogContinuity({ filters, retryHref, children }: {
  filters: CatalogFilters;
  retryHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [lastResult, setLastResult] = useState({ children, filters });
  if (!retryHref && (lastResult.children !== children || lastResult.filters !== filters)) {
    setLastResult({ children, filters });
  }

  return (
    <>
      <CatalogControls
        {...filters}
        brands={retryHref ? lastResult.filters.brands : filters.brands}
        families={retryHref ? lastResult.filters.families : filters.families}
      />
      {retryHref && (
        <section className="card mt-8 p-6 sm:p-8" aria-label="بازیابی کاتالوگ">
          <h2 className="text-xl font-semibold">کاتالوگ موقتاً در دسترس نیست</h2>
          <p role="alert" className="mt-2 leading-8">
            {lastResult.children
              ? 'به‌روزرسانی انجام نشد. نتایج قبلی هنوز نمایش داده می‌شوند.'
              : 'اتصال به کاتالوگ برقرار نشد. با تلاش دوباره، همین جستجو تکرار می‌شود.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href={retryHref} prefetch={false} onNavigate={event => {
              event.preventDefault();
              router.refresh();
            }}>تلاش دوباره</Link>
            {retryHref !== '/shop' && <Link className="btn btn-secondary" href="/shop">نمایش همه محصولات</Link>}
          </div>
        </section>
      )}
      {retryHref ? lastResult.children : children}
    </>
  );
}
