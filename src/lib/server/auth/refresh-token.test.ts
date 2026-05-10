import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/postgres.js', () => ({
  db: {},
  schema: {}
}));

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn()
}));

vi.mock('$lib/server/observability/logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: warnMock,
      error: vi.fn(),
      child: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: warnMock,
        error: vi.fn(),
        child: vi.fn()
      })
    })
  }
}));

import {
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  clearRefreshTokenCookie,
  clearSessionCookie,
  parseRefreshTokenTtlToMs,
  parseSessionTtlToMs,
  resolveRefreshTokenTtlMs,
  resolveSessionTtlMs,
  setRefreshTokenCookie,
  setSessionCookie
} from './session.js';

describe('session ttl parsing', () => {
  it('parses valid session ttl values', () => {
    expect(parseSessionTtlToMs('30m')).toBe(30 * 60 * 1000);
    expect(parseSessionTtlToMs('12h')).toBe(12 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('1y')).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('returns null for invalid ttl values', () => {
    expect(parseSessionTtlToMs('')).toBeNull();
    expect(parseSessionTtlToMs('abc')).toBeNull();
    expect(parseSessionTtlToMs('10x')).toBeNull();
    expect(parseSessionTtlToMs('0h')).toBeNull();
  });

  it('parses valid refresh token ttl values', () => {
    expect(parseRefreshTokenTtlToMs('45 minutes')).toBe(45 * 60 * 1000);
    expect(parseRefreshTokenTtlToMs('2days')).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('falls back to defaults for undefined or invalid env values', () => {
    warnMock.mockClear();

    expect(resolveSessionTtlMs(undefined)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(resolveRefreshTokenTtlMs(undefined)).toBe(30 * 24 * 60 * 60 * 1000);

    expect(resolveSessionTtlMs('invalid')).toBe(30 * 24 * 60 * 60 * 1000);
    expect(resolveRefreshTokenTtlMs('invalid')).toBe(30 * 24 * 60 * 60 * 1000);

    expect(warnMock).toHaveBeenCalledTimes(2);
  });
});

describe('session cookie helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets and clears session cookie with expected name', () => {
    const cookies = {
      set: vi.fn(),
      delete: vi.fn()
    };

    setSessionCookie(cookies as unknown as import('@sveltejs/kit').Cookies, 'session-id-1');
    expect(cookies.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      'session-id-1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      })
    );

    clearSessionCookie(cookies as unknown as import('@sveltejs/kit').Cookies);
    expect(cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });

  it('sets and clears refresh token cookie with expected name', () => {
    const cookies = {
      set: vi.fn(),
      delete: vi.fn()
    };

    setRefreshTokenCookie(cookies as unknown as import('@sveltejs/kit').Cookies, 'refresh-token-1');
    expect(cookies.set).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token-1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      })
    );

    clearRefreshTokenCookie(cookies as unknown as import('@sveltejs/kit').Cookies);
    expect(cookies.delete).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, { path: '/' });
  });
});
