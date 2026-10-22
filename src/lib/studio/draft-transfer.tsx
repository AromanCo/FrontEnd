'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Layer, Note } from '@/lib/api/client';
import type { SelectedNote } from './composition';

export type StudioDraftNote = Readonly<{ noteId: string; layer: Layer; position: number }>;
export type StudioDraftTransfer = Readonly<{
  transferId: string;
  name: string;
  notes: readonly StudioDraftNote[];
}>;

export type DraftResolution =
  | Readonly<{ status: 'ready'; name: string; selected: readonly SelectedNote[] }>
  | Readonly<{ status: 'missing'; name: string; selected: readonly SelectedNote[]; missingIds: readonly string[] }>
  | Readonly<{ status: 'invalid'; reason: string }>;

export function resolveStudioDraft(draft: StudioDraftTransfer, catalogNotes: readonly Note[]): DraftResolution {
  const validLayers = new Set<Layer>(['top', 'heart', 'base']);
  if (!draft.transferId || !draft.name.trim() || draft.name.trim().length > 60 || !draft.notes.length || draft.notes.length > 6) {
    return { status: 'invalid', reason: 'پیش‌نویس انتقال‌یافته کامل یا معتبر نیست.' };
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

  const createDraft = useCallback((name: string, notes: readonly StudioDraftNote[]) => {
    transferSequence += 1;
    const transferId = `guided-${Date.now().toString(36)}-${transferSequence.toString(36)}`;
    const draft: StudioDraftTransfer = {
      transferId,
      name,
      notes: notes.map(note => ({ ...note })),
    };
    pendingRef.current = draft;
    setPending(draft);
    setNavigationIntentId(transferId);
    return draft;
  }, []);

  const isCurrent = useCallback((transferId: string) => pendingRef.current?.transferId === transferId, []);
  const consume = useCallback((transferId: string) => {
    if (pendingRef.current?.transferId !== transferId) return false;
    pendingRef.current = null;
    setPending(null);
    setNavigationIntentId(current => current === transferId ? null : current);
    return true;
  }, []);

  const discard = useCallback((transferId: string) => consume(transferId), [consume]);
  const value = useMemo(() => ({ pending, navigationIntentId, createDraft, isCurrent, consume, discard }), [pending, navigationIntentId, createDraft, isCurrent, consume, discard]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useStudioDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('StudioDraftProvider is missing');
  return value;
}
