import Link from 'next/link';

export function Footer({ explorationOnly = false, publicShowcase = false }: { explorationOnly?: boolean; publicShowcase?: boolean }) {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div><p className="footer-wordmark">AROMAN</p><p className="footer-copy">فضایی برای کشف رایحه و ساخت روایت شخصی شما.</p></div>
      <nav aria-label="پیوندهای پایانی" className="footer-links"><Link href="/shop">مجموعه‌ی آرومان</Link><Link href="/studio/creative">استودیو خلاق</Link><Link href="/studio/guided">استودیو راهنما</Link>{publicShowcase&&<><Link href="/account">حساب کاربری · پیش‌نمایش</Link><Link href="/cart">سبد خرید · پیش‌نمایش</Link><Link href="/checkout">تسویه‌حساب · پیش‌نمایش</Link></>}</nav>
      <div><p>آرومان</p><p className="footer-note">{explorationOnly ? 'کاتالوگ و تصویرها نمایشی‌اند؛ قیمت، موجودی و امکان سفارش ارائه نمی‌شود.' : 'قیمت‌گذاری و سفارش آنلاین در مرحله‌ی بعد در دسترس قرار می‌گیرد.'}</p></div>
    </div>
    <div className="footer-legal">© {new Date().getFullYear()} AROMAN</div>
  </footer>;
}
