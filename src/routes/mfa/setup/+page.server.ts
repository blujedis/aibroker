import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db, schema } from '$lib/server/db/postgres.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  toOtpAuthUri,
  verifyTotpToken
} from '$lib/server/auth/mfa.js';
import { replaceRecoveryCodesForUser } from '$lib/server/auth/mfa-recovery.js';
import { getPendingMfaDestination } from '$lib/server/auth/mfa-flow.js';
import { markSessionMfaComplete } from '$lib/server/auth/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  if (!locals.pendingUser || !locals.sessionId) throw redirect(303, '/login');

  const userRows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      mfaSecret: schema.users.mfaSecret,
      mfaEnabled: schema.users.mfaEnabled
    })
    .from(schema.users)
    .where(eq(schema.users.id, locals.pendingUser.id))
    .limit(1);
  const user = userRows[0];

  if (!user) throw redirect(303, '/login');

  if (
    getPendingMfaDestination({
      mfaEnabled: Boolean(user.mfaEnabled),
      mfaSecret: user.mfaSecret
    }) === '/mfa/verify'
  ) {
    throw redirect(303, '/mfa/verify');
  }

  let secret = user.mfaSecret ? decryptTotpSecret(user.mfaSecret) : '';
  if (!secret) {
    secret = generateTotpSecret();
    await db.update(schema.users)
      .set({ mfaSecret: encryptTotpSecret(secret), updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
  }

  const otpauth = toOtpAuthUri(user.email, secret);
  let qrCodeDataUrl: string | null = null;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240
    });
  } catch {
    qrCodeDataUrl = null;
  }

  return {
    email: user.email,
    secret,
    otpauth,
    qrCodeDataUrl
  };
};

export const actions: Actions = {
  verify: async ({ request, locals }) => {
    if (!locals.pendingUser || !locals.sessionId) return fail(401, { error: 'Not authenticated' });

    const form = await request.formData();
    const token = String(form.get('token') ?? '').trim();
    if (!token) return fail(400, { error: 'Authenticator code is required' });

    const userRows = await db
      .select({ id: schema.users.id, mfaSecret: schema.users.mfaSecret })
      .from(schema.users)
      .where(eq(schema.users.id, locals.pendingUser.id))
      .limit(1);
    const user = userRows[0];

    if (!user?.mfaSecret) return fail(400, { error: 'MFA setup is incomplete' });

    const plainSecret = decryptTotpSecret(user.mfaSecret);
    const valid = verifyTotpToken(plainSecret, token);
    if (!valid) return fail(400, { error: 'Invalid authenticator code' });

    await db.update(schema.users)
      .set({ mfaEnabled: true, mfaEnrolledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const recoveryCodes = await replaceRecoveryCodesForUser(user.id);

    await markSessionMfaComplete(locals.sessionId);
    return {
      setupComplete: true,
      recoveryCodes
    };
  }
};
