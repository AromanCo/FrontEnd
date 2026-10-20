import Link from 'next/link';
import { catalog, type Family, type Product } from '@/lib/api/client';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FamilyCard } from '@/components/home/FamilyCard';
import { AtelierHeroArtwork } from '@/components/home/AtelierHeroArtwork';
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
          <p className="eyebrow"><span className="hero-kicker-mark">✳</span> آتلیه‌ی رایحه‌ی آرومان</p>
          <h1>رایحه‌ای که<br /><em>از شما آغاز می‌شود.</em></h1>
          <p className="atelier-hero-lede">راه خودتان را میان کشف عطرها و ساخت یک مفهوم شخصی پیدا کنید؛ هر انتخاب، بخشی از روایت شماست.</p>
          <div className="atelier-hero-actions">
            <Link className="btn btn-primary" href="/shop">کشف عطرها <span aria-hidden="true">←</span></Link>
            <Link className="btn btn-atelier-outline" href="/studio/creative">ساخت رایحه شخصی <span aria-hidden="true">✳</span></Link>
          </div>
          <div className="hero-pathways" aria-label="دو مسیر آرومان">
            <span><i>۰۱</i> کشف مجموعه</span><span><i>۰۲</i> ساخت روایت</span>
          </div>
        </div>
        <AtelierHeroArtwork />
      </div>
      <div className="atelier-hero-foot container"><span>PERFUME · MEMORY · YOU</span><span aria-hidden="true">↓</span><span>از تجربه‌ی رایحه آغاز کنید</span></div>
    </section>

    <section className="home-discovery section" id="discover">
      <div className="container">
        <header className="section-editorial-heading">
          <div><p className="eyebrow">۰۱ / مجموعه‌ی آرومان</p><h2 className="heading">رایحه‌هایی برای کشف</h2><p>با مجموعه‌ی نمایشی کاتالوگ آشنا شوید.</p></div>
          <Link className="text-link" href="/shop">رفتن به فروشگاه <span aria-hidden="true">←</span></Link>
        </header>
        {unavailable ? <p className="catalog-state" role="status">کاتالوگ در دسترس نیست. لطفاً کمی بعد دوباره سر بزنید.</p> : products.length ? <div className="home-product-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div> : <p className="catalog-state">هنوز محصولی در کاتالوگ ثبت نشده است.</p>}
        <p className="demo-data-note">تصویرها، تصویرسازی مفهومی هستند؛ جزئیات واقعی هر محصول را در صفحه‌ی آن ببینید.</p>
      </div>
    </section>

    <section className="family-atelier section">
      <div className="container">
        <header className="section-editorial-heading family-heading">
          <div><p className="eyebrow">۰۲ / جهان‌های بویایی</p><h2 className="heading">از کدام فضا آغاز کنیم؟</h2><p>خانواده‌های رایحه را از کاتالوگ انتخاب کنید و مسیر کشف را ادامه دهید.</p></div>
          <span className="family-heading-note">هر خانواده<br />یک حال‌وهوا</span>
        </header>
        {unavailable ? <p className="catalog-state" role="status">خانواده‌های رایحه اکنون در دسترس نیستند.</p> : families.length ? <div className="family-world-grid">{families.map((family, index) => <FamilyCard key={family.id} family={family} index={index} />)}</div> : <p className="catalog-state">هنوز خانواده‌ی رایحه‌ای ثبت نشده است.</p>}
      </div>
    </section>

    <section className="studio-invitation section">
      <div className="container studio-invitation-inner">
        <StudioInvitationArtwork />
        <div className="studio-invitation-copy">
          <p className="eyebrow">۰۳ / استودیو خلاق</p>
          <h2 className="heading">ساختن، راه دیگری برای کشف است.</h2>
          <p>از میان نت‌های واقعی کاتالوگ انتخاب کنید، آن‌ها را در سه لایه بچینید و پیش‌نمایش مفهومی روایت خود را ببینید.</p>
          <div className="invitation-facts"><span>تا ۶ نت</span><span>۳ لایه‌ی رایحه</span><span>یک مفهوم شخصی</span></div>
          <Link className="btn btn-light" href="/studio/creative">ورود به استودیو خلاق <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>

    <section className="guided-invitation section">
      <div className="container guided-invitation-inner">
        <div><p className="eyebrow">۰۴ / استودیو راهنما</p><h2 className="heading">برای آغاز، یک همراه</h2><p>مسیر راهنمای کشف رایحه در مرحله‌ی بعد تکمیل می‌شود. فعلاً می‌توانید با استودیو خلاق، آزادانه تجربه کنید.</p><Link className="text-link" href="/studio/guided">آشنایی با استودیو راهنما <span aria-hidden="true">←</span></Link></div>
        <div className="guided-note"><span aria-hidden="true">✳</span><p>یک حس را دنبال کنید؛<br />روایت خودش پیدا می‌شود.</p><small>به‌زودی در آرومان</small></div>
      </div>
    </section>

    <section className="atelier-story section">
      <div className="container"><p className="eyebrow">درباره‌ی آرومان</p><h2 className="heading">عطر، حافظه‌ای که می‌سازیم.</h2><p>آرومان فضایی برای کشف رایحه و ساخت روایت شخصی است؛ جایی که انتخاب‌های کوچک، قصه‌ی بزرگ‌تری را شکل می‌دهند.</p><Link href="/studio/creative" className="text-link">روایت خود را آغاز کنید <span aria-hidden="true">←</span></Link></div>
    </section>
  </>;
}
