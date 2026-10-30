import {AccountContent} from '@/components/auth/AccountContent';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function AccountPage(){const scope=getReleaseScope();if(scope==='exploration')notFound();if(scope==='public-showcase')return <Preview title="حساب کاربری" text="ورود و نگهداری اطلاعات حساب در این نسخه فعال نیست. برای این پیش‌نمایش هیچ درخواست ورود یا ذخیره‌سازی انجام نمی‌شود."/>;return <div className="container section"><AccountContent/></div>}
function Preview({title,text}:{title:string;text:string}){return <div className="container section"><div className="card mx-auto max-w-2xl p-7 md:p-10"><p className="eyebrow">پیش‌نمایش · هنوز فعال نیست</p><h1 className="heading mt-4">{title}</h1><p className="mt-5 leading-9">{text}</p><a className="btn btn-primary mt-8" href="/studio/guided">ادامه‌ی کاوش رایحه</a></div></div>}
