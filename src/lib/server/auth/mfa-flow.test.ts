import { describe, expect, it } from 'vitest';
import { getPendingMfaDestination, isMfaEnrollmentComplete } from './mfa-flow.js';

describe('isMfaEnrollmentComplete', () => {
  it('returns false when MFA is disabled', () => {
    expect(isMfaEnrollmentComplete({ mfaEnabled: false, mfaSecret: null })).toBe(false);
    expect(isMfaEnrollmentComplete({ mfaEnabled: false, mfaSecret: 'secret' })).toBe(false);
  });

  it('returns false when MFA is enabled but secret is missing', () => {
    expect(isMfaEnrollmentComplete({ mfaEnabled: true, mfaSecret: null })).toBe(false);
    expect(isMfaEnrollmentComplete({ mfaEnabled: true, mfaSecret: '' })).toBe(false);
  });

  it('returns true when MFA is enabled and secret is present', () => {
    expect(isMfaEnrollmentComplete({ mfaEnabled: true, mfaSecret: 'secret' })).toBe(true);
  });
});

describe('getPendingMfaDestination', () => {
  it('routes to setup until enrollment is complete', () => {
    expect(getPendingMfaDestination({ mfaEnabled: false, mfaSecret: null })).toBe('/mfa/setup');
    expect(getPendingMfaDestination({ mfaEnabled: true, mfaSecret: null })).toBe('/mfa/setup');
  });

  it('routes to verify after enrollment is complete', () => {
    expect(getPendingMfaDestination({ mfaEnabled: true, mfaSecret: 'secret' })).toBe(
      '/mfa/verify'
    );
  });
});
