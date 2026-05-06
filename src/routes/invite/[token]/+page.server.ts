import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '$lib/server/auth/password.js';
import {
  acceptInvitation,
  findInvitationByToken,
  isInvitationExpired,
  isInvitationUsable
} from '$lib/server/invitations/service.js';
import { db, schema } from '$lib/server/db/index.js';
import { ensureProfileAssignmentsExist } from '$lib/server/authz.js';
import { createSession, setSessionCookie } from '$lib/server/auth/session.js';
import {
  getPostLoginDestination,
  shouldMarkSessionMfaComplete
} from '$lib/server/auth/login-flow.js';
import { getGlobalSettings } from '$lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

function getInvitationState(token: string) {
  const invitation = findInvitationByToken(token);

  if (!invitation) {
    return { valid: false as const, reason: 'invalid' as const, invitation: null };
  }

  if (invitation.acceptedAt) {
    return { valid: false as const, reason: 'accepted' as const, invitation };
  }

  if (invitation.revokedAt) {
    return { valid: false as const, reason: 'revoked' as const, invitation };
  }

  if (isInvitationExpired(invitation)) {
    return { valid: false as const, reason: 'expired' as const, invitation };
  }

  if (!isInvitationUsable(invitation)) {
    return { valid: false as const, reason: 'invalid' as const, invitation };
  }

  return { valid: true as const, reason: null, invitation };
}

export const load: PageServerLoad = ({ params, locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  if (locals.pendingUser) {
    throw redirect(303, locals.pendingUser.mfaEnabled ? '/mfa/verify' : '/mfa/setup');
  }

  const result = getInvitationState(params.token);
  if (!result.invitation) {
    return {
      valid: false,
      reason: result.reason,
      invitation: null,
      profile: null,
      globalMfaEnabled: getGlobalSettings().globalMfaEnabled
    };
  }

  const profile = db
    .select({ id: schema.profiles.id, name: schema.profiles.name })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, result.invitation.profileId))
    .get();

  return {
    valid: result.valid,
    reason: result.reason,
    invitation: {
      email: result.invitation.email,
      role: result.invitation.role,
      profileId: result.invitation.profileId,
      customMessage: result.invitation.customMessage,
      expiresAt: result.invitation.expiresAt
    },
    profile,
    globalMfaEnabled: getGlobalSettings().globalMfaEnabled
  };
};

export const actions: Actions = {
  default: async ({ request, params, cookies, locals }) => {
    if (locals.user) throw redirect(303, '/dashboard');
    if (locals.pendingUser) {
      throw redirect(303, locals.pendingUser.mfaEnabled ? '/mfa/verify' : '/mfa/setup');
    }

    const result = getInvitationState(params.token);
    if (!result.valid || !result.invitation) {
      return fail(400, { error: 'This invitation is no longer valid.' });
    }

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (!name || !password || !confirmPassword) {
      return fail(400, { error: 'Name, password, and password confirmation are required.' });
    }

    if (password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return fail(400, { error: 'Passwords do not match' });
    }

    const existingUser = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, result.invitation.email))
      .get();

    if (existingUser) {
      return fail(409, { error: 'An account already exists for this email.' });
    }

    const profile = db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, result.invitation.profileId))
      .get();

    if (!profile) {
      return fail(404, { error: 'The assigned profile no longer exists.' });
    }

    const userId = nanoid();
    const passwordHash = await hashPassword(password);

    db.insert(schema.users)
      .values({
        id: userId,
        email: result.invitation.email,
        name,
        passwordHash,
        role: result.invitation.role,
        isSuperadmin: false,
        createdByUserId: result.invitation.role === 'operator' ? result.invitation.invitedByUserId : null,
        mfaEnabled: false
      })
      .run();

    ensureProfileAssignmentsExist(userId, [result.invitation.profileId]);
    acceptInvitation(result.invitation.id, userId);

    const { globalMfaEnabled } = getGlobalSettings();
    const userMfaEnabled = false;
    const sessionId = await createSession(userId, {
      isMfaComplete: shouldMarkSessionMfaComplete({ globalMfaEnabled, userMfaEnabled })
    });
    setSessionCookie(cookies, sessionId);

    throw redirect(
      303,
      getPostLoginDestination({ globalMfaEnabled, userMfaEnabled })
    );
  }
};
