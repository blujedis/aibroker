import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import { hashPassword, verifyPassword } from '$lib/server/auth/password.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  return { user: locals.user };
};

export const actions: Actions = {
  changePassword: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    const form = await request.formData();
    const current = String(form.get('current') ?? '');
    const next = String(form.get('next') ?? '');
    if (next.length < 6) return fail(400, { error: 'Password must be at least 6 characters' });
    const rows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, locals.user.id))
      .all();
    const u = rows[0];
    if (!u) return fail(404, { error: 'User not found' });
    const ok = await verifyPassword(u.passwordHash, current);
    if (!ok) return fail(400, { error: 'Current password is incorrect' });
    const hash = await hashPassword(next);
    db.update(schema.users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(schema.users.id, u.id))
      .run();
    return { ok: true };
  }
};
