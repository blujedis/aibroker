import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, ensureDatabaseExists } from './postgres.js';

let _ensureSchemaPromise: Promise<void> | undefined;

export async function ensureSchemaReady(): Promise<void> {
  if (_ensureSchemaPromise) return _ensureSchemaPromise;

  _ensureSchemaPromise = (async () => {
    await ensureDatabaseExists();
    await migrate(db, {
      migrationsFolder: './drizzle'
    });
  })();

  return _ensureSchemaPromise;
}
