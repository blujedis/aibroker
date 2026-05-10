import { pgClient } from './postgres.js';
import { ensureSchemaReady } from './ready.js';
import { logger } from '../observability/logger.js';

const migrateLogger = logger.child({ component: 'db.migrate' });

async function runMigrations(): Promise<void> {
  await ensureSchemaReady();
  migrateLogger.info('db.migration.completed');
  await pgClient.end();
}

runMigrations().catch(async (error) => {
  migrateLogger.error('db.migration.failed', { err: error });
  await pgClient.end();
  process.exit(1);
});
