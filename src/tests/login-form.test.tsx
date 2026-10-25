import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  challenge: vi.fn(),
  verify: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
  auth: { challenge: mocks.challenge, verify: mocks.verify },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ refresh: mocks.refresh }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

import { ApiError } from '@/lib/api/client';
import { LoginForm } from '@/components/auth/LoginForm';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.refresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

function enterMobileAndSubmit() {
  fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09121234567' } });
  fireEvent.submit(screen.getByRole('button', { name: 'دریافت کد' }).closest('form')!);
}

it.each([
  [503, 'این سرویس در حال حاضر در دسترس نیست.'],
  [429, 'درخواست‌های زیادی ثبت شده است. کمی صبر کنید.'],
])('shows the safe challenge message for HTTP %i without advancing', async (status, message) => {
  mocks.challenge.mockRejectedValue(new ApiError(status, message));
  render(<LoginForm />);

  enterMobileAndSubmit();

  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByLabelText('کد شش رقمی')).toBeNull();
  expect(screen.getByLabelText('شماره موبایل')).toBeTruthy();
  expect(mocks.verify).not.toHaveBeenCalled();
});

it('advances to code entry after a successful challenge', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  render(<LoginForm />);

  enterMobileAndSubmit();

  expect(await screen.findByLabelText('کد شش رقمی')).toBeTruthy();
  expect(mocks.challenge).toHaveBeenCalledWith('09121234567');
});

it('keeps the verification step available for retry after an invalid or expired code', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  mocks.verify.mockRejectedValue(new ApiError(400, 'کد نامعتبر یا منقضی شده است.'));
  render(<LoginForm />);
  enterMobileAndSubmit();

  const codeInput = await screen.findByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.submit(codeInput.closest('form')!);

  expect(await screen.findByRole('alert')).toHaveTextContent('کد نامعتبر یا منقضی شده است.');
  expect(screen.getByLabelText('کد شش رقمی')).toBeTruthy();
  expect(screen.getByLabelText('شماره موبایل')).toBeDisabled();
});

it('ignores duplicate submissions while a request is pending', async () => {
  let resolveChallenge!: (value: { message: string }) => void;
  mocks.challenge.mockReturnValue(
    new Promise((resolve) => {
      resolveChallenge = resolve;
    }),
  );
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText('شماره موبایل'), {
    target: { value: '09121234567' },
  });
  const form = screen.getByRole('button', { name: 'دریافت کد' }).closest('form')!;

  fireEvent.submit(form);
  fireEvent.submit(form);

  expect(mocks.challenge).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'در حال انجام…' })).toBeDisabled();
  await act(async () => resolveChallenge({ message: 'accepted' }));
  expect(await screen.findByLabelText('کد شش رقمی')).toBeTruthy();
});

it('ignores duplicate verification submissions while pending, then refreshes and navigates', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  let resolveVerify!: (value: { user_id: string }) => void;
  mocks.verify.mockReturnValue(
    new Promise((resolve) => {
      resolveVerify = resolve;
    }),
  );
  render(<LoginForm />);
  enterMobileAndSubmit();
  const codeInput = await screen.findByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  const form = codeInput.closest('form')!;

  fireEvent.submit(form);
  fireEvent.submit(form);

  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'در حال انجام…' })).toBeDisabled();
  await act(async () => resolveVerify({ user_id: 'user-1' }));

  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it('clears a previously entered code after successful resend', async () => {
  vi.useFakeTimers();
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText('شماره موبایل'), {
    target: { value: '09121234567' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'دریافت کد' }).closest('form')!);
    await Promise.resolve();
  });
  const codeInput = screen.getByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });

  for (let second = 0; second < 60; second += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
  }
  const resend = screen.getByRole('button', { name: 'ارسال دوباره کد' });
  await act(async () => {
    fireEvent.click(resend);
    await Promise.resolve();
  });

  expect(mocks.challenge).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('کد شش رقمی')).toHaveValue('');
});

it('refreshes authentication and navigates to the account after successful verification', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  mocks.verify.mockResolvedValue({ user_id: 'user-1' });
  render(<LoginForm />);
  enterMobileAndSubmit();
  const codeInput = await screen.findByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.submit(codeInput.closest('form')!);

  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
  expect(mocks.verify).toHaveBeenCalledWith('09121234567', '123456');
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it('retries only profile refresh after a verified OTP and prevents duplicate retries', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  mocks.verify.mockResolvedValue({ user_id: 'user-1' });
  mocks.refresh.mockRejectedValueOnce(new ApiError(503, 'این سرویس در حال حاضر در دسترس نیست.'));
  let resolveRefresh!: () => void;
  mocks.refresh.mockReturnValueOnce(new Promise<void>(resolve => { resolveRefresh = resolve; }));
  render(<LoginForm />);
  enterMobileAndSubmit();
  const codeInput = await screen.findByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.submit(codeInput.closest('form')!);

  expect(await screen.findByRole('alert')).toHaveTextContent('کد تأیید شد، اما بارگذاری حساب انجام نشد.');
  expect(codeInput).toBeDisabled();
  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  const retry = screen.getByRole('button', { name: 'تلاش دوباره برای ورود' });
  fireEvent.click(retry);
  fireEvent.submit(retry.closest('form')!);
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'در حال انجام…' })).toBeDisabled();
  await act(async () => resolveRefresh());
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('requests a fresh code if the session is rejected after OTP verification', async () => {
  mocks.challenge.mockResolvedValue({ message: 'accepted' });
  mocks.verify.mockResolvedValue({ user_id: 'user-1' });
  mocks.refresh.mockRejectedValueOnce(new ApiError(401, 'برای ادامه وارد حساب شوید.'));
  render(<LoginForm />);
  enterMobileAndSubmit();
  const codeInput = await screen.findByLabelText('کد شش رقمی');
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.submit(codeInput.closest('form')!);

  expect(await screen.findByRole('alert')).toHaveTextContent('کد تازه‌ای درخواست کنید.');
  expect(screen.getByRole('button', { name: 'دریافت کد' })).toBeEnabled();
  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
});
