import type { Metadata } from 'next';
import { GuidedStudio } from '@/components/studio/guided/GuidedStudio';

export const metadata: Metadata = {
  title: 'استودیوی هدایت‌شده | آرومان',
  description: 'با چند انتخاب حسی، یک تصویر مفهومی از رایحهٔ دلخواهتان بسازید.',
};

export default function GuidedPage() {
  return <GuidedStudio />;
}
