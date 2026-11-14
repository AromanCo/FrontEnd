import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CatalogControls } from './CatalogControls';

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }));

const brands = [
  { id: 'brand-1', slug: 'brand-demo', name: 'برند آزمایشی', description: null, is_demo: true },
];
const families = [
  { id: 'family-1', slug: 'floral', name: 'گلی', description: null, is_demo: true },
];

describe('CatalogControls', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  const mount = (q = '', brandId = '', familyId = '') => render(
    <CatalogControls q={q} brandId={brandId} familyId={familyId} brands={brands} families={families} />,
  );

  it('submits the three filters with trimmed search and resets pagination', () => {
    mount();
    fireEvent.change(screen.getByPlaceholderText('نام محصول'), { target: { value: '  گل  ' } });
    fireEvent.change(screen.getByLabelText('برند'), { target: { value: 'brand-1' } });
    fireEvent.change(screen.getByLabelText('خانواده رایحه'), { target: { value: 'family-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'اعمال فیلتر' }));

    const target = mockRouter.push.mock.calls[0][0] as string;
    const params = new URL(target, 'http://localhost').searchParams;
    expect(target.startsWith('/shop?')).toBe(true);
    expect(params.get('q')).toBe('گل');
    expect(params.get('brand_id')).toBe('brand-1');
    expect(params.get('family_id')).toBe('family-1');
    expect(params.has('offset')).toBe(false);
  });

  it('displays active filters with accessible removal without dropping unrelated filters', () => {
    mount('رایحه', 'brand-1', 'family-1');
    expect(screen.getByLabelText('فیلترهای فعال')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'حذف برند: برند آزمایشی' }));

    const target = mockRouter.push.mock.calls[0][0] as string;
    const params = new URL(target, 'http://localhost').searchParams;
    expect(params.get('q')).toBe('رایحه');
    expect(params.get('family_id')).toBe('family-1');
    expect(params.has('brand_id')).toBe(false);
  });

  it('clears all filters without requiring an additional form submit', () => {
    mount('رایحه', 'brand-1', '');
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن همه فیلترها' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/shop');
  });

  it('does not show misleading active-filter controls for an unfiltered catalog', () => {
    mount();
    expect(screen.queryByLabelText('فیلترهای فعال')).toBeNull();
    expect(screen.queryByRole('button', { name: 'پاک کردن همه فیلترها' })).toBeNull();
  });
});
