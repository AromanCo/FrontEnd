import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const catalogMocks = vi.hoisted(() => ({
  products: vi.fn().mockResolvedValue([]),
  families: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/api/client', () => ({
  catalog: {
    products: catalogMocks.products,
    families: catalogMocks.families,
  },
}));

import Home from '@/app/page';

it('presents Guided Studio as an available conceptual questionnaire and links to its route', async () => {
  render(await Home());

  const heading = screen.getByRole('heading', { level: 2, name: 'با چند پرسش، مسیر رایحه‌تان را پیدا کنید' });
  const section = heading.closest('section');
  expect(section).not.toBeNull();

  const guidedSection = within(section as HTMLElement);
  expect(guidedSection.getByText(/به چند پرسش دربارهٔ حس‌وحال و سلیقه‌تان پاسخ دهید تا یک پیشنهاد مفهومی رایحه دریافت کنید/)).toBeInTheDocument();
  expect(guidedSection.getByRole('link', { name: 'شروع استودیو راهنما' })).toHaveAttribute('href', '/studio/guided');
  expect(guidedSection.queryByText(/به‌زودی|در مرحله‌ی بعد تکمیل می‌شود/)).not.toBeInTheDocument();
});
