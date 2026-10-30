import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function Cart(){const scope=getReleaseScope();if(scope==='exploration')notFound();return <div className="container section"><p className="eyebrow">پیش‌نمایش · سبد خرید فعال نیست</p><h1 className="heading mt-4">سبد خرید</h1><p className="mt-5 max-w-xl leading-9">افزودن محصول به سبد و نگهداری آن فعال نیست. هیچ اطلاعاتی ذخیره نمی‌شود.</p><div className="mt-8 flex flex-wrap gap-3"><Link className="btn btn-primary" href="/checkout">ادامه به پیش‌نمایش تسویه‌حساب</Link><Link className="btn btn-secondary" href="/shop">مشاهده کاتالوگ نمایشی</Link></div></div>}
