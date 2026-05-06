import { authenticator } from 'otplib';
import { decryptSecret, encryptSecret } from '$lib/server/secrets.js';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function toOtpAuthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, 'AiBroker', secret);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return authenticator.verify({ token: token.replace(/\s+/g, ''), secret });
}

export function encryptTotpSecret(secret: string): string {
  return encryptSecret(secret);
}

export function decryptTotpSecret(secret: string): string {
  return decryptSecret(secret);
}
