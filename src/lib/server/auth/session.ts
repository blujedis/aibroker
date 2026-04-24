import { eq, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Cookies } from '@sveltejs/kit';
import { db, schema } from '../db/index.js';

export const SESSION_COOKIE = 'np_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
}

export async function createSession(userId: string): Promise<string> {
  const id = nanoid(40);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(schema.sessions).values({ id, userId, expiresAt }).run();
  return id;
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

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function resolveSession(
  sessionId: string | null
): Promise<{ user: SessionUser | null; sessionId: string | null }> {
  if (!sessionId) return { user: null, sessionId: null };

  const row = db
    .select({
      sid: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, sessionId))
    .get();

  if (!row) return { user: null, sessionId: null };

  if (row.expiresAt.getTime() <= Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return { user: null, sessionId: null };
  }

  return {
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role as 'admin' | 'operator'
    },
    sessionId: row.sid
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

export function reapExpiredSessions(): void {
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).run();
}
