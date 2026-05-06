import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';

export interface LinkedIdentity {
  provider: string;
  providerEmail: string | null;
  linkedAt: Date;
}

export async function findIdentity(
  provider: string,
  providerUserId: string
): Promise<{ userId: string } | null> {
  const rows = await db
    .select({ userId: schema.userIdentities.userId })
    .from(schema.userIdentities)
    .where(
      and(
        eq(schema.userIdentities.provider, provider),
        eq(schema.userIdentities.providerUserId, providerUserId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function linkIdentity(
  userId: string,
  provider: string,
  providerUserId: string,
  providerEmail: string | null
): Promise<void> {
  const id = randomBytes(16).toString('hex');
  const now = new Date();

  await db.insert(schema.userIdentities).values({
    id,
    userId,
    provider,
    providerUserId,
    providerEmail,
    linkedAt: now
  });
}

export async function unlinkIdentity(userId: string, provider: string): Promise<void> {
  await db.delete(schema.userIdentities)
    .where(
      and(
        eq(schema.userIdentities.userId, userId),
        eq(schema.userIdentities.provider, provider)
      )
    );
}

export async function getLinkedIdentities(userId: string): Promise<LinkedIdentity[]> {
  return db
    .select({
      provider: schema.userIdentities.provider,
      providerEmail: schema.userIdentities.providerEmail,
      linkedAt: schema.userIdentities.linkedAt
    })
    .from(schema.userIdentities)
    .where(eq(schema.userIdentities.userId, userId));
}
