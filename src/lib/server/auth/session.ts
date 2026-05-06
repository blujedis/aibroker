import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Cookies } from '@sveltejs/kit';
import { db, schema } from '../db/index.js';

export const SESSION_COOKIE = 'ab_session';
export const REFRESH_TOKEN_COOKIE = 'ab_refresh';
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const DEFAULT_REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL_ENV_VAR = 'SESSION_TTL';
const REFRESH_TOKEN_TTL_ENV_VAR = 'REFRESH_TOKEN_TTL';

const SESSION_TTL_UNITS = {
  m: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  years: 365 * 24 * 60 * 60 * 1000
} as const;

function parseTtlToMs(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(m|minute|minutes|h|hour|hours|d|day|days|y|year|years)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof SESSION_TTL_UNITS;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount * SESSION_TTL_UNITS[unit];
}

export function parseSessionTtlToMs(value: string): number | null {
  return parseTtlToMs(value);
}

export function parseRefreshTokenTtlToMs(value: string): number | null {
  return parseTtlToMs(value);
}

export function resolveSessionTtlMs(envValue: string | undefined): number {
  if (!envValue?.trim()) return DEFAULT_SESSION_TTL_MS;
  const parsed = parseSessionTtlToMs(envValue);
  if (parsed) return parsed;

  console.warn(
    `[auth/session] Invalid ${SESSION_TTL_ENV_VAR} value "${envValue}". Using default 30 days. ` +
    'Expected examples: 30m, 12h, 7d, 1y, 45 minutes.'
  );
  return DEFAULT_SESSION_TTL_MS;
}

export function resolveRefreshTokenTtlMs(envValue: string | undefined): number {
  if (!envValue?.trim()) return DEFAULT_REFRESH_TOKEN_TTL_MS;
  const parsed = parseRefreshTokenTtlToMs(envValue);
  if (parsed) return parsed;

  console.warn(
    `[auth/session] Invalid ${REFRESH_TOKEN_TTL_ENV_VAR} value "${envValue}". Using default 30 days. ` +
    'Expected examples: 30m, 12h, 7d, 1y, 45 minutes.'
  );
  return DEFAULT_REFRESH_TOKEN_TTL_MS;
}

const SESSION_TTL_MS = resolveSessionTtlMs(process.env[SESSION_TTL_ENV_VAR]);
const REFRESH_TOKEN_TTL_MS = resolveRefreshTokenTtlMs(process.env[REFRESH_TOKEN_TTL_ENV_VAR]);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  isSuperadmin: boolean;
  mfaEnabled: boolean;
}

export async function createSession(
  userId: string,
  options?: { isMfaComplete?: boolean }
): Promise<string> {
  const id = nanoid(40);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(schema.sessions)
    .values({ id, userId, expiresAt, isMfaComplete: options?.isMfaComplete ?? true })
    .run();
  return id;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createRefreshTokenValue(): string {
  return randomBytes(32).toString('hex');
}

export function createRefreshToken(
  userId: string,
  options?: { isMfaComplete?: boolean }
): string {
  const rawToken = createRefreshTokenValue();
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  db.insert(schema.refreshTokens)
    .values({
      id: nanoid(40),
      userId,
      tokenHash,
      expiresAt,
      isMfaComplete: options?.isMfaComplete ?? true
    })
    .run();

  return rawToken;
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  });
}

export function setRefreshTokenCookie(cookies: Cookies, refreshToken: string): void {
  cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(REFRESH_TOKEN_TTL_MS / 1000)
  });
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function clearRefreshTokenCookie(cookies: Cookies): void {
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
}

export async function resolveSession(
  sessionId: string | null
): Promise<{ user: SessionUser | null; pendingUser: SessionUser | null; sessionId: string | null }> {
  if (!sessionId) return { user: null, pendingUser: null, sessionId: null };

  const row = db
    .select({
      sid: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isSuperadmin: schema.users.isSuperadmin,
      mfaEnabled: schema.users.mfaEnabled,
      isMfaComplete: schema.sessions.isMfaComplete
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, sessionId))
    .get();

  if (!row) return { user: null, pendingUser: null, sessionId: null };

  if (row.expiresAt.getTime() <= Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return { user: null, pendingUser: null, sessionId: null };
  }

  const sessionUser: SessionUser = {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role as 'admin' | 'manager' | 'operator',
    isSuperadmin: Boolean(row.isSuperadmin),
    mfaEnabled: Boolean(row.mfaEnabled)
  };

  if (!row.isMfaComplete) {
    return {
      user: null,
      pendingUser: sessionUser,
      sessionId: row.sid
    };
  }

  return {
    user: sessionUser,
    pendingUser: null,
    sessionId: row.sid
  };
}

type ResolveSessionWithRefreshResult = {
  user: SessionUser | null;
  pendingUser: SessionUser | null;
  sessionId: string | null;
  refreshed: boolean;
  clearRefreshCookie: boolean;
};

function buildSessionUser(row: {
  userId: string;
  email: string;
  name: string;
  role: string;
  isSuperadmin: boolean;
  mfaEnabled: boolean;
}): SessionUser {
  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role as 'admin' | 'manager' | 'operator',
    isSuperadmin: Boolean(row.isSuperadmin),
    mfaEnabled: Boolean(row.mfaEnabled)
  };
}

export async function resolveSessionWithRefresh(
  sessionId: string | null,
  refreshToken: string | null
): Promise<ResolveSessionWithRefreshResult> {
  const session = await resolveSession(sessionId);
  if (session.user || session.pendingUser) {
    return {
      ...session,
      refreshed: false,
      clearRefreshCookie: false
    };
  }

  if (!refreshToken) {
    return {
      ...session,
      refreshed: false,
      clearRefreshCookie: false
    };
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const tokenRow = db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isSuperadmin: schema.users.isSuperadmin,
      mfaEnabled: schema.users.mfaEnabled,
      expiresAt: schema.refreshTokens.expiresAt,
      isMfaComplete: schema.refreshTokens.isMfaComplete
    })
    .from(schema.refreshTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.refreshTokens.userId))
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, tokenHash),
        isNull(schema.refreshTokens.revokedAt)
      )
    )
    .get();

  if (!tokenRow) {
    return {
      ...session,
      refreshed: false,
      clearRefreshCookie: true
    };
  }

  if (tokenRow.expiresAt.getTime() <= Date.now()) {
    await revokeRefreshToken(refreshToken);
    return {
      ...session,
      refreshed: false,
      clearRefreshCookie: true
    };
  }

  const newSessionId = await createSession(tokenRow.userId, {
    isMfaComplete: Boolean(tokenRow.isMfaComplete)
  });
  const sessionUser = buildSessionUser(tokenRow);

  if (!tokenRow.isMfaComplete) {
    return {
      user: null,
      pendingUser: sessionUser,
      sessionId: newSessionId,
      refreshed: true,
      clearRefreshCookie: false
    };
  }

  return {
    user: sessionUser,
    pendingUser: null,
    sessionId: newSessionId,
    refreshed: true,
    clearRefreshCookie: false
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);
  db.update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, tokenHash),
        isNull(schema.refreshTokens.revokedAt)
      )
    )
    .run();
}

export async function markSessionMfaComplete(sessionId: string): Promise<void> {
  const row = db
    .select({ userId: schema.sessions.userId })
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .get();

  db.update(schema.sessions)
    .set({ isMfaComplete: true })
    .where(eq(schema.sessions.id, sessionId))
    .run();

  if (!row) return;

  db.update(schema.refreshTokens)
    .set({ isMfaComplete: true })
    .where(
      and(
        eq(schema.refreshTokens.userId, row.userId),
        isNull(schema.refreshTokens.revokedAt),
        gt(schema.refreshTokens.expiresAt, new Date())
      )
    )
    .run();
}

export function reapExpiredSessions(): void {
  const now = new Date();
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).run();
  db.delete(schema.refreshTokens)
    .where(
      or(lt(schema.refreshTokens.expiresAt, now), isNotNull(schema.refreshTokens.revokedAt))
    )
    .run();
  db.delete(schema.oauthStates).where(lt(schema.oauthStates.expiresAt, now)).run();
}

const REAP_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

export function startReapScheduler(): void {
  const timer = setInterval(() => {
    try {
      reapExpiredSessions();
    } catch (err) {
      console.warn('[auth/session] Failed to reap expired tokens:', err);
    }
  }, REAP_INTERVAL_MS);
  timer.unref();
}
