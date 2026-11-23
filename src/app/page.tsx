import Link from 'next/link';
import { catalog, type Family, type Product } from '@/lib/api/client';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FamilyCard } from '@/components/home/FamilyCard';
import Image from 'next/image';
import { feelingOptions } from '@/lib/studio/guided/presentation';
import { StudioInvitationArtwork } from '@/components/home/StudioInvitationArtwork';

export default async function Home() {
  let products: Product[] = [];
  let families: Family[] = [];
  let unavailable = false;
  try {
    [products, families] = await Promise.all([catalog.products({ limit: 3 }, true), catalog.families('', 6, 0, true)]);
  } catch {
    unavailable = true;
  }

  return <>
    <section className="atelier-hero">
      <div className="atelier-hero-inner container">
        <div className="atelier-hero-copy">
          <p className="eyebrow">آتلیهٔ رایحهٔ آرومان</p>
          <h1>رایحه‌ای که<br /><em>شبیه شماست.</em></h1>
          <p className="atelier-hero-lede">از یک حس شروع کنید. در ۶ گام، نت‌های دلخواهتان را پیدا کنید و ایدهٔ رایحهٔ شخصی‌تان را ببینید.</p>
          <nav className="atelier-hero-actions" aria-label="مسیرهای شروع آرومان">
            <Link className="btn btn-primary" href="/studio/guided">شروع کشف با راهنما <span aria-hidden="true">←</span></Link>
            <Link className="text-link" href="/shop">کشف مجموعه رایحه‌ها</Link>
            <Link className="text-link" href="/studio/creative">ساخت مفهوم رایحه</Link>
          </nav>
          <div className="hero-feelings" role="group" aria-labelledby="hero-feelings-label">
            <p id="hero-feelings-label">رایحهٔ شما چه حسی داشته باشد؟</p>
            <ul>
              {feelingOptions.filter(({ value }) => value === 'calm' || value === 'bright' || value === 'intimate').map(({ value, label, tone }) => (
                <li key={value}><Link href={`/studio/guided?feeling=${value}`} data-tone={tone}>{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <figure className="hero-photo">
          <Image src="/images/atelier-editorial.webp" alt="" fill preload sizes="(max-width: 760px) 100vw, 55vw" />
          <figcaption>تصویر مفهومی</figcaption>
        </figure>
      </div>
    </section>

    <section className="home-discovery section" id="discover">
      <div className="container">
        <header className="section-editorial-heading">
          <div><h2 className="heading">رایحه‌هایی برای کشف</h2><p>برای شناخت رایحه‌ها، از نمونه‌های این مجموعه شروع کنید.</p></div>
          <Link className="text-link" href="/shop">دیدن مجموعه رایحه‌ها <span aria-hidden="true">←</span></Link>
        </header>
        {unavailable ? <p className="catalog-state" role="status">کاتالوگ در دسترس نیست. لطفاً کمی بعد دوباره سر بزنید.</p> : products.length ? <div className="home-product-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div> : <p className="catalog-state">هنوز محصولی در کاتالوگ ثبت نشده است.</p>}
        <p className="demo-data-note">تصویرها مفهومی‌اند و نمای واقعی محصولات را نشان نمی‌دهند.</p>
      </div>
    </section>

    <section className="family-atelier section">
      <div className="container">
        <header className="section-editorial-heading family-heading">
          <div><h2 className="heading">از کدام فضا آغاز کنیم؟</h2><p>خانواده‌های رایحه را از کاتالوگ انتخاب کنید و مسیر کشف را ادامه دهید.</p></div>
        </header>
        {unavailable ? <p className="catalog-state" role="status">خانواده‌های رایحه اکنون در دسترس نیستند.</p> : families.length ? <div className="family-world-grid">{families.map(family => <FamilyCard key={family.id} family={family} />)}</div> : <p className="catalog-state">هنوز خانواده‌ی رایحه‌ای ثبت نشده است.</p>}
      </div>
    </section>

    <section className="studio-invitation section">
      <div className="container studio-invitation-inner">
        <StudioInvitationArtwork />
        <div className="studio-invitation-copy">
          <p className="eyebrow">استودیو خلاق</p>
          <h2 className="heading">ساختن، راه دیگری برای کشف است.</h2>
          <p>از میان نت‌های کاتالوگ انتخاب کنید، آن‌ها را در سه لایه بچینید و پیش‌نمایش مفهومی روایت خود را ببینید.</p>
          <Link className="btn btn-light" href="/studio/creative">ورود به استودیو خلاق <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>

    <section className="guided-invitation section">
      <div className="container guided-invitation-inner">
        <div><p className="eyebrow">استودیو راهنما</p><h2 className="heading">با چند پرسش، مسیر رایحه‌تان را پیدا کنید</h2><p>به چند پرسش دربارهٔ حس‌وحال و سلیقه‌تان پاسخ دهید تا یک پیشنهاد مفهومی رایحه دریافت کنید.</p><Link className="text-link" href="/studio/guided">شروع استودیو راهنما <span aria-hidden="true">←</span></Link></div>
        <div className="guided-note"><span aria-hidden="true">✳</span><p>از یک حس آغاز کنید؛<br />پیشنهاد مفهومی خود را ببینید.</p><small>شش گام برای کشف رایحه</small></div>
      </div>
    </section>

    <section className="atelier-story section">
      <div className="container"><p className="eyebrow">درباره‌ی آرومان</p><h2 className="heading">عطر، حافظه‌ای که می‌سازیم.</h2><p>آرومان فضایی برای کشف رایحه و ساخت روایت شخصی است؛ جایی که انتخاب‌های کوچک، قصه‌ی بزرگ‌تری را شکل می‌دهند.</p><Link href="/studio/creative" className="text-link">روایت خود را آغاز کنید <span aria-hidden="true">←</span></Link></div>
    </section>
  </>;
}
