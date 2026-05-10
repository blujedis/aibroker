import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import {
  createPasswordResetTokenValue,
  hashPasswordResetToken
} from '$lib/server/auth/password-reset.js';

describe('createPasswordResetTokenValue', () => {
  it('returns a 64-char hex string', () => {
    const token = createPasswordResetTokenValue();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a unique value each call', () => {
    const a = createPasswordResetTokenValue();
    const b = createPasswordResetTokenValue();
    expect(a).not.toBe(b);
  });
});

describe('hashPasswordResetToken', () => {
  it('returns the SHA-256 hex digest of the input', () => {
    const token = 'abc123';
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashPasswordResetToken(token)).toBe(expected);
  });

  it('is deterministic', () => {
    expect(hashPasswordResetToken('x')).toBe(hashPasswordResetToken('x'));
  });
});
