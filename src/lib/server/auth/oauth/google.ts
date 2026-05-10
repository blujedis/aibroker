import { Google, decodeIdToken } from 'arctic';
import { env } from '$env/dynamic/private';

function buildRedirectUrl(origin: string) {
  return origin.trim() + '/auth/google/callback';
}

function getGoogleClient(origin: string): Google {
  return new Google(env.GOOGLE_CLIENT_ID!, env.GOOGLE_CLIENT_SECRET!, (env.GOOGLE_OAUTH_REDIRECT_URI!).trim() || buildRedirectUrl(origin));
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URI);
}

export async function getGoogleAuthUrl(state: string, codeVerifier: string, origin: string): Promise<URL> {
  const google = getGoogleClient(origin);
  return google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
}

export interface GoogleUserInfo {
  googleUserId: string;
  email: string;
  name: string | null;
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  origin: string
): Promise<GoogleUserInfo> {
  const google = getGoogleClient(origin);
  const tokens = await google.validateAuthorizationCode(code, codeVerifier);

  const idToken = tokens.idToken();
  const claims = decodeIdToken(idToken) as Record<string, unknown>;

  const googleUserId = String(claims['sub'] ?? '');
  const email = String(claims['email'] ?? '');
  const name = claims['name'] ? String(claims['name']) : null;

  if (!googleUserId || !email) {
    throw new Error('Missing required fields in Google ID token');
  }

  return { googleUserId, email, name };
}
