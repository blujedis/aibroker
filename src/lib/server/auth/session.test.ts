import { describe, expect, it } from 'vitest';
import {
  parseRefreshTokenTtlToMs,
  parseSessionTtlToMs,
  resolveRefreshTokenTtlMs,
  resolveSessionTtlMs
} from './session.js';

describe('parseSessionTtlToMs', () => {
  it('parses short unit syntax', () => {
    expect(parseSessionTtlToMs('30m')).toBe(30 * 60 * 1000);
    expect(parseSessionTtlToMs('12h')).toBe(12 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('1y')).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('parses long unit syntax', () => {
    expect(parseSessionTtlToMs('45 minutes')).toBe(45 * 60 * 1000);
    expect(parseSessionTtlToMs('2 hours')).toBe(2 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('3 days')).toBe(3 * 24 * 60 * 60 * 1000);
    expect(parseSessionTtlToMs('1 year')).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('returns null for invalid values', () => {
    expect(parseSessionTtlToMs('')).toBeNull();
    expect(parseSessionTtlToMs('10')).toBeNull();
    expect(parseSessionTtlToMs('0h')).toBeNull();
    expect(parseSessionTtlToMs('5w')).toBeNull();
    expect(parseSessionTtlToMs('abc')).toBeNull();
  });
});

describe('resolveSessionTtlMs', () => {
  it('returns default for undefined or invalid values', () => {
    expect(resolveSessionTtlMs(undefined)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(resolveSessionTtlMs('invalid')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('uses parsed env value when valid', () => {
    expect(resolveSessionTtlMs('90m')).toBe(90 * 60 * 1000);
  });
});

describe('parseRefreshTokenTtlToMs', () => {
  it('parses supported units', () => {
    expect(parseRefreshTokenTtlToMs('30m')).toBe(30 * 60 * 1000);
    expect(parseRefreshTokenTtlToMs('6h')).toBe(6 * 60 * 60 * 1000);
    expect(parseRefreshTokenTtlToMs('10 days')).toBe(10 * 24 * 60 * 60 * 1000);
  });

  it('returns null for invalid values', () => {
    expect(parseRefreshTokenTtlToMs('')).toBeNull();
    expect(parseRefreshTokenTtlToMs('soon')).toBeNull();
    expect(parseRefreshTokenTtlToMs('0h')).toBeNull();
  });
});

describe('resolveRefreshTokenTtlMs', () => {
  it('returns default for undefined or invalid values', () => {
    expect(resolveRefreshTokenTtlMs(undefined)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(resolveRefreshTokenTtlMs('bad')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('uses parsed env value when valid', () => {
    expect(resolveRefreshTokenTtlMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
