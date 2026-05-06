import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';
import { hashPassword, verifyPassword } from '$lib/server/auth/password.js';
import { destroySession, clearSessionCookie } from '$lib/server/auth/session.js';
import { getGlobalSettings } from '$lib/server/settings.js';
import { getLinkedIdentities, unlinkIdentity } from '$lib/server/auth/oauth/identity.js';
import { isGoogleConfigured } from '$lib/server/auth/oauth/google.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { user: null, globalMfaEnabled: false, linkedIdentities: [], googleEnabled: false };

  const userRows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isSuperadmin: schema.users.isSuperadmin,
      mfaEnabled: schema.users.mfaEnabled
    })
    .from(schema.users)
    .where(eq(schema.users.id, locals.user.id))
    .limit(1);
  const user = userRows[0];

  const { globalMfaEnabled } = await getGlobalSettings();
  const linkedIdentities = await getLinkedIdentities(locals.user.id);

  return {
    user: user ?? locals.user,
    globalMfaEnabled,
    linkedIdentities,
    googleEnabled: isGoogleConfigured()
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();

    if (!name || !email) return fail(400, { error: 'Name and email are required' });

    const allWithEmail = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    const duplicate = allWithEmail.find((row) => row.id !== locals.user?.id);

    if (duplicate) return fail(409, { error: 'Email is already in use' });

    await db.update(schema.users)
      .set({ name, email, updatedAt: new Date() })
      .where(eq(schema.users.id, locals.user.id));

    return { ok: true, profileUpdated: true };
  },
  changePassword: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    const form = await request.formData();
    const current = String(form.get('current') ?? '');
    const next = String(form.get('next') ?? '');
    if (next.length < 6) return fail(400, { error: 'Password must be at least 6 characters' });
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, locals.user.id));
    const u = rows[0];
    if (!u) return fail(404, { error: 'User not found' });
    const ok = await verifyPassword(u.passwordHash, current);
    if (!ok) return fail(400, { error: 'Current password is incorrect' });
    const hash = await hashPassword(next);
    await db.update(schema.users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(schema.users.id, u.id));
    return { ok: true };
  },
  toggleMfa: async ({ locals, cookies }) => {
    if (!locals.user || !locals.sessionId) return fail(401, { error: 'Not authenticated' });

    const { globalMfaEnabled } = await getGlobalSettings();
    if (globalMfaEnabled) return fail(400, { error: 'MFA is globally enforced and cannot be changed.' });

    const userRows2 = await db
      .select({ mfaEnabled: schema.users.mfaEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, locals.user.id))
      .limit(1);
    const user = userRows2[0];

    if (!user) return fail(404, { error: 'User not found' });

    const newMfaEnabled = !user.mfaEnabled;

    await db.update(schema.users)
      .set({ mfaEnabled: newMfaEnabled, mfaSecret: newMfaEnabled ? undefined : null, updatedAt: new Date() })
      .where(eq(schema.users.id, locals.user.id));

    await destroySession(locals.sessionId);
    clearSessionCookie(cookies);

    redirect(303, '/login');
  },

  unlinkIdentity: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const form = await request.formData();
    const provider = String(form.get('provider') ?? '').trim();
    if (!provider) return fail(400, { error: 'Provider is required' });

    await unlinkIdentity(locals.user.id, provider);
    return { unlinked: true };
  }
};
