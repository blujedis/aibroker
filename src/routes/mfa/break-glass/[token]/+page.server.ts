import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
  consumeBreakGlassToken,
  disableMfaForUser,
  verifyBreakGlassToken
} from '$lib/server/auth/mfa-break-glass.js';
import { db, schema } from '$lib/server/db/index.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const userId = verifyBreakGlassToken(params.token);
  return { valid: userId !== null };
};

export const actions: Actions = {
  default: async ({ params }) => {
    const userId = verifyBreakGlassToken(params.token);
    if (!userId) return fail(400, { error: 'This recovery link is invalid or has expired.' });

    disableMfaForUser(userId);

    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
    db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, userId)).run();

    consumeBreakGlassToken(params.token);

    throw redirect(303, '/login?mfa_reset=1');
  }
};
