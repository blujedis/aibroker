import { describe, expect, it } from 'vitest';
import { getPostLoginDestination, shouldMarkSessionMfaComplete } from './login-flow.js';

describe('getPostLoginDestination', () => {
  it('routes to dashboard when neither global nor user MFA are enabled', () => {
    expect(
      getPostLoginDestination({
        globalMfaEnabled: false,
        userMfaEnabled: false
      })
    ).toBe('/dashboard');
  });

  it('routes to verify when global MFA is disabled but user MFA is enabled', () => {
    expect(
      getPostLoginDestination({
        globalMfaEnabled: false,
        userMfaEnabled: true
      })
    ).toBe('/mfa/verify');
  });

  it('routes to setup when global MFA is enabled and user is not enrolled', () => {
    expect(
      getPostLoginDestination({
        globalMfaEnabled: true,
        userMfaEnabled: false
      })
    ).toBe('/mfa/setup');
  });

  it('routes to verify when global MFA is enabled and user is enrolled', () => {
    expect(
      getPostLoginDestination({
        globalMfaEnabled: true,
        userMfaEnabled: true
      })
    ).toBe('/mfa/verify');
  });
});

describe('shouldMarkSessionMfaComplete', () => {
  it('marks session complete only when neither global nor user MFA are enabled', () => {
    expect(shouldMarkSessionMfaComplete({ globalMfaEnabled: false, userMfaEnabled: false })).toBe(
      true
    );
    expect(shouldMarkSessionMfaComplete({ globalMfaEnabled: true, userMfaEnabled: false })).toBe(
      false
    );
    expect(shouldMarkSessionMfaComplete({ globalMfaEnabled: false, userMfaEnabled: true })).toBe(
      false
    );
  });
});
