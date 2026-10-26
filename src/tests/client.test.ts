import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, auth, authenticated, concepts, getCsrf, request, setCsrf } from '@/lib/api/client';

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response;
const malformedResponse = (status: number) => ({
  ...response(status, null),
  json: async () => { throw new SyntaxError('backend body'); },
}) as Response;

describe('API transport', () => {
  beforeEach(() => setCsrf(null));
  afterEach(() => vi.unstubAllGlobals());

  it('maps backend HTTP failures to safe Persian messages', async () => {
    const cases = [
      [400, 'کد نامعتبر یا منقضی شده است.'],
      [401, 'برای ادامه وارد حساب شوید.'],
      [403, 'دسترسی به این درخواست مجاز نیست.'],
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

  it('renews CSRF and retries exactly once for csrf_invalid on an authenticated write', async () => {
    setCsrf('old');
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(403, { code: 'csrf_invalid', detail: 'private backend detail' }))
      .mockResolvedValueOnce(response(200, { csrf_token: 'new' }))
      .mockResolvedValueOnce(response(204, null));
    vi.stubGlobal('fetch', fetch);

    await authenticated('/auth/session', 'DELETE');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][1].headers['X-CSRF-Token']).toBe('old');
    expect(fetch.mock.calls[2][1].credentials).toBe('include');
    expect(fetch.mock.calls[2][1].headers['X-CSRF-Token']).toBe('new');
    expect(getCsrf()).toBe('new');
  });

  it('propagates a failed csrf_invalid retry without a third write or renewal', async () => {
    setCsrf('old');
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(403, { code: 'csrf_invalid' }))
      .mockResolvedValueOnce(response(200, { csrf_token: 'new' }))
      .mockResolvedValueOnce(response(403, { code: 'csrf_invalid', detail: 'private backend detail' }));
    vi.stubGlobal('fetch', fetch);

    await expect(authenticated('/fragrance-concepts/id', 'PUT', { name: 'test' })).rejects.toMatchObject({
      status: 403, code: 'csrf_invalid', message: 'نشست امنیتی منقضی شده است. دوباره تلاش کنید.',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/fragrance-concepts/id'))).toHaveLength(2);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/csrf'))).toHaveLength(1);
  });

  it.each([
    ['origin_denied', 'دسترسی به این درخواست مجاز نیست.'],
    ['account_unavailable', 'حساب کاربری در دسترس نیست.'],
    ['unexpected_code', 'دسترسی به این درخواست مجاز نیست.'],
    ['toString', 'دسترسی به این درخواست مجاز نیست.'],
    [undefined, 'دسترسی به این درخواست مجاز نیست.'],
    [42, 'دسترسی به این درخواست مجاز نیست.'],
    ['', 'دسترسی به این درخواست مجاز نیست.'],
  ])('does not retry a write for 403 code %s', async (code, message) => {
    setCsrf('old');
    const fetch = vi.fn().mockResolvedValue(response(403, { code, detail: 'private backend detail' }));
    vi.stubGlobal('fetch', fetch);

    await expect(authenticated('/fragrance-concepts', 'POST', { name: 'test' })).rejects.toMatchObject({
      status: 403, message, code: typeof code === 'string' && code.length > 0 ? code : undefined,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(getCsrf()).toBe('old');
  });

  it.each([null, [], 'csrf_invalid', { error: { code: 'csrf_invalid' } }])('ignores an unexpected 403 body: %j', async body => {
    setCsrf('old');
    const fetch = vi.fn().mockResolvedValue(response(403, body));
    vi.stubGlobal('fetch', fetch);
    await expect(authenticated('/auth/session', 'DELETE')).rejects.toMatchObject({
      status: 403, code: undefined, message: 'دسترسی به این درخواست مجاز نیست.',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('ignores an inherited 403 code', async () => {
    setCsrf('old');
    const fetch = vi.fn().mockResolvedValue(response(403, Object.create({ code: 'csrf_invalid' })));
    vi.stubGlobal('fetch', fetch);
    await expect(authenticated('/auth/session', 'DELETE')).rejects.toMatchObject({
      status: 403, code: undefined, message: 'دسترسی به این درخواست مجاز نیست.',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('ignores a non-JSON 403 body without retrying', async () => {
    setCsrf('old');
    const fetch = vi.fn().mockResolvedValue(malformedResponse(403));
    vi.stubGlobal('fetch', fetch);
    await expect(authenticated('/auth/session', 'DELETE')).rejects.toMatchObject({
      status: 403, code: undefined, message: 'دسترسی به این درخواست مجاز نیست.',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('dispatches session expiry for a genuine 401 without a write retry', async () => {
    setCsrf('old');
    const expired = vi.fn();
    window.addEventListener('aroman:session-expired', expired);
    const fetch = vi.fn().mockResolvedValue(response(401, { detail: 'private backend detail' }));
    vi.stubGlobal('fetch', fetch);
    try {
      await expect(authenticated('/fragrance-concepts/id', 'DELETE')).rejects.toMatchObject({
        status: 401, message: 'برای ادامه وارد حساب شوید.',
      });
      expect(fetch).toHaveBeenCalledOnce();
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('aroman:session-expired', expired);
    }
  });

  it('does not retry an ambiguous network failure during a write', async () => {
    setCsrf('old');
    const fetch = vi.fn().mockRejectedValue(new Error('private transport detail'));
    vi.stubGlobal('fetch', fetch);
    await expect(authenticated('/fragrance-concepts', 'POST', { name: 'test' })).rejects.toMatchObject({
      status: 0, message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not retain CSRF after failed OTP verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, { detail: 'invalid' })));

    await expect(auth.verify('09121234567', '000000')).rejects.toBeInstanceOf(ApiError);
    expect(getCsrf()).toBeNull();
  });
});
