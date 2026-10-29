import {LoginForm} from '@/components/auth/LoginForm';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function LoginPage(){if(getReleaseScope()==='exploration')notFound();return <div className="container section"><div className="card mx-auto max-w-lg p-7 md:p-10"><LoginForm/></div></div>}
