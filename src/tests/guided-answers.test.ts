import { describe, expect, it } from 'vitest';
import {
  validateConceptName,
  validateDiscovery,
  validateFamilyIds,
  validateFeeling,
  validateGuidedAnswers,
  validateNoteAffinity,
  validateScene,
  validateTemperature,
} from '@/lib/studio/guided/answers';
import { answer, seedFamilies, seedNotes, uuid } from './guided-fixtures';

describe('Guided answer validation', () => {
  it.each(['calm', 'bright', 'confident', 'intimate', 'curious'])('accepts feeling %s', value => {
    expect(validateFeeling(value).valid).toBe(true);
  });
  it.each(['bright', 'soft', 'warm'])('accepts temperature %s', value => expect(validateTemperature(value).valid).toBe(true));
  it.each(['rainGarden', 'citrusMorning', 'quietFlowers', 'woodland', 'warmEvening', 'coffeePause'])('accepts scene %s', value => expect(validateScene(value).valid).toBe(true));
  it.each(['familiar', 'balanced', 'exploratory'])('accepts discovery %s', value => expect(validateDiscovery(value).valid).toBe(true));
  it('rejects unsupported enum values and missing required steps', () => {
    expect(validateFeeling('happy').valid).toBe(false);
    const checked = validateGuidedAnswers({}, seedFamilies, seedNotes);
    expect(checked.valid).toBe(false);
    expect(checked.issues.map(item => item.field)).toEqual(expect.arrayContaining(['feeling', 'familyIds', 'temperature', 'scene', 'noteAffinityStatus', 'discovery']));
  });
  it('requires one or two unique currently available family UUIDs in original order', () => {
    expect(validateFamilyIds([uuid(3), uuid(1)], seedFamilies).value).toEqual([uuid(3), uuid(1)]);
    expect(validateFamilyIds([], seedFamilies).valid).toBe(false);
    expect(validateFamilyIds([uuid(1), uuid(2), uuid(3)], seedFamilies).valid).toBe(false);
    expect(validateFamilyIds([uuid(1), uuid(1)], seedFamilies).valid).toBe(false);
    expect(validateFamilyIds([uuid(90)], seedFamilies).issues[0]?.code).toBe('stale-family');
  });
  it('limits like/avoid groups, rejects duplicates and overlap, and requires an explicit skip', () => {
    const ids = seedNotes.slice(0, 4).map(note => note.id);
    expect(validateNoteAffinity('selected', ids.slice(0, 3), [], seedNotes).valid).toBe(true);
    expect(validateNoteAffinity('selected', ids, [], seedNotes).valid).toBe(false);
    expect(validateNoteAffinity('selected', [ids[0], ids[0]], [], seedNotes).valid).toBe(false);
    expect(validateNoteAffinity('selected', [ids[0]], [ids[0]], seedNotes).issues[0]?.code).toBe('overlap');
    expect(validateNoteAffinity(undefined, [], [], seedNotes).valid).toBe(false);
    expect(validateNoteAffinity('skipped', [], [], seedNotes).value?.status).toBe('skipped');
    expect(validateNoteAffinity('selected', [], [], seedNotes).valid).toBe(false);
    expect(validateNoteAffinity('skipped', [ids[0]], [], seedNotes).valid).toBe(false);
  });
  it('rejects a stale avoided note but reports a missing formerly liked note without invalidating answers', () => {
    const missing = uuid(999);
    const liked = validateNoteAffinity('selected', [missing], [], seedNotes);
    expect(liked.valid).toBe(true);
    expect(liked.notices).toHaveLength(1);
    expect(validateNoteAffinity('selected', [], [missing], seedNotes).valid).toBe(false);
  });
  it('normalizes blank names to the approved default, trims names, and enforces 60 characters', () => {
    expect(validateConceptName('  ').value).toBe('رایحهٔ من');
    expect(validateConceptName('  باغ من  ').value).toBe('باغ من');
    expect(validateConceptName('ا'.repeat(60)).valid).toBe(true);
    expect(validateConceptName('ا'.repeat(61)).valid).toBe(false);
  });
  it('validates a complete answer object while retaining selected family order and skip status', () => {
    const checked = validateGuidedAnswers(answer({ familyIds: [uuid(3), uuid(1)] }), seedFamilies, seedNotes);
    expect(checked.valid).toBe(true);
    expect(checked.value?.familyIds).toEqual([uuid(3), uuid(1)]);
    expect(checked.value?.noteAffinityStatus).toBe('skipped');
  });
});
