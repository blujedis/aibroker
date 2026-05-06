import { error } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import type { SessionUser } from '$lib/server/auth/session.js';
import type { User } from '$lib/server/db/schema.js';

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw error(401, 'Not authenticated');
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}

export function isManager(user: SessionUser | null): boolean {
  return user?.role === 'manager';
}

export function isOperator(user: SessionUser | null): boolean {
  return user?.role === 'operator';
}

export function requireAdmin(user: SessionUser | null): SessionUser {
  const current = requireUser(user);
  if (current.role !== 'admin') throw error(403, 'Admin access required');
  return current;
}

export function requireSuperadmin(user: SessionUser | null): SessionUser {
  const current = requireAdmin(user);
  if (!current.isSuperadmin) throw error(403, 'Superadmin access required');
  return current;
}

export function getAssignedProfileIds(userId: string): string[] {
  return db
    .select({ profileId: schema.userProfiles.profileId })
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .all()
    .map((r) => r.profileId);
}

export function canAccessProfile(user: SessionUser, profileId: string | null): boolean {
  if (user.role === 'admin') return true;
  if (!profileId) return false;
  const assigned = getAssignedProfileIds(user.id);
  return assigned.includes(profileId);
}

export function assertCanAccessProfile(user: SessionUser, profileId: string | null): void {
  if (!canAccessProfile(user, profileId)) {
    throw error(403, 'Profile access denied');
  }
}

export function getVisibleProfileIds(user: SessionUser): string[] | null {
  if (user.role === 'admin') return null;
  return getAssignedProfileIds(user.id);
}

export function canCreateRole(actor: SessionUser, requestedRole: 'admin' | 'manager' | 'operator'): boolean {
  if (actor.role === 'admin') {
    if (requestedRole === 'admin') return actor.isSuperadmin;
    return true;
  }
  if (actor.role === 'manager') return requestedRole === 'operator';
  return false;
}

export function canMutateTarget(
  actor: SessionUser,
  target: Pick<User, 'id' | 'role' | 'isSuperadmin' | 'createdByUserId'>
): boolean {
  // A superadmin account can only be modified by itself.
  if (target.isSuperadmin && actor.id !== target.id) return false;

  if (actor.role === 'admin') {
    if (target.role === 'admin' && !actor.isSuperadmin) {
      return target.id === actor.id;
    }
    return true;
  }

  if (actor.role === 'manager') {
    if (target.id === actor.id) return true;
    return target.role === 'operator' && target.createdByUserId === actor.id;
  }

  return target.id === actor.id;
}

export function filterRowsByVisibleProfiles<T extends { profileId: string | null }>(
  rows: T[],
  visibleProfileIds: string[] | null
): T[] {
  if (visibleProfileIds === null) return rows;
  return rows.filter((row) => row.profileId !== null && visibleProfileIds.includes(row.profileId));
}

export function ensureProfileAssignmentsExist(userId: string, profileIds: string[]): void {
  db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).run();

  if (profileIds.length === 0) return;

  const distinctProfileIds = [...new Set(profileIds)];
  const existingProfiles = db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(inArray(schema.profiles.id, distinctProfileIds))
    .all();

  if (existingProfiles.length !== distinctProfileIds.length) {
    throw error(400, 'One or more profiles are invalid');
  }

  for (const profileId of distinctProfileIds) {
    db.insert(schema.userProfiles).values({ userId, profileId }).run();
  }
}

export function assertCanLinkOperatorToProfiles(actor: SessionUser, profileIds: string[]): void {
  if (actor.role === 'admin') return;

  if (actor.role !== 'manager') {
    throw error(403, 'Not allowed to assign profiles');
  }

  const assigned = getAssignedProfileIds(actor.id);
  for (const profileId of profileIds) {
    if (!assigned.includes(profileId)) {
      throw error(403, 'Managers can only assign operators to their own profiles');
    }
  }
}
