import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import { decryptTotpSecret, verifyTotpToken } from '$lib/server/auth/mfa.js';
import {
  consumeRecoveryCode,
  hasActiveRecoveryCodes,
  replaceRecoveryCodesForUser
} from '$lib/server/auth/mfa-recovery.js';
import { getPendingMfaDestination } from '$lib/server/auth/mfa-flow.js';
import { markSessionMfaComplete } from '$lib/server/auth/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  if (!locals.pendingUser || !locals.sessionId) throw redirect(303, '/login');

  const user = db
    .select({ id: schema.users.id, email: schema.users.email, mfaSecret: schema.users.mfaSecret, mfaEnabled: schema.users.mfaEnabled })
    .from(schema.users)
    .where(eq(schema.users.id, locals.pendingUser.id))
    .get();

  if (!user) throw redirect(303, '/login');

  if (
    getPendingMfaDestination({
      mfaEnabled: Boolean(user.mfaEnabled),
      mfaSecret: user.mfaSecret
    }) === '/mfa/setup'
  ) {
    throw redirect(303, '/mfa/setup');
  }

  return { email: user.email };
};

export const actions: Actions = {
  verify: async ({ request, locals }) => {
    if (!locals.pendingUser || !locals.sessionId) return fail(401, { error: 'Not authenticated' });

    const form = await request.formData();
    const token = String(form.get('token') ?? '').trim();
    if (!token) return fail(400, { error: 'Authenticator or recovery code is required' });

    const user = db
      .select({ id: schema.users.id, mfaSecret: schema.users.mfaSecret, mfaEnabled: schema.users.mfaEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, locals.pendingUser.id))
      .get();

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw redirect(303, '/mfa/setup');
    }

    const plainSecret = decryptTotpSecret(user.mfaSecret);
    const validTotp = verifyTotpToken(plainSecret, token);
    const validRecovery = !validTotp && consumeRecoveryCode(user.id, token);
    const valid = validTotp || validRecovery;
    if (!valid) return fail(400, { error: 'Invalid authenticator code' });

    let recoveryCodes: string[] | null = null;
    if (validTotp && !hasActiveRecoveryCodes(user.id)) {
      recoveryCodes = replaceRecoveryCodesForUser(user.id);
    }

    await markSessionMfaComplete(locals.sessionId);

    if (recoveryCodes) {
      return {
        setupComplete: true,
        recoveryCodes
      };
    }

    throw redirect(303, '/dashboard');
  }
};
