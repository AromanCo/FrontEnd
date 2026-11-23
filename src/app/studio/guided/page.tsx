import type { Metadata } from 'next';
import { validateFeeling } from '@/lib/studio/guided/answers';
import { GuidedStudio } from '@/components/studio/guided/GuidedStudio';

export const metadata: Metadata = {
  title: 'استودیوی هدایت‌شده | آرومان',
  description: 'با چند انتخاب حسی، یک تصویر مفهومی از رایحهٔ دلخواهتان بسازید.',
};

export default async function GuidedPage({
  searchParams,
}: {
  searchParams: Promise<{ feeling?: string | string[] }>;
}) {
  const initialFeeling = validateFeeling((await searchParams).feeling).value;
  return <GuidedStudio key={initialFeeling ?? 'default'} initialFeeling={initialFeeling} />;
}
