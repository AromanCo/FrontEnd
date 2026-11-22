'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, concepts, type Concept, type User } from '@/lib/api/client';
import { normalizeSearch } from '@/lib/normalize-search';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from './AuthProvider';

type Layer = 'top' | 'heart' | 'base';
type CollectionAction = { kind: 'duplicate'; copy: Concept } | { kind: 'delete' };

const conceptEditorHref = (id: string) => '/studio/creative?concept=' + encodeURIComponent(id);

const layerDetails: { key: Layer; name: string; accent: string; track: string }[] = [
  { key: 'top', name: 'آغازین', accent: 'bg-[#d6ad72]', track: 'bg-[#f7ead7]' },
  { key: 'heart', name: 'میانی', accent: 'bg-[#a887b4]', track: 'bg-[#f1e8f2]' },
  { key: 'base', name: 'پایه', accent: 'bg-[#93a58a]', track: 'bg-[#e8eee4]' },
];

function LayerPreview({ notes }: { notes: Concept['notes'] }) {
  const counts = layerDetails.map(layer => ({
    ...layer,
    count: notes.filter(note => note.layer === layer.key).length,
  }));
  const description = counts.map(layer => layer.name + ' ' + layer.count.toLocaleString('fa-IR')).join('، ');

  return (
    <div className="rounded-2xl border border-[#eadfe1] bg-white/70 p-4" role="img" aria-label={'توزیع نت‌ها: ' + description}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#715b72]">چیدمان رایحه</span>
        <span className="text-xs text-[#806f7d]">{notes.length.toLocaleString('fa-IR')} نت</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {counts.map(layer => (
          <div key={layer.key} className="min-w-0">
            <div className={'mb-2 flex h-12 items-end justify-center rounded-xl p-1.5 ' + layer.track}>
              <div
                className={'w-full rounded-lg ' + layer.accent}
                style={{ height: layer.count ? Math.max(20, (layer.count / Math.max(notes.length, 1)) * 100) + '%' : '3px', opacity: layer.count ? 1 : 0.35 }}
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center justify-between gap-1 text-xs text-[#5c4a61]">
              <span>{layer.name}</span>
              <span className="tabular-nums">{layer.count.toLocaleString('fa-IR')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptCard({
  concept,
  busy,
  onAction,
}: {
  concept: Concept;
  busy: boolean;
  onAction: (id: string, kind: 'duplicate' | 'delete') => void;
}) {
  return (
    <article className="card flex h-full min-w-0 flex-col overflow-hidden shadow-[0_12px_32px_rgba(56,42,61,0.035)] transition-shadow hover:shadow-[0_18px_44px_rgba(56,42,61,0.09)]">
      <div className="account-concept-preview px-5 py-5 sm:px-6">
        <LayerPreview notes={concept.notes} />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="mt-2 break-words text-2xl font-semibold leading-relaxed">{concept.name}</h3>
        <p className="mt-2 text-sm leading-7 text-[#806f7d]">
          {concept.notes.length.toLocaleString('fa-IR')} نت در ترکیب
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
          <Link className="btn btn-primary flex-1 text-center" href={conceptEditorHref(concept.id)}>
            باز کردن و ویرایش
          </Link>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction(concept.id, 'duplicate')}>
            کپی
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction(concept.id, 'delete')}>
            حذف
          </button>
        </div>
      </div>
    </article>
  );
}

export function AccountContent() {
  const { user, loading, error: authError } = useAuth();

  if (authError && !user) return <p role="status">پس از بررسی دوباره نشست، محتوای حساب نمایش داده می‌شود.</p>;
  if (loading) return <p role="status">در حال بررسی نشست…</p>;
  if (!user) return (
    <div className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
      <h1 className="heading mt-4">حساب من</h1>
      <p className="my-6 leading-8 text-[#715b72]">برای دیدن و ادامه‌دادن رایحه‌های شخصی خود وارد شوید.</p>
      <Link className="btn btn-primary" href="/login">ورود</Link>
    </div>
  );

  // Each authenticated identity owns a fresh collection and in-flight loading state.
  // Never render the previous account's saved concepts while another user loads.
  return <AuthenticatedAccountContent key={user.id} user={user} />;
}

function AuthenticatedAccountContent({ user }: { user: User }) {
  const { logout } = useAuth();
  const [items, setItems] = useState<Concept[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<Concept | null>(null);
  const cancelDeleteButton = useRef<HTMLButtonElement>(null);
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const focusCollectionAfterDelete = useRef(false);
  const closeDeleteDialog = useCallback(() => setDeleteCandidate(null), []);

  useEffect(() => {
    if (deleteCandidate || !focusCollectionAfterDelete.current) return;
    focusCollectionAfterDelete.current = false;
    collectionHeading.current?.focus();
  }, [deleteCandidate]);
  const actionRef = useRef(false);
  const activeListRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState(false);
  const [completedAction, setCompletedAction] = useState<CollectionAction | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const query = normalizeSearch(search);
  const visibleItems = query ? items.filter(item => normalizeSearch(item.name).includes(query)) : items;

  const loadPage = useCallback(async (nextOffset = 0) => {
    if (!mounted.current || activeListRequest.current) return;
    const controller = new AbortController();
    activeListRequest.current = controller;
    setListError(false);
    if (nextOffset === 0) setLoadingItems(true);
    else setLoadingMore(true);
    try {
      const page = await concepts.list(20, nextOffset, controller.signal);
      if (controller.signal.aborted) return;
      setItems(current => nextOffset ? [...current, ...page] : page);
      setOffset(nextOffset + page.length);
      setHasMore(page.length === 20);
    } catch {
      if (!controller.signal.aborted) setListError(true);
    } finally {
      if (!controller.signal.aborted) {
        activeListRequest.current = null;
        if (nextOffset === 0) setLoadingItems(false);
        else setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { void loadPage(); }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      activeListRequest.current?.abort();
      activeListRequest.current = null;
    };
  }, [loadPage]);

  const runAction = async (id: string, kind: 'duplicate' | 'delete') => {
    if (actionRef.current || activeListRequest.current) return;
    actionRef.current = true;
    setBusy(id);
    setError('');
    setCompletedAction(null);
    try {
      let completed: CollectionAction;
      if (kind === 'duplicate') {
        completed = { kind, copy: await concepts.duplicate(id) };
      } else {
        await concepts.remove(id);
        completed = { kind };
      }
      if (!mounted.current) return;
      setCompletedAction(completed);
      setItems([]);
      setOffset(0);
      setHasMore(false);
      await loadPage();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'درخواست انجام نشد.');
    } finally {
      actionRef.current = false;
      setBusy('');
    }
  };

  return (
    <div dir="rtl">
      <header className="account-intro relative overflow-hidden rounded-2xl border px-6 py-8 sm:px-9 sm:py-10 lg:px-12">
        <div className="pointer-events-none absolute -left-14 -top-20 h-64 w-64 rounded-full border border-white/80" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h1 className="heading mt-3">مفاهیم من</h1>
            <p className="mt-3 max-w-xl leading-8 text-[#715b72]">
              رایحه‌هایی که ساخته‌اید، همین‌جا منتظر ادامهٔ داستان شما هستند.
            </p>
            <p className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-[#e4d7dc] bg-white/70 px-4 py-2 text-sm">
              <span className="text-[#806f7d]">حساب کاربری</span>
              <bdi dir="ltr" className="font-medium tabular-nums">{user.mobile_e164}</bdi>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="btn btn-primary" href="/studio/creative">ساخت رایحه تازه</Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void logout().catch(cause => setError(cause instanceof ApiError ? cause.message : 'خروج انجام نشد.'))}
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="mt-6 rounded-2xl bg-blush p-4 leading-7">{error}</div>}
      {completedAction && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sage/30 p-4 leading-7">
          <p role="status">
            {completedAction.kind === 'duplicate' ? <>مفهوم کپی شد. <strong className="break-words">«{completedAction.copy.name}»</strong></> : 'مفهوم حذف شد.'}
          </p>
          {completedAction.kind === 'duplicate' && (
            <Link className="btn btn-secondary" href={conceptEditorHref(completedAction.copy.id)}>ویرایش نسخهٔ کپی</Link>
          )}
        </div>
      )}

      <section aria-labelledby="account-concepts-heading" className="mt-9 sm:mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="account-concepts-heading" ref={collectionHeading} tabIndex={-1} className="mt-2 text-2xl font-semibold sm:text-3xl">مجموعهٔ رایحه‌های شما</h2>
          </div>
          {!loadingItems && items.length > 0 && (
            <p className="rounded-full border border-[#e5d9ce] bg-white/70 px-4 py-2 text-sm text-[#715b72]">
              {visibleItems.length.toLocaleString('fa-IR')} مفهوم نمایش داده‌شده
            </p>
          )}
        </div>

        {loadingItems && items.length === 0 && (
          <div role="status" className="card p-9 text-center leading-8">در حال بارگذاری مفاهیم شما…</div>
        )}

        {!loadingItems && items.length === 0 && !listError && (
          <div className="card relative overflow-hidden px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#f3e7ee]" aria-hidden="true">
              <span className="text-4xl text-[#806080]">✦</span>
            </div>
            <h3 className="text-2xl font-semibold">اولین داستان رایحه‌تان را بسازید</h3>
            <p className="mx-auto mt-4 max-w-lg leading-8 text-[#715b72]">
              هنوز مفهومی ذخیره نکرده‌اید. از استودیوی خلاق شروع کنید یا قدم‌به‌قدم با استودیوی راهنما پیش بروید.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link className="btn btn-primary" href="/studio/creative">اولین مفهوم را بسازید.</Link>
              <Link className="btn btn-secondary" href="/studio/guided">شروع با استودیوی راهنما</Link>
            </div>
          </div>
        )}

        {!loadingItems && items.length === 0 && listError && (
          <div className="card p-8 text-center">
            <p role="alert" className="leading-8">مفاهیم ذخیره‌شده بارگذاری نشدند.</p>
            <button className="btn btn-secondary mt-5" type="button" disabled={Boolean(busy)} onClick={() => void loadPage()}>
              تلاش دوباره
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="account-collection-search">
            <label htmlFor="account-concept-search">جستجو بر اساس نام رایحه</label>
            <div className="account-collection-search-controls">
              <input
                className="input"
                id="account-concept-search"
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                aria-describedby={hasMore ? 'account-concept-search-scope' : undefined}
              />
              {search && <button className="btn btn-secondary" type="button" onClick={() => setSearch('')}>پاک کردن</button>}
            </div>
            {hasMore && <p id="account-concept-search-scope">جستجو در رایحه‌های بارگذاری‌شده انجام می‌شود. برای بررسی بقیه، «نمایش بیشتر» را بزنید.</p>}
          </div>
        )}

        {items.length > 0 && visibleItems.length === 0 && (
          <p className="card p-6" role="status">
            {hasMore ? 'در رایحه‌های بارگذاری‌شده نامی مطابق جستجو پیدا نشد.' : 'رایحه‌ای با این نام پیدا نشد.'}
          </p>
        )}

        {visibleItems.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {visibleItems.map(item => (
              <ConceptCard
                key={item.id}
                concept={item}
                busy={Boolean(busy) || loadingItems || loadingMore}
                onAction={(id, kind) => {
                  if (kind === 'delete') setDeleteCandidate(item);
                  else void runAction(id, kind);
                }}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            {listError && <p role="alert" className="card px-5 py-3">دریافت رایحه‌های بیشتر انجام نشد. می‌توانید دوباره همین صفحه را دریافت کنید.</p>}
            {loadingMore && <p role="status" className="sr-only">در حال دریافت رایحه‌های بیشتر…</p>}
            <button type="button" className="btn btn-secondary" disabled={loadingItems || loadingMore || Boolean(busy)} onClick={() => {
              if (!actionRef.current) void loadPage(offset);
            }}>
              {loadingMore ? 'در حال بارگذاری…' : listError ? 'تلاش دوباره برای دریافت رایحه‌های بیشتر' : 'نمایش بیشتر'}
            </button>
          </div>
        )}
      </section>

      {deleteCandidate && (
        <Dialog title="حذف رایحهٔ ذخیره‌شده" onClose={closeDeleteDialog} initialFocusRef={cancelDeleteButton}>
          <h2 className="text-xl">این رایحه حذف شود؟</h2>
          <p className="mt-3 break-words leading-8">«{deleteCandidate.name}» از مجموعهٔ شما حذف می‌شود و بازگرداندن آن ممکن نیست.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button ref={cancelDeleteButton} type="button" className="btn btn-secondary" onClick={closeDeleteDialog}>انصراف</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                focusCollectionAfterDelete.current = true;
                closeDeleteDialog();
                void runAction(deleteCandidate.id, 'delete');
              }}
            >
              حذف رایحه
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
