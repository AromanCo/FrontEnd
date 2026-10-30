'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

const PersonIcon = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6" /></svg>;
const BagIcon = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h16l-1 12H5L4 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
const MenuIcon = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export function Header() {
  const [open, setOpen] = useState(false);
  const { user, loading, error, authEnabled, publicShowcase } = useAuth();
  const links = [['/shop', authEnabled ? 'فروشگاه' : 'کشف رایحه‌ها'], ['/studio/creative', 'استودیو خلاق'], ['/studio/guided', 'استودیو راهنما']];
  const accountPending = Boolean(user || loading || error);
  const openSmartPerfumer = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    if (window.location.pathname.startsWith('/studio/creative')) {
      event.preventDefault();
      if (window.location.hash !== '#smart-perfumer') window.location.hash = 'smart-perfumer';
      window.dispatchEvent(new Event('aroman:show-smart-perfumer'));
    }
  };
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">رفتن به محتوا</a>
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="site-wordmark" aria-label="آرومان، صفحه اصلی">AROMAN</Link>
        <nav aria-label="ناوبری اصلی" className="site-nav">{links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/studio/creative#smart-perfumer" onClick={openSmartPerfumer}>اسمارت پرفیومر</Link>{publicShowcase&&<Link href="/account">حساب · پیش‌نمایش</Link>}{publicShowcase&&<Link href="/cart">سبد · پیش‌نمایش</Link>}{publicShowcase&&<Link href="/checkout">تسویه‌حساب · پیش‌نمایش</Link>}</nav>
        <div className="header-actions">
          <Link className="header-action" href="/shop" aria-label="جستجوی محصولات"><span className="hidden lg:inline">جستجو</span><span className="lg:hidden" aria-hidden="true">⌕</span></Link>
          {(authEnabled || publicShowcase) && <Link className="header-action" href={publicShowcase ? '/account' : accountPending ? '/account' : '/login'} aria-label={publicShowcase ? 'پیش‌نمایش حساب کاربری' : accountPending ? 'حساب من' : 'ورود'}><span className="hidden lg:inline">{publicShowcase ? 'حساب کاربری · پیش‌نمایش' : accountPending ? 'حساب من' : 'ورود'}</span><span className="lg:hidden" aria-hidden="true"><PersonIcon /></span></Link>}
          {(authEnabled || publicShowcase) && <Link className="header-action" href="/cart" aria-label={publicShowcase ? 'پیش‌نمایش سبد خرید' : 'سبد خرید'}><span className="hidden lg:inline">{publicShowcase ? 'سبد · پیش‌نمایش' : 'سبد خرید'}</span><span className="lg:hidden" aria-hidden="true"><BagIcon /></span></Link>}
          <button className="header-menu" type="button" aria-label={open ? 'بستن فهرست' : 'باز کردن فهرست'} aria-expanded={open} onClick={() => setOpen(!open)}><MenuIcon /></button>
        </div>
      </div>
      {open && <nav aria-label="ناوبری موبایل" className="container mobile-nav"><Link onClick={() => setOpen(false)} href="/shop">{authEnabled ? 'جستجو و فروشگاه' : 'کشف رایحه‌ها'}</Link>{links.slice(1).map(([href, label]) => <Link onClick={() => setOpen(false)} key={href} href={href}>{label}</Link>)}<Link onClick={openSmartPerfumer} href="/studio/creative#smart-perfumer">اسمارت پرفیومر</Link>{publicShowcase&&<><Link onClick={() => setOpen(false)} href="/account">حساب کاربری · پیش‌نمایش</Link><Link onClick={() => setOpen(false)} href="/cart">سبد خرید · پیش‌نمایش</Link><Link onClick={() => setOpen(false)} href="/checkout">تسویه‌حساب · پیش‌نمایش</Link></>}</nav>}
    </header>
  </>;
}
