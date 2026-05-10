import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, pgClient, schema } from './postgres.js';
import { ensureSchemaReady } from './ready.js';
import { logger } from '../observability/logger.js';

const seedLogger = logger.child({ component: 'db.seed' });

export async function bootstrapAdminIfNeeded(): Promise<void> {
  await ensureSchemaReady();
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length > 0) return;

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@local';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'admin';
  const passwordHash = await hash(password);

  await db.insert(schema.users)
    .values({
      id: nanoid(),
      email,
      name: 'Administrator',
      passwordHash,
      role: 'admin',
      isSuperadmin: true
    })
    .execute();

  seedLogger.info('db.seed.bootstrap_admin_created', { email });
}

// Allow `pnpm db:seed` to call this directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapAdminIfNeeded()
    .then(async () => {
      await pgClient.end();
      process.exit(0);
    })
    .catch(async (error) => {
      seedLogger.error('db.seed.failed', { err: error });
      await pgClient.end();
      process.exit(1);
    });
}

export async function hasAnyUser(): Promise<boolean> {
  const rows = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return rows.length > 0;
}

export async function ensureAdmin(): Promise<void> {
  // Only auto-seed if BOOTSTRAP_ADMIN_EMAIL is explicitly configured.
  // Without it the interactive /setup onboarding form creates the first user.
  if (!process.env.BOOTSTRAP_ADMIN_EMAIL) return;
  await bootstrapAdminIfNeeded();
}

// simple helper to check if email exists
export async function userByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ?? null;
}
