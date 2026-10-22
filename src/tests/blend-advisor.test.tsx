import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  notes: vi.fn(), families: vi.fn(), conceptGet: vi.fn(), conceptCreate: vi.fn(), conceptUpdate: vi.fn(),
  routerReplace: vi.fn(), route: { bfcacheId: 'route-a' }, auth: { user: null as null | { id: string; mobile_e164: string; role: string }, loading: false },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...mocks.auth, refresh: vi.fn(), logout: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } },
  catalog: { notes: mocks.notes, families: mocks.families },
  concepts: { get: mocks.conceptGet, create: mocks.conceptCreate, update: mocks.conceptUpdate },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ ...mocks.route, replace: mocks.routerReplace, push: vi.fn() }) }));

import { CreativeStudio } from '@/components/studio/CreativeStudio';
import { StudioDraftProvider, useStudioDraft } from '@/lib/studio/draft-transfer';

// Synthetic catalog fixtures used only by these UI tests.
const noteA = { id: '00000000-0000-4000-8000-000000000001', slug: 'synthetic-a', name: 'نت آزمایشی آ', description: null, is_demo: true, family_id: '10000000-0000-4000-8000-000000000001' };
const noteB = { id: '00000000-0000-4000-8000-000000000002', slug: 'synthetic-b', name: 'نت آزمایشی ب', description: null, is_demo: true, family_id: '10000000-0000-4000-8000-000000000001' };
const noteC = { id: '00000000-0000-4000-8000-000000000003', slug: 'synthetic-c', name: 'نت آزمایشی پ', description: null, is_demo: true, family_id: '10000000-0000-4000-8000-000000000001' };
const fixtures = [noteA, noteB, noteC];

function renderStudio(props: { conceptId?: string; fromGuided?: boolean } = {}) {
  return render(<StudioDraftProvider><CreativeStudio {...props} /></StudioDraftProvider>);
}

async function addNoteAndOpenAdvisor(noteName = noteA.name) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(noteName) }));
  fireEvent.click(screen.getByRole('tab', { name: /ترکیب/ }));
  fireEvent.click(screen.getByText('پیشنهاد خلاق آرومان'));
}

async function requestSuggestion() {
  fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
  await screen.findByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.auth.loading = false;
  mocks.route.bfcacheId = 'route-a';
  mocks.families.mockResolvedValue([]);
  mocks.notes.mockImplementation((filters?: { limit?: number }) => Promise.resolve(filters?.limit === 100 ? fixtures : fixtures));
  mocks.conceptGet.mockResolvedValue({ id: 'saved-1', name: 'مفهوم ذخیره‌شده', notes: [{ note_id: noteA.id, layer: 'heart', position: 0 }] });
  mocks.conceptCreate.mockResolvedValue({ id: 'new-1', name: 'رایحه من', notes: [] });
  mocks.conceptUpdate.mockResolvedValue({ id: 'saved-1', name: 'مفهوم ذخیره‌شده', notes: [] });
});
afterEach(() => vi.clearAllMocks());

describe('BlendAdvisor Creative Studio integration', () => {
  it('places the advisor within the existing Composition panel and previews without mutation', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    const composition = screen.getByRole('tabpanel', { name: 'ترکیب' });
    expect(within(composition).getByLabelText('پیشنهاد خلاق آرومان')).toBeInTheDocument();
    expect(document.querySelectorAll('.studio-grid > *')).toHaveLength(3);
    await requestSuggestion();
    expect(screen.getByRole('region', { name: 'ترکیب فعلی' })).toHaveTextContent(noteA.name);
    expect(screen.getByRole('region', { name: 'پیشنهاد برای کاوش' })).toHaveTextContent(noteA.name);
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('heart');
    expect(mocks.conceptCreate).not.toHaveBeenCalled();
    expect(mocks.conceptUpdate).not.toHaveBeenCalled();
  });

  it('explicitly applies a valid suggestion and undoes exactly one in-memory change', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }));
    expect(await screen.findByText(/چیدمان پیشنهادی در ترکیب مفهومی اعمال شد/)).toBeInTheDocument();
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('top');
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به ترکیب قبلی' }));
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('heart');
    expect(mocks.conceptCreate).not.toHaveBeenCalled();
    expect(mocks.conceptUpdate).not.toHaveBeenCalled();
  });

  it('moves focus to the keyboard-operable Undo action after Apply', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }));
    const undo = await screen.findByRole('button', { name: 'بازگشت به ترکیب قبلی' });
    await waitFor(() => expect(document.activeElement).toBe(undo));
    expect(undo).toBeEnabled();
  });

  it('returns focus to the request button after Undo restores the original composition', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();

    fireEvent.click(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }));
    const undo = await screen.findByRole('button', { name: 'بازگشت به ترکیب قبلی' });
    await waitFor(() => expect(document.activeElement).toBe(undo));

    fireEvent.click(undo);
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('heart');
    const request = await screen.findByRole('button', { name: 'یک پیشنهاد برای ترکیبم' });
    await waitFor(() => expect(document.activeElement).toBe(request));
  });

  it('rejects a preview without changing the current composition', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getByRole('button', { name: 'ترکیب فعلی را نگه می‌دارم' }));
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('heart');
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
  });

  it('returns focus to the request action after Reject removes the preview actions', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getByRole('button', { name: 'ترکیب فعلی را نگه می‌دارم' }));
    const request = await screen.findByRole('button', { name: 'یک پیشنهاد برای ترکیبم' });
    await waitFor(() => expect(document.activeElement).toBe(request));
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('heart');
  });

  it('expires Undo on the first manual edit after accepting a suggestion', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' }));
    expect(await screen.findByRole('button', { name: 'بازگشت به ترکیب قبلی' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(`لایه ${noteA.name}`), { target: { value: 'base' } });
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('base');
    expect(screen.queryByRole('button', { name: 'بازگشت به ترکیب قبلی' })).not.toBeInTheDocument();
  });

  it('invalidates a preview after a manual layer edit or rename', async () => {
    const view = renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.change(screen.getByLabelText(`لایه ${noteA.name}`), { target: { value: 'base' } });
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toHaveValue('base');
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
    await requestSuggestion();
    fireEvent.change(screen.getByLabelText('نام مفهوم'), { target: { value: 'نام تازه' } });
    expect(screen.getByLabelText('نام مفهوم')).toHaveValue('نام تازه');
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
    view.unmount();
  });

  it('shows explicit no-guidance for an empty composition', async () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: /ترکیب/ }));
    fireEvent.click(screen.getByText('پیشنهاد خلاق آرومان'));
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    expect(await screen.findByText('برای دریافت پیشنهاد، ابتدا نتی به ترکیب اضافه کنید.')).toBeInTheDocument();
    expect(mocks.notes).not.toHaveBeenCalledWith({ limit: 100, offset: 0 }); // Empty compositions need no complete-catalog request.
  });

  it('fails closed when a complete paginated catalog request fails', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...noteA, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, slug: `synthetic-${index}`, name: `نت ${index}` }));
    mocks.notes.mockImplementation((filters?: { limit?: number; offset?: number }) => {
      if (filters?.limit === 100 && (filters.offset ?? 0) === 0) return Promise.resolve(firstPage);
      if (filters?.limit === 100) return Promise.reject(new Error('page failed'));
      return Promise.resolve(fixtures);
    });
    renderStudio();
    await addNoteAndOpenAdvisor();
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    // A failed later page prevents the partial first page from being treated as complete.
    expect(await screen.findByRole('alert')).toHaveTextContent('دریافت نت‌ها کامل نشد');
  });

  it('loads every unfiltered catalog page before marking the advisor catalog complete', async () => {
    const firstPage = [noteA, ...Array.from({ length: 99 }, (_, index) => ({
      ...noteA, id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`, slug: `page-one-${index}`, name: `نت صفحه اول ${index}`,
    }))];
    mocks.notes.mockImplementation((filters?: { limit?: number; offset?: number }) => {
      if (filters?.limit === 100 && filters.offset === 0) return Promise.resolve(firstPage);
      if (filters?.limit === 100 && filters.offset === 100) return Promise.resolve([noteB]);
      return Promise.resolve(fixtures);
    });
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    expect(mocks.notes).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    expect(mocks.notes).toHaveBeenCalledWith({ limit: 100, offset: 100 });
    expect(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).toBeEnabled();
  });

  it('rejects catalog metadata drift instead of previewing a substituted note', async () => {
    mocks.notes.mockImplementation((filters?: { limit?: number }) => Promise.resolve(
      filters?.limit === 100 ? [{ ...noteA, name: 'نام تغییرکرده' }, noteB, noteC] : fixtures,
    ));
    renderStudio();
    await addNoteAndOpenAdvisor();
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('اطلاعات کاتالوگ');
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
  });

  it('ignores a late catalog response after the composition changes', async () => {
    const delayed = deferred<typeof fixtures>();
    mocks.notes.mockImplementation((filters?: { limit?: number }) => filters?.limit === 100 ? delayed.promise : Promise.resolve(fixtures));
    renderStudio();
    await addNoteAndOpenAdvisor();
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    await waitFor(() => expect(mocks.notes).toHaveBeenCalledWith({ limit: 100, offset: 0 }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(noteB.name) }));
    delayed.resolve(fixtures);
    await waitFor(() => expect(screen.getByLabelText('نام مفهوم')).toHaveValue('رایحه من'));
    expect(screen.queryByRole('heading', { name: 'پیشنهاد برای کاوش' })).not.toBeInTheDocument();
  });

  it('ignores an in-flight result after the route intent changes', async () => {
    const delayed = deferred<typeof fixtures>();
    mocks.notes.mockImplementation((filters?: { limit?: number }) => filters?.limit === 100 ? delayed.promise : Promise.resolve(fixtures));
    const view = renderStudio();
    await addNoteAndOpenAdvisor();
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    await waitFor(() => expect(mocks.notes).toHaveBeenCalledWith({ limit: 100, offset: 0 }));
    mocks.route.bfcacheId = 'route-b';
    view.rerender(<StudioDraftProvider><CreativeStudio /></StudioDraftProvider>);
    delayed.resolve(fixtures);
    await waitFor(() => expect(screen.getByLabelText('نام مفهوم')).toHaveValue('رایحه من'));
    expect(screen.queryByRole('heading', { name: 'پیشنهاد برای کاوش' })).not.toBeInTheDocument();
  });

  it('invalidates a preview when a Guided draft is imported into the editor', async () => {
    function Harness({ fromGuided }: { fromGuided: boolean }) {
      const { createDraft } = useStudioDraft();
      React.useEffect(() => { createDraft('پیش‌نویس هدایت‌شده', [{ noteId: noteB.id, layer: 'base', position: 0 }]); }, [createDraft]);
      return <CreativeStudio fromGuided={fromGuided} />;
    }
    const view = render(<StudioDraftProvider><Harness fromGuided={false} /></StudioDraftProvider>);
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    view.rerender(<StudioDraftProvider><Harness fromGuided /></StudioDraftProvider>);
    expect(await screen.findByDisplayValue('پیش‌نویس هدایت‌شده')).toBeInTheDocument();
    expect(screen.getByLabelText(`لایه ${noteB.name}`)).toHaveValue('base');
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
  });

  it('disables Apply for a loaded saved concept and for an unresolved saved-concept route', async () => {
    mocks.auth.user = { id: 'user-1', mobile_e164: '+989121234567', role: 'customer' };
    const view = renderStudio({ conceptId: 'saved-1' });
    await screen.findByDisplayValue('مفهوم ذخیره‌شده');
    fireEvent.click(screen.getByRole('tab', { name: /ترکیب/ }));
    fireEvent.click(screen.getByText('پیشنهاد خلاق آرومان'));
    await requestSuggestion();
    expect(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).toBeDisabled();
    expect(screen.getByText(/برای حفظ مفهوم ذخیره‌شده/)).toBeInTheDocument();
    view.unmount();

    renderStudio({ conceptId: 'still-loading' });
    fireEvent.click(screen.getByRole('tab', { name: /ترکیب/ }));
    fireEvent.click(screen.getByText('پیشنهاد خلاق آرومان'));
    expect(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' })).toBeDisabled();
    expect(screen.getByText(/پس از بارگذاری کامل مفهوم ذخیره‌شده/)).toBeInTheDocument();
  });

  it('clears previews when Save starts and keeps Apply blocked after a successful Save establishes savedId', async () => {
    mocks.auth.user = { id: 'user-1', mobile_e164: '+989121234567', role: 'customer' };
    const saveRequest = deferred<{ id: string; name: string; notes: [] }>();
    mocks.conceptCreate.mockReturnValue(saveRequest.promise);
    renderStudio();
    await addNoteAndOpenAdvisor();
    await requestSuggestion();
    fireEvent.click(screen.getAllByRole('button', { name: 'ذخیره مفهوم' })[0]);
    await waitFor(() => expect(mocks.conceptCreate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).not.toBeInTheDocument();
    saveRequest.resolve({ id: 'saved-after-create', name: 'رایحه من', notes: [] });
    await screen.findByText('مفهوم رایحه با موفقیت ذخیره شد.');
    fireEvent.click(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' }));
    await screen.findByRole('heading', { name: 'پیشنهاد برای کاوش', level: 3 });
    expect(screen.getByRole('button', { name: 'ساخت نسخهٔ پیشنهادی' })).toBeDisabled();
    expect(mocks.conceptUpdate).not.toHaveBeenCalled();
  });

  it('does not attach a pending Save result to a Guided draft imported after Save began', async () => {
    mocks.auth.user = { id: 'user-1', mobile_e164: '+989121234567', role: 'customer' };
    const pendingSave = deferred<{ id: string; name: string; notes: [] }>();
    mocks.conceptCreate.mockReturnValueOnce(pendingSave.promise).mockResolvedValueOnce({ id: 'saved-b', name: 'پیش‌نویس ب', notes: [] });

    function GuidedArrivalHarness() {
      const { createDraft } = useStudioDraft();
      const [fromGuided, setFromGuided] = React.useState(false);
      return <>
        <button type="button" onClick={() => {
          createDraft('پیش‌نویس ب', [{ noteId: noteB.id, layer: 'base', position: 0 }]);
          setFromGuided(true);
        }}>ورود پیش‌نویس هدایت‌شده</button>
        <CreativeStudio fromGuided={fromGuided} />
      </>;
    }

    render(<StudioDraftProvider><GuidedArrivalHarness /></StudioDraftProvider>);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(noteA.name) }));
    fireEvent.click(screen.getAllByRole('button', { name: 'ذخیره مفهوم' })[0]);
    await waitFor(() => expect(mocks.conceptCreate).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'ورود پیش‌نویس هدایت‌شده' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ذخیرهٔ ترکیب فعلی هنوز در جریان است');
    expect(screen.getByLabelText(`لایه ${noteA.name}`)).toBeInTheDocument();

    pendingSave.resolve({ id: 'saved-a', name: 'رایحه من', notes: [] });
    await waitFor(() => expect(screen.queryByText('مفهوم رایحه با موفقیت ذخیره شد.')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای دریافت نت‌ها' }));
    fireEvent.click(await screen.findByRole('button', { name: 'جایگزینی و بارگذاری' }));
    await screen.findByDisplayValue('پیش‌نویس ب');
    expect(screen.getByLabelText(`لایه ${noteB.name}`)).toHaveValue('base');

    fireEvent.click(screen.getAllByRole('button', { name: 'ذخیره مفهوم' })[0]);
    await waitFor(() => expect(mocks.conceptCreate).toHaveBeenCalledTimes(2));
    expect(mocks.conceptUpdate).not.toHaveBeenCalled();
    expect(mocks.conceptCreate.mock.calls[1][0]).toEqual({ name: 'پیش‌نویس ب', notes: [{ note_id: noteB.id, layer: 'base', position: 0 }] });
  });

  it('ignores a late Save response after the route loads a different composition identity', async () => {
    mocks.auth.user = { id: 'user-1', mobile_e164: '+989121234567', role: 'customer' };
    const pendingSave = deferred<{ id: string; name: string; notes: [] }>();
    mocks.conceptCreate.mockReturnValueOnce(pendingSave.promise);
    mocks.conceptGet.mockResolvedValue({ id: 'saved-b', name: 'مفهوم تازه', notes: [{ note_id: noteB.id, layer: 'base', position: 0 }] });
    const view = renderStudio();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(noteA.name) }));
    fireEvent.click(screen.getAllByRole('button', { name: 'ذخیره مفهوم' })[0]);
    await waitFor(() => expect(mocks.conceptCreate).toHaveBeenCalledTimes(1));

    view.rerender(<StudioDraftProvider><CreativeStudio conceptId="saved-b" /></StudioDraftProvider>);
    await screen.findByDisplayValue('مفهوم تازه');
    pendingSave.resolve({ id: 'saved-a', name: 'رایحه من', notes: [] });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'ذخیره تغییرات' })[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'ذخیره تغییرات' })[0]);
    await waitFor(() => expect(mocks.conceptUpdate).toHaveBeenCalledWith('saved-b', expect.any(Object)));
    expect(mocks.conceptUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps all three existing panel roles and Persian accessible control names', async () => {
    renderStudio();
    await addNoteAndOpenAdvisor();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(3);
    expect(screen.getByRole('tablist', { name: 'گام‌های استودیو' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'یک پیشنهاد برای ترکیبم' })).toBeInTheDocument();
  });
});
