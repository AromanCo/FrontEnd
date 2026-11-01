import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedStudio } from '@/components/studio/guided/GuidedStudio';
import { StudioDraftProvider } from '@/lib/studio/draft-transfer';
import { MAX_CONCEPT_NAME_LENGTH } from '@/lib/studio/guided/config';
import { seedFamilies, seedNotes, uuid } from './guided-fixtures';

const authMock = vi.hoisted(() => ({ authEnabled: true, user: null as { id: string; mobile_e164: string; role: string } | null, loading: false, autoLogin: false }));
const { families, notes, createConcept, challenge, verify } = vi.hoisted(() => ({ families: vi.fn(), notes: vi.fn(), createConcept: vi.fn(), challenge: vi.fn(), verify: vi.fn() }));
vi.mock('@/lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, auth: { ...actual.auth, challenge, verify }, catalog: { ...actual.catalog, families, notes }, concepts: { ...actual.concepts, create: createConcept } };
});
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...authMock, refresh: vi.fn(async () => { if (authMock.autoLogin) authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' }; }), logout: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

function renderGuided() { return render(<StudioDraftProvider><GuidedStudio /></StudioDraftProvider>); }

const continueButton = () => screen.getByRole('button', { name: /ادامه|دیدن پیشنهاد من/ });
const selectRadio = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }));
const goNext = () => fireEvent.click(continueButton());

async function reachStep(step: number) {
  await screen.findByRole('heading', { name: 'حال‌وهوای شما' });
  selectRadio(/آرام و آسوده/);
  goNext();
  if (step === 1) return;
  await screen.findByRole('heading', { name: 'جهان‌های رایحه' });
  fireEvent.click(screen.getByRole('checkbox', { name: /گلی/ }));
  goNext();
  if (step === 2) return;
  await screen.findByRole('heading', { name: 'دمای حسی' });
  selectRadio(/نرم و متعادل/);
  goNext();
  if (step === 3) return;
  await screen.findByRole('heading', { name: 'یک تصویر برای خیال' });
  selectRadio(/گوشه‌ای پر از گل/);
  goNext();
  if (step === 4) return;
  await screen.findByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' });
  fireEvent.click(screen.getByRole('button', { name: /فعلاً انتخابی ندارم/ }));
  goNext();
  if (step === 5) await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

async function changeFeelingAndRegenerate(label: RegExp, conceptName?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'مرور پاسخ‌ها' }));
  fireEvent.click(await screen.findByRole('button', { name: 'ویرایش حال‌وهوا' }));
  fireEvent.click(screen.getByRole('radio', { name: label }));
  goNext();
  await screen.findByRole('heading', { name: 'جهان‌های رایحه' }); goNext();
  await screen.findByRole('heading', { name: 'دمای حسی' }); goNext();
  await screen.findByRole('heading', { name: 'یک تصویر برای خیال' }); goNext();
  await screen.findByRole('heading', { name: 'نت‌هایی که به دلتان می‌نشینند' }); goNext();
  await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' });
  if (conceptName) fireEvent.change(screen.getByLabelText('برای این تصویر چه نامی دوست دارید؟'), { target: { value: conceptName } });
  fireEvent.click(screen.getByRole('button', { name: 'دیدن پیشنهاد من' }));
  await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
}

describe('Guided Studio questionnaire and result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authEnabled = true;
    authMock.user = null;
    authMock.autoLogin = false;
    challenge.mockResolvedValue(undefined);
    verify.mockResolvedValue(undefined);
    families.mockResolvedValue([...seedFamilies]);
    notes.mockResolvedValue([...seedNotes]);
  });

  it('keeps the conceptual result and in-memory transfer in exploration mode without Save or login UI', async () => {
    authMock.authEnabled = false;
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    expect(screen.queryByRole('button', { name: 'ذخیرهٔ مفهوم' })).toBeNull();
    expect(screen.getByRole('button', { name: 'رفتن به استودیوی خلاق' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /ورود/ })).toBeNull();
    expect(createConcept).not.toHaveBeenCalled();
  });

  it('loads real catalog pages and completes all six approved steps into a grounded result', async () => {
    renderGuided();
    await reachStep(5);
    await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' });
    expect(screen.getAllByText('گلی').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));

    expect(await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
    const recommendedNotes = document.querySelectorAll('.guided-result-layer li strong');
    expect(recommendedNotes).toHaveLength(4);
    expect([...recommendedNotes].every(element => seedNotes.some(note => note.name === element.textContent))).toBe(true);
    expect(screen.getByText('این پیشنهاد یک تصویر مفهومی از سلیقهٔ شماست، نه فرمول ساخت یا پیش‌بینی عملکرد یک عطر واقعی.')).toBeInTheDocument();
    expect(families).toHaveBeenCalledWith('', 100, 0);
    expect(notes).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    expect(screen.getByRole('button', { name: /ذخیرهٔ مفهوم/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /رفتن به استودیوی خلاق/ })).toBeEnabled();
  });

  it('opens existing login for anonymous Save without posting or losing the result', async () => {
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    expect(screen.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' })).toBeInTheDocument();
    expect(createConcept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'بستن' }));
    expect(screen.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
  });

  it('requires an explicit Save retry after login succeeds', async () => {
    authMock.autoLogin = true;
    createConcept.mockResolvedValue({ id: uuid(903), name: 'رایحهٔ من', notes: [] });
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    const dialog = screen.getByRole('dialog', { name: 'ورود برای ذخیرهٔ مفهوم' });
    fireEvent.change(within(dialog).getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'دریافت کد' }));
    fireEvent.change(await within(dialog).findByLabelText('کد شش رقمی'), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید و ورود' }));
    await screen.findByText(/وارد شدید\. برای ذخیرهٔ این پیشنهاد، دوباره دکمهٔ ذخیره را بزنید/);
    expect(createConcept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await screen.findByText('مفهوم رایحهٔ شما ذخیره شد.');
    expect(createConcept).toHaveBeenCalledTimes(1);
  });

  it('creates an authenticated concept with the exact API payload and blocks duplicate Save', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    const pendingSave = deferred<{ id: string; name: string; notes: never[] }>();
    createConcept.mockReturnValue(pendingSave.promise);
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    const save = screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(createConcept).toHaveBeenCalledTimes(1);
    pendingSave.resolve({ id: uuid(902), name: 'رایحهٔ من', notes: [] });
    await screen.findByText('مفهوم رایحهٔ شما ذخیره شد.');
    expect(createConcept).toHaveBeenCalledTimes(1);
    const body = createConcept.mock.calls[0]?.[0];
    expect(Object.keys(body).sort()).toEqual(['name', 'notes']);
    expect(body.name).toBe('رایحهٔ من');
    expect(body.notes).toHaveLength(4);
    expect(body.notes.every((item: { note_id: string }) => seedNotes.some(note => note.id === item.note_id))).toBe(true);
    expect(body.notes.map((item: { layer: string; position: number }) => [item.layer, item.position])).toEqual([
      ['top', 0], ['heart', 0], ['base', 0], ['heart', 1],
    ]);
    expect(screen.getByRole('link', { name: 'دیدن مفاهیم ذخیره‌شده' })).toHaveAttribute('href', '/account');
  });

  it('keeps a late success attached to Save A and allows changed result B to save separately', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    const saveA = deferred<{ id: string; name: string; notes: never[] }>();
    createConcept.mockReturnValueOnce(saveA.promise).mockResolvedValueOnce({ id: uuid(904), name: 'رایحهٔ من', notes: [] });
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ })); goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await waitFor(() => expect(createConcept).toHaveBeenCalledTimes(1));
    await changeFeelingAndRegenerate(/سرزنده و روشن/, 'روایت تازه');
    expect(screen.queryByText('مفهوم رایحهٔ شما ذخیره شد.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' })).toBeEnabled();
    saveA.resolve({ id: uuid(903), name: 'رایحهٔ من', notes: [] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' })).toBeEnabled());
    expect(screen.queryByText('مفهوم رایحهٔ شما ذخیره شد.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await screen.findByText('مفهوم رایحهٔ شما ذخیره شد.');
    expect(createConcept).toHaveBeenCalledTimes(2);
  });

  it('does not show stale failure from Save A after the user generates result B', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    const saveA = deferred<{ id: string; name: string; notes: never[] }>();
    createConcept.mockReturnValueOnce(saveA.promise);
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ })); goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await waitFor(() => expect(createConcept).toHaveBeenCalledTimes(1));
    await changeFeelingAndRegenerate(/سرزنده و روشن/, 'روایت تازه');
    saveA.reject(new Error('A network failure'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
  });

  it('keeps late Save completion out of the restarted questionnaire', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    const saveA = deferred<{ id: string; name: string; notes: never[] }>();
    createConcept.mockReturnValue(saveA.promise);
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ })); goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await waitFor(() => expect(createConcept).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'شروع دوباره' }));
    fireEvent.click(screen.getByRole('button', { name: 'پاک‌کردن و شروع دوباره' }));
    await screen.findByRole('heading', { name: 'حال‌وهوای شما' });
    saveA.resolve({ id: uuid(905), name: 'رایحهٔ من', notes: [] });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'حال‌وهوای شما' })).toBeInTheDocument());
    expect(screen.queryByText('مفهوم رایحهٔ شما ذخیره شد.')).not.toBeInTheDocument();
  });

  it('does not attempt state updates when an in-flight Save resolves after unmount', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    const save = deferred<{ id: string; name: string; notes: never[] }>();
    createConcept.mockReturnValue(save.promise);
    const view = renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ })); goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await waitFor(() => expect(createConcept).toHaveBeenCalledTimes(1));
    view.unmount();
    save.resolve({ id: uuid(907), name: 'رایحهٔ من', notes: [] });
    await save.promise;
  });

  it('does not create a duplicate when the identical saved composition is regenerated', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    createConcept.mockResolvedValue({ id: uuid(906), name: 'رایحهٔ من', notes: [] });
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ })); goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    await screen.findByText('مفهوم رایحهٔ شما ذخیره شد.');
    await changeFeelingAndRegenerate(/آرام و آسوده/);
    expect(screen.getByRole('button', { name: 'ذخیره شد' })).toBeDisabled();
    expect(screen.getByText('مفهوم رایحهٔ شما ذخیره شد.')).toBeInTheDocument();
    expect(createConcept).toHaveBeenCalledTimes(1);
  });

  it('retains the result and offers no success when Save fails', async () => {
    authMock.user = { id: uuid(901), mobile_e164: '+989121234567', role: 'customer' };
    createConcept.mockRejectedValue(new Error('offline'));
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    goNext();
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره انجام نشد');
    expect(screen.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیرهٔ مفهوم' })).toBeEnabled();
  });

  it('loads every family and note page in limit-100 batches', async () => {
    const firstFamilyPage = Array.from({ length: 100 }, (_, index) => ({
      ...seedFamilies[0]!, id: uuid(1000 + index), slug: `test-family-${index}`, name: `خانوادهٔ ${index}`,
    }));
    const firstNotePage = Array.from({ length: 100 }, (_, index) => ({
      ...seedNotes[0]!, id: uuid(2000 + index), slug: `test-note-${index}`, name: `نت ${index}`,
    }));
    families.mockResolvedValueOnce(firstFamilyPage).mockResolvedValueOnce([seedFamilies[0]]);
    notes.mockResolvedValueOnce(firstNotePage).mockResolvedValueOnce([seedNotes[0]]);
    renderGuided();
    await screen.findByRole('heading', { name: 'حال‌وهوای شما' });
    selectRadio(/آرام و آسوده/); goNext();
    await screen.findByRole('heading', { name: 'جهان‌های رایحه' });
    expect(await screen.findByRole('checkbox', { name: /گلی/ })).toBeInTheDocument();
    await waitFor(() => expect(families).toHaveBeenCalledTimes(2));
    expect(document.querySelector(`input[value="${uuid(1099)}"]`)).not.toBeNull();
    await waitFor(() => expect(notes).toHaveBeenCalledTimes(2));
    expect(families).toHaveBeenNthCalledWith(1, '', 100, 0);
    expect(families).toHaveBeenNthCalledWith(2, '', 100, 100);
    expect(notes).toHaveBeenNthCalledWith(1, { limit: 100, offset: 0 });
    expect(notes).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 });
  });

  it('preserves answers through Review Answers, editing and regeneration', async () => {
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    fireEvent.click(screen.getByRole('button', { name: 'مرور پاسخ‌ها' }));
    expect(await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' })).toBeInTheDocument();
    expect(screen.getAllByText('گلی').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش حال‌وهوا' }));
    expect(await screen.findByRole('heading', { name: 'حال‌وهوای شما' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /آرام و آسوده/ })).toBeChecked();
    goNext();
    await screen.findByRole('heading', { name: 'جهان‌های رایحه' });
    expect(screen.getByRole('checkbox', { name: /گلی/ })).toBeChecked();
  });

  it('moves a note between like and avoid lists and records explicit skip', async () => {
    renderGuided();
    await reachStep(4);
    const roseRow = screen.getByText('رز').closest('li');
    expect(roseRow).not.toBeNull();
    fireEvent.click(within(roseRow!).getByRole('button', { name: /^دوست دارم$/ }));
    expect(within(screen.getByLabelText('شمار نت‌های انتخاب‌شده')).getByText('۱ از ۳')).toBeInTheDocument();
    fireEvent.click(within(roseRow!).getByRole('button', { name: /^کنار بگذار$/ }));
    expect(within(screen.getByLabelText('شمار نت‌های انتخاب‌شده')).getByText('۰ از ۳')).toBeInTheDocument();
    expect(within(screen.getByLabelText('شمار نت‌های انتخاب‌شده')).getByText('۱ از ۳')).toBeInTheDocument();
    expect(screen.getByText(/به فهرست «ترجیح می‌دهم نباشد» منتقل شد/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /فعلاً انتخابی ندارم/ }));
    expect(screen.getByRole('button', { name: /فعلاً انتخابی ندارم/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByLabelText('شمار نت‌های انتخاب‌شده')).getAllByText('۰ از ۳')).toHaveLength(2);
  });

  it('rejects a third family and reports the limit accessibly', async () => {
    renderGuided();
    await screen.findByRole('heading', { name: 'حال‌وهوای شما' });
    selectRadio(/آرام و آسوده/); goNext();
    await screen.findByRole('heading', { name: 'جهان‌های رایحه' });
    fireEvent.click(screen.getByRole('checkbox', { name: /گلی/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /مرکباتی/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /چوبی/ }));
    expect(screen.getByRole('checkbox', { name: /چوبی/ })).not.toBeChecked();
    expect(screen.getByText('برای دقیق‌تر شدن پیشنهاد، حداکثر دو خانواده انتخاب کنید.')).toBeInTheDocument();
  });

  it('offers retry on real note API failure without losing prior answers', async () => {
    notes.mockRejectedValueOnce(new Error('private traceback')).mockResolvedValue([...seedNotes]);
    renderGuided();
    await reachStep(4);
    expect(await screen.findByRole('alert')).toHaveTextContent('دریافت نت‌ها انجام نشد. اتصال را بررسی و دوباره تلاش کنید.');
    expect(screen.queryByText('private traceback')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(await screen.findByText('رز')).toBeInTheDocument();
    expect(notes).toHaveBeenCalledTimes(2);
    for (const heading of ['یک تصویر برای خیال', 'دمای حسی', 'جهان‌های رایحه', 'حال‌وهوای شما']) {
      fireEvent.click(screen.getByRole('button', { name: 'بازگشت' }));
      await screen.findByRole('heading', { name: heading });
    }
    expect(screen.getByRole('radio', { name: /آرام و آسوده/ })).toBeChecked();
  });

  it('shows an honest no-match when the API returns an empty note catalog', async () => {
    notes.mockResolvedValue([]);
    renderGuided();
    await reachStep(4);
    expect(screen.getByText(/در حال حاضر نتی برای انتخاب در دسترس نیست/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /فعلاً انتخابی ندارم/ }));
    goNext();
    await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' });
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    expect(await screen.findByRole('heading', { name: 'این بار، انتخاب‌ها را کمی تغییر دهیم' })).toBeInTheDocument();
    expect(screen.getByText(/در کاتالوگ فعلی نتی برای پیشنهاد در دسترس نیست/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ذخیرهٔ مفهوم/ })).not.toBeInTheDocument();
  });

  it('uses the approved 60-character concept-name boundary and Persian counter', async () => {
    renderGuided();
    await reachStep(5);
    const name = screen.getByRole('textbox', { name: /برای این تصویر چه نامی دوست دارید/ });
    expect(name).toHaveAttribute('maxLength', String(MAX_CONCEPT_NAME_LENGTH));
    fireEvent.change(name, { target: { value: 'ر'.repeat(MAX_CONCEPT_NAME_LENGTH) } });
    expect(name).toHaveValue('ر'.repeat(MAX_CONCEPT_NAME_LENGTH));
    expect(screen.getByText('۶۰ از ۶۰')).toBeInTheDocument();
  });

  it('expands the note list, filters all loaded notes, and keeps selected notes removable', async () => {
    renderGuided();
    await reachStep(4);
    const noteRows = () => document.querySelectorAll('.guided-note-item');
    expect(noteRows()).toHaveLength(seedNotes.length);
    const more = screen.getByRole('button', { name: 'نمایش نت‌های بیشتر' });
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');

    const coffee = seedNotes.find(note => note.slug === 'coffee')!;
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: coffee.name } });
    expect(noteRows()).toHaveLength(1);
    expect(noteRows()[0]).toHaveTextContent(coffee.name);
    fireEvent.click(screen.getByRole('button', { name: 'دوست دارم' }));
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'نمایش نت‌های بیشتر' })).toHaveAttribute('aria-expanded', 'false');
    const remove = screen.getByRole('button', { name: `حذف ${coffee.name} از دوست دارم` });
    expect(remove).toBeInTheDocument();
    fireEvent.click(remove);
    expect(screen.queryByRole('button', { name: `حذف ${coffee.name} از دوست دارم` })).not.toBeInTheDocument();

    const rose = seedNotes.find(note => note.slug !== coffee.slug)!;
    fireEvent.change(search, { target: { value: rose.name } });
    fireEvent.click(screen.getByRole('button', { name: 'کنار بگذار' }));
    fireEvent.change(search, { target: { value: '' } });
    const avoidedRemove = screen.getByRole('button', { name: `حذف ${rose.name} از فهرست کنارگذاشته‌ها` });
    expect(avoidedRemove).toBeInTheDocument();
    fireEvent.click(avoidedRemove);
    expect(screen.queryByRole('button', { name: `حذف ${rose.name} از فهرست کنارگذاشته‌ها` })).not.toBeInTheDocument();
    const counts = screen.getByLabelText('شمار نت‌های انتخاب‌شده');
    expect(counts).toHaveTextContent('۰ از ۳');
    expect(counts).toHaveTextContent('ترجیح می‌دهم نباشد');
  });

  it('traps dialog focus, restores focus on cancellation, and focuses Step 1 after confirmed restart', async () => {
    renderGuided();
    await reachStep(5);
    fireEvent.click(screen.getByRole('radio', { name: /دوست دارم کشف کنم/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });
    const opener = screen.getByRole('button', { name: 'شروع دوباره' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector('.guided-content')).toHaveAttribute('inert');
    const cancel = within(dialog).getByRole('button', { name: 'ادامهٔ مسیر' });
    const confirm = within(dialog).getByRole('button', { name: 'پاک‌کردن و شروع دوباره' });
    await waitFor(() => expect(cancel).toHaveFocus());
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.getByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'مرور پاسخ‌ها' }));
    expect(screen.getByRole('radio', { name: /دوست دارم کشف کنم/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    await screen.findByRole('heading', { name: 'این تصویرِ رایحهٔ شماست' });

    fireEvent.click(screen.getByRole('button', { name: 'شروع دوباره' }));
    fireEvent.click(screen.getByRole('button', { name: 'پاک‌کردن و شروع دوباره' }));
    expect(await screen.findByRole('heading', { name: 'حال‌وهوای شما' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'حال‌وهوای شما' })).toHaveFocus());
    expect(screen.getByRole('radio', { name: /آرام و آسوده/ })).not.toBeChecked();
  });
});
