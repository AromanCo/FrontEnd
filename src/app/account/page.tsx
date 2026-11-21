import { AccountContent } from '@/components/auth/AccountContent';
import { DemoOrderHistory } from '@/components/catalog/DemoOrderHistory';
import { notFound } from 'next/navigation';
import { getReleaseScope, isDemoCheckoutEnabled } from '@/lib/release-scope';

export default function AccountPage() {
  const scope = getReleaseScope();
  if (scope !== 'full') notFound();
  return (
    <div className="container account-page py-10 sm:py-14 lg:py-16">
      <AccountContent />
      {isDemoCheckoutEnabled(scope) && <DemoOrderHistory />}
    </div>
  );
}
