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
    vi.restoreAllMocks();
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

  it('does not send a second duplicate request while the first is unresolved', async () => {
    let rejectDuplicate!: (error: Error) => void;
    mocks.list.mockResolvedValue([first]);
    mocks.duplicate.mockReturnValue(new Promise((_resolve, reject) => { rejectDuplicate = reject; }));
    render(<AccountContent />);

    await screen.findByRole('heading', { name: 'رایحه باران' });
    const duplicate = screen.getByRole('button', { name: 'کپی' });
    fireEvent.click(duplicate);
    fireEvent.click(duplicate);
    expect(mocks.duplicate).toHaveBeenCalledTimes(1);
    expect(duplicate.hasAttribute('disabled')).toBe(true);

    await act(async () => { rejectDuplicate(new Error('uncertain network response')); });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('مفهوم کپی شد.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'رایحه باران' })).toBeTruthy();
    expect(mocks.duplicate).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('requires delete confirmation and does not replay an uncertain delete', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mocks.list.mockResolvedValue([first]);
    mocks.remove.mockRejectedValueOnce(new Error('uncertain network response'));
    render(<AccountContent />);

    await screen.findByRole('heading', { name: 'رایحه باران' });
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();

    confirmation.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith('concept-1');
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'رایحه باران' })).toBeTruthy();
    expect(screen.queryByText('مفهوم حذف شد.')).toBeNull();
  });

  it('keeps loaded concepts during a failed next page and retries only on explicit action', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({ ...first, id: `page-one-${index + 1}` }));
    mocks.list.mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('next page unavailable'))
      .mockResolvedValueOnce([second]);
    render(<AccountContent />);

    await screen.findAllByRole('heading', { name: 'رایحه باران' });
    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'رایحه باران' })).toHaveLength(20);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.list.mock.calls[1].slice(0, 2)).toEqual([20, 20]);

    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }));
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(3);
    expect(mocks.list.mock.calls[2].slice(0, 2)).toEqual([20, 20]);
    expect(screen.getAllByRole('heading', { name: 'رایحه باران' })).toHaveLength(20);
  });

  it('prevents list paging and concept changes from racing each other', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({ ...first, id: `page-one-${index + 1}` }));
    const secondPage = Array.from({ length: 20 }, (_, index) => ({ ...first, id: `page-two-${index + 1}` }));
    let resolvePage!: (items: typeof second[]) => void;
    let resolveDuplicate!: (item: typeof second) => void;
    mocks.list.mockResolvedValueOnce(firstPage)
      .mockImplementationOnce(() => new Promise(resolve => { resolvePage = resolve; }))
      .mockResolvedValueOnce([second]);
    mocks.duplicate.mockReturnValue(new Promise(resolve => { resolveDuplicate = resolve; }));
    render(<AccountContent />);

    await screen.findAllByRole('heading', { name: 'رایحه باران' });
    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }));
    const duplicate = screen.getAllByRole('button', { name: 'کپی' })[0];
    expect(duplicate).toHaveProperty('disabled', true);
    fireEvent.click(duplicate);
    expect(mocks.duplicate).not.toHaveBeenCalled();

    await act(async () => { resolvePage(secondPage); });
    fireEvent.click(duplicate);
    expect(mocks.duplicate).toHaveBeenCalledTimes(1);
    const more = screen.getByRole('button', { name: 'نمایش بیشتر' });
    expect(more).toHaveProperty('disabled', true);
    fireEvent.click(more);
    expect(mocks.list).toHaveBeenCalledTimes(2);

    await act(async () => { resolveDuplicate(second); });
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
    expect(mocks.list.mock.calls[2].slice(0, 2)).toEqual([20, 0]);
  });

  it('retries the list alone after a confirmed delete and failed refresh', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.remove.mockResolvedValue(undefined);
    mocks.list.mockResolvedValueOnce([first])
      .mockRejectedValueOnce(new Error('refresh unavailable'))
      .mockResolvedValueOnce([second]);
    render(<AccountContent />);

    await screen.findByRole('heading', { name: 'رایحه باران' });
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('مفهوم حذف شد.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'رایحه باران' })).toBeNull();
    expect(screen.queryByText(/هنوز مفهومی ذخیره نکرده‌اید/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(await screen.findByRole('heading', { name: 'رایحه باغ' })).toBeTruthy();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.list.mock.calls[2].slice(0, 2)).toEqual([20, 0]);
  });

  it('requests saved concepts again after a same-account logout and remount', async () => {
    mocks.list.mockResolvedValue([first]);
    const firstMount = render(<AccountContent />);
    await screen.findByRole('heading', { name: 'رایحه باران' });
    firstMount.unmount();

    render(<AccountContent />);
    expect(await screen.findByRole('heading', { name: 'رایحه باران' })).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.list.mock.calls[0][1]).toBe(0);
    expect(mocks.list.mock.calls[1][1]).toBe(0);
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
