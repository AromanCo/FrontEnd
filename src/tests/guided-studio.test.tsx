import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedStudio } from '@/components/studio/guided/GuidedStudio';
import { MAX_CONCEPT_NAME_LENGTH } from '@/lib/studio/guided/config';
import { seedFamilies, seedNotes, uuid } from './guided-fixtures';

const { families, notes } = vi.hoisted(() => ({ families: vi.fn(), notes: vi.fn() }));
vi.mock('@/lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, catalog: { ...actual.catalog, families, notes } };
});
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

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

describe('Guided Studio questionnaire and result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    families.mockResolvedValue([...seedFamilies]);
    notes.mockResolvedValue([...seedNotes]);
  });

  it('loads real catalog pages and completes all six approved steps into a grounded result', async () => {
    render(<GuidedStudio />);
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
    expect(screen.getByRole('button', { name: /ذخیرهٔ مفهوم/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /رفتن به استودیوی خلاق/ })).toBeDisabled();
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
    render(<GuidedStudio />);
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
    render(<GuidedStudio />);
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
    render(<GuidedStudio />);
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
    render(<GuidedStudio />);
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
    render(<GuidedStudio />);
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
    render(<GuidedStudio />);
    await reachStep(4);
    expect(screen.getByText(/در حال حاضر نتی برای انتخاب در دسترس نیست/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /فعلاً انتخابی ندارم/ }));
    goNext();
    await screen.findByRole('heading', { name: 'بازبینی و میزان کشف' });
    fireEvent.click(screen.getByRole('radio', { name: /کمی آشنا، کمی تازه/ }));
    fireEvent.click(screen.getByRole('button', { name: /دیدن پیشنهاد من/ }));
    expect(await screen.findByRole('heading', { name: 'این بار، انتخاب‌ها را کمی تغییر دهیم' })).toBeInTheDocument();
    expect(screen.getByText(/در کاتالوگ فعلی نتی برای پیشنهاد در دسترس نیست/)).toBeInTheDocument();
  });

  it('uses the approved 60-character concept-name boundary and Persian counter', async () => {
    render(<GuidedStudio />);
    await reachStep(5);
    const name = screen.getByRole('textbox', { name: /برای این تصویر چه نامی دوست دارید/ });
    expect(name).toHaveAttribute('maxLength', String(MAX_CONCEPT_NAME_LENGTH));
    fireEvent.change(name, { target: { value: 'ر'.repeat(MAX_CONCEPT_NAME_LENGTH) } });
    expect(name).toHaveValue('ر'.repeat(MAX_CONCEPT_NAME_LENGTH));
    expect(screen.getByText('۶۰ از ۶۰')).toBeInTheDocument();
  });

  it('expands the note list, filters all loaded notes, and keeps selected notes removable', async () => {
    render(<GuidedStudio />);
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
  });

  it('traps dialog focus, restores focus on cancellation, and focuses Step 1 after confirmed restart', async () => {
    render(<GuidedStudio />);
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
