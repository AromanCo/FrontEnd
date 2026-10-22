import type { Family } from '@/lib/api/client';
import { ANSWER_PERSIAN_COPY, GUIDED_RECOMMENDATION_CONFIG, type EditorialConfig } from './config';
import { isUuid } from './answers';
import { validateGuidedAnswers } from './answers';
import type {
  FamilyScore,
  GuidedAnswers,
  GuidedCatalogNote,
  GuidedSelection,
  RecommendationInvalidReason,
  RecommendationResult,
  ValidationIssue,
} from './types';

const idKey = (id: string) => id.toLowerCase();
const stableCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const slugCompare = (left: string, right: string): number => stableCompare(left.normalize('NFC'), right.normalize('NFC'));

type FamilyMaps = Readonly<{
  byId: Map<string, Family>;
  scoreById: Map<string, FamilyScore>;
  tapOrder: Map<string, number>;
}>;

function invalid(reason: RecommendationInvalidReason, issues: readonly ValidationIssue[], notices: readonly string[] = []): RecommendationResult {
  return { status: 'invalid', reason, issues, notices, explanation: ['پاسخ‌ها یا اطلاعات کاتالوگ معتبر نیستند؛ لطفاً انتخاب‌ها را بازبینی کنید.'] };
}

function catalogIssues(families: readonly Family[], notes: readonly GuidedCatalogNote[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const familyIds = new Set<string>();
  for (const family of families) {
    const key = idKey(family.id);
    if (!family.id || familyIds.has(key)) issues.push({ field: 'families', code: 'duplicate-or-empty-id', message: 'شناسهٔ خانواده‌های کاتالوگ یکتا نیست.' });
    familyIds.add(key);
  }
  const noteIds = new Set<string>();
  for (const note of notes) {
    const key = idKey(note.id);
    if (!note.id || noteIds.has(key)) issues.push({ field: 'notes', code: 'duplicate-or-empty-id', message: 'شناسهٔ نت‌های کاتالوگ یکتا نیست.' });
    noteIds.add(key);
    if (note.family_id !== null && !isUuid(note.family_id)) {
      issues.push({ field: 'notes', code: 'invalid-family-reference', message: 'شناسهٔ خانوادهٔ یکی از نت‌های کاتالوگ معتبر نیست.' });
    }
  }
  return issues;
}

export function scoreFamilies(
  answers: GuidedAnswers,
  families: readonly Family[],
  config: EditorialConfig = GUIDED_RECOMMENDATION_CONFIG,
): readonly FamilyScore[] {
  const selectedIds = new Set(answers.familyIds.map(idKey));
  return families.map(family => {
    const selected = selectedIds.has(idKey(family.id)) ? config.selectedFamilyWeight : 0;
    const feeling = config.feeling[answers.feeling][family.slug] ?? 0;
    const temperature = config.temperature[answers.temperature][family.slug] ?? 0;
    const scene = config.scene[answers.scene][family.slug] ?? 0;
    const isOutside = !selectedIds.has(idKey(family.id));
    const discovery = isOutside ? config.discovery[answers.discovery] : 0;
    return {
      familyId: family.id,
      slug: family.slug,
      name: family.name,
      score: selected + feeling + temperature + scene + discovery,
      contributions: { selected, feeling, temperature, scene, discovery },
    };
  }).sort((a, b) => slugCompare(a.slug, b.slug) || stableCompare(idKey(a.familyId), idKey(b.familyId)));
}

function familyMaps(families: readonly Family[], scores: readonly FamilyScore[], answers: GuidedAnswers): FamilyMaps {
  return {
    byId: new Map(families.map(family => [idKey(family.id), family])),
    scoreById: new Map(scores.map(score => [idKey(score.familyId), score])),
    tapOrder: new Map(answers.familyIds.map((id, index) => [idKey(id), index])),
  };
}

function noteOrder(a: GuidedCatalogNote, b: GuidedCatalogNote): number {
  return slugCompare(a.slug, b.slug) || stableCompare(idKey(a.id), idKey(b.id));
}

function knownFamilyId(note: GuidedCatalogNote, maps: FamilyMaps): string | null {
  return note.family_id && maps.byId.has(idKey(note.family_id)) ? idKey(note.family_id) : null;
}

function addSelection(
  note: GuidedCatalogNote,
  output: GuidedSelection[],
  counts: Map<string, number>,
  config: EditorialConfig,
): void {
  const sequenceIndex = output.length;
  const layer = config.layerSequence[sequenceIndex];
  if (!layer) return;
  const position = output.filter(item => item.layer === layer).length;
  output.push({ note, layer, position });
  if (note.family_id) {
    const key = idKey(note.family_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}

type RankedBucket = Readonly<{ familyId: string; family: Family; notes: readonly GuidedCatalogNote[] }>;

function rankBuckets(
  familyIds: readonly string[],
  notes: readonly GuidedCatalogNote[],
  maps: FamilyMaps,
): RankedBucket[] {
  const buckets = familyIds.flatMap(id => {
    const key = idKey(id);
    const family = maps.byId.get(key);
    if (!family) return [];
    const bucketNotes = notes.filter(note => note.family_id && idKey(note.family_id) === key).slice().sort(noteOrder);
    return bucketNotes.length ? [{ familyId: key, family, notes: bucketNotes }] : [];
  });
  return buckets.sort((a, b) => {
    const aScore = maps.scoreById.get(a.familyId)?.score ?? 0;
    const bScore = maps.scoreById.get(b.familyId)?.score ?? 0;
    const tapDifference = (maps.tapOrder.get(a.familyId) ?? Number.MAX_SAFE_INTEGER) - (maps.tapOrder.get(b.familyId) ?? Number.MAX_SAFE_INTEGER);
    return bScore - aScore || tapDifference || slugCompare(a.family.slug, b.family.slug) || stableCompare(a.familyId, b.familyId);
  });
}

/** Round-robin family buckets with a two-note family cap, relaxed only if a sweep cannot progress. */
function fillRoundRobin(
  buckets: readonly RankedBucket[],
  output: GuidedSelection[],
  counts: Map<string, number>,
  target: number,
  config: EditorialConfig,
): void {
  const cursors = buckets.map(() => 0);
  let capped = true;
  while (output.length < target) {
    let progressed = false;
    for (let index = 0; index < buckets.length && output.length < target; index++) {
      const bucket = buckets[index];
      const note = bucket.notes[cursors[index]];
      if (!note) continue;
      if (capped && (counts.get(bucket.familyId) ?? 0) >= config.familyCapPerSweep) continue;
      cursors[index]++;
      addSelection(note, output, counts, config);
      progressed = true;
    }
    if (!progressed) {
      if (capped && buckets.some((bucket, index) => cursors[index] < bucket.notes.length)) {
        capped = false;
        continue;
      }
      break;
    }
  }
}

function unresolvedNotes(notes: readonly GuidedCatalogNote[], maps: FamilyMaps): GuidedCatalogNote[] {
  const unresolved = notes.filter(note => !note.family_id || !maps.byId.has(idKey(note.family_id)));
  const nullNotes = unresolved.filter(note => note.family_id === null).sort(noteOrder);
  const unknownIds = [...new Set(unresolved.flatMap(note => note.family_id ? [note.family_id] : []))].sort(stableCompare);
  const ordered = [...nullNotes];
  for (const familyId of unknownIds) {
    ordered.push(...unresolved.filter(note => note.family_id === familyId).slice().sort(noteOrder));
  }
  return ordered;
}

function layerSelections(notes: readonly GuidedCatalogNote[], config: EditorialConfig): GuidedSelection[] {
  const selected: GuidedSelection[] = [];
  const counts = new Map<string, number>();
  for (const note of notes) addSelection(note, selected, counts, config);
  return selected;
}

function explanationFor(
  answers: GuidedAnswers,
  selections: readonly GuidedSelection[],
  liked: readonly GuidedCatalogNote[],
  avoided: readonly GuidedCatalogNote[],
  maps: FamilyMaps,
  reservedId: string | undefined,
  balancedFallback: boolean,
  exploratoryUnavailable: boolean,
  missingLiked: number,
): string[] {
  const clauses: string[] = [];
  const selectedNoteIds = new Set(selections.map(selection => idKey(selection.note.id)));
  const selectedFamilyKeys = new Set(selections.flatMap(selection => {
    const familyKey = knownFamilyId(selection.note, maps);
    return familyKey ? [familyKey] : [];
  }));
  const preferenceFamilyKeys = new Set(selections.flatMap(selection => {
    const familyKey = knownFamilyId(selection.note, maps);
    if (!familyKey) return [];
    const score = maps.scoreById.get(familyKey);
    return score && (score.contributions.feeling > 0 || score.contributions.temperature > 0 || score.contributions.scene > 0) ? [familyKey] : [];
  }));
  const chosenFamilies = answers.familyIds
    .map(idKey)
    .filter((id, index, ids) => selectedFamilyKeys.has(id) && ids.indexOf(id) === index)
    .map(id => maps.byId.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  if (chosenFamilies.length) clauses.push(`با توجه به علاقه‌تان به ${chosenFamilies.length > 1 ? 'خانواده‌های' : 'خانوادهٔ'} ${chosenFamilies.join(' و ')}`);

  const preferenceClauses: string[] = [];
  const preferenceValues = [...preferenceFamilyKeys].map(id => maps.scoreById.get(id)).filter((value): value is FamilyScore => Boolean(value));
  if (preferenceValues.some(score => score.contributions.feeling > 0)) preferenceClauses.push(ANSWER_PERSIAN_COPY.feeling[answers.feeling]);
  if (preferenceValues.some(score => score.contributions.temperature > 0)) preferenceClauses.push(ANSWER_PERSIAN_COPY.temperature[answers.temperature]);
  if (preferenceValues.some(score => score.contributions.scene > 0)) preferenceClauses.push(ANSWER_PERSIAN_COPY.scene[answers.scene]);
  if (preferenceClauses.length) clauses.push(`و ${preferenceClauses.join(' و ')} که انتخاب کردید`);

  const includedLikes = liked.filter(note => selectedNoteIds.has(idKey(note.id)));
  if (includedLikes.length) clauses.push(`${includedLikes.map(note => note.name).join('، ')} را که خودتان پسندیدید در پیشنهاد حفظ کردیم`);
  if (avoided.length) clauses.push(`نت‌های ${avoided.map(note => note.name).join('، ')} را که ترجیح دادید کنار گذاشتیم`);

  if (reservedId) {
    const reserved = selections.find(selection => idKey(selection.note.id) === idKey(reservedId));
    const family = reserved?.note.family_id ? maps.byId.get(idKey(reserved.note.family_id)) : undefined;
    if (family) clauses.push(`برای کمی کشف بیشتر، نتی از خانوادهٔ ${family.name} هم در پیشنهاد آمده است`);
  }
  if (balancedFallback) clauses.push('با توجه به محدودیت نت‌های خانواده‌های انتخابی، از نت‌های موجود در کاتالوگ هم کمک گرفتیم');
  if (exploratoryUnavailable) clauses.push('در کاتالوگ فعلی نتِ دیگری از خانواده‌های متفاوت برای گسترش پیشنهاد پیدا نشد');
  if (selections.some(selection => !knownFamilyId(selection.note, maps))) clauses.push('اطلاعات خانوادهٔ برخی نت‌های کاتالوگ در دسترس نبود؛ می‌توانید پیشنهاد را بازبینی کنید');
  if (missingLiked) clauses.push('یکی از نت‌هایی که پسندیده بودید دیگر در کاتالوگ نیست و از پیشنهاد کنار گذاشته شد');

  if (!clauses.length) clauses.push('این پیشنهاد بر پایهٔ نت‌های موجود در کاتالوگ شکل گرفته است');
  clauses.push('این یک پیشنهاد مفهومی است، نه فرمول ساخت عطر');
  return clauses.map(clause => `«${clause}»`);
}

export function recommend(
  input: GuidedAnswers | unknown,
  families: readonly Family[],
  notes: readonly GuidedCatalogNote[],
  config: EditorialConfig = GUIDED_RECOMMENDATION_CONFIG,
): RecommendationResult {
  const validated = validateGuidedAnswers(input, families, notes);
  if (!validated.valid || !validated.value) {
    const first = validated.issues[0]?.code;
    const reason: RecommendationInvalidReason = first === 'stale-family' ? 'missing-family' : first === 'overlap' ? 'conflicting-note-choice' : 'invalid-answers';
    return invalid(reason, validated.issues, validated.notices);
  }
  const answers = validated.value;
  const dataIssues = catalogIssues(families, notes);
  if (dataIssues.length) return invalid('invalid-catalog', dataIssues, validated.notices);

  const familyIds = new Set(families.map(family => idKey(family.id)));
  if (answers.familyIds.some(id => !familyIds.has(idKey(id)))) {
    return invalid('missing-family', [{ field: 'familyIds', code: 'stale-family', message: 'یکی از خانواده‌های انتخابی دیگر در کاتالوگ در دسترس نیست.' }], validated.notices);
  }

  const familyScores = scoreFamilies(answers, families, config);
  const maps = familyMaps(families, familyScores, answers);
  const noteById = new Map(notes.map(note => [idKey(note.id), note]));
  const liked = answers.likedNoteIds.flatMap(id => {
    const note = noteById.get(idKey(id));
    return note ? [note] : [];
  });
  const avoided = answers.avoidedNoteIds.flatMap(id => {
    const note = noteById.get(idKey(id));
    return note ? [note] : [];
  });
  const avoidedIds = new Set(answers.avoidedNoteIds.map(idKey));
  const likedIds = new Set(liked.map(note => idKey(note.id)));
  const selectedFamilyIds = new Set(answers.familyIds.map(idKey));
  const scopeNotes = notes.filter(note => {
    if (avoidedIds.has(idKey(note.id))) return false;
    if (answers.discovery !== 'familiar') return true;
    return Boolean(note.family_id && selectedFamilyIds.has(idKey(note.family_id)) && familyIds.has(idKey(note.family_id)));
  });
  const scopeIds = new Set(scopeNotes.map(note => idKey(note.id)));
  const eligible = notes.filter(note => !avoidedIds.has(idKey(note.id)) && (scopeIds.has(idKey(note.id)) || likedIds.has(idKey(note.id))));
  const target = Math.min(config.target, 4, config.layerSequence.length, eligible.length);
  if (!target) {
    const reason = notes.length === 0
      ? 'no-notes'
      : notes.every(note => avoidedIds.has(idKey(note.id)))
        ? 'all-excluded'
        : answers.discovery === 'familiar' ? 'familiar-scope-empty' : 'no-candidates';
    const notices = [...validated.notices];
    const explanation = [reason === 'no-notes'
      ? 'در کاتالوگ فعلی نتی برای پیشنهاد در دسترس نیست.'
      : reason === 'all-excluded'
        ? 'همهٔ نت‌های موجود کنار گذاشته شده‌اند؛ پاسخ‌ها را بازبینی کنید.'
        : 'با این ترکیب از انتخاب‌ها، نتی در کاتالوگ فعلی برای پیشنهاد پیدا نشد.'];
    return { status: 'no-match', reason, explanation, notices, familyScores };
  }

  const output: GuidedSelection[] = [];
  const counts = new Map<string, number>();
  for (const note of liked) if (!avoidedIds.has(idKey(note.id)) && output.length < target) addSelection(note, output, counts, config);
  let exploratoryReservedNoteId: string | undefined;
  let exploratoryAlreadySatisfied = liked.some(note => {
    const familyId = knownFamilyId(note, maps);
    return familyId !== null && !selectedFamilyIds.has(familyId);
  });
  const knownOutsideEligible = eligible.filter(note => {
    const familyId = knownFamilyId(note, maps);
    return familyId !== null && !selectedFamilyIds.has(familyId);
  });

  if (answers.discovery === 'exploratory' && !exploratoryAlreadySatisfied && output.length < target && knownOutsideEligible.length) {
    const ranked = knownOutsideEligible.slice().sort((a, b) => {
      const af = knownFamilyId(a, maps)!;
      const bf = knownFamilyId(b, maps)!;
      const scoreDifference = (maps.scoreById.get(bf)?.score ?? 0) - (maps.scoreById.get(af)?.score ?? 0);
      const familyDifference = slugCompare(maps.byId.get(af)!.slug, maps.byId.get(bf)!.slug);
      return scoreDifference || familyDifference || noteOrder(a, b);
    });
    const note = ranked.find(candidate => !output.some(item => idKey(item.note.id) === idKey(candidate.id)));
    if (note) {
      addSelection(note, output, counts, config);
      exploratoryReservedNoteId = note.id;
      exploratoryAlreadySatisfied = true;
    }
  }

  const knownNonAvoided = eligible.filter(note => !output.some(item => idKey(item.note.id) === idKey(note.id)) && knownFamilyId(note, maps));
  const selectedBuckets = rankBuckets(answers.familyIds, knownNonAvoided, maps);
  fillRoundRobin(selectedBuckets, output, counts, target, config);

  let usedBalancedFallback = false;
  if (answers.discovery !== 'familiar' && output.length < target) {
    const outsideIds = [...maps.byId.keys()].filter(id => !selectedFamilyIds.has(id));
    const outsideNotes = knownNonAvoided.filter(note => {
      const id = knownFamilyId(note, maps);
      return id !== null && !selectedFamilyIds.has(id);
    });
    const outsideBuckets = rankBuckets(outsideIds, outsideNotes, maps).sort((a, b) => {
      const difference = (maps.scoreById.get(b.familyId)?.score ?? 0) - (maps.scoreById.get(a.familyId)?.score ?? 0);
      return difference || slugCompare(a.family.slug, b.family.slug) || stableCompare(a.familyId, b.familyId);
    });
    const previous = output.length;
    fillRoundRobin(outsideBuckets, output, counts, target, config);
    if (output.length > previous && answers.discovery === 'balanced') {
      usedBalancedFallback = output.slice(previous).some(selection => {
        const id = knownFamilyId(selection.note, maps);
        return id !== null && !selectedFamilyIds.has(id) && !likedIds.has(idKey(selection.note.id));
      });
    }
  }

  if (answers.discovery !== 'familiar' && output.length < target) {
    const chosen = new Set(output.map(item => idKey(item.note.id)));
    for (const note of unresolvedNotes(eligible, maps)) {
      if (output.length >= target) break;
      if (chosen.has(idKey(note.id))) continue;
      addSelection(note, output, counts, config);
      chosen.add(idKey(note.id));
    }
  }

  if (!output.length) {
    return { status: 'no-match', reason: 'no-candidates', explanation: ['با این ترکیب از انتخاب‌ها، نتی در کاتالوگ فعلی برای پیشنهاد پیدا نشد.'], notices: validated.notices, familyScores };
  }
  const selections = layerSelections(output.map(item => item.note), config);
  const exploratoryUnavailable = answers.discovery === 'exploratory' && !exploratoryAlreadySatisfied && knownOutsideEligible.length === 0;
  const missingLikedCount = answers.likedNoteIds.filter(id => !noteById.has(idKey(id))).length;
  const explanation = explanationFor(answers, selections, liked, avoided, maps, exploratoryReservedNoteId, usedBalancedFallback, exploratoryUnavailable, missingLikedCount);
  return {
    status: 'ready',
    selections,
    explanation,
    notices: [...validated.notices],
    familyScores,
    ...(exploratoryReservedNoteId ? { exploratoryReservedNoteId } : {}),
    usedBalancedFallback,
  };
}
