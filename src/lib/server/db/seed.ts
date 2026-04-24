import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from './index.js';
import { ensureSchema } from './bootstrap.js';

export async function bootstrapAdminIfNeeded(): Promise<void> {
  ensureSchema();
  const existing = db.select({ id: schema.users.id }).from(schema.users).limit(1).all();
  if (existing.length > 0) return;

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@local';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'admin';
  const passwordHash = await hash(password);

  db.insert(schema.users)
    .values({
      id: nanoid(),
      email,
      name: 'Administrator',
      passwordHash,
      role: 'admin'
    })
    .run();

  // eslint-disable-next-line no-console
  console.log(`[nostraproxy] seeded bootstrap admin '${email}'`);
}

// Allow `pnpm db:seed` to call this directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapAdminIfNeeded().then(() => process.exit(0));
}

export async function ensureAdmin(): Promise<void> {
  await bootstrapAdminIfNeeded();
}

// simple helper to check if email exists
export function userByEmail(email: string) {
  return db.select().from(schema.users).where(eq(schema.users.email, email)).get();
}
