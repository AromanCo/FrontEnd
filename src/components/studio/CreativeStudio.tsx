'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, catalog, concepts, type Concept, type Family, type Note } from '@/lib/api/client';
import { addNote, layers, moveNote, payload, reorder, type SelectedNote } from '@/lib/studio/composition';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dialog } from '@/components/ui/Dialog';
import { NoteLibrary } from '@/components/studio/NoteLibrary';
import { CompositionWorkspace } from '@/components/studio/CompositionWorkspace';
import { ConceptPreview } from '@/components/studio/ConceptPreview';

const tabs = ['نت‌ها', 'ترکیب', 'نتیجه'] as const;
const tabNumbers = ['۰۱', '۰۲', '۰۳'];

export function CreativeStudio({ conceptId }: { conceptId?: string }) {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('رایحه من');
  const [selected, setSelected] = useState<SelectedNote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [family, setFamily] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noteError, setNoteError] = useState('');
  const [familyError, setFamilyError] = useState('');
  const [failedOffset, setFailedOffset] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [savedId, setSavedId] = useState(conceptId || '');
  const noteRequest = useRef(0);
  const savingRef = useRef(false);
  const selectedIds = new Set(selected.map(item => item.note.id));

  const loadNotes = useCallback(async (currentOffset = 0) => {
    const requestId = ++noteRequest.current;
    setLoading(true);
    setNoteError('');
    if (currentOffset === 0) setHasMore(false);
    try {
      const list = await catalog.notes({ q: query, family_id: family || undefined, limit: 50, offset: currentOffset });
      if (requestId !== noteRequest.current) return;
      setNotes(previous => currentOffset === 0 ? list : [...previous, ...list]);
      setOffset(currentOffset + list.length);
      setHasMore(list.length === 50);
    } catch (cause) {
      if (requestId === noteRequest.current) {
        setFailedOffset(currentOffset);
        setNoteError(cause instanceof ApiError ? cause.message : 'دریافت نت‌ها انجام نشد.');
      }
    } finally {
      if (requestId === noteRequest.current) setLoading(false);
    }
  }, [query, family]);

  const loadFamilies = useCallback(() => {
    setFamilyError('');
    void catalog.families('', 100).then(setFamilies).catch(() => setFamilyError('دریافت خانواده‌های رایحه انجام نشد.'));
  }, []);

  useEffect(() => {
    void catalog.families('', 100).then(setFamilies).catch(() => setFamilyError('دریافت خانواده‌های رایحه انجام نشد.'));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void loadNotes(0); }, 250);
    return () => clearTimeout(timer);
  }, [loadNotes]);

  useEffect(() => {
    if (!conceptId || authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const concept = await concepts.get(conceptId);
        let all: Note[] = [];
        let page = 0;
        for (;;) {
          const chunk = await catalog.notes({ limit: 100, offset: page });
          all = [...all, ...chunk];
          if (chunk.length < 100) break;
          page += 100;
        }
        if (cancelled) return;
        setName(concept.name);
        setSelected([...concept.notes]
          .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer) || a.position - b.position)
          .flatMap(item => {
            const note = all.find(candidate => candidate.id === item.note_id);
            return note ? [{ note, layer: item.layer }] : [];
          }));
        setSavedId(concept.id);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof ApiError ? cause.message : 'بارگذاری مفهوم انجام نشد.');
      }
    })();
    return () => { cancelled = true; };
  }, [conceptId, authLoading, user]);

  const select = (note: Note) => {
    if (selected.length >= 6 && !selectedIds.has(note.id)) {
      setNotice('برای افزودن نت تازه، یکی را از ترکیب بردارید.');
      setTab(1);
      return;
    }
    setSelected(current => addNote(current, note));
    setNotice('');
  };

  const save = async () => {
    if (savingRef.current) return;
    if (!name.trim()) { setError('برای مفهوم خود نامی انتخاب کنید.'); return; }
    if (!user) {
      setLoginOpen(true);
      setNotice('ترکیب شما روی صفحه حفظ شده است. پس از ورود، ذخیره را کامل کنید.');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const body = payload(name, selected);
      const result: Concept = savedId ? await concepts.update(savedId, body) : await concepts.create(body);
      setSavedId(result.id);
      setNotice('مفهوم رایحه با موفقیت ذخیره شد.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ذخیره انجام نشد.');
      if (cause instanceof ApiError && cause.status === 401) setLoginOpen(true);
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const updateQuery = (value: string) => {
    noteRequest.current++;
    setQuery(value.slice(0, 100));
    setNotes([]);
    setLoading(true);
    setHasMore(false);
  };
  const updateFamily = (value: string) => {
    noteRequest.current++;
    setFamily(value);
    setNotes([]);
    setLoading(true);
    setHasMore(false);
  };

  return <div className="studio-page">
    <header className="studio-intro">
      <div className="container studio-intro-inner">
        <div><p className="eyebrow">AROMAN · کارگاه ساخت رایحه</p><h1>روایت رایحه‌ی شما</h1><p>نت‌ها را برگزینید، در سه لایه بچینید و حال‌وهوای مفهوم خود را تماشا کنید.</p></div>
        <div className="studio-intro-actions"><p className="studio-count-badge" role="status" aria-live="polite" aria-label={`${selected.length} از ۶ نت انتخاب شده`}><strong aria-hidden="true">{selected.length}</strong><span aria-hidden="true">از ۶ نت</span></p><button type="button" className="studio-save-top" onClick={() => void save()} disabled={busy}>{busy ? 'در حال ذخیره…' : savedId ? 'ذخیره تغییرات' : 'ذخیره مفهوم'}</button></div>
      </div>
    </header>

    <div className="container studio-workspace">
      <nav className="studio-mobile-tabs" role="tablist" aria-label="گام‌های استودیو">
        {tabs.map((label, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`studio-panel-${index}`} id={`studio-tab-${index}`} tabIndex={tab === index ? 0 : -1} key={label}
          onKeyDown={event => {
            const next = event.key === 'ArrowLeft' ? (index + 1) % 3 : event.key === 'ArrowRight' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
            if (next !== null) { event.preventDefault(); setTab(next); event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus(); }
          }} onClick={() => setTab(index)}><span className="studio-tab-number" aria-hidden="true">{tabNumbers[index]}</span>{label}{index === 0 && <span className="studio-tab-count" aria-label={`${selected.length} از ۶ نت`}>{selected.length.toLocaleString('fa-IR')}/۶</span>}</button>)}
      </nav>

      {notice && <p role="status" className="studio-global-notice">{notice}</p>}
      {error && <p role="alert" className="studio-global-error">{error}</p>}

      <div className="studio-grid">
        <NoteLibrary notes={notes} families={families} selectedIds={selectedIds} count={selected.length} query={query} familyId={family} loading={loading} noteError={noteError} familyError={familyError} hasMore={hasMore} active={tab === 0}
          onQuery={updateQuery} onFamily={updateFamily} onSelect={select} onRetry={() => void loadNotes(failedOffset)} onRetryFamilies={loadFamilies} onMore={() => void loadNotes(offset)} onContinue={() => setTab(1)} />
        <CompositionWorkspace selected={selected} name={name} active={tab === 1} onName={setName}
          onLayer={(id, layer) => setSelected(current => moveNote(current, id, layer))}
          onRemove={id => { setSelected(current => current.filter(item => item.note.id !== id)); setNotice(''); }}
          onReorder={(id, direction) => setSelected(current => reorder(current, id, direction))} />
        <ConceptPreview selected={selected} families={families} name={name} active={tab === 2} busy={busy} saved={Boolean(savedId)} onSave={() => void save()} />
      </div>
    </div>

    {loginOpen && <Dialog title="ورود برای ذخیره" onClose={() => setLoginOpen(false)}><LoginForm onSuccess={() => { setLoginOpen(false); setNotice('وارد شدید. برای تکمیل ذخیره، دکمه ذخیره مفهوم را بزنید.'); }} /></Dialog>}
    {savedId && <div className="studio-saved-link"><Link href="/account">مفاهیم ذخیره‌شده</Link></div>}
  </div>;
}
