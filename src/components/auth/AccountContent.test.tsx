import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountContent } from './AccountContent';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  logout: vi.fn(),
  user: { id: 'user-1', mobile_e164: '+989990000001', role: 'customer' },
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
    user: mocks.user,
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
    mocks.user = { id: 'user-1', mobile_e164: '+989990000001', role: 'customer' };
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

  it('does not show account A concepts or actions while account B is loading', async () => {
    let resolveSecond!: (items: typeof second[]) => void;
    mocks.list.mockResolvedValueOnce([first]).mockImplementationOnce(() =>
      new Promise(resolve => { resolveSecond = resolve; }),
    );
    const { rerender } = render(<AccountContent />);
    expect(await screen.findByRole('heading', { name: 'رایحه باران' })).toBeTruthy();

    mocks.user = { id: 'user-2', mobile_e164: '+989990000002', role: 'customer' };
    rerender(<AccountContent />);

    expect(screen.queryByRole('heading', { name: 'رایحه باران' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'باز کردن و ویرایش' })).toBeNull();
    expect(screen.getByText('+989990000002')).toBeTruthy();
    expect(screen.getByRole('status').textContent?.includes('در حال بارگذاری مفاهیم شما')).toBe(true);

    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    await act(async () => { resolveSecond([second]); });
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'رایحه باران' })).toBeNull();
  });

  it('ignores a late account A list response after account B has loaded', async () => {
    let resolveFirst!: (items: typeof first[]) => void;
    mocks.list.mockImplementationOnce(() =>
      new Promise(resolve => { resolveFirst = resolve; }),
    ).mockResolvedValueOnce([second]);

    const { rerender } = render(<AccountContent />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    const firstRequestSignal = mocks.list.mock.calls[0][2] as AbortSignal;
    expect(firstRequestSignal).toBeInstanceOf(AbortSignal);
    expect(firstRequestSignal.aborted).toBe(false);

    mocks.user = { id: 'user-2', mobile_e164: '+989990000002', role: 'customer' };
    rerender(<AccountContent />);
    expect(firstRequestSignal.aborted).toBe(true);
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();

    await act(async () => { resolveFirst([first]); });
    expect(screen.queryByRole('heading', { name: 'رایحه باران' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
  });

  it('cancels an unfinished concept list request when the account page unmounts', async () => {
    mocks.list.mockReturnValue(new Promise(() => { /* Intentionally pending until unmount. */ }));
    const { unmount } = render(<AccountContent />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    const signal = mocks.list.mock.calls[0][2] as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });
});
