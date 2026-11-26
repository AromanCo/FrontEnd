import Link from 'next/link';
import { Suspense } from 'react';
import { catalog, type Brand, type Family, type Product } from '@/lib/api/client';
import { ProductCard } from '@/components/catalog/ProductCard';
import { CatalogContinuity } from '@/components/catalog/CatalogContinuity';
import { catalogSearchSuffix, readCatalogSearch } from '@/lib/catalog-search';

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = readCatalogSearch(await searchParams);
  return (
    <div className="container section catalog-page">
      <header className="catalog-intro">
        <div>
          <h1 className="heading">کشف محصولات</h1>
          <p className="mt-3 text-plum/70">مجموعه‌ای نمایشی برای آشنایی با خانواده‌های رایحه.</p>
        </div>
        <Link className="btn btn-atelier-outline justify-self-start" href="/studio/guided">
          شروع کشف با راهنما
        </Link>
      </header>
      <Suspense fallback={<CatalogLoading />}>
        <CatalogResults search={search} />
      </Suspense>
    </div>
  );
}

function CatalogLoading() {
  return (
    <div className="mt-8">
      <p role="status" className="sr-only">در حال دریافت محصولات…</p>
      <div aria-hidden="true" className="card h-24 bg-plum/5" />
      <div aria-hidden="true" className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(card => <div key={card} className="card min-h-96 bg-plum/5" />)}
      </div>
    </div>
  );
}

async function CatalogResults({ search }: { search: ReturnType<typeof readCatalogSearch> }) {
  const { q, brand_id, family_id, offset } = search;
  const suffix = catalogSearchSuffix(search);
  const limit = 12;
  let products: Product[] = [];
  let brands: Brand[] = [];
  let families: Family[] = [];
  let error = false;

  try {
    [products, brands, families] = await Promise.all([
      catalog.products({ q, brand_id, family_id, limit, offset }, true),
      catalog.brands('', 100, 0, true),
      catalog.families('', 100, 0, true),
    ]);
  } catch {
    error = true;
  }

  const active = Boolean(q || brand_id || family_id);
  const pageUrl = (nextOffset: number) => '/shop' + catalogSearchSuffix({ ...search, offset: nextOffset });

  return (
    <CatalogContinuity
      filters={{ q, brandId: brand_id || '', familyId: family_id || '', brands, families }}
      retryHref={error ? pageUrl(offset) : undefined}
    >
      {error ? null : products.length ? (
        <>
          <p className="catalog-result-count" aria-live="polite">
            نمایش {products.length.toLocaleString('fa-IR')} محصول در این صفحه
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(product => <ProductCard key={product.id} product={product} catalogSuffix={suffix} />)}
          </div>
          <nav aria-label="صفحه‌بندی محصولات" className="mt-9 flex flex-wrap justify-center gap-3">
            {offset > 0 && (
              <Link className="btn btn-secondary" href={pageUrl(Math.max(0, offset - limit))}>قبلی</Link>
            )}
            {products.length === limit && (
              <Link className="btn btn-primary" href={pageUrl(offset + limit)}>نمایش بیشتر</Link>
            )}
          </nav>
        </>
      ) : (
        <div className="card mt-8 p-8 text-center sm:p-12">
          <h2 className="text-xl font-semibold">
            {active ? 'برای این جستجو محصولی پیدا نشد.' : offset > 0 ? 'محصول دیگری در این صفحه نیست' : 'هنوز محصولی در کاتالوگ نیست'}
          </h2>
          <p className="mt-4 leading-8 text-plum/70">
            {active
              ? 'فیلترها را تغییر دهید یا همه را پاک کنید و دوباره جستجو کنید.'
              : offset > 0 ? 'می‌توانید به صفحهٔ اول کاتالوگ برگردید.' : 'برای کشف سلیقهٔ خود می‌توانید از استودیوی راهنما شروع کنید.'}
          </p>
          {active && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <a className="btn btn-primary" href="#catalog-product-search">تغییر جستجو</a>
              <Link className="btn btn-secondary" href="/shop">نمایش همه محصولات</Link>
            </div>
          )}
          {offset > 0 && (
            <Link className="btn btn-secondary mt-6" href={pageUrl(0)}>بازگشت به صفحه اول</Link>
          )}
          {!active && offset === 0 && (
            <Link className="btn btn-primary mt-6" href="/studio/guided">شروع کشف با راهنما</Link>
          )}
        </div>
      )}
    </CatalogContinuity>
  );
}
