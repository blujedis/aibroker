import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectedGet: unknown;
let selectedGets: unknown[];
let insertRun: ReturnType<typeof vi.fn>;
let updateRun: ReturnType<typeof vi.fn>;
let deleteRun: ReturnType<typeof vi.fn>;
let lastInsertValues: unknown;
let lastUpdateValues: unknown;
let createInvitationMock: ReturnType<typeof vi.fn>;
let findActiveInvitationByEmailMock: ReturnType<typeof vi.fn>;
let listVisibleInvitationsMock: ReturnType<typeof vi.fn>;
let revokeInvitationMock: ReturnType<typeof vi.fn>;
let sendInvitationEmailMock: ReturnType<typeof vi.fn>;
let buildInvitationUrlMock: ReturnType<typeof vi.fn>;

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ kind: 'and', args }),
  eq: (...args: unknown[]) => ({ kind: 'eq', args }),
  inArray: (...args: unknown[]) => ({ kind: 'inArray', args }),
  or: (...args: unknown[]) => ({ kind: 'or', args })
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-user-id'
}));

vi.mock('$lib/server/auth/password.js', () => ({
  hashPassword: vi.fn(async () => 'hashed-password')
}));

vi.mock('$lib/server/invitations/service.js', () => {
  createInvitationMock = vi.fn(() => ({
    id: 'invite-1',
    rawToken: 'raw-token',
    expiresAt: new Date('2026-04-28T12:00:00.000Z')
  }));
  findActiveInvitationByEmailMock = vi.fn(() => undefined);
  listVisibleInvitationsMock = vi.fn(() => []);
  revokeInvitationMock = vi.fn();

  return {
    createInvitation: createInvitationMock,
    findActiveInvitationByEmail: findActiveInvitationByEmailMock,
    getInviteExpiryHours: vi.fn(() => 72),
    listVisibleInvitations: listVisibleInvitationsMock,
    revokeInvitation: revokeInvitationMock
  };
});

vi.mock('$lib/server/mail/mailgun.js', () => {
  buildInvitationUrlMock = vi.fn((token: string) => `http://localhost:5173/invite/${token}`);
  sendInvitationEmailMock = vi.fn(async () => undefined);

  return {
    buildInvitationUrl: buildInvitationUrlMock,
    sendInvitationEmail: sendInvitationEmailMock
  };
});

vi.mock('$lib/server/db/index.js', () => {
  const nextSelectedGet = () => {
    if (selectedGets.length > 0) return selectedGets.shift();
    return selectedGet;
  };

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(() => nextSelectedGet()),
        all: vi.fn(() => [])
      })),
      get: vi.fn(() => nextSelectedGet()),
      all: vi.fn(() => [])
    }))
  }));

  const insert = vi.fn(() => ({
    values: vi.fn((values: unknown) => {
      lastInsertValues = values;
      return { run: insertRun };
    })
  }));

  const update = vi.fn(() => ({
    set: vi.fn((values: unknown) => {
      lastUpdateValues = values;
      return {
        where: vi.fn(() => ({ run: updateRun }))
      };
    })
  }));

  const del = vi.fn(() => ({
    where: vi.fn(() => ({ run: deleteRun }))
  }));

  return {
    db: {
      select,
      insert,
      update,
      delete: del
    },
    schema: {
      users: {
        id: 'users.id',
        email: 'users.email',
        name: 'users.name',
        role: 'users.role',
        isSuperadmin: 'users.is_superadmin',
        createdByUserId: 'users.created_by_user_id',
        mfaEnabled: 'users.mfa_enabled',
        createdAt: 'users.created_at',
        updatedAt: 'users.updated_at'
      },
      userProfiles: {
        userId: 'user_profiles.user_id',
        profileId: 'user_profiles.profile_id'
      },
      userInvitations: {
        id: 'user_invitations.id',
        invitedByUserId: 'user_invitations.invited_by_user_id'
      },
      profiles: {
        id: 'profiles.id'
      }
    }
  };
});

const { actions } = await import('./+page.server.js');

function makeRequest(fields: Record<string, string | string[]>): { formData: () => Promise<FormData> } {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
  }

  return {
    formData: async () => form
  };
}

function makeUser(overrides: Partial<{ id: string; role: 'admin' | 'manager' | 'operator'; isSuperadmin: boolean }> = {}) {
  return {
    id: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
    role: 'admin' as const,
    isSuperadmin: false,
    mfaEnabled: false,
    ...overrides
  };
}

describe('users actions policy enforcement', () => {
  beforeEach(() => {
    selectedGet = undefined;
    selectedGets = [];
    insertRun = vi.fn();
    updateRun = vi.fn();
    deleteRun = vi.fn();
    lastInsertValues = undefined;
    lastUpdateValues = undefined;
    createInvitationMock.mockClear();
    findActiveInvitationByEmailMock.mockReset();
    findActiveInvitationByEmailMock.mockReturnValue(undefined);
    listVisibleInvitationsMock.mockReset();
    listVisibleInvitationsMock.mockReturnValue([]);
    revokeInvitationMock.mockClear();
    sendInvitationEmailMock.mockReset();
    sendInvitationEmailMock.mockResolvedValue(undefined);
    buildInvitationUrlMock.mockClear();
  });

  it('blocks non-superadmin admin from creating another admin', async () => {
    const result = await actions.create({
      request: makeRequest({
        name: 'New Admin',
        email: 'new-admin@example.com',
        password: 'password123',
        role: 'admin'
      }) as never,
      locals: { user: makeUser({ role: 'admin', isSuperadmin: false }) }
    } as never);

    expect((result as { status: number }).status).toBe(403);
    expect(insertRun).not.toHaveBeenCalled();
  });

  it('allows superadmin to create admin', async () => {
    const result = await actions.create({
      request: makeRequest({
        name: 'New Admin',
        email: 'new-admin@example.com',
        password: 'password123',
        role: 'admin'
      }) as never,
      locals: { user: makeUser({ role: 'admin', isSuperadmin: true }) }
    } as never);

    expect(result).toEqual({ ok: true });
    expect(insertRun).toHaveBeenCalledTimes(1);
    expect(lastInsertValues).toMatchObject({
      role: 'admin',
      createdByUserId: null,
      isSuperadmin: false
    });
  });

  it('allows admin to invite a manager with a profile assignment', async () => {
    selectedGets = [{ id: 'profile-1', name: 'Profile One' }, undefined];

    const result = await actions.invite({
      request: makeRequest({
        email: 'invitee@example.com',
        role: 'manager',
        profileId: 'profile-1',
        customMessage: 'Welcome aboard'
      }) as never,
      locals: { user: makeUser({ id: 'admin-1', role: 'admin', isSuperadmin: true }) },
      url: new URL('http://localhost:5173/users')
    } as never);

    expect(result).toEqual({ ok: true });
    expect(createInvitationMock).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      role: 'manager',
      profileId: 'profile-1',
      invitedByUserId: 'admin-1',
      customMessage: 'Welcome aboard'
    });
    expect(sendInvitationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        role: 'manager',
        profileName: 'Profile One',
        inviterName: 'Actor'
      })
    );
  });

  it('blocks duplicate active invitations for the same email', async () => {
    selectedGets = [{ id: 'profile-1', name: 'Profile One' }, undefined];
    findActiveInvitationByEmailMock.mockReturnValue({ id: 'invite-existing' });

    const result = await actions.invite({
      request: makeRequest({
        email: 'invitee@example.com',
        role: 'operator',
        profileId: 'profile-1'
      }) as never,
      locals: { user: makeUser({ id: 'admin-1', role: 'admin' }) },
      url: new URL('http://localhost:5173/users')
    } as never);

    expect((result as { status: number }).status).toBe(409);
    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('blocks managers from revoking invitations they do not own', async () => {
    selectedGet = {
      id: 'invite-2',
      email: 'invitee@example.com',
      role: 'operator',
      profileId: 'profile-1',
      invitedByUserId: 'other-manager',
      acceptedAt: null,
      revokedAt: null
    };

    const result = await actions.revokeInvite({
      request: makeRequest({ id: 'invite-2' }) as never,
      locals: { user: makeUser({ id: 'mgr-1', role: 'manager' }) }
    } as never);

    expect((result as { status: number }).status).toBe(403);
    expect(revokeInvitationMock).not.toHaveBeenCalled();
  });

  it('blocks manager from updating foreign operator', async () => {
    selectedGet = {
      id: 'op-2',
      name: 'Foreign Operator',
      email: 'op-2@example.com',
      role: 'operator',
      createdByUserId: 'mgr-2'
    };

    const result = await actions.update({
      request: makeRequest({
        id: 'op-2',
        name: 'Foreign Operator Updated',
        email: 'op-2@example.com',
        role: 'operator'
      }) as never,
      locals: { user: makeUser({ id: 'mgr-1', role: 'manager' }) }
    } as never);

    expect((result as { status: number }).status).toBe(403);
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('allows manager to delete own operator', async () => {
    selectedGet = {
      id: 'op-1',
      name: 'Owned Operator',
      email: 'op-1@example.com',
      role: 'operator',
      createdByUserId: 'mgr-1'
    };

    const result = await actions.delete({
      request: makeRequest({ id: 'op-1' }) as never,
      locals: { user: makeUser({ id: 'mgr-1', role: 'manager' }) }
    } as never);

    expect(result).toEqual({ ok: true });
    expect(deleteRun).toHaveBeenCalledTimes(1);
  });

  it('allows admin to enable MFA when explicitly provided in update form', async () => {
    selectedGet = {
      id: 'adm-2',
      name: 'Target Admin',
      email: 'target-admin@example.com',
      role: 'admin',
      createdByUserId: null
    };

    const result = await actions.update({
      request: makeRequest({
        id: 'adm-2',
        name: 'Target Admin',
        email: 'target-admin@example.com',
        role: 'admin',
        mfaEnabledProvided: '1',
        mfaEnabled: 'on'
      }) as never,
      locals: { user: makeUser({ id: 'adm-1', role: 'admin', isSuperadmin: true }) }
    } as never);

    expect(result).toEqual({ ok: true });
    expect(updateRun).toHaveBeenCalledTimes(1);
    expect(lastUpdateValues).toMatchObject({ mfaEnabled: true });
  });

  it('blocks manager from updating MFA when field is explicitly provided', async () => {
    selectedGet = {
      id: 'op-1',
      name: 'Owned Operator',
      email: 'op-1@example.com',
      role: 'operator',
      createdByUserId: 'mgr-1'
    };

    const result = await actions.update({
      request: makeRequest({
        id: 'op-1',
        name: 'Owned Operator',
        email: 'op-1@example.com',
        role: 'operator',
        mfaEnabledProvided: '1',
        mfaEnabled: 'on'
      }) as never,
      locals: { user: makeUser({ id: 'mgr-1', role: 'manager' }) }
    } as never);

    expect((result as { status: number }).status).toBe(403);
    expect(updateRun).not.toHaveBeenCalled();
  });
});
