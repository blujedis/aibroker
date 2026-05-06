import { redirect } from '@sveltejs/kit';
import {
  clearRefreshTokenCookie,
  clearSessionCookie,
  destroySession,
  REFRESH_TOKEN_COOKIE,
  revokeRefreshToken
} from '$lib/server/auth/session.js';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ cookies, locals }) => {
  if (locals.sessionId) await destroySession(locals.sessionId);

  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  clearSessionCookie(cookies);
  clearRefreshTokenCookie(cookies);
  throw redirect(303, '/login');
};

export const GET = handler;
export const POST = handler;
