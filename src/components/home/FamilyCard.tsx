import Link from 'next/link';
import type { Family } from '@/lib/api/client';
import { familyMood } from '@/lib/studio/presentation';

export function FamilyCard({ family, index }: { family: Family; index: number }) {
  const mood = familyMood(family.name);
  return <Link href={`/shop?family_id=${family.id}`} className="family-world" data-mood={mood}>
    <span className="family-world-number">۰{index + 1}</span>
    <span className="family-world-symbol" aria-hidden="true"><i /><i /><i /></span>
    <span className="family-world-copy"><span className="family-world-kicker">خانواده‌ی رایحه</span><strong>{family.name}</strong><span>{family.description || 'برای آشنایی با محصولات این خانواده، آن را در کاتالوگ ببینید.'}</span><span className="family-world-link">مشاهده محصولات <i aria-hidden="true">←</i></span></span>
  </Link>;
}
