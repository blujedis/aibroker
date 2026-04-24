import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import { verifyPassword } from '$lib/server/auth/password.js';
import {
  createSession,
  setSessionCookie,
  SESSION_COOKIE
} from '$lib/server/auth/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');

    if (!email || !password)
      return fail(400, { email, error: 'Email and password are required' });

    const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user) return fail(401, { email, error: 'Invalid credentials' });

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) return fail(401, { email, error: 'Invalid credentials' });

    const sid = await createSession(user.id);
    setSessionCookie(cookies, sid);
    cookies.set(SESSION_COOKIE, sid, { path: '/' });
    throw redirect(303, '/dashboard');
  }
};
