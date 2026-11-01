'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, auth } from '@/lib/api/client';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { refresh } = useAuth();
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const challenge = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await auth.challenge(normalizeDigits(mobile));
      setCode('');
      setStep('code');
      setRemaining(60);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'درخواست انجام نشد.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const finishLogin = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await refresh();
      if (onSuccess) onSuccess();
      else router.push('/account');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setVerified(false);
        setStep('mobile');
        setCode('');
        setError('نشست ورود برقرار نشد. کد تازه‌ای درخواست کنید.');
      } else {
        const detail = cause instanceof ApiError ? cause.message : 'دوباره تلاش کنید.';
        setError(`کد تأیید شد، اما بارگذاری حساب انجام نشد. ${detail}`);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busyRef.current || verified) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await auth.verify(normalizeDigits(mobile), normalizeDigits(code));
      setVerified(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ورود انجام نشد.');
      busyRef.current = false;
      setBusy(false);
      return;
    }
    busyRef.current = false;
    setBusy(false);
    await finishLogin();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 'mobile') void challenge();
        else if (verified) void finishLogin();
        else void verify();
      }}
    >
      <h2 className="text-2xl font-semibold">ورود به آرومان</h2>
      <p className="text-sm leading-7">
        کد ورود به شماره موبایل ایرانی شما ارسال می‌شود. سرویس پیامک ممکن است در حال حاضر در دسترس
        نباشد.
      </p>
      <label className="block space-y-2">
        <span>شماره موبایل</span>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          dir="ltr"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          disabled={step === 'code'}
          placeholder="09123456789"
        />
      </label>
      {step === 'code' && (
        <label className="block space-y-2">
          <span>کد شش رقمی</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9۰-۹٠-٩]{6}"
            maxLength={6}
            required
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          disabled={verified}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-blush p-3">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={busy}>
        {busy ? 'در حال انجام…' : step === 'mobile' ? 'دریافت کد' : verified ? 'تلاش دوباره برای ورود' : 'تأیید و ورود'}
      </Button>
      {step === 'code' && !verified && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="underline" onClick={() => setStep('mobile')}>
            ویرایش شماره
          </button>
          <button
            type="button"
            className="underline disabled:opacity-50"
            disabled={busy || remaining > 0}
            onClick={() => void challenge()}
          >
            {remaining > 0 ? `ارسال دوباره تا ${remaining} ثانیه` : 'ارسال دوباره کد'}
          </button>
        </div>
      )}
    </form>
  );
}
