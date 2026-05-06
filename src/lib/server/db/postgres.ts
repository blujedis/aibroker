import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.postgres.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// Keep a single pooled client for the process lifecycle.
const client = postgres(databaseUrl, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT_SEC ?? 20),
  connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_SEC ?? 10)
});

export const pgClient = client;
export const db = drizzle(client, { schema });
export { schema };
export type DB = typeof db;
