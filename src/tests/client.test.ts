import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, auth, authenticated, concepts, getCsrf, request, setCsrf } from '@/lib/api/client';

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response;

describe('API transport', () => {
  beforeEach(() => setCsrf(null));
  afterEach(() => vi.unstubAllGlobals());

  it('maps backend HTTP failures to safe Persian messages', async () => {
    const cases = [
      [400, 'کد نامعتبر یا منقضی شده است.'],
      [401, 'برای ادامه وارد حساب شوید.'],
      [403, 'نشست امنیتی منقضی شده است. دوباره تلاش کنید.'],
      [404, 'مورد درخواستی پیدا نشد.'],
      [422, 'اطلاعات واردشده معتبر نیست.'],
      [429, 'درخواست‌های زیادی ثبت شده است. کمی صبر کنید.'],
      [503, 'این سرویس در حال حاضر در دسترس نیست.'],
    ] as const;

    for (const [status, message] of cases) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(status, { detail: 'internal detail' })));
      await expect(request('/test')).rejects.toMatchObject({ status, message });
    }
  });

  it('maps network failures without exposing transport details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(request('/brands')).rejects.toMatchObject({
      status: 0,
      message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
    });
  });

  it('includes credentials and obtains CSRF for authenticated writes', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(200, { csrf_token: 'fresh' }))
      .mockResolvedValueOnce(response(201, { id: 'uuid', name: 'test', notes: [] }));
    vi.stubGlobal('fetch', fetch);

    await concepts.create({ name: 'test', notes: [] });

    expect(fetch.mock.calls[0][0]).toContain('/auth/csrf');
    expect(fetch.mock.calls[1][1].credentials).toBe('include');
    expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('fresh');
  });

  it('retries a 403 once with a rotated CSRF token', async () => {
    setCsrf('old');
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(403, { detail: 'bad' }))
      .mockResolvedValueOnce(response(200, { csrf_token: 'new' }))
      .mockResolvedValueOnce(response(204, null));
    vi.stubGlobal('fetch', fetch);

    await authenticated('/auth/session', 'DELETE');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers['X-CSRF-Token']).toBe('new');
    expect(getCsrf()).toBe('new');
  });

  it('does not retain CSRF after failed OTP verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, { detail: 'invalid' })));

    await expect(auth.verify('09121234567', '000000')).rejects.toBeInstanceOf(ApiError);
    expect(getCsrf()).toBeNull();
  });
});
