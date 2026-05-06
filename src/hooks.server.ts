import type { Handle } from '@sveltejs/kit';
import {
	clearRefreshTokenCookie,
	REFRESH_TOKEN_COOKIE,
	resolveSessionWithRefresh,
	SESSION_COOKIE,
	setSessionCookie,
	startReapScheduler,
} from '$lib/server/auth/session.js';
import { ensureSchema } from '$lib/server/db/bootstrap.js';
import { ensureAdmin } from '$lib/server/db/seed.js';

// Eager startup: ensure DB schema, seed admin, and start cleanup scheduler.
ensureSchema();
await ensureAdmin();
startReapScheduler();

export const handle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get(SESSION_COOKIE) ?? null;
	const refreshToken = event.cookies.get(REFRESH_TOKEN_COOKIE) ?? null;
	const { user, pendingUser, sessionId, refreshed, clearRefreshCookie } =
		await resolveSessionWithRefresh(sid, refreshToken);

	if (refreshed && sessionId) {
		setSessionCookie(event.cookies, sessionId);
	}

	if (clearRefreshCookie) {
		clearRefreshTokenCookie(event.cookies);
	}

	event.locals.user = user;
	event.locals.pendingUser = pendingUser;
	event.locals.sessionId = sessionId;
	return resolve(event);
};
