import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.postgres.js';
import { logger } from '../observability/logger.js';

type PgLogLevel = typeof PG_LOG_LEVELS[number];

const dbLogger = logger.child({ component: 'db.postgres' });

const DATABASE_LOG_LEVEL = (process.env.DATABASE_LOG_LEVEL || 'WARNING').toUpperCase();

const PG_LOG_LEVELS = ['PANIC', 'FATAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'LOG', 'DEBUG1', 'DEBUG2', 'DEBUG3', 'DEBUG4', 'DEBUG5'] as const;

const DATABASE_LOG_LEVEL_INDEX = PG_LOG_LEVELS.indexOf((DATABASE_LOG_LEVEL as PgLogLevel));
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/aibroker';

let hasConnected = false;

function resolveDatabaseUrl(): { url: string; source: 'DATABASE_CONNECTION_URL' | 'default' } {
  const fromConnectionUrl = process.env.DATABASE_CONNECTION_URL?.trim();
  if (fromConnectionUrl) {
    return { url: fromConnectionUrl, source: 'DATABASE_CONNECTION_URL' };
  }

  return { url: DEFAULT_DATABASE_URL, source: 'default' };
}

// Validate database URL at first use (lazy) so the module can be imported
// during build-time analysis (e.g. SvelteKit SSR analyse step) without a
// live database connection available.
function requireDatabaseUrl(): string {
  const { url, source } = resolveDatabaseUrl();
  const parsed = new URL(url);

  dbLogger.info('db.connection.configured', {
    source,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: getDatabaseName(url),
    ssl: parsed.searchParams.get('sslmode') ?? null
  });

  if (source === 'default') {
    dbLogger.warn('db.connection.using_default_url', {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      database: getDatabaseName(url)
    });
  }

  if (!url) throw new Error('DATABASE_CONNECTION_URL is not set');

  if (!hasConnected) {
    console.log(`\nDatabase connected to: ${parsed.hostname}:${parsed.port}\n`);
    hasConnected = true;
  }
  return url;
}

function getDatabaseName(url: string): string {
  const parsed = new URL(url);
  const value = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  if (!value) throw new Error('DATABASE_CONNECTION_URL must include a database name in the path');
  return value;
}

function toAdminDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  return parsed.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

// postgres-js defers TCP connections until the first query, so creating the
// client here is safe even if the database URL env var is not yet set — it will only be
// read when getDb() / getClient() is called for the first time.
let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _ensureDatabasePromise: Promise<void> | undefined;

export async function ensureDatabaseExists(): Promise<void> {
  if (_ensureDatabasePromise) return _ensureDatabasePromise;

  _ensureDatabasePromise = (async () => {
    const url = requireDatabaseUrl();
    const databaseName = getDatabaseName(url);
    const adminUrl = toAdminDatabaseUrl(url);
    const adminClient = postgres(adminUrl, {
      max: 1,
      idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT_SEC ?? 20),
      connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_SEC ?? 10)
    });

    try {
      const rows = await adminClient`select 1 from pg_database where datname = ${databaseName} limit 1`;
      if (rows.length > 0) return;

      const quotedName = quoteIdentifier(databaseName);
      await adminClient.unsafe(`create database ${quotedName}`);
      dbLogger.warn('db.database.created', { database: databaseName });
    }
    catch (error) {
      const maybePgError = error as { code?: string };
      if (maybePgError.code !== '42P04') {
        throw error;
      }
    }
    finally {
      await adminClient.end();
    }
  })();

  return _ensureDatabasePromise;
}

function handleNotice(notice: { severity: PgLogLevel, message: string, routine: string; }) {
  const severityIndex = PG_LOG_LEVELS.indexOf(notice.severity as PgLogLevel);
  if (severityIndex < 0 || severityIndex > DATABASE_LOG_LEVEL_INDEX) return;

  const payload = {
    severity: notice.severity,
    message: notice.message,
    routine: notice.routine
  };

  if (notice.severity === 'ERROR' || notice.severity === 'FATAL' || notice.severity === 'PANIC') {
    dbLogger.error('db.notice', payload);
    return;
  }
  if (notice.severity === 'WARNING') {
    dbLogger.warn('db.notice', payload);
    return;
  }
  dbLogger.info('db.notice', payload);
}

function getClient(): ReturnType<typeof postgres> {
  if (!_client) {
    const url = requireDatabaseUrl();
    _client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT_SEC ?? 20),
      connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_SEC ?? 10),
      onnotice: handleNotice as any
    });
  }
  return _client;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

export const pgClient = new Proxy({} as ReturnType<typeof postgres>, {
  get(_, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
  apply(_, thisArg, args) {
    return Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, thisArg, args);
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  }
});

export { schema };
export type DB = typeof db;
