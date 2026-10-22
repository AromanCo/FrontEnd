import type { ConceptInput, Note } from '@/lib/api/client';
import { MAX_CONCEPT_NOTES } from './config';
import { isUuid, validateConceptName } from './answers';
import type { GuidedCatalogNote, PayloadResult, RecommendationResult, ValidationIssue } from './types';

const UUID_COMPARISON = (id: string) => id.toLowerCase();
const problem = (field: string, code: string, message: string): ValidationIssue => ({ field, code, message });

/** Build the existing Backend payload from a ready result and a fresh API snapshot. */
export function toConceptInput(
  recommendation: RecommendationResult,
  conceptName: unknown,
  currentNotes: readonly (Note | GuidedCatalogNote)[],
): PayloadResult {
  if (recommendation.status !== 'ready') {
    return { status: 'invalid', issues: [problem('recommendation', 'not-saveable', 'نتیجهٔ آماده‌ای برای ذخیره وجود ندارد.')] };
  }
  const name = validateConceptName(conceptName);
  const issues = [...name.issues];
  const selections = recommendation.selections;
  if (!selections.length || selections.length > MAX_CONCEPT_NOTES) {
    issues.push(problem('selections', 'count', 'مفهوم باید یک تا شش نت داشته باشد.'));
  }
  const currentById = new Map(currentNotes.map(note => [UUID_COMPARISON(note.id), note]));
  const ids = selections.map(selection => selection.note.id);
  if (ids.some(id => !isUuid(id))) issues.push(problem('selections', 'invalid-id', 'شناسهٔ یکی از نت‌ها معتبر نیست.'));
  if (new Set(ids.map(UUID_COMPARISON)).size !== ids.length) issues.push(problem('selections', 'duplicate', 'هر نت فقط یک‌بار می‌تواند در مفهوم باشد.'));
  if (ids.some(id => !currentById.has(UUID_COMPARISON(id)))) issues.push(problem('selections', 'stale-note', 'یکی از نت‌ها در کاتالوگ فعلی پیدا نشد.'));

  const validLayers = new Set(['top', 'heart', 'base']);
  for (const selection of selections) {
    if (!validLayers.has(selection.layer)) issues.push(problem('selections', 'invalid-layer', 'لایهٔ یکی از نت‌ها معتبر نیست.'));
  }
  for (const layer of validLayers) {
    const positions = selections.filter(item => item.layer === layer).map(item => item.position).sort((a, b) => a - b);
    if (positions.some((position, index) => !Number.isInteger(position) || position !== index)) {
      issues.push(problem('selections', 'invalid-position', 'جایگاه نت‌ها در هر لایه باید پیوسته و از صفر باشد.'));
    }
  }
  if (issues.length || !name.value) return { status: 'invalid', issues };

  // Re-resolve actual current API records before serializing; never send view models or answers.
  const payload: ConceptInput = {
    name: name.value,
    notes: selections.map(selection => ({
      note_id: currentById.get(UUID_COMPARISON(selection.note.id))!.id,
      layer: selection.layer,
      position: selection.position,
    })),
  };
  return { status: 'ready', payload };
}
