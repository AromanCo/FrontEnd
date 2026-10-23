import type { ConceptInput, Layer, Note } from '@/lib/api/client';
import type { SelectedNote } from '@/lib/studio/composition';

export type CompositionSnapshot = Readonly<{
  name: string;
  selected: readonly SelectedNote[];
  revision: number;
  compositionIdentity: string;
  routeIntent: string;
  saveTargetId: string | null;
}>;

export type AdvisorSource = Pick<
  CompositionSnapshot,
  'revision' | 'compositionIdentity' | 'routeIntent' | 'saveTargetId'
>;

export type AdvisoryRuleId = 'explore-empty-layer' | 'explore-layer-sequence';

export type AdvisoryRuleset = Readonly<{
  id: 'aroman-editorial-layer-exploration';
  version: string;
  labelFa: 'راهنمای ویرایشی آرومان';
}>;

export type AdvisoryRuleIdentity = AdvisoryRuleset & Readonly<{ ruleId: AdvisoryRuleId }>;

export type AdvisorySuggestion = Readonly<{
  id: string;
  titleFa: string;
  rationaleFa: string;
  provenance: AdvisoryRuleIdentity;
  sourceRevision: number;
  sourceCompositionIdentity: string;
  sourceRouteIntent: string;
  sourceSaveTargetId: string | null;
  original: CompositionSnapshot;
  proposed: CompositionSnapshot;
  changedNoteIds: readonly string[];
  limitationsFa: readonly string[];
  payload: ConceptInput;
}>;

export type ConceptValidationIssue =
  | 'empty-name'
  | 'name-too-long'
  | 'too-many-notes'
  | 'duplicate-note-id'
  | 'invalid-note-id'
  | 'unknown-note-id'
  | 'conflicting-catalog-record'
  | 'invalid-layer'
  | 'invalid-position'
  | 'duplicate-layer-position'
  | 'non-contiguous-position'
  | 'selection-changed'
  | 'source-token-changed'
  | 'candidate-unchanged'
  | 'name-changed'
  | 'note-metadata-mismatch'
  | 'invalid-source-metadata';

export type AdvisorInvalidReason = 'invalid-source' | 'invalid-candidate';

export type AdvisorUnavailableReason =
  | 'catalog-loading'
  | 'catalog-failed'
  | 'catalog-incomplete'
  | 'catalog-conflict'
  | 'stale-selection';

export type AdvisorNoGuidanceReason = 'empty' | 'no-structural-rule';

export type AdvisorCatalog =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; completeness: 'complete' | 'partial'; notes: readonly Note[] }>;

export type AdvisorResult =
  | Readonly<{ status: 'suggestion'; suggestion: AdvisorySuggestion }>
  | Readonly<{ status: 'no-guidance'; reason: AdvisorNoGuidanceReason }>
  | Readonly<{ status: 'invalid'; reason: AdvisorInvalidReason; issues: readonly ConceptValidationIssue[] }>
  | Readonly<{ status: 'unavailable'; reason: AdvisorUnavailableReason }>;

export type CandidateValidationResult =
  | Readonly<{ status: 'valid' }>
  | Readonly<{ status: 'invalid'; issues: readonly ConceptValidationIssue[] }>
  | Readonly<{ status: 'unavailable'; reason: AdvisorUnavailableReason }>;

export type ConceptualLayer = Layer;
