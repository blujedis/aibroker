import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pgClient } from './postgres.js';

async function runMigrations(): Promise<void> {
  await migrate(db, {
    migrationsFolder: './drizzle'
  });
  // eslint-disable-next-line no-console
  console.log('[aibroker] postgres migrations completed');
  await pgClient.end();
}

runMigrations().catch(async (error) => {
  console.error('[aibroker] postgres migrations failed', error);
  await pgClient.end();
  process.exit(1);
});
