'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brand, Family } from '@/lib/api/client';

type Props = {
  q: string;
  brandId: string;
  familyId: string;
  brands: Brand[];
  families: Family[];
};

function catalogUrl(q: string, brandId: string, familyId: string) {
  const query = new URLSearchParams();
  const search = q.trim().slice(0, 100);
  if (search) query.set('q', search);
  if (brandId) query.set('brand_id', brandId);
  if (familyId) query.set('family_id', familyId);
  const suffix = query.toString();
  return suffix ? `/shop?${suffix}` : '/shop';
}

export function CatalogControls({ q, brandId, familyId, brands, families }: Props) {
  const router = useRouter();
  const fieldId = useId();
  const [search, setSearch] = useState(q);
  const [brand, setBrand] = useState(brandId);
  const [family, setFamily] = useState(familyId);

  const apply = (nextSearch: string, nextBrand: string, nextFamily: string) => {
    router.push(catalogUrl(nextSearch, nextBrand, nextFamily));
  };

  const removeAll = () => {
    setSearch('');
    setBrand('');
    setFamily('');
    router.push('/shop');
  };

  const activeFilters = [
    ...(q ? [{ key: 'search', label: `جستجو: ${q}`, clear: () => apply('', brandId, familyId) }] : []),
    ...(brandId ? [{
      key: 'brand',
      label: `برند: ${brands.find(item => item.id === brandId)?.name ?? 'فیلتر انتخاب‌شده'}`,
      clear: () => apply(q, '', familyId),
    }] : []),
    ...(familyId ? [{
      key: 'family',
      label: `خانواده: ${families.find(item => item.id === familyId)?.name ?? 'فیلتر انتخاب‌شده'}`,
      clear: () => apply(q, brandId, ''),
    }] : []),
  ];

  return (
    <div className="mt-8">
      <form
        role="search"
        aria-label="جستجو و فیلتر محصولات"
        className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={event => {
          event.preventDefault();
          apply(search, brand, family);
        }}
      >
        <div className="grid min-w-0 gap-2 sm:col-span-2 lg:col-span-1">
          <label className="text-sm" htmlFor={`${fieldId}-search`}>جستجوی نام</label>
          <input
            id={`${fieldId}-search`}
            className="input"
            type="search"
            maxLength={100}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="نام محصول"
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <label className="text-sm" htmlFor={`${fieldId}-brand`}>برند</label>
          <select className="input" id={`${fieldId}-brand`} value={brand} onChange={event => setBrand(event.target.value)}>
            <option value="">همه برندها</option>
            {brands.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-2">
          <label className="text-sm" htmlFor={`${fieldId}-family`}>خانواده رایحه</label>
          <select className="input" id={`${fieldId}-family`} value={family} onChange={event => setFamily(event.target.value)}>
            <option value="">همه خانواده‌ها</option>
            {families.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary self-end sm:col-span-2 lg:col-span-1">اعمال فیلتر</button>
      </form>

      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
          <span className="text-sm text-plum/70">فیلترهای فعال:</span>
          {activeFilters.map(filter => (
            <button
              key={filter.key}
              type="button"
              className="rounded-full border border-[#d9c5d4] bg-white/70 px-4 py-2 text-sm text-plum transition-colors hover:bg-[#f5eaf0]"
              onClick={filter.clear}
              aria-label={`حذف ${filter.label}`}
            >
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="px-3 py-2 text-sm underline underline-offset-4" onClick={removeAll}>
            پاک کردن همه فیلترها
          </button>
        </div>
      )}
    </div>
  );
}
