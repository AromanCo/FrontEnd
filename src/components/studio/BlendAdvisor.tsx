'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdvisorResult } from '@/lib/studio/advisor/types';
import { layerLabels, layers, type SelectedNote } from '@/lib/studio/composition';

type Props = Readonly<{
  result: AdvisorResult | null;
  loading: boolean;
  accepted: boolean;
  canUndo: boolean;
  busy: boolean;
  applyBlockedMessage: string | null;
  forkBlockedMessage: string | null;
  requestBlockedMessage: string | null;
  allowFork?: boolean;
  onRequest: () => void;
  onApply: () => void;
  onFork: () => void;
  onReject: () => void;
  onUndo: () => void;
}>;

function LayerComposition({ selected, label }: { selected: readonly SelectedNote[]; label: string }) {
  return <section className="blend-advisor-version" data-version={label === 'ترکیب فعلی' ? 'original' : 'proposed'} aria-label={label}>
    <h4>{label}</h4>
    <dl>
      {layers.map(layer => {
        const notes = selected.filter(item => item.layer === layer);
        return <div className="blend-advisor-layer" key={layer}>
          <dt>{layerLabels[layer]}</dt>
          <dd>{notes.length ? notes.map(item => item.note.name).join('، ') : 'بدون نت'}</dd>
        </div>;
      })}
    </dl>
  </section>;
}

export function BlendAdvisor({
  result, loading, accepted, canUndo, busy, applyBlockedMessage, forkBlockedMessage, requestBlockedMessage, allowFork = true,
  onRequest, onApply, onFork, onReject, onUndo,
}: Props) {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const requestRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusAfterTransition = useRef<'request' | 'undo' | null>(null);
  const suggestion = result?.status === 'suggestion' ? result.suggestion : null;
  const changedNames = suggestion?.changedNoteIds.flatMap(id => {
    const note = suggestion.proposed.selected.find(item => item.note.id === id)?.note;
    return note ? [note.name] : [];
  }) ?? [];

  useEffect(() => {
    const target = focusAfterTransition.current;
    if (!target) return;
    const undo = target === 'undo' ? undoRef.current : null;
    const request = target === 'request' && open ? requestRef.current : null;
    const available = undo && !undo.disabled && undo.isConnected
      ? undo
      : request && !request.disabled && request.isConnected
        ? request
        : summaryRef.current;
    available?.focus();
    focusAfterTransition.current = null;
  }, [accepted, result, open]);

  const apply = () => {
    focusAfterTransition.current = 'undo';
    onApply();
  };
  const reject = () => {
    focusAfterTransition.current = 'request';
    onReject();
  };
  const undo = () => {
    focusAfterTransition.current = 'request';
    onUndo();
  };

  return <section className="blend-advisor" aria-label="پیشنهاد خلاق آرومان">
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary ref={summaryRef} tabIndex={0}>پیشنهاد خلاق آرومان</summary>
      <div className="blend-advisor-content">
        <p className="blend-advisor-intro">یک راه ویرایشی برای کاوش در چیدمان مفهومی نت‌های انتخابی شما.</p>
        {!suggestion && !accepted && <button ref={requestRef} type="button" className="blend-advisor-button blend-advisor-primary" onClick={onRequest} disabled={loading || busy || Boolean(requestBlockedMessage)}>
          {loading ? 'در حال بررسی کاتالوگ…' : 'یک پیشنهاد برای ترکیبم'}
        </button>}
        {requestBlockedMessage && !suggestion && <p className="blend-advisor-message" role="status">{requestBlockedMessage}</p>}
        {loading && <p className="blend-advisor-message" role="status">در حال دریافت همهٔ نت‌ها برای بررسی ترکیب…</p>}
        {result?.status === 'no-guidance' && <p className="blend-advisor-message" role="status">{result.reason === 'empty' ? 'برای دریافت پیشنهاد، ابتدا نتی به ترکیب اضافه کنید.' : 'برای این ترکیب پیشنهاد ویرایشی دیگری نداریم.'}</p>}
        {result?.status === 'unavailable' && <p className="blend-advisor-message" role="alert">{result.reason === 'catalog-incomplete' || result.reason === 'catalog-failed' || result.reason === 'catalog-loading'
          ? 'برای بررسی پیشنهاد، دریافت نت‌ها کامل نشد. ترکیب شما محفوظ است.'
          : result.reason === 'stale-selection' ? 'یکی از نت‌های انتخابی در کاتالوگ کامل فعلی پیدا نشد. ترکیب شما محفوظ است.'
            : 'اطلاعات کاتالوگ برای بررسی این پیشنهاد یکدست نیست. ترکیب شما محفوظ است.'}</p>}
        {result?.status === 'invalid' && <p className="blend-advisor-message" role="alert">ترکیب یا پیشنهاد نیاز به بازبینی دارد؛ هیچ تغییری اعمال نشد.</p>}
        {suggestion && !accepted && <div className="blend-advisor-preview">
          <div className="blend-advisor-heading"><h3>پیشنهاد برای کاوش</h3><p className="blend-advisor-kicker">{suggestion.provenance.labelFa} · نسخهٔ {suggestion.provenance.version}</p></div>
          <p className="blend-advisor-rationale">{suggestion.rationaleFa}</p>
          <p className="blend-advisor-changes"><strong>نت‌های جابه‌جاشده:</strong> {changedNames.join('، ')}</p>
          <div className="blend-advisor-comparison">
            <LayerComposition label="ترکیب فعلی" selected={suggestion.original.selected} />
            <LayerComposition label="پیشنهاد برای کاوش" selected={suggestion.proposed.selected} />
          </div>
          <p className="blend-advisor-limit">{suggestion.limitationsFa.join(' ')}</p>
          {applyBlockedMessage && <p className="blend-advisor-message" role="status">{applyBlockedMessage}</p>}
          {allowFork && forkBlockedMessage && applyBlockedMessage && <p className="blend-advisor-message" role="status">{forkBlockedMessage}</p>}
          <div className="blend-advisor-actions">
            {applyBlockedMessage && allowFork
              ? <button type="button" className="blend-advisor-button blend-advisor-primary" onClick={onFork} disabled={busy || Boolean(forkBlockedMessage)}>ساخت نسخهٔ مستقل</button>
              : <button type="button" className="blend-advisor-button blend-advisor-primary" onClick={apply} disabled={busy}>ساخت نسخهٔ پیشنهادی</button>}
            <button type="button" className="blend-advisor-button blend-advisor-secondary" onClick={reject} disabled={busy}>ترکیب فعلی را نگه می‌دارم</button>
          </div>
        </div>}
        {accepted && <div className="blend-advisor-message" role="status">
          <p>چیدمان پیشنهادی در ترکیب مفهومی اعمال شد؛ هنوز ذخیره نشده است.</p>
          {canUndo && <button ref={undoRef} type="button" className="blend-advisor-button blend-advisor-secondary" onClick={undo} disabled={busy}>بازگشت به ترکیب قبلی</button>}
        </div>}
        <p className="blend-advisor-disclaimer">این پیشنهاد دربارهٔ بوی واقعی، کیفیت، ایمنی یا امکان ساخت عطر داوری نمی‌کند و فرمول فیزیکی نیست.</p>
      </div>
    </details>
  </section>;
}
