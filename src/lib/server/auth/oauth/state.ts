import { randomBytes } from 'crypto';
import { generateCodeVerifier, generateState } from 'arctic';
import { eq, lt } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthStateRow {
  id: string;
  state: string;
  codeVerifier: string;
  provider: string;
  intent: 'login' | 'link';
  actorUserId: string | null;
  expiresAt: Date;
}

export async function createOAuthState(
  provider: string,
  intent: 'login' | 'link',
  actorUserId?: string
): Promise<{ state: string; codeVerifier: string }> {
  const id = randomBytes(16).toString('hex');
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  await db.insert(schema.oauthStates).values({
    id,
    state,
    codeVerifier,
    provider,
    intent,
    actorUserId: actorUserId ?? null,
    expiresAt,
    consumedAt: null
  });

  return { state, codeVerifier };
}

export async function consumeOAuthState(state: string): Promise<OAuthStateRow | null> {
  const rows = await db
    .select()
    .from(schema.oauthStates)
    .where(eq(schema.oauthStates.state, state))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.consumedAt !== null) return null; // already consumed
  if (row.expiresAt.getTime() < Date.now()) return null; // expired

  await db.update(schema.oauthStates)
    .set({ consumedAt: new Date() })
    .where(eq(schema.oauthStates.id, row.id));

  return {
    id: row.id,
    state: row.state,
    codeVerifier: row.codeVerifier,
    provider: row.provider,
    intent: row.intent as 'login' | 'link',
    actorUserId: row.actorUserId,
    expiresAt: row.expiresAt
  };
}

export async function reapExpiredOAuthStates(): Promise<void> {
  await db.delete(schema.oauthStates)
    .where(lt(schema.oauthStates.expiresAt, new Date()));
}
