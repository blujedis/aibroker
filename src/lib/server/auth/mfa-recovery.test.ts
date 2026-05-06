import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRecoveryCodeValue,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode
} from './mfa-recovery.js';

describe('normalizeRecoveryCode', () => {
  it('normalizes case and punctuation', () => {
    expect(normalizeRecoveryCode('ab12-cd34')).toBe('AB12CD34');
    expect(normalizeRecoveryCode(' a b 1 2 c d 3 4 ')).toBe('AB12CD34');
  });
});

describe('hashRecoveryCode', () => {
  it('hashes normalized values deterministically', () => {
    const expected = createHash('sha256').update('AB12CD34').digest('hex');
    expect(hashRecoveryCode('ab12-cd34')).toBe(expected);
    expect(hashRecoveryCode('ab12-cd34')).toBe(hashRecoveryCode('AB12CD34'));
  });
});

describe('createRecoveryCodeValue', () => {
  it('returns code in XXXX-XXXX format', () => {
    expect(createRecoveryCodeValue()).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
  });
});

describe('generateRecoveryCodes', () => {
  it('returns requested number of unique codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
});
