import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';

const DEFAULT_EXPIRY_HOURS = 1;

export function getPasswordResetExpiryHours(): number {
  const value = Number(process.env.PASSWORD_RESET_EXPIRY_HOURS ?? DEFAULT_EXPIRY_HOURS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXPIRY_HOURS;
}

export function createPasswordResetTokenValue(): string {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Store a reset token and return the raw (unhashed) value to email the user. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = createPasswordResetTokenValue();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(
    Date.now() + getPasswordResetExpiryHours() * 60 * 60 * 1000
  );

  await db.insert(schema.passwordResetTokens)
    .values({ id: nanoid(), userId, tokenHash, expiresAt });

  return rawToken;
}

/** Look up a token and return the userId if valid (exists, not expired, not used). */
export async function verifyPasswordResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashPasswordResetToken(rawToken);

  const rows = await db
    .select()
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.tokenHash, tokenHash),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Constant-time comparison as a defence-in-depth measure
  const expected = Buffer.from(tokenHash, 'hex');
  const actual = Buffer.from(row.tokenHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return row.userId;
}

/** Mark a token as used so it cannot be replayed. */
export async function consumePasswordResetToken(rawToken: string): Promise<void> {
  const tokenHash = hashPasswordResetToken(rawToken);
  await db.update(schema.passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResetTokens.tokenHash, tokenHash));
}
