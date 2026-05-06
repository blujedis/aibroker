import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';
import { verifyPassword } from '$lib/server/auth/password.js';
import {
  createRefreshToken,
  createSession,
  setRefreshTokenCookie,
  setSessionCookie
} from '$lib/server/auth/session.js';
import {
  getPostLoginDestination,
  shouldMarkSessionMfaComplete
} from '$lib/server/auth/login-flow.js';
import { getGlobalSettings } from '$lib/server/settings.js';
import { isGoogleConfigured } from '$lib/server/auth/oauth/google.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  if (locals.pendingUser) {
    throw redirect(303, locals.pendingUser.mfaEnabled ? '/mfa/verify' : '/mfa/setup');
  }
  return { googleEnabled: isGoogleConfigured() };
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');

    if (!email || !password)
      return fail(400, { email, error: 'Email and password are required' });

    const users = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const user = users[0];
    if (!user) return fail(401, { email, error: 'Invalid credentials' });

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) return fail(401, { email, error: 'Invalid credentials' });

    const { globalMfaEnabled } = await getGlobalSettings();
    const userMfaEnabled = Boolean(user.mfaEnabled);
    const destination = getPostLoginDestination({
      globalMfaEnabled,
      userMfaEnabled
    });

    const isMfaComplete = shouldMarkSessionMfaComplete({ globalMfaEnabled, userMfaEnabled });

    const sid = await createSession(user.id, {
      isMfaComplete
    });
    const refreshToken = await createRefreshToken(user.id, { isMfaComplete });

    setSessionCookie(cookies, sid);
    setRefreshTokenCookie(cookies, refreshToken);

    throw redirect(303, destination);
  }
};
