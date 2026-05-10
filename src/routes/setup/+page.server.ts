import { fail, redirect } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import { hashPassword } from '$lib/server/auth/password.js';
import { hasAnyUser } from '$lib/server/db/seed.js';
import {
  createRefreshToken,
  createSession,
  setRefreshTokenCookie,
  setSessionCookie
} from '$lib/server/auth/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // If any user already exists this route is permanently closed.
  if (await hasAnyUser()) throw redirect(303, '/login');
  // Already logged in — shouldn't happen at this stage but guard anyway.
  if (locals.user) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    // Double-check: reject if a user already exists (race-condition safety).
    if (await hasAnyUser()) throw redirect(303, '/login');

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (!name)
      return fail(400, { name, email, error: 'Name is required.' });
    if (!email)
      return fail(400, { name, email, error: 'Email is required.' });
    if (!password)
      return fail(400, { name, email, error: 'Password is required.' });
    if (password.length < 8)
      return fail(400, { name, email, error: 'Password must be at least 8 characters.' });
    if (password !== confirmPassword)
      return fail(400, { name, email, error: 'Passwords do not match.' });

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(schema.users)
      .values({
        id: nanoid(),
        email,
        name,
        passwordHash,
        role: 'admin',
        isSuperadmin: true
      })
      .returning({ id: schema.users.id })
      .execute();

    const sid = await createSession(user.id, { isMfaComplete: true });
    const refreshToken = await createRefreshToken(user.id, { isMfaComplete: true });
    setSessionCookie(cookies, sid);
    setRefreshTokenCookie(cookies, refreshToken);

    throw redirect(303, '/dashboard');
  }
};
