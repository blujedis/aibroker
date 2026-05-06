import { randomBytes } from 'crypto';
import { generateCodeVerifier, generateState } from 'arctic';
import { eq, lt } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';

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

export function createOAuthState(
  provider: string,
  intent: 'login' | 'link',
  actorUserId?: string
): { state: string; codeVerifier: string } {
  const id = randomBytes(16).toString('hex');
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  db.insert(schema.oauthStates)
    .values({
      id,
      state,
      codeVerifier,
      provider,
      intent,
      actorUserId: actorUserId ?? null,
      expiresAt,
      consumedAt: null
    })
    .run();

  return { state, codeVerifier };
}

export function consumeOAuthState(state: string): OAuthStateRow | null {
  const row = db
    .select()
    .from(schema.oauthStates)
    .where(eq(schema.oauthStates.state, state))
    .get();

  if (!row) return null;
  if (row.consumedAt !== null) return null; // already consumed
  if (row.expiresAt.getTime() < Date.now()) return null; // expired

  db.update(schema.oauthStates)
    .set({ consumedAt: new Date() })
    .where(eq(schema.oauthStates.id, row.id))
    .run();

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

export function reapExpiredOAuthStates(): void {
  db.delete(schema.oauthStates)
    .where(lt(schema.oauthStates.expiresAt, new Date()))
    .run();
}
