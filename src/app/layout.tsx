import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { StudioDraftProvider } from '@/lib/studio/draft-transfer';
export const metadata: Metadata = { title: 'آرومان | عطرِ روایت شما', description: 'کشف رایحه‌ها و ساخت مفهوم عطر شخصی در آرومان' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body><AuthProvider><StudioDraftProvider><Header/><main id="main">{children}</main><Footer/></StudioDraftProvider></AuthProvider></body></html>}
