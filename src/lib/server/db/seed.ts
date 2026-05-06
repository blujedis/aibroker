import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, pgClient, schema } from './postgres.js';

export async function bootstrapAdminIfNeeded(): Promise<void> {
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

  // eslint-disable-next-line no-console
  console.log(`[aibroker] seeded bootstrap admin '${email}'`);
}

// Allow `pnpm db:seed` to call this directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapAdminIfNeeded()
    .then(async () => {
      await pgClient.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[aibroker] postgres seed failed', error);
      await pgClient.end();
      process.exit(1);
    });
}

export async function ensureAdmin(): Promise<void> {
  await bootstrapAdminIfNeeded();
}

// simple helper to check if email exists
export async function userByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ?? null;
}
