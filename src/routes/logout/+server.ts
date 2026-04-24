import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, destroySession } from '$lib/server/auth/session.js';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ cookies, locals }) => {
  if (locals.sessionId) await destroySession(locals.sessionId);
  clearSessionCookie(cookies);
  throw redirect(303, '/login');
};

export const GET = handler;
export const POST = handler;
