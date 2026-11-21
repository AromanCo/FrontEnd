import Link from 'next/link';
import { catalog, type Brand, type Family, type Product } from '@/lib/api/client';
import { ProductCard } from '@/components/catalog/ProductCard';
import { CatalogControls } from '@/components/catalog/CatalogControls';

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = (firstQueryValue(params.q) || '').slice(0, 100);
  const brand_id = firstQueryValue(params.brand_id) || undefined;
  const family_id = firstQueryValue(params.family_id) || undefined;
  const raw = Number(firstQueryValue(params.offset) || 0);
  const offset = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
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
  const pageUrl = (nextOffset: number) => {
    const query = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(brand_id ? { brand_id } : {}),
      ...(family_id ? { family_id } : {}),
      offset: String(nextOffset),
    });
    return `/shop?${query}`;
  };

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
      <CatalogControls key={JSON.stringify([q, brand_id, family_id])} q={q} brandId={brand_id || ''} familyId={family_id || ''} brands={brands} families={families} />

      {error ? (
        <section className="card mt-8 p-6 sm:p-8" aria-label="بازیابی کاتالوگ">
          <p role="alert" className="leading-8">اتصال به کاتالوگ برقرار نشد. لطفاً بعداً دوباره تلاش کنید.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="btn btn-primary" href={pageUrl(offset)}>تلاش دوباره</a>
            {active && <Link className="btn btn-secondary" href="/shop">نمایش همه محصولات</Link>}
          </div>
        </section>
      ) : products.length ? (
        <>
          <p className="catalog-result-count" aria-live="polite">
            نمایش {products.length.toLocaleString('fa-IR')} محصول در این صفحه
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(product => <ProductCard key={product.id} product={product} />)}
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
          <h2 className="text-xl font-semibold">برای این جستجو محصولی پیدا نشد.</h2>
          <p className="mt-4 leading-8 text-plum/70">
            {active
              ? 'فیلترها را تغییر دهید یا همه را پاک کنید و دوباره جستجو کنید.'
              : 'در حال حاضر محصول نمایشی دیگری در این صفحه وجود ندارد.'}
          </p>
          {active && <Link className="btn btn-primary mt-6" href="/shop">نمایش همه محصولات</Link>}
          {offset > 0 && (
            <Link className="btn btn-secondary mt-6" href={pageUrl(0)}>بازگشت به صفحه اول</Link>
          )}
        </div>
      )}
    </div>
  );
}
