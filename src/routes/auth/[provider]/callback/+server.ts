import { redirect, error } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';
import { consumeOAuthState } from '$lib/server/auth/oauth/state.js';
import { findIdentity, linkIdentity } from '$lib/server/auth/oauth/identity.js';
import { exchangeGoogleCode } from '$lib/server/auth/oauth/google.js';
import {
  createSession,
  createRefreshToken,
  setSessionCookie,
  setRefreshTokenCookie
} from '$lib/server/auth/session.js';
import {
  getPostLoginDestination,
  shouldMarkSessionMfaComplete
} from '$lib/server/auth/login-flow.js';
import { findActiveInvitationByEmail, acceptInvitation } from '$lib/server/invitations/service.js';
import { ensureProfileAssignmentsExist } from '$lib/server/authz.js';
import { getGlobalSettings } from '$lib/server/settings.js';
import { logger } from '$lib/server/observability/logger.js';
import type { RequestHandler } from './$types';

const oauthLogger = logger.child({ component: 'auth.oauth.callback' });

const SUPPORTED_PROVIDERS = ['google'] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

function assertProvider(p: string): asserts p is Provider {
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(p)) {
    throw error(404, 'Unknown OAuth provider');
  }
}

export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
  const provider = params.provider;
  assertProvider(provider);

  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    // User denied access or something else went wrong
    throw redirect(303, `/login?oauth_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !stateParam) {
    throw error(400, 'Missing OAuth code or state');
  }

  // Validate and consume state (CSRF protection)
  const stateRow = await consumeOAuthState(stateParam);
  if (!stateRow) {
    throw error(400, 'Invalid or expired OAuth state');
  }
  if (stateRow.provider !== provider) {
    throw error(400, 'OAuth provider mismatch');
  }

  // Exchange code for user info
  let userInfo: { googleUserId: string; email: string; name: string | null };
  try {
    if (provider === 'google') {
      userInfo = await exchangeGoogleCode(code, stateRow.codeVerifier, url.origin);
    } else {
      throw error(404, 'Unknown OAuth provider');
    }
  } catch (err) {
    oauthLogger.error('auth.oauth.exchange.failed', { provider, err });
    throw redirect(303, '/login?oauth_error=exchange_failed');
  }

  const { googleUserId: providerUserId, email, name } = userInfo;

  // ── LINK intent ──────────────────────────────────────────────────────────
  if (stateRow.intent === 'link') {
    const actorUserId = stateRow.actorUserId;
    if (!actorUserId) {
      throw error(400, 'No actor for link intent');
    }
    // Prevent linking an identity already attached to another account
    const existing = await findIdentity(provider, providerUserId);
    if (existing && existing.userId !== actorUserId) {
      throw redirect(303, '/profile?oauth_error=already_linked_other');
    }
    if (!existing) {
      await linkIdentity(actorUserId, provider, providerUserId, email);
    }
    throw redirect(303, '/profile?linked=1');
  }

  // ── LOGIN intent ─────────────────────────────────────────────────────────

  // 1. Already linked identity → sign in
  let resolvedUserId: string | null = null;
  const identityRow = await findIdentity(provider, providerUserId);
  if (identityRow) {
    resolvedUserId = identityRow.userId;
  }

  // 2. Existing local user with matching email → auto-link
  if (!resolvedUserId) {
    const localUserRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    const localUser = localUserRows[0];

    if (localUser) {
      await linkIdentity(localUser.id, provider, providerUserId, email);
      resolvedUserId = localUser.id;
    }
  }

  // 3. Active invitation for this email → create user + link
  if (!resolvedUserId) {
    const invitation = await findActiveInvitationByEmail(email);
    if (!invitation) {
      // No invitation → access denied
      throw redirect(303, '/login?oauth_error=no_invitation');
    }

    const userId = nanoid();
    // OAuth users have no password — store an unusable sentinel value
    const unusablePasswordHash = `$oauth_only$${randomBytes(32).toString('hex')}`;

    await db.insert(schema.users)
      .values({
        id: userId,
        email: email.toLowerCase(),
        name: name ?? email.split('@')[0],
        passwordHash: unusablePasswordHash,
        role: invitation.role,
        isSuperadmin: false,
        createdByUserId: invitation.invitedByUserId,
        mfaEnabled: false
      });

    await ensureProfileAssignmentsExist(userId, [invitation.profileId]);
    await acceptInvitation(invitation.id, userId);
    await linkIdentity(userId, provider, providerUserId, email);

    resolvedUserId = userId;
  }

  // Verify the user record still exists (safety check)
  const userRows = await db
    .select({
      id: schema.users.id,
      mfaEnabled: schema.users.mfaEnabled
    })
    .from(schema.users)
    .where(eq(schema.users.id, resolvedUserId))
    .limit(1);
  const user = userRows[0];

  if (!user) {
    throw error(500, 'User record not found after OAuth resolution');
  }

  const { globalMfaEnabled } = await getGlobalSettings();
  const userMfaEnabled = Boolean(user.mfaEnabled);
  const isMfaComplete = shouldMarkSessionMfaComplete({ globalMfaEnabled, userMfaEnabled });

  const sessionId = await createSession(user.id, { isMfaComplete });
  const refreshToken = await createRefreshToken(user.id, { isMfaComplete });

  setSessionCookie(cookies, sessionId);
  setRefreshTokenCookie(cookies, refreshToken);

  throw redirect(303, getPostLoginDestination({ globalMfaEnabled, userMfaEnabled }));
};
