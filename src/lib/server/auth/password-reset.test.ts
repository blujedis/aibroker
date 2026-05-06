import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema.js';
import { createHash } from 'node:crypto';

// ----------------------------------------------------------------
// Isolated in-memory DB setup for tests
// ----------------------------------------------------------------

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    is_superadmin INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    mfa_enrolled_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`);

const db = drizzle(sqlite, { schema });

// Seed a test user
const TEST_USER_ID = 'user-test-001';
db.insert(schema.users)
  .values({
    id: TEST_USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed',
    role: 'operator'
  })
  .run();

// ----------------------------------------------------------------
// Unit-test the pure functions directly — no DB needed
// ----------------------------------------------------------------

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
