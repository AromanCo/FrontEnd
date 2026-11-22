import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalog, type Product, type Variant } from '@/lib/api/client';
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
  const returnLabel = suffix ? 'بازگشت به نتایج' : 'بازگشت به مجموعه';

  let product: Product | undefined;
  let variants: Variant[] = [];
  try {
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const batch = await catalog.products({ limit, offset }, true);
      product = batch.find(item => item.id === id);
      if (product || batch.length < limit) break;
    }
    if (product) variants = await catalog.variants(id, true);
  } catch {
    return (
      <div className="container section product-page">
        <p role="alert">اطلاعات محصول اکنون در دسترس نیست.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="btn btn-primary" href={`/shop/${encodeURIComponent(id)}${suffix}`}>تلاش دوباره</a>
          <Link className="btn btn-secondary" href={returnHref}>{returnLabel}</Link>
        </div>
      </div>
    );
  }
  if (!product) notFound();
  const scope = getReleaseScope();
  const demoCheckout = isDemoCheckoutEnabled(scope);
  const productName = product.name;
  const productIsDemo = product.is_demo;

  return (
    <article className="container section">
      <Link className="text-link" href={returnHref}>{returnLabel} <span aria-hidden="true">↗</span></Link>
      <div className="mt-5 grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="product-detail-art flex min-h-64 flex-col items-center justify-center gap-4 p-5 md:min-h-96">
          <div className="bottle !h-52 !w-32 md:!h-64 md:!w-40" aria-hidden="true" />
          <span className="text-sm text-plum/80">تصویر مفهومی</span>
        </div>
        <div>
          {product.is_demo && <p className="eyebrow">محصول نمایشی</p>}
          <h1 className="heading mt-2">{product.name}</h1>
          <p className="mt-4 leading-8">{product.description || 'توضیحی برای این محصول ثبت نشده است.'}</p>
          {scope === 'exploration' && (
            <p className="mt-4 text-sm leading-7 text-plum/70">
              این ورودی برای کاوش در کاتالوگ است و دسترسی به محصول واقعی را نشان نمی‌دهد.
            </p>
          )}

          <h2 className="mt-7 text-xl font-semibold">گونه‌ها</h2>
          {variants.length ? (
            <ul className="mt-3 space-y-2">
              {variants.map(variant => (
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
            <Link className="text-link mt-3" href="/studio/guided">شروع کشف با راهنما <span aria-hidden="true">←</span></Link>
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
