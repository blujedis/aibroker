import { redirect, error } from '@sveltejs/kit';
import { createOAuthState } from '$lib/server/auth/oauth/state.js';
import { getGoogleAuthUrl, isGoogleConfigured } from '$lib/server/auth/oauth/google.js';
import type { RequestHandler } from './$types';

const SUPPORTED_PROVIDERS = ['google'] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

function assertProvider(p: string): asserts p is Provider {
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(p)) {
    throw error(404, 'Unknown OAuth provider');
  }
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const provider = params.provider;
  assertProvider(provider);

  const intentParam = url.searchParams.get('intent') ?? 'login';
  const intent = intentParam === 'link' ? 'link' : 'login';

  // Link intent requires an authenticated user
  if (intent === 'link' && !locals.user) {
    throw redirect(303, '/login');
  }
  const actorUserId = intent === 'link' ? (locals.user?.id ?? undefined) : undefined;

  if (provider === 'google') {
    if (!isGoogleConfigured()) {
      throw error(503, 'Google OAuth is not configured');
    }
    const { state, codeVerifier } = await createOAuthState(provider, intent, actorUserId);
    const authUrl = await getGoogleAuthUrl(state, codeVerifier);
    throw redirect(303, authUrl.toString());
  }

  throw error(404, 'Unknown OAuth provider');
};
