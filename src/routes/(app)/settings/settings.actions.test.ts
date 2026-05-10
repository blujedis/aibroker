import { beforeEach, describe, expect, it, vi } from 'vitest';

let requireAdminMock: ReturnType<typeof vi.fn>;
let requireSuperadminMock: ReturnType<typeof vi.fn>;
let getGlobalSettingsMock: ReturnType<typeof vi.fn>;
let setGlobalMfaEnabledMock: ReturnType<typeof vi.fn>;
let getQueueStatsMock: ReturnType<typeof vi.fn>;
let reapExpiredSessionsMock: ReturnType<typeof vi.fn>;
let ingestCatalogMock: ReturnType<typeof vi.fn>;

vi.mock('$lib/server/auth/session.js', () => {
  reapExpiredSessionsMock = vi.fn(() => 0);
  return {
    reapExpiredSessions: reapExpiredSessionsMock
  };
});

vi.mock('$lib/server/proxy/concurrency.js', () => {
  getQueueStatsMock = vi.fn(() => ({ backendA: { concurrency: 1, pending: 2 } }));
  return {
    getQueueStats: getQueueStatsMock
  };
});

vi.mock('$lib/server/catalog.js', () => {
  ingestCatalogMock = vi.fn(() => ({
    providersInserted: 0,
    providersUpdated: 0,
    modelsInserted: 0,
    modelsUpdated: 0
  }));
  return {
    ingestCatalog: ingestCatalogMock
  };
});

vi.mock('$lib/server/authz.js', () => {
  requireAdminMock = vi.fn((user) => user);
  requireSuperadminMock = vi.fn();

  return {
    requireAdmin: requireAdminMock,
    requireSuperadmin: requireSuperadminMock
  };
});

vi.mock('$lib/server/settings.js', () => {
  getGlobalSettingsMock = vi.fn(() => ({ globalMfaEnabled: false }));
  setGlobalMfaEnabledMock = vi.fn();

  return {
    getGlobalSettings: getGlobalSettingsMock,
    setGlobalMfaEnabled: setGlobalMfaEnabledMock
  };
});

const { load, actions } = await import('./+page.server.js');

function makeRequest(fields: Record<string, string>): { formData: () => Promise<FormData> } {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return {
    formData: async () => form
  };
}

describe('settings page server behavior', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockImplementation((user) => user);

    requireSuperadminMock.mockReset();

    getGlobalSettingsMock.mockReset();
    getGlobalSettingsMock.mockReturnValue({ globalMfaEnabled: false });

    setGlobalMfaEnabledMock.mockReset();

    getQueueStatsMock.mockReset();
    getQueueStatsMock.mockReturnValue({ backendA: { concurrency: 1, pending: 2 } });

    reapExpiredSessionsMock.mockReset();
    reapExpiredSessionsMock.mockReturnValue(0);

    ingestCatalogMock.mockClear();
  });

  it('loads settings data for admins', async () => {
    const user = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      isSuperadmin: true,
      mfaEnabled: false
    };

    const data = await load({ locals: { user } } as never);

    expect(requireAdminMock).toHaveBeenCalledWith(user);
    expect(data).toMatchObject({
      user,
      settings: { globalMfaEnabled: false },
      queueStats: { backendA: { concurrency: 1, pending: 2 } },
      env: {
        MAX_CONCURRENT_PER_BACKEND: expect.any(String),
        UPSTREAM_TIMEOUT_MS: expect.any(String),
        UPSTREAM_STREAM_TIMEOUT_MS: expect.any(String),
        BOOTSTRAP_ADMIN_EMAIL: expect.any(String)
      }
    });
  });

  it('sets global MFA to true when checkbox is checked', async () => {
    const result = await actions.setGlobalMfa({
      request: makeRequest({ enabled: 'on' }) as never,
      locals: { user: { id: 'admin-1' } }
    } as never);

    expect(requireSuperadminMock).toHaveBeenCalledWith({ id: 'admin-1' });
    expect(setGlobalMfaEnabledMock).toHaveBeenCalledWith(true);
    expect(result).toEqual({ ok: true, globalMfaEnabled: true });
  });

  it('sets global MFA to false when checkbox is not checked', async () => {
    const result = await actions.setGlobalMfa({
      request: makeRequest({}) as never,
      locals: { user: { id: 'admin-1' } }
    } as never);

    expect(setGlobalMfaEnabledMock).toHaveBeenCalledWith(false);
    expect(result).toEqual({ ok: true, globalMfaEnabled: false });
  });

  it('enforces superadmin check for global MFA updates', async () => {
    requireSuperadminMock.mockImplementation(() => {
      throw new Error('forbidden');
    });

    await expect(
      actions.setGlobalMfa({
        request: makeRequest({ enabled: 'on' }) as never,
        locals: { user: { id: 'manager-1' } }
      } as never)
    ).rejects.toThrow('forbidden');
  });
});