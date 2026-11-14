'use client';

import { useEffect, useState } from 'react';
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
  const [search, setSearch] = useState(q);
  const [brand, setBrand] = useState(brandId);
  const [family, setFamily] = useState(familyId);

  // Next.js can reuse this client component across server-side query navigation.
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => { setBrand(brandId); }, [brandId]);
  useEffect(() => { setFamily(familyId); }, [familyId]);

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
        className="card grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={event => {
          event.preventDefault();
          apply(search, brand, family);
        }}
      >
        <label className="space-y-2">
          <span className="text-sm">جستجوی نام</span>
          <input
            className="input"
            type="search"
            maxLength={100}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="نام محصول"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm">برند</span>
          <select className="input" value={brand} onChange={event => setBrand(event.target.value)}>
            <option value="">همه برندها</option>
            {brands.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm">خانواده رایحه</span>
          <select className="input" value={family} onChange={event => setFamily(event.target.value)}>
            <option value="">همه خانواده‌ها</option>
            {families.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary self-end">اعمال فیلتر</button>
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
