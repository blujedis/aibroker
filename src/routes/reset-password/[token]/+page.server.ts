import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import { hashPassword } from '$lib/server/auth/password.js';
import {
  verifyPasswordResetToken,
  consumePasswordResetToken
} from '$lib/server/auth/password-reset.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const userId = verifyPasswordResetToken(params.token);
  return { valid: userId !== null };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (!password) return fail(400, { error: 'Password is required' });
    if (password.length < 8) return fail(400, { error: 'Password must be at least 8 characters' });
    if (password !== confirm) return fail(400, { error: 'Passwords do not match' });

    const userId = verifyPasswordResetToken(params.token);
    if (!userId) return fail(400, { error: 'This reset link is invalid or has expired.' });

    const passwordHash = await hashPassword(password);

    db.update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .run();

    // Invalidate all existing sessions for this user for security
    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();

    consumePasswordResetToken(params.token);

    throw redirect(303, '/login?reset=1');
  }
};
