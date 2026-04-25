import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

const urlFromEnv = process.env.DATABASE_URL ?? 'file:./data/aibroker.db';

const filePath = urlFromEnv.startsWith('file:')
  ? urlFromEnv.slice('file:'.length)
  : urlFromEnv;
const resolved = resolve(filePath);

mkdirSync(dirname(resolved), { recursive: true });

export const sqlite = new Database(resolved);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');

export const db = drizzle(sqlite, { schema });
export { schema };
export type DB = typeof db;
