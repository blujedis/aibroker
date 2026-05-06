import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';

const DEFAULT_BREAK_GLASS_EXPIRY_MINUTES = 10;

export function getBreakGlassExpiryMinutes(): number {
  const value = Number(process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES ?? DEFAULT_BREAK_GLASS_EXPIRY_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BREAK_GLASS_EXPIRY_MINUTES;
}

export function createBreakGlassTokenValue(): string {
  return randomBytes(32).toString('hex');
}

export function hashBreakGlassToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createBreakGlassTokenForUser(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = createBreakGlassTokenValue();
  const tokenHash = hashBreakGlassToken(token);
  const expiresAt = new Date(Date.now() + getBreakGlassExpiryMinutes() * 60 * 1000);

  await db.delete(schema.mfaBreakGlassTokens)
    .where(
      or(
        eq(schema.mfaBreakGlassTokens.userId, userId),
        isNotNull(schema.mfaBreakGlassTokens.usedAt),
        lt(schema.mfaBreakGlassTokens.expiresAt, new Date()),
      )
    );

  await db.insert(schema.mfaBreakGlassTokens)
    .values({
      id: nanoid(),
      userId,
      tokenHash,
      expiresAt
    });

  return { token, expiresAt };
}

export async function verifyBreakGlassToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashBreakGlassToken(rawToken);
  const rows = await db
    .select({ userId: schema.mfaBreakGlassTokens.userId, tokenHash: schema.mfaBreakGlassTokens.tokenHash })
    .from(schema.mfaBreakGlassTokens)
    .where(
      and(
        eq(schema.mfaBreakGlassTokens.tokenHash, tokenHash),
        isNull(schema.mfaBreakGlassTokens.usedAt),
        gt(schema.mfaBreakGlassTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const expected = Buffer.from(tokenHash, 'hex');
  const actual = Buffer.from(row.tokenHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return row.userId;
}

export async function consumeBreakGlassToken(rawToken: string): Promise<void> {
  const tokenHash = hashBreakGlassToken(rawToken);
  await db.update(schema.mfaBreakGlassTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.mfaBreakGlassTokens.tokenHash, tokenHash));
}

export async function disableMfaForUser(userId: string): Promise<void> {
  await db.update(schema.users)
    .set({
      mfaEnabled: false,
      mfaSecret: null,
      mfaEnrolledAt: null,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, userId));

  await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, userId));
}
