import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { StudioDraftProvider } from '@/lib/studio/draft-transfer';
import { getReleaseScope } from '@/lib/release-scope';
export const metadata: Metadata = { title: 'آرومان | عطرِ روایت شما', description: 'کشف رایحه‌ها و ساخت مفهوم عطر شخصی در آرومان' };
export const dynamic = 'force-dynamic';
export default function RootLayout({children}:{children:React.ReactNode}){const scope=getReleaseScope();return <html lang="fa" dir="rtl"><body><AuthProvider scope={scope}><StudioDraftProvider><Header/><main id="main">{children}</main><Footer explorationOnly={scope==='exploration'}/></StudioDraftProvider></AuthProvider></body></html>}
