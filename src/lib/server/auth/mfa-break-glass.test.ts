import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBreakGlassTokenValue,
  getBreakGlassExpiryMinutes,
  hashBreakGlassToken
} from './mfa-break-glass.js';

const ORIGINAL_EXPIRY = Number(process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES || 10);

afterEach(() => {
  if (ORIGINAL_EXPIRY === undefined) {
    delete process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES;
  } else {
    process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES = ORIGINAL_EXPIRY + '';
  }
});

describe('getBreakGlassExpiryMinutes', () => {
  it('uses valid env values', () => {
    process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES = '5';
    expect(getBreakGlassExpiryMinutes()).toBe(5);
  });

  it('falls back to default when env is invalid', () => {
    process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES = 'invalid';
    expect(getBreakGlassExpiryMinutes()).toBe(10);
  });
});

describe('createBreakGlassTokenValue', () => {
  it('creates a 64-char hex token', () => {
    const token = createBreakGlassTokenValue();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashBreakGlassToken', () => {
  it('uses SHA-256 hex digest', () => {
    const token = 'abc123';
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashBreakGlassToken(token)).toBe(expected);
  });
});
