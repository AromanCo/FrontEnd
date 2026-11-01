import {AccountContent} from '@/components/auth/AccountContent';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';
export default function AccountPage(){if(getReleaseScope()!=='full')notFound();return <div className="container section"><AccountContent/></div>}
