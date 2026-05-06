import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';

const DEFAULT_RECOVERY_CODE_COUNT = 10;

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function createRecoveryCodeValue(): string {
  const left = randomBytes(2).toString('hex').toUpperCase();
  const right = randomBytes(2).toString('hex').toUpperCase();
  return `${left}-${right}`;
}

export function generateRecoveryCodes(count = DEFAULT_RECOVERY_CODE_COUNT): string[] {
  const out = new Set<string>();
  while (out.size < count) {
    out.add(createRecoveryCodeValue());
  }
  return [...out];
}

export function replaceRecoveryCodesForUser(userId: string, count = DEFAULT_RECOVERY_CODE_COUNT): string[] {
  const codes = generateRecoveryCodes(count);

  db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId)).run();

  if (codes.length === 0) return codes;

  db.insert(schema.mfaRecoveryCodes)
    .values(
      codes.map((code) => ({
        id: nanoid(),
        userId,
        codeHash: hashRecoveryCode(code)
      }))
    )
    .run();

  return codes;
}

export function hasActiveRecoveryCodes(userId: string): boolean {
  const row = db
    .select({ id: schema.mfaRecoveryCodes.id })
    .from(schema.mfaRecoveryCodes)
    .where(
      and(
        eq(schema.mfaRecoveryCodes.userId, userId),
        isNull(schema.mfaRecoveryCodes.usedAt)
      )
    )
    .get();

  return Boolean(row);
}

export function consumeRecoveryCode(userId: string, code: string): boolean {
  const codeHash = hashRecoveryCode(code);

  const row = db
    .select({ id: schema.mfaRecoveryCodes.id, codeHash: schema.mfaRecoveryCodes.codeHash })
    .from(schema.mfaRecoveryCodes)
    .where(
      and(
        eq(schema.mfaRecoveryCodes.userId, userId),
        eq(schema.mfaRecoveryCodes.codeHash, codeHash),
        isNull(schema.mfaRecoveryCodes.usedAt)
      )
    )
    .get();

  if (!row) return false;

  const expected = Buffer.from(codeHash, 'hex');
  const actual = Buffer.from(row.codeHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  db.update(schema.mfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(schema.mfaRecoveryCodes.id, row.id))
    .run();

  return true;
}
