import type { ConceptInput, Family, Layer, Note } from '@/lib/api/client';

export const feelings = ['calm', 'bright', 'confident', 'intimate', 'curious'] as const;
export const temperatures = ['bright', 'soft', 'warm'] as const;
export const scenes = ['rainGarden', 'citrusMorning', 'quietFlowers', 'woodland', 'warmEvening', 'coffeePause'] as const;
export const discoveries = ['familiar', 'balanced', 'exploratory'] as const;

export type Feeling = (typeof feelings)[number];
export type Temperature = (typeof temperatures)[number];
export type Scene = (typeof scenes)[number];
export type Discovery = (typeof discoveries)[number];
export type NoteAffinityStatus = 'selected' | 'skipped';

/** The domain honors the published nullable family_id contract even though the checked-in OpenAPI type is narrower. */
export type GuidedCatalogNote = Omit<Note, 'family_id'> & { family_id: string | null };

export type GuidedAnswers = Readonly<{
  feeling: Feeling;
  familyIds: readonly string[];
  temperature: Temperature;
  scene: Scene;
  likedNoteIds: readonly string[];
  avoidedNoteIds: readonly string[];
  noteAffinityStatus: NoteAffinityStatus;
  discovery: Discovery;
}>;

/** Incomplete, UI-independent answer state used by step validators. */
export type GuidedAnswersDraft = Readonly<Partial<{
  feeling: unknown;
  familyIds: unknown;
  temperature: unknown;
  scene: unknown;
  likedNoteIds: unknown;
  avoidedNoteIds: unknown;
  noteAffinityStatus: unknown;
  discovery: unknown;
}>>;

/** Naming is draft/result data and intentionally kept outside GuidedAnswers. */
export type GuidedConceptDraft = Readonly<{ conceptName: string }>;
export type GuidedFamily = Family;
export type GuidedNote = GuidedCatalogNote;
export type GuidedLayer = Layer;
export type GuidedSelection = Readonly<{ note: GuidedCatalogNote; layer: Layer; position: number }>;
export type GuidedConceptInput = ConceptInput;

export type ValidationIssue = Readonly<{
  field: string;
  code: string;
  message: string;
}>;

export type ValidationResult<T> = Readonly<{
  valid: boolean;
  value?: T;
  issues: readonly ValidationIssue[];
  notices: readonly string[];
}>;

export type FamilyScore = Readonly<{
  familyId: string;
  slug: string;
  name: string;
  score: number;
  contributions: Readonly<{ selected: number; feeling: number; temperature: number; scene: number; discovery: number }>;
}>;

export type RecommendationInvalidReason =
  | 'invalid-answers'
  | 'missing-family'
  | 'unknown-family'
  | 'invalid-catalog'
  | 'conflicting-note-choice';

export type RecommendationNoMatchReason = 'no-notes' | 'all-excluded' | 'familiar-scope-empty' | 'no-candidates';

export type RecommendationResult =
  | Readonly<{
      status: 'ready';
      selections: readonly GuidedSelection[];
      explanation: readonly string[];
      notices: readonly string[];
      familyScores: readonly FamilyScore[];
      exploratoryReservedNoteId?: string;
      usedBalancedFallback: boolean;
    }>
  | Readonly<{
      status: 'no-match';
      reason: RecommendationNoMatchReason;
      explanation: readonly string[];
      notices: readonly string[];
      familyScores: readonly FamilyScore[];
    }>
  | Readonly<{
      status: 'invalid';
      reason: RecommendationInvalidReason;
      issues: readonly ValidationIssue[];
      explanation: readonly string[];
      notices: readonly string[];
    }>;

export type PayloadResult =
  | Readonly<{ status: 'ready'; payload: GuidedConceptInput }>
  | Readonly<{ status: 'invalid'; issues: readonly ValidationIssue[] }>;
