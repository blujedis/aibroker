import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const SECRET_PREFIX = 'enc:v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getMasterKey(): Buffer {
  const secret = process.env.MASTER_KEY_SECRET?.trim();
  if (!secret) {
    throw new Error('MASTER_KEY_SECRET must be configured to encrypt backend API keys');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${SECRET_PREFIX}:`);
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return plainText;
  if (isEncryptedSecret(plainText)) return plainText;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join(':');
}

export function decryptSecret(secretText: string): string {
  if (!secretText) return secretText;
  if (!isEncryptedSecret(secretText)) return secretText;

  const parts = secretText.split(':');
  if (parts.length !== 5) {
    throw new Error('Encrypted secret has an invalid format');
  }

  const iv = Buffer.from(parts[2], 'base64url');
  const authTag = Buffer.from(parts[3], 'base64url');
  const ciphertext = Buffer.from(parts[4], 'base64url');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted secret has invalid parameters');
  }

  const decipher = createDecipheriv('aes-256-gcm', getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}