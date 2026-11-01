#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

/** Pure decision rehearsal. This does not access releases, backups, infrastructure, or networks. */
export function chooseRecovery({ trigger, schemaCompatible, approvedBackupAvailable }) {
  if (!trigger) return 'STOP_NO_TRIGGER';
  if (schemaCompatible) return 'OPERATOR_CODE_ROLLBACK';
  if (approvedBackupAvailable) return 'OWNER_DECISION_RESTORE';
  return 'STOP_NO_APPROVED_RECOVERY';
}

export function rehearse() {
  const cases = [
    [{ trigger: false, schemaCompatible: true, approvedBackupAvailable: true }, 'STOP_NO_TRIGGER'],
    [{ trigger: true, schemaCompatible: true, approvedBackupAvailable: false }, 'OPERATOR_CODE_ROLLBACK'],
    [{ trigger: true, schemaCompatible: false, approvedBackupAvailable: true }, 'OWNER_DECISION_RESTORE'],
    [{ trigger: true, schemaCompatible: false, approvedBackupAvailable: false }, 'STOP_NO_APPROVED_RECOVERY'],
  ];
  for (const [input, expected] of cases) assert.equal(chooseRecovery(input), expected);
  return cases.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = rehearse();
  console.log(`PASS offline rollback decision rehearsal: ${count} deterministic branches; no live release or backup was changed.`);
}
