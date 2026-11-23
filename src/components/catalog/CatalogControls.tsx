'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brand, Family } from '@/lib/api/client';
import { catalogSearchSuffix } from '@/lib/catalog-search';

type Props = {
  q: string;
  brandId: string;
  familyId: string;
  brands: Brand[];
  families: Family[];
};

export function CatalogControls({ q, brandId, familyId, brands, families }: Props) {
  const router = useRouter();
  const fieldId = useId();
  const [search, setSearch] = useState(q);
  const [brand, setBrand] = useState(brandId);
  const [family, setFamily] = useState(familyId);
  const [showFilters, setShowFilters] = useState(Boolean(brandId || familyId));

  const apply = (nextSearch: string, nextBrand: string, nextFamily: string) => {
    router.push('/shop' + catalogSearchSuffix({ q: nextSearch, brand_id: nextBrand, family_id: nextFamily }));
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
        className="card catalog-search-form"
        onSubmit={event => {
          event.preventDefault();
          apply(search, brand, family);
        }}
      >
        <div className="catalog-search-field">
          <label className="text-sm" htmlFor="catalog-product-search">جستجوی نام</label>
          <input
            id="catalog-product-search"
            className="input"
            type="search"
            maxLength={100}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="نام محصول"
          />
        </div>
        <button type="button" className="btn btn-secondary catalog-filter-toggle" aria-expanded={showFilters}
          aria-controls={`${fieldId}-options`} onClick={() => setShowFilters(open => !open)}>
          فیلترهای برند و خانواده
        </button>
        <div id={`${fieldId}-options`} className="catalog-filter-options" data-expanded={showFilters}>
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
        </div>
        <button type="submit" className="btn btn-primary catalog-search-submit">اعمال فیلتر</button>
      </form>

      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
          <span className="text-sm text-plum/70">فیلترهای فعال:</span>
          {activeFilters.map(filter => (
            <button
              key={filter.key}
              type="button"
              className="catalog-filter-chip"
              onClick={filter.clear}
              aria-label={`حذف ${filter.label}`}
            >
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="min-h-11 px-3 py-2 text-sm underline underline-offset-4" onClick={removeAll}>
            پاک کردن همه فیلترها
          </button>
        </div>
      )}
    </div>
  );
}
