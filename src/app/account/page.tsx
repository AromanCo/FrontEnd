import {AccountContent} from '@/components/auth/AccountContent';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function AccountPage(){if(getReleaseScope()==='exploration')notFound();return <div className="container section"><AccountContent/></div>}
