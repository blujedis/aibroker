import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '$lib/server/auth/password.js';
import { db, schema } from '$lib/server/db/index.js';
import { destroySession, clearSessionCookie } from '$lib/server/auth/session.js';
import { getGlobalSettings } from '$lib/server/settings.js';
import {
  assertCanLinkOperatorToProfiles,
  canCreateRole,
  canMutateTarget,
  ensureProfileAssignmentsExist,
  getAssignedProfileIds,
  requireUser
} from '$lib/server/authz.js';
import {
  createInvitation,
  findActiveInvitationByEmail,
  getInviteExpiryHours,
  listVisibleInvitations,
  revokeInvitation
} from '$lib/server/invitations/service.js';
import { buildInvitationUrl, sendInvitationEmail } from '$lib/server/mail/mailgun.js';
import type { Actions, PageServerLoad } from './$types';

function asRole(value: string): 'admin' | 'manager' | 'operator' {
  if (value === 'admin' || value === 'manager' || value === 'operator') return value;
  return 'operator';
}

function parseProfileIds(values: FormDataEntryValue[]): string[] {
  return values.map(String).map((s) => s.trim()).filter(Boolean);
}

function canMutateInvitation(
  actor: ReturnType<typeof requireUser>,
  invitation: { invitedByUserId: string }
): boolean {
  return actor.role === 'admin' || invitation.invitedByUserId === actor.id;
}

function getProfileById(profileId: string) {
  return db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).get();
}

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireUser(locals.user);
  if (actor.role === 'operator') throw redirect(303, '/profile');

  const users =
    actor.role === 'admin'
      ? db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          isSuperadmin: schema.users.isSuperadmin,
          createdByUserId: schema.users.createdByUserId,
          mfaEnabled: schema.users.mfaEnabled,
          createdAt: schema.users.createdAt,
          updatedAt: schema.users.updatedAt
        })
        .from(schema.users)
        .all()
      : db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          isSuperadmin: schema.users.isSuperadmin,
          createdByUserId: schema.users.createdByUserId,
          mfaEnabled: schema.users.mfaEnabled,
          createdAt: schema.users.createdAt,
          updatedAt: schema.users.updatedAt
        })
        .from(schema.users)
        .where(
          or(
            eq(schema.users.id, actor.id),
            and(eq(schema.users.role, 'operator'), eq(schema.users.createdByUserId, actor.id))
          )
        )
        .all();

  const userIds = users.map((u) => u.id);
  const assignments =
    userIds.length > 0
      ? db
        .select()
        .from(schema.userProfiles)
        .where(inArray(schema.userProfiles.userId, userIds))
        .all()
      : [];

  const identities =
    userIds.length > 0
      ? db
        .select({
          userId: schema.userIdentities.userId,
          provider: schema.userIdentities.provider
        })
        .from(schema.userIdentities)
        .where(inArray(schema.userIdentities.userId, userIds))
        .all()
      : [];

  const assignmentByUser = new Map<string, string[]>();
  for (const assignment of assignments) {
    const row = assignmentByUser.get(assignment.userId) ?? [];
    row.push(assignment.profileId);
    assignmentByUser.set(assignment.userId, row);
  }

  const identitiesByUser = new Map<string, string[]>();
  for (const identity of identities) {
    const row = identitiesByUser.get(identity.userId) ?? [];
    row.push(identity.provider);
    identitiesByUser.set(identity.userId, row);
  }

  const profiles = (() => {
    if (actor.role === 'admin') return db.select().from(schema.profiles).all();
    const visibleProfileIds = getAssignedProfileIds(actor.id);
    if (visibleProfileIds.length === 0) return [];
    return db
      .select()
      .from(schema.profiles)
      .where(inArray(schema.profiles.id, visibleProfileIds))
      .all();
  })();

  const invitations = listVisibleInvitations(actor)
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const { globalMfaEnabled } = getGlobalSettings();

  return {
    actor,
    actorId: actor.id,
    globalMfaEnabled,
    users: users.map((user) => ({
      ...user,
      profileIds: assignmentByUser.get(user.id) ?? [],
      linkedProviders: identitiesByUser.get(user.id) ?? []
    })),
    profiles,
    invitations
  };
};

export const actions: Actions = {
  invite: async ({ request, locals, url }) => {
    const actor = requireUser(locals.user);
    if (actor.role === 'operator') return fail(403, { error: 'Not allowed' });

    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const role = asRole(String(form.get('role') ?? 'operator'));
    const profileId = String(form.get('profileId') ?? '').trim();
    const customMessage = String(form.get('customMessage') ?? '').trim();

    if (!email || !profileId) {
      return fail(400, { error: 'Email and profile are required' });
    }

    if (!canCreateRole(actor, role)) {
      return fail(403, { error: 'You are not allowed to invite this role' });
    }

    const profile = getProfileById(profileId);
    if (!profile) return fail(404, { error: 'Profile not found' });

    if (actor.role === 'manager') {
      assertCanLinkOperatorToProfiles(actor, [profileId]);
    }

    const existingUser = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (existingUser) return fail(409, { error: 'Email is already in use' });

    const existingInvite = findActiveInvitationByEmail(email);
    if (existingInvite) {
      return fail(409, { error: 'An active invitation already exists for this email' });
    }

    const invitation = createInvitation({
      email,
      role,
      profileId,
      invitedByUserId: actor.id,
      customMessage
    });

    try {
      await sendInvitationEmail({
        to: email,
        inviteUrl: buildInvitationUrl(invitation.rawToken, url.origin),
        role,
        profileName: profile.name,
        expiresInHours: getInviteExpiryHours(),
        inviterName: actor.name,
        customMessage
      });
    } catch (error) {
      revokeInvitation(invitation.id);
      return fail(500, {
        error: error instanceof Error ? error.message : 'Failed to send invitation email'
      });
    }

    return { ok: true };
  },

  resendInvite: async ({ request, locals, url }) => {
    const actor = requireUser(locals.user);
    if (actor.role === 'operator') return fail(403, { error: 'Not allowed' });

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing invitation id' });

    const invitation = db
      .select()
      .from(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id))
      .get();

    if (!invitation) return fail(404, { error: 'Invitation not found' });
    if (!canMutateInvitation(actor, invitation)) return fail(403, { error: 'Not allowed' });
    if (invitation.acceptedAt) return fail(400, { error: 'Accepted invitations cannot be resent' });
    if (invitation.revokedAt) return fail(400, { error: 'Revoked invitations cannot be resent' });

    const profile = getProfileById(invitation.profileId);
    if (!profile) return fail(404, { error: 'Profile not found' });

    revokeInvitation(invitation.id);
    const replacement = createInvitation({
      email: invitation.email,
      role: invitation.role,
      profileId: invitation.profileId,
      invitedByUserId: actor.id,
      customMessage: invitation.customMessage
    });

    try {
      await sendInvitationEmail({
        to: invitation.email,
        inviteUrl: buildInvitationUrl(replacement.rawToken, url.origin),
        role: invitation.role,
        profileName: profile.name,
        expiresInHours: getInviteExpiryHours(),
        inviterName: actor.name,
        customMessage: invitation.customMessage
      });
    } catch (error) {
      revokeInvitation(replacement.id);
      return fail(500, {
        error: error instanceof Error ? error.message : 'Failed to resend invitation email'
      });
    }

    return { ok: true };
  },

  revokeInvite: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    if (actor.role === 'operator') return fail(403, { error: 'Not allowed' });

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing invitation id' });

    const invitation = db
      .select()
      .from(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id))
      .get();

    if (!invitation) return fail(404, { error: 'Invitation not found' });
    if (!canMutateInvitation(actor, invitation)) return fail(403, { error: 'Not allowed' });
    if (invitation.acceptedAt) return fail(400, { error: 'Accepted invitations cannot be revoked' });
    if (invitation.revokedAt) return fail(400, { error: 'Invitation already revoked' });

    revokeInvitation(invitation.id);
    return { ok: true };
  },

  create: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    if (actor.role === 'operator') return fail(403, { error: 'Not allowed' });

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const role = asRole(String(form.get('role') ?? 'operator'));
    const profileIds = parseProfileIds(form.getAll('profileIds'));

    if (!name || !email || !password) {
      return fail(400, { error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters' });
    }

    if (!canCreateRole(actor, role)) {
      return fail(403, { error: 'You are not allowed to create this role' });
    }

    if (role === 'operator' && actor.role === 'manager') {
      assertCanLinkOperatorToProfiles(actor, profileIds);
    }

    if ((role === 'manager' || role === 'operator') && actor.role === 'admin' && profileIds.length === 0) {
      return fail(400, { error: 'At least one profile assignment is required for managers/operators' });
    }

    const existing = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (existing) return fail(409, { error: 'Email is already in use' });

    const id = nanoid();
    const passwordHash = await hashPassword(password);

    db.insert(schema.users)
      .values({
        id,
        name,
        email,
        passwordHash,
        role,
        createdByUserId: role === 'operator' ? actor.id : null,
        isSuperadmin: false
      })
      .run();

    if (role === 'operator' || role === 'manager') {
      ensureProfileAssignmentsExist(id, profileIds);
    }

    return { ok: true };
  },

  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();

    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing user id' });

    const target = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();

    if (!target) return fail(404, { error: 'User not found' });
    if (!canMutateTarget(actor, target)) return fail(403, { error: 'Not allowed' });

    const nextRole = asRole(String(form.get('role') ?? target.role));
    if (nextRole !== target.role) {
      if (actor.role !== 'admin') return fail(403, { error: 'Only admins can change roles' });
      if (nextRole === 'admin' && !actor.isSuperadmin) {
        return fail(403, { error: 'Only superadmin can grant admin role' });
      }
    }

    const password = String(form.get('password') ?? '');
    const patch: {
      name: string;
      email: string;
      role: 'admin' | 'manager' | 'operator';
      createdByUserId: string | null;
      updatedAt: Date;
      passwordHash?: string;
      mfaEnabled?: boolean;
      mfaSecret?: string | null;
      mfaEnrolledAt?: Date | null;
    } = {
      name: String(form.get('name') ?? target.name).trim(),
      email: String(form.get('email') ?? target.email).trim().toLowerCase(),
      role: nextRole,
      createdByUserId: nextRole === 'operator' ? (target.createdByUserId ?? actor.id) : null,
      updatedAt: new Date()
    };

    const mfaEnabledProvided = String(form.get('mfaEnabledProvided') ?? '') === '1';
    if (mfaEnabledProvided) {
      if (actor.role !== 'admin') {
        return fail(403, { error: 'Only admins can update MFA settings' });
      }
      patch.mfaEnabled = form.has('mfaEnabled');
      if (!patch.mfaEnabled) {
        patch.mfaSecret = null;
        patch.mfaEnrolledAt = null;
      }
    }

    if (password) {
      if (password.length < 6) return fail(400, { error: 'Password must be at least 6 characters' });
      patch.passwordHash = await hashPassword(password);
    }

    db.update(schema.users).set(patch).where(eq(schema.users.id, id)).run();

    if (patch.mfaEnabled === false) {
      db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, id)).run();
    }

    if (actor.role === 'admin' && (nextRole === 'manager' || nextRole === 'operator')) {
      const profileIds = parseProfileIds(form.getAll('profileIds'));
      if (profileIds.length === 0) {
        return fail(400, { error: 'At least one profile assignment is required for managers/operators' });
      }
      ensureProfileAssignmentsExist(id, profileIds);
    }

    return { ok: true };
  },

  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing user id' });
    if (id === actor.id) return fail(400, { error: 'You cannot delete your own account' });

    const target = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();

    if (!target) return fail(404, { error: 'User not found' });
    if (!canMutateTarget(actor, target)) return fail(403, { error: 'Not allowed' });
    if (target.role === 'admin' && !actor.isSuperadmin) {
      return fail(403, { error: 'Only superadmin can delete admin users' });
    }

    db.delete(schema.users).where(eq(schema.users.id, id)).run();
    return { ok: true };
  },

  toggleMfa: async ({ locals, cookies }) => {
    const actor = requireUser(locals.user);
    if (!locals.sessionId) return fail(401, { error: 'Not authenticated' });

    const { globalMfaEnabled } = getGlobalSettings();
    if (globalMfaEnabled) return fail(400, { error: 'MFA is globally enforced and cannot be changed.' });

    const user = db
      .select({ mfaEnabled: schema.users.mfaEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .get();

    if (!user) return fail(404, { error: 'User not found' });

    const newMfaEnabled = !user.mfaEnabled;

    db.update(schema.users)
      .set({
        mfaEnabled: newMfaEnabled,
        mfaSecret: newMfaEnabled ? undefined : null,
        mfaEnrolledAt: newMfaEnabled ? undefined : null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, actor.id))
      .run();

    if (!newMfaEnabled) {
      db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, actor.id)).run();
    }

    await destroySession(locals.sessionId);
    clearSessionCookie(cookies);

    redirect(303, '/login');
  }
};
