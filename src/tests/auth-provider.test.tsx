import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), me: vi.fn(), logout: vi.fn(), renewCsrf: vi.fn(), setCsrf: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  auth: { session: mocks.session, me: mocks.me, logout: mocks.logout },
  renewCsrf: mocks.renewCsrf,
  setCsrf: mocks.setCsrf,
}));

import { ApiError } from '@/lib/api/client';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/layout/Header';

const user = { id: 'id', mobile_e164: '+989121234567', role: 'customer' };
function Probe() {
  const { user: current, loading, error, refresh, logout } = useAuth();
  return <div>
    <span data-testid="auth-state">{loading ? 'loading' : current ? 'signed-in' : 'guest'}</span>
    <span data-testid="user">{current?.id ?? 'none'}</span>
    <span data-testid="error">{error}</span>
    <button onClick={() => void refresh().catch(() => {})}>Refresh</button>
    <button onClick={() => void logout()}>خروج</button>
  </div>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user_id: 'id', role: 'customer' });
  mocks.renewCsrf.mockResolvedValue('csrf');
  mocks.me.mockResolvedValue(user);
  mocks.logout.mockResolvedValue(undefined);
});

it('confirms an initial 401 as guest and clears CSRF without a retry warning', async () => {
  mocks.session.mockRejectedValueOnce(new ApiError(401, 'برای ادامه وارد حساب شوید.'));
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mocks.renewCsrf).not.toHaveBeenCalled();
  expect(mocks.setCsrf).toHaveBeenCalledWith(null);
});

it.each([
  new ApiError(503, 'این سرویس در حال حاضر در دسترس نیست.'),
  new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.'),
  new ApiError(0, 'پاسخ سرور بیش از حد طول کشید. دوباره تلاش کنید.'),
])('keeps initial authentication unresolved after a transient failure: %s', async (failure) => {
  mocks.session.mockRejectedValueOnce(failure);
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent(failure.message);
  expect(screen.getByTestId('auth-state')).toHaveTextContent('loading');
  expect(screen.getByTestId('user')).toHaveTextContent('none');
  expect(mocks.setCsrf).not.toHaveBeenCalledWith(null);
  expect(screen.getByRole('button', { name: 'تلاش دوباره برای بررسی نشست' })).toBeEnabled();
});

it('recovers on retry and ignores duplicate retry clicks while pending', async () => {
  mocks.session.mockRejectedValueOnce(new ApiError(503, 'این سرویس در حال حاضر در دسترس نیست.'));
  let resolveSession!: (value: { user_id: string; role: string }) => void;
  mocks.session.mockReturnValueOnce(new Promise(resolve => { resolveSession = resolve; }));
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  const retry = await screen.findByRole('button', { name: 'تلاش دوباره برای بررسی نشست' });
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(mocks.session).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'در حال تلاش…' })).toBeDisabled();
  await act(async () => resolveSession({ user_id: 'id', role: 'customer' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mocks.renewCsrf).toHaveBeenCalledOnce();
});

it('preserves a known user after a failed profile refresh, then recovers', async () => {
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
  mocks.me.mockRejectedValueOnce(new ApiError(503, 'این سرویس در حال حاضر در دسترس نیست.'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('این سرویس در حال حاضر در دسترس نیست.');
  expect(screen.getByTestId('user')).toHaveTextContent('id');
  expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in');
  expect(mocks.setCsrf).not.toHaveBeenCalledWith(null);
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای بررسی نشست' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(screen.getByTestId('user')).toHaveTextContent('id');
});

it('clears a known user when a refresh receives a genuine 401', async () => {
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
  mocks.session.mockRejectedValueOnce(new ApiError(401, 'برای ادامه وارد حساب شوید.'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
  expect(screen.getByTestId('user')).toHaveTextContent('none');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mocks.setCsrf).toHaveBeenCalledWith(null);
});

it('clears a known user on session expiry and logs out through the backend', async () => {
  render(<AuthProvider scope="full"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
  act(() => window.dispatchEvent(new Event('aroman:session-expired')));
  expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
  expect(mocks.setCsrf).toHaveBeenCalledWith(null);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
  fireEvent.click(screen.getByRole('button', { name: 'خروج' }));
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
  expect(mocks.logout).toHaveBeenCalledOnce();
});

it('keeps a ready guest context and makes no authentication calls in exploration mode', async () => {
  render(<AuthProvider scope="exploration"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.renewCsrf).not.toHaveBeenCalled();
  expect(mocks.me).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps a ready guest context and makes no authentication calls in public-showcase mode', async () => {
  render(<AuthProvider scope="public-showcase"><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.renewCsrf).not.toHaveBeenCalled();
  expect(mocks.me).not.toHaveBeenCalled();
  expect(mocks.logout).not.toHaveBeenCalled();
});

it('exposes major public areas and clearly labeled previews in desktop and mobile navigation', () => {
  render(<AuthProvider scope="public-showcase"><Header /></AuthProvider>);
  const desktop = screen.getByRole('navigation', { name: 'ناوبری اصلی' });
  for (const href of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    expect(desktop.querySelector(`a[href="${href}"]`), href).toBeTruthy();
  }
  expect(desktop).toHaveTextContent('پیش‌نمایش');
  fireEvent.click(screen.getByRole('button', { name: 'باز کردن فهرست' }));
  const mobile = screen.getByRole('navigation', { name: 'ناوبری موبایل' });
  for (const href of ['/shop', '/studio/creative', '/studio/guided', '/account', '/cart', '/checkout']) {
    expect(mobile.querySelector(`a[href="${href}"]`), href).toBeTruthy();
  }
});
