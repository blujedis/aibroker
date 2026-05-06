import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';

export interface LinkedIdentity {
  provider: string;
  providerEmail: string | null;
  linkedAt: Date;
}

export function findIdentity(
  provider: string,
  providerUserId: string
): { userId: string } | null {
  const row = db
    .select({ userId: schema.userIdentities.userId })
    .from(schema.userIdentities)
    .where(
      and(
        eq(schema.userIdentities.provider, provider),
        eq(schema.userIdentities.providerUserId, providerUserId)
      )
    )
    .get();

  return row ?? null;
}

export function linkIdentity(
  userId: string,
  provider: string,
  providerUserId: string,
  providerEmail: string | null
): void {
  const id = randomBytes(16).toString('hex');
  const now = new Date();

  db.insert(schema.userIdentities)
    .values({
      id,
      userId,
      provider,
      providerUserId,
      providerEmail,
      linkedAt: now
    })
    .run();
}

export function unlinkIdentity(userId: string, provider: string): void {
  db.delete(schema.userIdentities)
    .where(
      and(
        eq(schema.userIdentities.userId, userId),
        eq(schema.userIdentities.provider, provider)
      )
    )
    .run();
}

export function getLinkedIdentities(userId: string): LinkedIdentity[] {
  return db
    .select({
      provider: schema.userIdentities.provider,
      providerEmail: schema.userIdentities.providerEmail,
      linkedAt: schema.userIdentities.linkedAt
    })
    .from(schema.userIdentities)
    .where(eq(schema.userIdentities.userId, userId))
    .all();
}
