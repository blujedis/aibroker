import type { Handle } from '@sveltejs/kit';
import { ensureAdmin } from '$lib/server/db/seed.js';
import { ensureSchema } from '$lib/server/db/bootstrap.js';
import { resolveSession, SESSION_COOKIE } from '$lib/server/auth/session.js';

// Eager startup: ensure DB schema and seed admin on first import.
ensureSchema();
await ensureAdmin();

export const handle: Handle = async ({ event, resolve }) => {
  const sid = event.cookies.get(SESSION_COOKIE) ?? null;
  const { user, sessionId } = await resolveSession(sid);
  event.locals.user = user;
  event.locals.sessionId = sessionId;
  return resolve(event);
};
