import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalog, type Product } from '@/lib/api/client';
import { getReleaseScope, isDemoCheckoutEnabled } from '@/lib/release-scope';
import { AddToDemoCart } from '@/components/catalog/AddToDemoCart';
import { catalogSearchSuffix, readCatalogSearch } from '@/lib/catalog-search';

export default async function ProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) notFound();
  const suffix = catalogSearchSuffix(readCatalogSearch(await searchParams));
  const returnHref = `/shop${suffix}`;
  const retryHref = `/shop/${encodeURIComponent(id)}${suffix}`;
  const returnLabel = suffix ? 'بازگشت به نتایج' : 'بازگشت به مجموعه';

  let product: Product | undefined;
  try {
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const batch = await catalog.products({ limit, offset }, true);
      product = batch.find(item => item.id === id);
      if (product || batch.length < limit) break;
    }
  } catch {
    return (
      <div className="container section">
        <section className="card p-6 sm:p-8">
          <h1 className="heading">جزئیات محصول</h1>
          <p role="alert" className="mt-3 leading-8">اطلاعات محصول اکنون در دسترس نیست.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="btn btn-primary" href={retryHref}>تلاش دوباره</a>
            <Link className="btn btn-secondary" href={returnHref}>{returnLabel}</Link>
          </div>
        </section>
      </div>
    );
  }
  if (!product) notFound();
  const [variantList, brandList, familyList] = await Promise.allSettled([
    catalog.variants(id, true),
    product.brand_id ? catalog.brands('', 100, 0, true) : [],
    product.family_id ? catalog.families('', 100, 0, true) : [],
  ]);
  const brand = brandList.status === 'fulfilled' ? brandList.value.find(item => item.id === product.brand_id) : undefined;
  const family = familyList.status === 'fulfilled' ? familyList.value.find(item => item.id === product.family_id) : undefined;
  const scope = getReleaseScope();
  const demoCheckout = isDemoCheckoutEnabled(scope);
  const productName = product.name;
  const productIsDemo = product.is_demo;

  return (
    <article className="container section">
      <Link className="text-link" href={returnHref}>{returnLabel} <span aria-hidden="true">↗</span></Link>
      <div className="product-detail-layout">
        <header className="product-detail-heading">
          {product.is_demo && <p className="eyebrow">محصول نمایشی</p>}
          <h1 className="heading mt-2">{product.name}</h1>
          <p className="mt-4 leading-8">{product.description || 'توضیحی برای این محصول ثبت نشده است.'}</p>
          {(brand || family) && (
            <dl className="product-detail-facets">
              {brand && <div><dt>برند</dt><dd>{brand.name}</dd></div>}
              {family && <div><dt>خانوادهٔ رایحه</dt><dd>{family.name}</dd></div>}
            </dl>
          )}
        </header>
        <div className="product-detail-art flex min-h-64 flex-col items-center justify-center gap-4 p-5 md:min-h-96">
          <div className="bottle !h-52 !w-32 md:!h-64 md:!w-40" aria-hidden="true" />
          <span className="text-sm text-plum/80">تصویر مفهومی</span>
        </div>
        <div className="product-detail-body">
          {scope === 'exploration' && (
            <p className="mt-4 text-sm leading-7 text-plum/70">
              این ورودی برای کاوش در کاتالوگ است و دسترسی به محصول واقعی را نشان نمی‌دهد.
            </p>
          )}

          <h2 className="mt-7 text-xl font-semibold">گونه‌ها</h2>
          {variantList.status === 'rejected' ? (
            <div className="card mt-3 p-4">
              <p role="alert">فهرست گونه‌های این محصول بارگذاری نشد.</p>
              <a className="btn btn-secondary mt-3" href={retryHref}>تلاش دوباره</a>
            </div>
          ) : variantList.value.length ? (
            <ul className="mt-3 space-y-2">
              {variantList.value.map(variant => (
                <li className="card p-4" key={variant.id}>
                  {variant.label}{variant.volume_ml ? ` · ${variant.volume_ml} میلی‌لیتر` : ''}{variant.is_demo ? ' · نمایشی' : ''}
                  {demoCheckout && productIsDemo && variant.is_demo && (
                    <AddToDemoCart variantId={variant.id} name={`${productName} · ${variant.label}`} />
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3">گونه‌ای برای این محصول ثبت نشده است.</p>}

          <section className="product-next-step mt-6 p-4 sm:p-5" aria-label="ادامهٔ کشف رایحه">
            <p className="leading-8">برای دریافت یک پیشنهاد مفهومی بر اساس سلیقهٔ خودتان، به چند پرسش پاسخ دهید.</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <Link className="text-link" href="/studio/guided">شروع کشف با راهنما <span aria-hidden="true">←</span></Link>
              {family && <Link className="text-link" href={`/shop${catalogSearchSuffix({ family_id: family.id })}`}>دیدن رایحه‌های هم‌خانواده</Link>}
            </div>
          </section>
          <p className="mt-4 text-sm leading-7 text-plum/70">
            {demoCheckout && productIsDemo
              ? 'مبلغ آزمایشی در سبد نمایش داده می‌شود.'
              : 'قیمت، موجودی و خرید آنلاین هنوز در دسترس نیستند.'}
          </p>
        </div>
      </div>
    </article>
  );
}
