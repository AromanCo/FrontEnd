import type { ConceptInput, Layer, Note } from '@/lib/api/client';
import { MAX_CONCEPT_NOTES } from '@/lib/studio/guided/config';
import { layers, payload, type SelectedNote } from '@/lib/studio/composition';
import { ADVISOR_LAYER_ORDER, ADVISOR_LIMITATION_FA, ADVISOR_RULES, ADVISOR_RULESET } from './rules';
import type {
  AdvisoryRuleId,
  AdvisoryRuleset,
  AdvisorySuggestion,
  AdvisorCatalog,
  AdvisorResult,
  CandidateValidationResult,
  CompositionSnapshot,
  ConceptValidationIssue,
} from './types';

const MAX_NAME_LENGTH = 120;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const layerSet = new Set<string>(layers);

/** Validate a payload-compatible concept, including contiguous layer-local positions. */
export function validateConceptPayload(
  value: ConceptInput,
  catalogNotes: readonly Note[],
): readonly ConceptValidationIssue[] {
  const issues: ConceptValidationIssue[] = [];
  if (!value.name.trim()) issues.push('empty-name');
  if (value.name.trim().length > MAX_NAME_LENGTH) issues.push('name-too-long');
  const selections = value.notes ?? [];
  if (selections.length > MAX_CONCEPT_NOTES) issues.push('too-many-notes');
  const ids = new Set<string>();
  const known = new Set(catalogNotes.map(note => note.id.toLowerCase()));
  const positions = new Map<string, Set<number>>();
  const positionLists = new Map<string, number[]>();
  for (const selection of selections) {
    if (!UUID_PATTERN.test(selection.note_id)) issues.push('invalid-note-id');
    const idKey = selection.note_id.toLowerCase();
    if (ids.has(idKey)) issues.push('duplicate-note-id');
    ids.add(idKey);
    if (!known.has(idKey)) issues.push('unknown-note-id');
    if (!layerSet.has(selection.layer)) {
      issues.push('invalid-layer');
      continue;
    }
    if (!Number.isInteger(selection.position) || selection.position < 0) {
      issues.push('invalid-position');
      continue;
    }
    const layer = selection.layer;
    const seen = positions.get(layer) ?? new Set<number>();
    if (seen.has(selection.position)) issues.push('duplicate-layer-position');
    seen.add(selection.position);
    positions.set(layer, seen);
    positionLists.set(layer, [...(positionLists.get(layer) ?? []), selection.position]);
  }
  for (const layer of layers) {
    const values = positionLists.get(layer) ?? [];
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.some((position, index) => position !== index)) issues.push('non-contiguous-position');
  }
  return [...new Set(issues)];
}

function snapshotCopy(snapshot: CompositionSnapshot): CompositionSnapshot {
  const selected = snapshot.selected.map(item => Object.freeze({
    note: Object.freeze({ ...item.note }),
    layer: item.layer,
  }));
  return Object.freeze({ ...snapshot, selected: Object.freeze(selected) });
}

function sourceIssues(snapshot: CompositionSnapshot, catalog: readonly Note[]): ConceptValidationIssue[] {
  const result = payload(snapshot.name, snapshot.selected as SelectedNote[]);
  const issues = [...validateConceptPayload(result, catalog)];
  if (snapshot.selected.length === 0) return [];
  return issues;
}

function stableHash(input: string): string {
  // FNV-1a is used only for a reproducible local suggestion key, not security.
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function suggestionId(
  snapshot: CompositionSnapshot,
  proposed: CompositionSnapshot,
  ruleId: AdvisoryRuleId,
  ruleset: AdvisoryRuleset,
): string {
  const canonical = JSON.stringify({
    rulesetId: ruleset.id,
    version: ruleset.version,
    ruleId,
    source: {
      name: snapshot.name,
      revision: snapshot.revision,
      compositionIdentity: snapshot.compositionIdentity,
      routeIntent: snapshot.routeIntent,
      saveTargetId: snapshot.saveTargetId,
      selected: snapshot.selected.map(item => [item.note.id, item.layer]),
    },
    proposed: proposed.selected.map(item => [item.note.id, item.layer]),
  });
  return `advisor:${ruleset.version}:${ruleId}:${stableHash(canonical)}`;
}

function candidateForEmptyLayer(selected: readonly SelectedNote[], emptyLayer: Layer): { selected: SelectedNote[]; changed: string[] } | null {
  // The first selected record in composition order is the stable, documented choice.
  const index = 0;
  if (!selected[index]) return null;
  const next = selected.map(item => ({ ...item }));
  const chosen = next[index];
  next[index] = { ...chosen, layer: emptyLayer };
  return { selected: next, changed: [chosen.note.id] };
}

function candidateForSequence(selected: readonly SelectedNote[], layer: Layer): { selected: SelectedNote[]; changed: string[] } | null {
  const indexes = selected.map((item, index) => item.layer === layer ? index : -1).filter(index => index >= 0);
  if (indexes.length < 2) return null;
  const next = selected.map(item => ({ ...item }));
  [next[indexes[0]], next[indexes[1]]] = [next[indexes[1]], next[indexes[0]]];
  return { selected: next, changed: [selected[indexes[0]].note.id, selected[indexes[1]].note.id] };
}

function makeSuggestion(
  snapshot: CompositionSnapshot,
  candidate: readonly SelectedNote[],
  changedNoteIds: readonly string[],
  ruleId: AdvisoryRuleId,
  catalog: readonly Note[],
  ruleset: AdvisoryRuleset,
): AdvisorResult {
  const original = snapshotCopy(snapshot);
  const proposed = snapshotCopy({ ...snapshot, selected: candidate });
  if (JSON.stringify(original.selected.map(item => [item.note.id, item.layer])) === JSON.stringify(proposed.selected.map(item => [item.note.id, item.layer]))) {
    return { status: 'invalid', reason: 'invalid-candidate', issues: ['candidate-unchanged'] };
  }
  const candidatePayload = payload(proposed.name, proposed.selected as SelectedNote[]);
  const issues = validateConceptPayload(candidatePayload, catalog);
  if (issues.length) return { status: 'invalid', reason: 'invalid-candidate', issues };
  const originalIds = original.selected.map(item => item.note.id).sort();
  const proposedIds = proposed.selected.map(item => item.note.id).sort();
  if (JSON.stringify(originalIds) !== JSON.stringify(proposedIds)) {
    return { status: 'invalid', reason: 'invalid-candidate', issues: ['selection-changed'] };
  }
  const rule = ADVISOR_RULES[ruleId];
  const provenance = Object.freeze({ ...ruleset, ruleId });
  const suggestion: AdvisorySuggestion = Object.freeze({
    id: suggestionId(snapshot, proposed, ruleId, ruleset),
    titleFa: rule.titleFa,
    rationaleFa: rule.rationaleFa,
    provenance,
    sourceRevision: snapshot.revision,
    sourceCompositionIdentity: snapshot.compositionIdentity,
    sourceRouteIntent: snapshot.routeIntent,
    sourceSaveTargetId: snapshot.saveTargetId,
    original,
    proposed,
    changedNoteIds: Object.freeze([...changedNoteIds]),
    limitationsFa: ADVISOR_LIMITATION_FA,
    payload: Object.freeze({ name: candidatePayload.name, notes: Object.freeze(candidatePayload.notes?.map(note => Object.freeze({ ...note })) ?? []) }) as ConceptInput,
  });
  return { status: 'suggestion', suggestion };
}

/** Pure editorial layer-exploration engine. It never mutates or persists the source. */
export function recommendAdvisory(
  snapshot: CompositionSnapshot,
  catalog: AdvisorCatalog,
  ruleset: AdvisoryRuleset = ADVISOR_RULESET,
): AdvisorResult {
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0 || !snapshot.compositionIdentity || !snapshot.routeIntent) {
    return { status: 'invalid', reason: 'invalid-source', issues: ['invalid-source-metadata'] };
  }
  const basePayload = payload(snapshot.name, snapshot.selected as SelectedNote[]);
  const structuralIssues = validateConceptPayload({ ...basePayload, notes: [] }, []);
  if (structuralIssues.length) return { status: 'invalid', reason: 'invalid-source', issues: structuralIssues };
  if (snapshot.selected.length > MAX_CONCEPT_NOTES) return { status: 'invalid', reason: 'invalid-source', issues: ['too-many-notes'] };
  const duplicateIds = new Set<string>();
  for (const item of snapshot.selected) {
    const key = item.note.id.toLowerCase();
    if (duplicateIds.has(key)) return { status: 'invalid', reason: 'invalid-source', issues: ['duplicate-note-id'] };
    duplicateIds.add(key);
    if (!UUID_PATTERN.test(item.note.id)) return { status: 'invalid', reason: 'invalid-source', issues: ['invalid-note-id'] };
    if (!layerSet.has(item.layer)) return { status: 'invalid', reason: 'invalid-source', issues: ['invalid-layer'] };
  }
  if (snapshot.selected.length === 0) return { status: 'no-guidance', reason: 'empty' };
  if (catalog.status === 'loading') return { status: 'unavailable', reason: 'catalog-loading' };
  if (catalog.status === 'failed') return { status: 'unavailable', reason: 'catalog-failed' };
  if (catalog.completeness !== 'complete') return { status: 'unavailable', reason: 'catalog-incomplete' };

  const records = new Map<string, Note>();
  for (const note of catalog.notes) {
    const key = note.id.toLowerCase();
    const prior = records.get(key);
    if (prior && !sameNote(prior, note)) return { status: 'unavailable', reason: 'catalog-conflict' };
    records.set(key, note);
  }
  for (const item of snapshot.selected) {
    const authoritative = records.get(item.note.id.toLowerCase());
    if (!authoritative) return { status: 'unavailable', reason: 'stale-selection' };
    if (!sameNote(authoritative, item.note)) return { status: 'unavailable', reason: 'catalog-conflict' };
  }
  const sourceErrors = sourceIssues(snapshot, catalog.notes);
  if (sourceErrors.length) return { status: 'invalid', reason: 'invalid-source', issues: sourceErrors };

  const occupied = new Set(snapshot.selected.map(item => item.layer));
  const emptyLayer = ADVISOR_LAYER_ORDER.find(layer => !occupied.has(layer));
  if (emptyLayer) {
    const candidate = candidateForEmptyLayer(snapshot.selected, emptyLayer);
    if (!candidate) return { status: 'no-guidance', reason: 'no-structural-rule' };
    return makeSuggestion(snapshot, candidate.selected, candidate.changed, 'explore-empty-layer', catalog.notes, ruleset);
  }
  const repeatedLayer = ADVISOR_LAYER_ORDER.find(layer => snapshot.selected.filter(item => item.layer === layer).length >= 2);
  if (repeatedLayer) {
    const candidate = candidateForSequence(snapshot.selected, repeatedLayer);
    if (!candidate) return { status: 'no-guidance', reason: 'no-structural-rule' };
    return makeSuggestion(snapshot, candidate.selected, candidate.changed, 'explore-layer-sequence', catalog.notes, ruleset);
  }
  return { status: 'no-guidance', reason: 'no-structural-rule' };
}

/** Kept explicit for callers/tests that need to validate a candidate independently. */
export function validateAdvisoryCandidate(
  original: CompositionSnapshot,
  candidate: CompositionSnapshot,
  catalog: AdvisorCatalog,
): CandidateValidationResult {
  if (catalog.status === 'loading') return { status: 'unavailable', reason: 'catalog-loading' };
  if (catalog.status === 'failed') return { status: 'unavailable', reason: 'catalog-failed' };
  if (catalog.completeness !== 'complete') return { status: 'unavailable', reason: 'catalog-incomplete' };

  const records = new Map<string, Note>();
  for (const note of catalog.notes) {
    const key = note.id.toLowerCase();
    const prior = records.get(key);
    if (prior && !sameNote(prior, note)) return { status: 'unavailable', reason: 'catalog-conflict' };
    records.set(key, note);
  }
  const issues = [
    ...validateConceptPayload(payload(original.name, original.selected as SelectedNote[]), catalog.notes),
    ...validateConceptPayload(payload(candidate.name, candidate.selected as SelectedNote[]), catalog.notes),
  ];
  for (const selection of [...original.selected, ...candidate.selected]) {
    const authoritative = records.get(selection.note.id.toLowerCase());
    if (!authoritative) return { status: 'unavailable', reason: 'stale-selection' };
    if (!sameNote(authoritative, selection.note)) issues.push('note-metadata-mismatch');
  }
  const originalIds = original.selected.map(item => item.note.id).sort();
  const candidateIds = candidate.selected.map(item => item.note.id).sort();
  if (JSON.stringify(originalIds) !== JSON.stringify(candidateIds)) issues.push('selection-changed');
  if (candidate.name !== original.name) issues.push('name-changed');
  if (candidate.revision !== original.revision || candidate.compositionIdentity !== original.compositionIdentity
    || candidate.routeIntent !== original.routeIntent || candidate.saveTargetId !== original.saveTargetId) {
    issues.push('source-token-changed');
  }
  if (JSON.stringify(original.selected.map(item => [item.note.id, item.layer]))
    === JSON.stringify(candidate.selected.map(item => [item.note.id, item.layer]))) issues.push('candidate-unchanged');
  const uniqueIssues = [...new Set(issues)];
  return uniqueIssues.length ? { status: 'invalid', issues: uniqueIssues } : { status: 'valid' };
}

function sameNote(left: Note, right: Note): boolean {
  return left.id === right.id && left.slug === right.slug && left.name === right.name
    && left.description === right.description && left.family_id === right.family_id && left.is_demo === right.is_demo;
}
