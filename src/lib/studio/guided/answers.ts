import type { Family } from '@/lib/api/client';
import { DEFAULT_CONCEPT_NAME, MAX_CONCEPT_NAME_LENGTH } from './config';
import {
  discoveries,
  feelings,
  scenes,
  temperatures,
  type GuidedAnswers,
  type GuidedAnswersDraft,
  type GuidedCatalogNote,
  type ValidationIssue,
  type ValidationResult,
} from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const issue = (field: string, code: string, message: string): ValidationIssue => ({ field, code, message });
const result = <T>(value: T | undefined, issues: ValidationIssue[] = [], notices: string[] = []): ValidationResult<T> => ({
  valid: issues.length === 0,
  ...(issues.length === 0 && value !== undefined ? { value } : {}),
  issues,
  notices,
});

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string, label: string): ValidationResult<T> {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return result(value as T);
  return result(undefined, [issue(field, 'required-or-invalid', `${label} را به‌درستی انتخاب کنید.`)]);
}

export const validateFeeling = (value: unknown) => enumValue(value, feelings, 'feeling', 'حال‌وهوا');
export const validateTemperature = (value: unknown) => enumValue(value, temperatures, 'temperature', 'دمای حسی');
export const validateScene = (value: unknown) => enumValue(value, scenes, 'scene', 'تصویر');
export const validateDiscovery = (value: unknown) => enumValue(value, discoveries, 'discovery', 'میزان کشف');

export function validateFamilyIds(value: unknown, families: readonly Family[]): ValidationResult<readonly string[]> {
  if (!Array.isArray(value)) return result(undefined, [issue('familyIds', 'required', 'یک یا دو خانواده را انتخاب کنید.')]);
  const ids = value;
  const issues: ValidationIssue[] = [];
  if (ids.length < 1 || ids.length > 2) issues.push(issue('familyIds', 'count', 'یک یا دو خانواده را انتخاب کنید.'));
  if (!ids.every(isUuid)) issues.push(issue('familyIds', 'invalid-id', 'شناسهٔ یکی از خانواده‌ها معتبر نیست.'));
  if (new Set(ids.filter((id): id is string => typeof id === 'string').map(id => id.toLowerCase())).size !== ids.length) {
    issues.push(issue('familyIds', 'duplicate', 'یک خانواده را فقط یک‌بار انتخاب کنید.'));
  }
  const familyIds = new Set(families.map(family => family.id.toLowerCase()));
  if (ids.every(isUuid) && ids.some(id => !familyIds.has(id.toLowerCase()))) {
    issues.push(issue('familyIds', 'stale-family', 'یکی از خانواده‌های انتخابی دیگر در کاتالوگ در دسترس نیست.'));
  }
  return issues.length ? result(undefined, issues) : result(ids as string[]);
}

export type NoteAffinity = Readonly<{
  status: 'selected' | 'skipped';
  likedNoteIds: readonly string[];
  avoidedNoteIds: readonly string[];
}>;

export function validateNoteAffinity(
  status: unknown,
  likedValue: unknown,
  avoidedValue: unknown,
  notes: readonly GuidedCatalogNote[],
): ValidationResult<NoteAffinity> {
  const issues: ValidationIssue[] = [];
  const notices: string[] = [];
  if (status !== 'selected' && status !== 'skipped') {
    return result(undefined, [issue('noteAffinityStatus', 'unanswered', 'نت‌هایی را انتخاب کنید یا این مرحله را رد کنید.')]);
  }
  if (!Array.isArray(likedValue) || !Array.isArray(avoidedValue)) {
    return result(undefined, [issue('noteAffinity', 'invalid-list', 'انتخاب نت‌ها معتبر نیست.')]);
  }
  const liked = likedValue;
  const avoided = avoidedValue;
  if (!liked.every(isUuid) || !avoided.every(isUuid)) issues.push(issue('noteAffinity', 'invalid-id', 'شناسهٔ یکی از نت‌ها معتبر نیست.'));
  for (const [ids, field] of [[liked, 'likedNoteIds'], [avoided, 'avoidedNoteIds']] as const) {
    if (new Set(ids.filter((id): id is string => typeof id === 'string').map(id => id.toLowerCase())).size !== ids.length) {
      issues.push(issue(field, 'duplicate', 'هر نت را فقط یک‌بار انتخاب کنید.'));
    }
    if (ids.length > 3) issues.push(issue(field, 'maximum', 'در هر فهرست حداکثر سه نت انتخاب کنید.'));
  }
  const avoidedSet = new Set(avoided.filter((id): id is string => typeof id === 'string').map(id => id.toLowerCase()));
  if (liked.some((id): id is string => typeof id === 'string' && avoidedSet.has(id.toLowerCase()))) {
    issues.push(issue('noteAffinity', 'overlap', 'یک نت نمی‌تواند هم‌زمان در هر دو فهرست باشد.'));
  }
  if (status === 'skipped' && (liked.length || avoided.length)) {
    issues.push(issue('noteAffinityStatus', 'skip-has-selections', 'برای رد این مرحله، انتخاب‌های نت را پاک کنید.'));
  }
  if (status === 'selected' && liked.length + avoided.length === 0) {
    issues.push(issue('noteAffinityStatus', 'explicit-skip-required', 'یک نت انتخاب کنید یا گزینهٔ رد این مرحله را بزنید.'));
  }
  const noteMap = new Map(notes.map(note => [note.id.toLowerCase(), note]));
  if (avoided.every(isUuid) && avoided.some(id => !noteMap.has(id.toLowerCase()))) {
    issues.push(issue('avoidedNoteIds', 'stale-avoided-note', 'یکی از نت‌های کنارگذاشته‌شده دیگر در کاتالوگ نیست؛ انتخاب‌ها را بازبینی کنید.'));
  }
  if (liked.every(isUuid)) {
    for (const id of liked) {
      if (!noteMap.has(id.toLowerCase())) notices.push('یکی از نت‌هایی که پسندیده بودید دیگر در کاتالوگ نیست و از پیشنهاد کنار گذاشته شد.');
    }
  }
  return issues.length
    ? result(undefined, issues, notices)
    : result({ status, likedNoteIds: liked as string[], avoidedNoteIds: avoided as string[] }, [], notices);
}

export function validateConceptName(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') return result(undefined, [issue('conceptName', 'invalid', 'نام مفهوم معتبر نیست.')]);
  const trimmed = value.trim();
  const name = trimmed || DEFAULT_CONCEPT_NAME;
  if ([...name].length > MAX_CONCEPT_NAME_LENGTH) {
    return result(undefined, [issue('conceptName', 'too-long', `نام مفهوم باید حداکثر ${MAX_CONCEPT_NAME_LENGTH} نویسه باشد.`)]);
  }
  return result(name);
}

export function validateGuidedAnswers(
  input: GuidedAnswersDraft | unknown,
  families: readonly Family[],
  notes: readonly GuidedCatalogNote[],
): ValidationResult<GuidedAnswers> {
  if (!input || typeof input !== 'object') return result(undefined, [issue('answers', 'invalid', 'پاسخ‌ها کامل نیستند.')]);
  const value = input as Record<string, unknown>;
  const feeling = validateFeeling(value.feeling);
  const familyIds = validateFamilyIds(value.familyIds, families);
  const temperature = validateTemperature(value.temperature);
  const scene = validateScene(value.scene);
  const affinity = validateNoteAffinity(value.noteAffinityStatus, value.likedNoteIds, value.avoidedNoteIds, notes);
  const discovery = validateDiscovery(value.discovery);
  const checks = [feeling, familyIds, temperature, scene, affinity, discovery];
  const issues = checks.flatMap(check => check.issues);
  const notices = checks.flatMap(check => check.notices);
  if (issues.length || !feeling.value || !familyIds.value || !temperature.value || !scene.value || !affinity.value || !discovery.value) {
    return result(undefined, issues, notices);
  }
  return result({
    feeling: feeling.value,
    familyIds: [...familyIds.value],
    temperature: temperature.value,
    scene: scene.value,
    likedNoteIds: [...affinity.value.likedNoteIds],
    avoidedNoteIds: [...affinity.value.avoidedNoteIds],
    noteAffinityStatus: affinity.value.status,
    discovery: discovery.value,
  }, [], notices);
}
