import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '$lib/server/auth/password.js';
import { db, schema } from '$lib/server/db/postgres.js';
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

async function getProfileById(profileId: string) {
  const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
  return rows[0];
}

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireUser(locals.user);
  if (actor.role === 'operator') throw redirect(303, '/profile');

  const users =
    actor.role === 'admin'
      ? await db
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
      : await db
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
        );

  const userIds = users.map((u) => u.id);
  const assignments =
    userIds.length > 0
      ? await db
        .select()
        .from(schema.userProfiles)
        .where(inArray(schema.userProfiles.userId, userIds))
      : [];

  const identities =
    userIds.length > 0
      ? await db
        .select({
          userId: schema.userIdentities.userId,
          provider: schema.userIdentities.provider
        })
        .from(schema.userIdentities)
        .where(inArray(schema.userIdentities.userId, userIds))
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

  const profiles = await (async () => {
    if (actor.role === 'admin') return await db.select().from(schema.profiles);
    const visibleProfileIds = await getAssignedProfileIds(actor.id);
    if (visibleProfileIds.length === 0) return [];
    return await db
      .select()
      .from(schema.profiles)
      .where(inArray(schema.profiles.id, visibleProfileIds));
  })();

  const invitations = (await listVisibleInvitations(actor))
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const { globalMfaEnabled } = await getGlobalSettings();

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

    const profile = await getProfileById(profileId);
    if (!profile) return fail(404, { error: 'Profile not found' });

    if (actor.role === 'manager') {
      await assertCanLinkOperatorToProfiles(actor, [profileId]);
    }

    const existingUserRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const existingUser = existingUserRows[0];

    if (existingUser) return fail(409, { error: 'Email is already in use' });

    const existingInvite = await findActiveInvitationByEmail(email);
    if (existingInvite) {
      return fail(409, { error: 'An active invitation already exists for this email' });
    }

    const invitation = await createInvitation({
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
      await revokeInvitation(invitation.id);
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

    const invitationRows = await db
      .select()
      .from(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id))
      .limit(1);
    const invitation = invitationRows[0];

    if (!invitation) return fail(404, { error: 'Invitation not found' });
    if (!canMutateInvitation(actor, invitation)) return fail(403, { error: 'Not allowed' });
    if (invitation.acceptedAt) return fail(400, { error: 'Accepted invitations cannot be resent' });
    if (invitation.revokedAt) return fail(400, { error: 'Revoked invitations cannot be resent' });

    const profile = await getProfileById(invitation.profileId);
    if (!profile) return fail(404, { error: 'Profile not found' });

    await revokeInvitation(invitation.id);
    const replacement = await createInvitation({
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
      await revokeInvitation(replacement.id);
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

    const invitationRows = await db
      .select()
      .from(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id))
      .limit(1);
    const invitation = invitationRows[0];

    if (!invitation) return fail(404, { error: 'Invitation not found' });
    if (!canMutateInvitation(actor, invitation)) return fail(403, { error: 'Not allowed' });
    if (invitation.acceptedAt) return fail(400, { error: 'Accepted invitations cannot be revoked' });
    if (invitation.revokedAt) return fail(400, { error: 'Invitation already revoked' });

    await revokeInvitation(invitation.id);
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
      await assertCanLinkOperatorToProfiles(actor, profileIds);
    }

    if ((role === 'manager' || role === 'operator') && actor.role === 'admin' && profileIds.length === 0) {
      return fail(400, { error: 'At least one profile assignment is required for managers/operators' });
    }

    const existingRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const existing = existingRows[0];

    if (existing) return fail(409, { error: 'Email is already in use' });

    const id = nanoid();
    const passwordHash = await hashPassword(password);

    await db.insert(schema.users).values({
      id,
      name,
      email,
      passwordHash,
      role,
      createdByUserId: role === 'operator' ? actor.id : null,
      isSuperadmin: false
    });

    if (role === 'operator' || role === 'manager') {
      await ensureProfileAssignmentsExist(id, profileIds);
    }

    return { ok: true };
  },

  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();

    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing user id' });

    const targetRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const target = targetRows[0];

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

    await db.update(schema.users).set(patch).where(eq(schema.users.id, id));

    if (patch.mfaEnabled === false) {
      await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, id));
    }

    if (actor.role === 'admin' && (nextRole === 'manager' || nextRole === 'operator')) {
      const profileIds = parseProfileIds(form.getAll('profileIds'));
      if (profileIds.length === 0) {
        return fail(400, { error: 'At least one profile assignment is required for managers/operators' });
      }
      await ensureProfileAssignmentsExist(id, profileIds);
    }

    return { ok: true };
  },

  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing user id' });
    if (id === actor.id) return fail(400, { error: 'You cannot delete your own account' });

    const targetRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const target = targetRows[0];

    if (!target) return fail(404, { error: 'User not found' });
    if (!canMutateTarget(actor, target)) return fail(403, { error: 'Not allowed' });
    if (target.role === 'admin' && !actor.isSuperadmin) {
      return fail(403, { error: 'Only superadmin can delete admin users' });
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));
    return { ok: true };
  },

  toggleMfa: async ({ locals, cookies }) => {
    const actor = requireUser(locals.user);
    if (!locals.sessionId) return fail(401, { error: 'Not authenticated' });

    const { globalMfaEnabled } = await getGlobalSettings();
    if (globalMfaEnabled) return fail(400, { error: 'MFA is globally enforced and cannot be changed.' });

    const userRows = await db
      .select({ mfaEnabled: schema.users.mfaEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, actor.id))
      .limit(1);
    const user = userRows[0];

    if (!user) return fail(404, { error: 'User not found' });

    const newMfaEnabled = !user.mfaEnabled;

    await db.update(schema.users)
      .set({
        mfaEnabled: newMfaEnabled,
        mfaSecret: newMfaEnabled ? undefined : null,
        mfaEnrolledAt: newMfaEnabled ? undefined : null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, actor.id));

    if (!newMfaEnabled) {
      await db.delete(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.userId, actor.id));
    }

    await destroySession(locals.sessionId);
    clearSessionCookie(cookies);

    redirect(303, '/login');
  }
};
