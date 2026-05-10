
import { table } from 'table';
import { createHash, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { asc, eq, isNotNull, lt, or } from 'drizzle-orm';
import { hashPasswordWithPepper, verifyPasswordWithPepper } from './hashpass';
import clipboardy from 'clipboardy';
import { parseModels } from './scraper-vercel';
import { buildMfaBreakGlassUrl, sendMfaBreakGlassEmail } from '../src/lib/server/mail/mailgun.js';
import { db, pgClient, schema } from '../src/lib/server/db/postgres.js';
import { bootstrapAdminIfNeeded } from '../src/lib/server/db/seed.js';
import { aiBrokerRemove, aiBrokerRun, aiBrokerStop, dockerPruneVolumes, postgresRemove, postgresRun, postgresStop } from './docker.js';

const args = process.argv.slice(2);
const command = args[0];
const value1 = args[1] || '';
const value2 = args[2] || '';
const PEPPER = process.env.PASSWORD_PEPPER || '';

function showHelp() {
  console.log('Commands:');
  console.log('$ pnpm <command>', 'ex:', '$ pnpm hash-pass mypassword');
  console.log('Note: passwords, hashes must be escaped for special chars.\n');
  console.log('$ hash-pass    <password>          - Copies hashed password to clipboard.');
  console.log('$ verify-pass  <password> <hash>   - Verifies if password/hash are match.');
  console.log('$ get-models                       - Gets AI model configurations.');
  console.log('$ break-glass                      - Sends superadmin a short-lived MFA recovery link.');
  console.log('$ postgres-run                     - Runs Postgres container.');
  console.log('$ postgres-stop                    - Stops Postgres container.');
  console.log('$ postgres-rm                      - Removes Postgres container & volume.');
  console.log('$ aibroker-run                     - Runs Postgres container.');
  console.log('$ aibroker-stop                    - Stops Postgres container.');
  console.log('$ aibroker-rm                      - Removes Postgres container & volume.');
  console.log('$ docker-prune-vol                 - Prunes all unused volumes.');
  console.log('$ db-purge                         - Purges all Postgres data (development-only; requires confirmation).');
  console.log();
}

function showError(message: string) {
  if (!message) return;
  console.log(message);
}

async function copyToClipboard(value: string) {
  try {
    await clipboardy.write(value);
    return true;
  } catch (_) {
    return false;
  }
}

async function hashPassword(password: string) {
  if (!password)
    return showError(`Cannot hash password of null or undefined.\n\nCommand is pnpm cli:hash [password]\n`);
  const result = await hashPasswordWithPepper(password, PEPPER);
  console.log(table([
    ['Password', 'Hashed'],
    [password, result]
  ]));
  const copied = await copyToClipboard(result);
  if (copied)
    console.log('Copied Hash to Clipboard.\n');
  process.exit(0);
}

async function verifyPassword(password: string, hash: string) {
  console.log('submitted hash:', hash);
  if (!password)
    return showError(`Cannot unhash password of null or undefined.\n\nCommand is pnpm cli:hash [password] [current_hash]\n`);
  if (!hash)
    return showError(`Cannot uhhash hash of null or undefined.\n\nCommand is pnpm cli:hash [password] [current_hash]\n`);
  const result = await verifyPasswordWithPepper(password, hash, PEPPER);
  console.log(table([
    ['Password', 'Hash', 'Verified'],
    [password, hash, result]
  ]));
  console.log();
  process.exit(0);
}

function getBreakGlassExpiryMinutes(): number {
  const value = Number(process.env.MFA_BREAK_GLASS_EXPIRY_MINUTES ?? 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function createBreakGlassTokenValue(): string {
  return randomBytes(32).toString('hex');
}

function hashBreakGlassToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function sendBreakGlassRecoveryEmail() {
  const [superadmin] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.isSuperadmin, true))
    .orderBy(asc(schema.users.createdAt))
    .limit(1);

  if (!superadmin) {
    console.log('No superadmin account found. Cannot issue break-glass token.');
    process.exit(1);
  }

  const expiryMinutes = getBreakGlassExpiryMinutes();
  const token = createBreakGlassTokenValue();
  const tokenHash = hashBreakGlassToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await db.delete(schema.mfaBreakGlassTokens)
    .where(
      or(
        eq(schema.mfaBreakGlassTokens.userId, superadmin.id),
        isNotNull(schema.mfaBreakGlassTokens.usedAt),
        lt(schema.mfaBreakGlassTokens.expiresAt, new Date())
      )
    )
    .execute();

  await db.insert(schema.mfaBreakGlassTokens)
    .values({
      id: randomBytes(12).toString('hex'),
      userId: superadmin.id,
      tokenHash,
      expiresAt
    })
    .execute();

  const breakGlassUrl = buildMfaBreakGlassUrl(token);

  await sendMfaBreakGlassEmail({
    to: superadmin.email,
    breakGlassUrl,
    expiresInMinutes: expiryMinutes
  });

  console.log(`Break-glass email sent to ${superadmin.email}. Expires in ${expiryMinutes} minutes.`);
  process.exit(0);
}

function ensureDevelopmentModeForDbPurge() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('db-purge is only available when NODE_ENV=development.');
  }

  if (process.env.ALLOW_DB_PURGE !== '1') {
    throw new Error('db-purge requires ALLOW_DB_PURGE=1 to be set.');
  }
}

function getDatabaseNameFromUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
    return databaseName || 'unknown';
  }
  catch {
    return 'unknown';
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function confirmDatabasePurge(databaseName: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('db-purge requires an interactive terminal (TTY).');
    return false;
  }

  const expected = `PURGE ${databaseName}`;
  const rl = createInterface({ input, output });
  try {
    console.log('WARNING: this will permanently delete all data from public schema tables.');
    const answer = await rl.question(`Type "${expected}" to continue: `);
    return answer.trim() === expected;
  }
  finally {
    rl.close();
  }
}

async function purgeDatabase() {
  try {
    ensureDevelopmentModeForDbPurge();

    const databaseUrl = process.env.DATABASE_CONNECTION_URL ?? 'postgresql://postgres:postgres@localhost:5432/aibroker';
    const databaseName = getDatabaseNameFromUrl(databaseUrl);
    const confirmed = await confirmDatabasePurge(databaseName);

    if (!confirmed) {
      console.log('Aborted. No data was deleted.');
      process.exit(1);
    }

    const tables = await pgClient<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename <> '__drizzle_migrations'
      order by tablename
    `;

    if (tables.length > 0) {
      const tableNames = tables.map((row) => quoteIdentifier(row.tablename)).join(', ');
      await pgClient.unsafe(`truncate table ${tableNames} restart identity cascade`);
    }

    await bootstrapAdminIfNeeded();

    console.log(`Purge complete for database '${databaseName}'.`);
    console.log(`Purged ${tables.length} table(s) in schema public.`);
    console.log('Bootstrap admin was re-seeded if no users remained.');
    process.exit(0);
  }
  catch (error) {
    console.error('db-purge failed.', error);
    process.exit(1);
  }
  finally {
    await pgClient.end({ timeout: 5 });
  }
}

if (command === 'help') {
  showHelp();
}
else if (command === 'hash-pass') {
  hashPassword(value1);
}
else if (command === 'verify-pass') {
  verifyPassword(value1, value2);
}
else if (command === 'get-models') {
  parseModels();
}
else if (command === 'break-glass') {
  sendBreakGlassRecoveryEmail();
}
else if (command === 'postgres-run') {
  postgresRun();
}
else if (command === 'postgres-stop') {
  postgresStop();
}
else if (command === 'postgres-rm') {
  postgresRemove();
}
else if (command === 'aibroker-run') {
  aiBrokerRun();
}
else if (command === 'aibroker-stop') {
  aiBrokerStop();
}
else if (command === 'aibroker-rm') {
  aiBrokerRemove();
}
else if (command === 'docker-prune-vol') {
  dockerPruneVolumes();
}
else if (command === 'db-purge') {
  purgeDatabase();
}
else {
  console.log('Command -', command, 'is unknown.\n');
  process.exit(0);
}