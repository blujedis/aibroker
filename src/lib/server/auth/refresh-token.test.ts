import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nanoid } from 'nanoid';

/**
 * We mock $lib/server/db/index.js with a real in-memory SQLite database so
 * that session lifecycle functions run against a genuine (but isolated) DB.
 * The mock factory is hoisted by vitest before any static imports resolve,
 * which ensures that session.ts picks up the in-memory db when it is loaded.
 */
vi.mock('$lib/server/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schemaModule = await import('$lib/server/db/schema.js');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      is_superadmin INTEGER NOT NULL DEFAULT 0,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      mfa_enrolled_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      is_mfa_complete INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      is_mfa_complete INTEGER NOT NULL DEFAULT 1,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE oauth_states (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      provider TEXT NOT NULL,
      intent TEXT NOT NULL DEFAULT 'login',
      actor_user_id TEXT,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);

  return {
    db: drizzle(sqlite, { schema: schemaModule }),
    schema: schemaModule,
  };
});

// These imports resolve after the mock is registered — they receive the in-memory db.
import { db, schema } from '$lib/server/db/index.js';
import {
  createRefreshToken,
  createSession,
  reapExpiredSessions,
  resolveSessionWithRefresh,
  revokeRefreshToken,
} from './session.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'test-user-001';

function seedUser(overrides: { mfaEnabled?: boolean } = {}) {
  db.insert(schema.users)
    .values({
      id: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed',
      role: 'operator',
      isSuperadmin: false,
      mfaEnabled: overrides.mfaEnabled ?? false,
    })
    .run();
}

/**
 * Inserts a refresh token row with a past expiry date so we can test the
 * expired-token code path without waiting for the real TTL.
 */
function insertExpiredToken(userId: string): string {
  const raw = `expired-${nanoid(8)}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  db.insert(schema.refreshTokens)
    .values({
      id: nanoid(20),
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() - 5000),
      isMfaComplete: true,
    })
    .run();
  return raw;
}

beforeEach(() => {
  // Delete in dependency order to respect FK constraints.
  db.delete(schema.refreshTokens).run();
  db.delete(schema.sessions).run();
  db.delete(schema.users).run();
  seedUser();
});

// ---------------------------------------------------------------------------
// resolveSessionWithRefresh
// ---------------------------------------------------------------------------

describe('resolveSessionWithRefresh', () => {
  it('returns user from active session without touching refresh token', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });
    const sid = await createSession(TEST_USER_ID, { isMfaComplete: true });

    const result = await resolveSessionWithRefresh(sid, rawToken);

    expect(result.user?.id).toBe(TEST_USER_ID);
    expect(result.pendingUser).toBeNull();
    expect(result.sessionId).toBe(sid);
    expect(result.refreshed).toBe(false);
    expect(result.clearRefreshCookie).toBe(false);
  });

  it('silently re-authenticates (silent refresh) when session is absent', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });

    const result = await resolveSessionWithRefresh(null, rawToken);

    expect(result.user?.id).toBe(TEST_USER_ID);
    expect(result.pendingUser).toBeNull();
    expect(result.sessionId).not.toBeNull();
    expect(result.refreshed).toBe(true);
    expect(result.clearRefreshCookie).toBe(false);
  });

  it('preserves pending-MFA state on silent refresh', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: false });

    const result = await resolveSessionWithRefresh(null, rawToken);

    expect(result.user).toBeNull();
    expect(result.pendingUser?.id).toBe(TEST_USER_ID);
    expect(result.sessionId).not.toBeNull();
    expect(result.refreshed).toBe(true);
    expect(result.clearRefreshCookie).toBe(false);
  });

  it('returns no user and clears cookie when refresh token is expired', async () => {
    const rawToken = insertExpiredToken(TEST_USER_ID);

    const result = await resolveSessionWithRefresh(null, rawToken);

    expect(result.user).toBeNull();
    expect(result.pendingUser).toBeNull();
    expect(result.sessionId).toBeNull();
    expect(result.refreshed).toBe(false);
    expect(result.clearRefreshCookie).toBe(true);
  });

  it('returns no user and clears cookie when refresh token is revoked', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });
    await revokeRefreshToken(rawToken);

    const result = await resolveSessionWithRefresh(null, rawToken);

    expect(result.user).toBeNull();
    expect(result.pendingUser).toBeNull();
    expect(result.sessionId).toBeNull();
    expect(result.refreshed).toBe(false);
    expect(result.clearRefreshCookie).toBe(true);
  });

  it('returns no user and clears cookie for an unknown refresh token', async () => {
    const result = await resolveSessionWithRefresh(null, 'completely-unknown-token');

    expect(result.user).toBeNull();
    expect(result.sessionId).toBeNull();
    expect(result.clearRefreshCookie).toBe(true);
  });

  it('returns null session without touching DB when neither token is provided', async () => {
    const result = await resolveSessionWithRefresh(null, null);

    expect(result.user).toBeNull();
    expect(result.pendingUser).toBeNull();
    expect(result.sessionId).toBeNull();
    expect(result.refreshed).toBe(false);
    expect(result.clearRefreshCookie).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// revokeRefreshToken
// ---------------------------------------------------------------------------

describe('revokeRefreshToken', () => {
  it('marks the token row as revoked', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });

    const before = db
      .select({ revokedAt: schema.refreshTokens.revokedAt })
      .from(schema.refreshTokens)
      .all();
    expect(before[0].revokedAt).toBeNull();

    await revokeRefreshToken(rawToken);

    const after = db
      .select({ revokedAt: schema.refreshTokens.revokedAt })
      .from(schema.refreshTokens)
      .all();
    expect(after[0].revokedAt).not.toBeNull();
  });

  it('is idempotent — revoking an already-revoked token does not throw', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });
    await revokeRefreshToken(rawToken);
    await expect(revokeRefreshToken(rawToken)).resolves.toBeUndefined();
  });

  it('does not affect unrelated tokens', async () => {
    const rawA = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });
    const rawB = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });

    await revokeRefreshToken(rawA);

    const rows = db
      .select({ tokenHash: schema.refreshTokens.tokenHash, revokedAt: schema.refreshTokens.revokedAt })
      .from(schema.refreshTokens)
      .all();

    const hashA = createHash('sha256').update(rawA).digest('hex');
    const hashB = createHash('sha256').update(rawB).digest('hex');

    const rowA = rows.find((r) => r.tokenHash === hashA);
    const rowB = rows.find((r) => r.tokenHash === hashB);

    expect(rowA?.revokedAt).not.toBeNull();
    expect(rowB?.revokedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reapExpiredSessions
// ---------------------------------------------------------------------------

describe('reapExpiredSessions', () => {
  it('removes expired sessions', () => {
    // Insert an expired session directly.
    db.insert(schema.sessions)
      .values({
        id: 'expired-session-001',
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() - 5000),
        isMfaComplete: true,
      })
      .run();

    reapExpiredSessions();

    const rows = db.select().from(schema.sessions).all();
    expect(rows).toHaveLength(0);
  });

  it('removes expired refresh tokens', () => {
    insertExpiredToken(TEST_USER_ID);

    reapExpiredSessions();

    const rows = db.select().from(schema.refreshTokens).all();
    expect(rows).toHaveLength(0);
  });

  it('removes revoked refresh tokens even if they have not expired', async () => {
    const rawToken = createRefreshToken(TEST_USER_ID, { isMfaComplete: true });
    await revokeRefreshToken(rawToken);

    reapExpiredSessions();

    const rows = db.select().from(schema.refreshTokens).all();
    expect(rows).toHaveLength(0);
  });

  it('keeps valid sessions and non-revoked tokens', async () => {
    await createSession(TEST_USER_ID, { isMfaComplete: true });
    createRefreshToken(TEST_USER_ID, { isMfaComplete: true });

    reapExpiredSessions();

    const sessions = db.select().from(schema.sessions).all();
    const tokens = db.select().from(schema.refreshTokens).all();
    expect(sessions).toHaveLength(1);
    expect(tokens).toHaveLength(1);
  });

  it('removes expired while keeping valid in the same run', async () => {
    insertExpiredToken(TEST_USER_ID);
    createRefreshToken(TEST_USER_ID, { isMfaComplete: true });

    reapExpiredSessions();

    const rows = db.select().from(schema.refreshTokens).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
  });
});
