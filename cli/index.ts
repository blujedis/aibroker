
import { table } from 'table';
import { hashPasswordWithPepper, verifyPasswordWithPepper } from './hashpass';
import clipboardy from 'clipboardy';
import { parseModels } from './scraper-vercel';

const args = process.argv.slice(2);
const command = args[0];
const value1 = args[1] || '';
const value2 = args[2] || '';
const PEPPER = process.env.PASSWORD_PEPPER || '';

function showHelp() {
  console.log('Commands:');
  console.log('Prefix with bun run "./path/to/this/migrator.ts" <command>"');
  console.log('Note: passwords, hashes must be escaped for special chars.\n');
  console.log('$    hash <password>          - Copies hashed password to clipboard.');
  console.log('$  verify <password> <hash>   - Verifies if password/hash are match.');
  console.log('$ pricing                     - Gets AI model pricing.');
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

if (command === 'help') {
  showHelp();
}
else if (command === 'hash') {
  hashPassword(value1);
}
else if (command === 'verify') {
  verifyPassword(value1, value2);
}
else if (command === 'models') {
  parseModels();
}
else {
  console.log('Command -', command, 'is unknown.\n');
  process.exit(0);
}