import {LoginForm} from '@/components/auth/LoginForm';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function LoginPage(){const scope=getReleaseScope();if(scope==='exploration')notFound();if(scope==='public-showcase')return <div className="container section"><div className="card mx-auto max-w-lg p-7 md:p-10"><p className="eyebrow">پیش‌نمایش · ورود فعال نیست</p><h1 className="heading mt-4">ورود به آرومان</h1><p className="mt-5 leading-9">ورود با شماره همراه در این نسخه فعال نیست؛ شماره‌ای دریافت نمی‌کنیم و پیامکی ارسال نمی‌شود.</p></div></div>;return <div className="container section"><div className="card mx-auto max-w-lg p-7 md:p-10"><LoginForm/></div></div>}
