import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';

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

export async function replaceRecoveryCodesForUser(userId: string, count = DEFAULT_RECOVERY_CODE_COUNT): Promise<string[]> {
  const codes = generateRecoveryCodes(count);

  await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));

  if (codes.length === 0) return codes;

  await db.insert(schema.mfaRecoveryCodes).values(
    codes.map((code) => ({
      id: nanoid(),
      userId,
      codeHash: hashRecoveryCode(code)
    }))
  );

  return codes;
}

export async function hasActiveRecoveryCodes(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.mfaRecoveryCodes.id })
    .from(schema.mfaRecoveryCodes)
    .where(
      and(
        eq(schema.mfaRecoveryCodes.userId, userId),
        isNull(schema.mfaRecoveryCodes.usedAt)
      )
    )
    .limit(1);

  return rows.length > 0;
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashRecoveryCode(code);

  const rows = await db
    .select({ id: schema.mfaRecoveryCodes.id, codeHash: schema.mfaRecoveryCodes.codeHash })
    .from(schema.mfaRecoveryCodes)
    .where(
      and(
        eq(schema.mfaRecoveryCodes.userId, userId),
        eq(schema.mfaRecoveryCodes.codeHash, codeHash),
        isNull(schema.mfaRecoveryCodes.usedAt)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  const expected = Buffer.from(codeHash, 'hex');
  const actual = Buffer.from(row.codeHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  await db.update(schema.mfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(schema.mfaRecoveryCodes.id, row.id));

  return true;
}
