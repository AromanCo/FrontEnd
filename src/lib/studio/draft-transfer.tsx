'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Layer, Note } from '@/lib/api/client';
import type { SelectedNote } from './composition';

export type StudioDraftNote = Readonly<{ noteId: string; layer: Layer; position: number }>;
type StudioDraftTransferBase = Readonly<{
  transferId: string;
  name: string;
  notes: readonly StudioDraftNote[];
}>;
export type GuidedStudioDraftTransfer = StudioDraftTransferBase & Readonly<{ origin?: 'guided' }>;
export type AdvisorForkTransfer = StudioDraftTransferBase & Readonly<{
  origin: 'advisor-fork';
  sourceCompositionIdentity: string;
  sourceConceptId: string;
}>;
export type StudioDraftTransfer = GuidedStudioDraftTransfer | AdvisorForkTransfer;
export type AdvisorForkCreation =
  | Readonly<{ status: 'created'; transfer: AdvisorForkTransfer }>
  | Readonly<{ status: 'blocked'; reason: 'pending-transfer' }>
  | Readonly<{ status: 'invalid'; reason: 'invalid-name' | 'invalid-composition' | 'invalid-source' }>;
export const MAX_STUDIO_DRAFT_NAME_LENGTH = 120;

export type DraftResolution =
  | Readonly<{ status: 'ready'; name: string; selected: readonly SelectedNote[] }>
  | Readonly<{ status: 'missing'; name: string; selected: readonly SelectedNote[]; missingIds: readonly string[] }>
  | Readonly<{ status: 'invalid'; reason: string }>;

export function resolveStudioDraft(draft: StudioDraftTransfer, catalogNotes: readonly Note[]): DraftResolution {
  const validLayers = new Set<Layer>(['top', 'heart', 'base']);
  if (!Array.isArray(catalogNotes)) return { status: 'invalid', reason: 'ساختار صفحه‌های کاتالوگ معتبر نیست.' };
  if (!draft.transferId || !draft.name.trim() || draft.name.trim().length > MAX_STUDIO_DRAFT_NAME_LENGTH || !draft.notes.length || draft.notes.length > 6) {
    return { status: 'invalid', reason: 'پیش‌نویس انتقال‌یافته کامل یا معتبر نیست.' };
  }
  if (draft.origin === 'advisor-fork' && (!draft.sourceCompositionIdentity || !draft.sourceConceptId)) {
    return { status: 'invalid', reason: 'هویت مفهوم مبدأ برای انتقال نسخهٔ مستقل معتبر نیست.' };
  }
  if (draft.origin === 'advisor-fork') {
    const catalogIds = new Set<string>();
    for (const note of catalogNotes) {
      if (!note || typeof note.id !== 'string' || !note.id.trim()) {
        return { status: 'invalid', reason: 'ساختار کاتالوگ برای انتقال نسخهٔ مستقل معتبر نیست.' };
      }
      const id = note.id.toLowerCase();
      if (catalogIds.has(id)) {
        return { status: 'invalid', reason: 'شناسهٔ تکراری یا متناقض در کاتالوگ، انتقال نسخهٔ مستقل را متوقف کرد.' };
      }
      catalogIds.add(id);
    }
  }
  const ids = draft.notes.map(item => item.noteId.toLowerCase());
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (new Set(ids).size !== ids.length || draft.notes.some(item => !uuidPattern.test(item.noteId) || !validLayers.has(item.layer) || !Number.isInteger(item.position) || item.position < 0)) {
    return { status: 'invalid', reason: 'شناسه‌ها، لایه‌ها یا ترتیب پیش‌نویس انتقال‌یافته معتبر نیست.' };
  }
  for (const layer of validLayers) {
    const positions = draft.notes.filter(item => item.layer === layer).map(item => item.position).sort((a, b) => a - b);
    if (positions.some((position, index) => position !== index)) return { status: 'invalid', reason: 'ترتیب نت‌ها در یکی از لایه‌ها پیوسته نیست.' };
  }
  const byId = new Map(catalogNotes.map(note => [note.id.toLowerCase(), note]));
  const selected: SelectedNote[] = [];
  const missingIds: string[] = [];
  for (const item of draft.notes) {
    const note = byId.get(item.noteId.toLowerCase());
    if (note) selected.push({ note, layer: item.layer });
    else missingIds.push(item.noteId);
  }
  selected.sort((a, b) => validLayerOrder(a.layer) - validLayerOrder(b.layer) || draft.notes.find(item => item.noteId.toLowerCase() === a.note.id.toLowerCase())!.position - draft.notes.find(item => item.noteId.toLowerCase() === b.note.id.toLowerCase())!.position);
  return missingIds.length ? { status: 'missing', name: draft.name, selected, missingIds } : { status: 'ready', name: draft.name, selected };
}

function validLayerOrder(layer: Layer) { return layer === 'top' ? 0 : layer === 'heart' ? 1 : 2; }

type DraftTransferState = Readonly<{
  pending: StudioDraftTransfer | null;
  navigationIntentId: string | null;
  createDraft: (name: string, notes: readonly StudioDraftNote[]) => StudioDraftTransfer;
  createAdvisorFork: (name: string, notes: readonly StudioDraftNote[], source: { compositionIdentity: string; conceptId: string }) => AdvisorForkCreation;
  isCurrent: (transferId: string) => boolean;
  consume: (transferId: string) => boolean;
  discard: (transferId: string) => boolean;
}>;

const DraftContext = createContext<DraftTransferState | null>(null);
let transferSequence = 0;

export function StudioDraftProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<StudioDraftTransfer | null>(null);
  const [navigationIntentId, setNavigationIntentId] = useState<string | null>(null);
  const pendingRef = useRef<StudioDraftTransfer | null>(null);
  const navigationIntentRef = useRef<string | null>(null);

  const createDraft = useCallback((name: string, notes: readonly StudioDraftNote[]) => {
    transferSequence += 1;
    const transferId = `guided-${Date.now().toString(36)}-${transferSequence.toString(36)}`;
    const draft: GuidedStudioDraftTransfer = {
      transferId,
      origin: 'guided',
      name,
      notes: notes.map(note => ({ ...note })),
    };
    pendingRef.current = draft;
    setPending(draft);
    navigationIntentRef.current = transferId;
    setNavigationIntentId(transferId);
    return draft;
  }, []);

  const createAdvisorFork = useCallback((
    name: string,
    notes: readonly StudioDraftNote[],
    source: { compositionIdentity: string; conceptId: string },
  ): AdvisorForkCreation => {
    if (pendingRef.current || navigationIntentRef.current) return { status: 'blocked', reason: 'pending-transfer' };
    if (!name.trim() || name.trim().length > MAX_STUDIO_DRAFT_NAME_LENGTH) return { status: 'invalid', reason: 'invalid-name' };
    if (!source.compositionIdentity || !source.conceptId) return { status: 'invalid', reason: 'invalid-source' };
    const validLayers = new Set<Layer>(['top', 'heart', 'base']);
    const ids = notes.map(note => note.noteId.toLowerCase());
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!notes.length || notes.length > 6 || new Set(ids).size !== ids.length || notes.some(note =>
      !uuid.test(note.noteId) || !validLayers.has(note.layer) || !Number.isInteger(note.position) || note.position < 0,
    )) return { status: 'invalid', reason: 'invalid-composition' };
    for (const layer of validLayers) {
      const positions = notes.filter(note => note.layer === layer).map(note => note.position).sort((a, b) => a - b);
      if (positions.some((position, index) => position !== index)) return { status: 'invalid', reason: 'invalid-composition' };
    }
    transferSequence += 1;
    const transfer: AdvisorForkTransfer = Object.freeze({
      origin: 'advisor-fork',
      transferId: `advisor-${Date.now().toString(36)}-${transferSequence.toString(36)}`,
      name,
      notes: Object.freeze(notes.map(note => Object.freeze({ ...note }))),
      sourceCompositionIdentity: source.compositionIdentity,
      sourceConceptId: source.conceptId,
    });
    pendingRef.current = transfer;
    navigationIntentRef.current = transfer.transferId;
    setPending(transfer);
    setNavigationIntentId(transfer.transferId);
    return { status: 'created', transfer };
  }, []);

  const isCurrent = useCallback((transferId: string) => pendingRef.current?.transferId === transferId, []);
  const consume = useCallback((transferId: string) => {
    if (pendingRef.current?.transferId !== transferId) return false;
    pendingRef.current = null;
    if (navigationIntentRef.current === transferId) navigationIntentRef.current = null;
    setPending(null);
    setNavigationIntentId(current => current === transferId ? null : current);
    return true;
  }, []);

  const discard = useCallback((transferId: string) => consume(transferId), [consume]);
  const value = useMemo(() => ({ pending, navigationIntentId, createDraft, createAdvisorFork, isCurrent, consume, discard }), [pending, navigationIntentId, createDraft, createAdvisorFork, isCurrent, consume, discard]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useStudioDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('StudioDraftProvider is missing');
  return value;
}
