import { describe, expect, it } from 'vitest';
import { canCreateRole, canMutateTarget } from './authz.js';
import type { SessionUser } from './auth/session.js';

function actor(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: 'user-1',
    email: 'actor@example.com',
    name: 'Actor',
    role: 'operator',
    isSuperadmin: false,
    mfaEnabled: false,
    ...overrides
  };
}

describe('canCreateRole', () => {
  it('allows only superadmin admins to create admin users', () => {
    const admin = actor({ role: 'admin', isSuperadmin: false });
    const superadmin = actor({ role: 'admin', isSuperadmin: true });

    expect(canCreateRole(admin, 'admin')).toBe(false);
    expect(canCreateRole(superadmin, 'admin')).toBe(true);
  });

  it('allows manager to create operator only', () => {
    const manager = actor({ role: 'manager' });

    expect(canCreateRole(manager, 'operator')).toBe(true);
    expect(canCreateRole(manager, 'manager')).toBe(false);
    expect(canCreateRole(manager, 'admin')).toBe(false);
  });
});

describe('canMutateTarget', () => {
  it('allows manager to mutate self and own operators only', () => {
    const manager = actor({ id: 'mgr-1', role: 'manager' });

    const self = { id: 'mgr-1', role: 'manager' as const, isSuperadmin: false, createdByUserId: null };
    const ownOperator = { id: 'op-1', role: 'operator' as const, isSuperadmin: false, createdByUserId: 'mgr-1' };
    const foreignOperator = { id: 'op-2', role: 'operator' as const, isSuperadmin: false, createdByUserId: 'mgr-2' };
    const adminTarget = { id: 'adm-1', role: 'admin' as const, isSuperadmin: false, createdByUserId: null };

    expect(canMutateTarget(manager, self)).toBe(true);
    expect(canMutateTarget(manager, ownOperator)).toBe(true);
    expect(canMutateTarget(manager, foreignOperator)).toBe(false);
    expect(canMutateTarget(manager, adminTarget)).toBe(false);
  });

  it('prevents non-superadmin admin from mutating other admins', () => {
    const admin = actor({ id: 'adm-1', role: 'admin', isSuperadmin: false });

    const self = { id: 'adm-1', role: 'admin' as const, isSuperadmin: false, createdByUserId: null };
    const otherAdmin = { id: 'adm-2', role: 'admin' as const, isSuperadmin: false, createdByUserId: null };

    expect(canMutateTarget(admin, self)).toBe(true);
    expect(canMutateTarget(admin, otherAdmin)).toBe(false);
  });

  it('prevents any admin (including superadmin) from mutating a different superadmin', () => {
    const superadmin = actor({ id: 'sa-1', role: 'admin', isSuperadmin: true });
    const otherSuperadmin = actor({ id: 'sa-2', role: 'admin', isSuperadmin: true });
    const regularAdmin = actor({ id: 'adm-1', role: 'admin', isSuperadmin: false });

    const superadminTarget = { id: 'sa-2', role: 'admin' as const, isSuperadmin: true, createdByUserId: null };

    // Another superadmin cannot modify a different superadmin
    expect(canMutateTarget(superadmin, superadminTarget)).toBe(false);
    // A regular admin cannot modify a superadmin
    expect(canMutateTarget(regularAdmin, superadminTarget)).toBe(false);
    // A superadmin can modify itself
    const ownTarget = { id: 'sa-1', role: 'admin' as const, isSuperadmin: true, createdByUserId: null };
    expect(canMutateTarget(superadmin, ownTarget)).toBe(true);
    // A superadmin can still modify non-superadmin users
    const normalUser = { id: 'op-1', role: 'operator' as const, isSuperadmin: false, createdByUserId: null };
    expect(canMutateTarget(superadmin, normalUser)).toBe(true);
    // A regular admin cannot modify the superadmin but a superadmin can modify a regular admin
    const otherAdmin = { id: 'adm-2', role: 'admin' as const, isSuperadmin: false, createdByUserId: null };
    expect(canMutateTarget(otherSuperadmin, otherAdmin)).toBe(true);
  });
});
