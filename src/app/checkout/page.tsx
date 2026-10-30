import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function Checkout(){const scope=getReleaseScope();if(scope==='exploration')notFound();return <div className="container section"><p className="eyebrow">پیش‌نمایش · پرداخت فعال نیست</p><h1 className="heading mt-4">تسویه‌حساب</h1><p className="mt-5 max-w-xl leading-9">ثبت سفارش و پرداخت در دسترس نیست. اطلاعات پرداخت دریافت نمی‌کنیم و تراکنشی انجام نمی‌شود.</p><Link className="btn btn-primary mt-8" href="/shop">بازگشت به کاتالوگ</Link></div>}
