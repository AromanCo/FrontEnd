import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountContent } from './AccountContent';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  concepts: {
    list: mocks.list,
    duplicate: mocks.duplicate,
    remove: mocks.remove,
  },
}));

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', mobile_e164: '+989990000001', role: 'customer' },
    loading: false,
    error: '',
    logout: mocks.logout,
  }),
}));

const first = {
  id: 'concept-1',
  name: 'رایحه باران',
  notes: [
    { note_id: 'n1', layer: 'top', position: 0 },
    { note_id: 'n2', layer: 'heart', position: 0 },
    { note_id: 'n3', layer: 'heart', position: 1 },
    { note_id: 'n4', layer: 'base', position: 0 },
  ],
};

const second = {
  id: 'concept-2',
  name: 'رایحه باغ',
  notes: [{ note_id: 'n5', layer: 'base', position: 0 }],
};

describe('AccountContent dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows real concept note-layer counts and preserved edit action', async () => {
    mocks.list.mockResolvedValue([first]);
    render(<AccountContent />);

    expect(await screen.findByRole('heading', { name: 'رایحه باران' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /آغازین ۱، میانی ۲، پایه ۱/ })).toBeTruthy();
    expect(screen.getByText('۱ مفهوم نمایش داده‌شده')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'باز کردن و ویرایش' }).getAttribute('href'))
      .toBe('/studio/creative?concept=concept-1');
    expect(screen.getByRole('button', { name: 'خروج' })).toBeTruthy();
  });

  it('offers creative and guided starting points only for a genuinely empty account', async () => {
    mocks.list.mockResolvedValue([]);
    render(<AccountContent />);

    expect(await screen.findByRole('link', { name: 'اولین مفهوم را بسازید.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'اولین مفهوم را بسازید.' }).getAttribute('href'))
      .toBe('/studio/creative');
    expect(screen.getByRole('link', { name: 'شروع با استودیوی راهنما' }).getAttribute('href'))
      .toBe('/studio/guided');
  });

  it('shows a retry instead of an empty-state claim when loading fails', async () => {
    mocks.list.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce([first]);
    render(<AccountContent />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'اولین مفهوم را بسازید.' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(await screen.findByRole('heading', { name: 'رایحه باران' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps the existing duplicate action and refreshes the collection', async () => {
    mocks.list.mockResolvedValueOnce([first]).mockResolvedValueOnce([first, second]);
    mocks.duplicate.mockResolvedValue(second);
    render(<AccountContent />);

    await screen.findByRole('heading', { name: 'رایحه باران' });
    fireEvent.click(screen.getByRole('button', { name: 'کپی' }));

    await waitFor(() => expect(mocks.duplicate).toHaveBeenCalledWith('concept-1'));
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('مفهوم کپی شد.');
  });
});
