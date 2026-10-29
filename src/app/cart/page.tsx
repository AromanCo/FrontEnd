import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function Cart(){if(getReleaseScope()==='exploration')notFound();return <div className="container section"><p className="eyebrow">COMING NEXT</p><h1 className="heading mt-4">سبد خرید</h1><p className="mt-5 max-w-xl leading-9">سبد خرید در مرحله بعد به سرویس سفارش متصل می‌شود. در حال حاضر محصولی به سبد اضافه یا در سرور ثبت نمی‌شود.</p><Link className="btn btn-primary mt-8" href="/shop">مشاهده محصولات نمایشی</Link></div>}
