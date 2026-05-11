import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import {
	clearRefreshTokenCookie,
	REFRESH_TOKEN_COOKIE,
	resolveSessionWithRefresh,
	SESSION_COOKIE,
	setSessionCookie,
	startReapScheduler,
} from '$lib/server/auth/session.js';
import { ensureSchemaReady } from '$lib/server/db/ready.js';
import { ensureAdmin, hasAnyUser } from '$lib/server/db/seed.js';
import { logger } from '$lib/server/observability/logger.js';

// Eager startup: seed admin (env-var path) and start cleanup scheduler.
await ensureSchemaReady();
await ensureAdmin();
startReapScheduler();

// Track whether the interactive onboarding has been completed. Once a user
// exists this flips to true permanently for the lifetime of the process.
let onboardingComplete = await hasAnyUser();

function resolveRequestId(event: Parameters<Handle>[0]['event']): string {
	const fromHeader = event.request.headers.get('x-request-id')?.trim();
	return fromHeader || randomUUID();
}

function withRequestIdHeader(response: Response, requestId: string): Response {
	const headers = new Headers(response.headers);
	headers.set('x-request-id', requestId);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

let isListening = false;

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.url.origin;
	const startedAt = performance.now();
	const requestId = resolveRequestId(event);
	const requestLogger = logger.child({
		component: 'http.request',
		requestId,
		method: event.request.method,
		path: event.url.pathname
	});

	if (!isListening) {
		requestLogger.info('Server listening on: ' + event.url.origin);
		isListening = true;
	}
	event.locals.requestId = requestId;
	event.locals.logger = requestLogger;
	requestLogger.info('request.start');

	let statusCode = 500;

	try {
		// Re-check on each request until a user exists; once true it stays true.
		if (!onboardingComplete) {
			onboardingComplete = await hasAnyUser();
			if (!onboardingComplete) {
				const path = event.url.pathname;
				const isExempt = path.startsWith('/setup') || path.startsWith('/v1/');
				if (!isExempt) throw redirect(303, '/setup');
			}
		}

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

		const response = await resolve(event);
		statusCode = response.status;
		return withRequestIdHeader(response, requestId);
	} catch (error) {
		const maybeStatus = (error as { status?: number }).status;
		if (typeof maybeStatus === 'number') {
			statusCode = maybeStatus;
		}
		if (statusCode >= 500) {
			requestLogger.error('request.error', { err: error });
		}
		throw error;
	} finally {
		requestLogger.info('request.finish', {
			statusCode,
			durationMs: Math.round(performance.now() - startedAt)
		});
	}
};
