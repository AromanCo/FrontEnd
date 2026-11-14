import { AccountContent } from '@/components/auth/AccountContent';
import { notFound } from 'next/navigation';
import { getReleaseScope } from '@/lib/release-scope';

export default function AccountPage() {
  if (getReleaseScope() !== 'full') notFound();
  return (
    <div className="container py-10 sm:py-14 lg:py-16">
      <AccountContent />
    </div>
  );
}
