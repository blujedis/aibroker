import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import {
  createPasswordResetToken,
  getPasswordResetExpiryHours
} from '$lib/server/auth/password-reset.js';
import {
  buildPasswordResetUrl,
  sendPasswordResetEmail
} from '$lib/server/mail/mailgun.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();

    if (!email) return fail(400, { error: 'Email is required' });

    // Always return the same success-like response to prevent email enumeration.
    const user = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (user) {
      try {
        const rawToken = createPasswordResetToken(user.id);
        const resetUrl = buildPasswordResetUrl(rawToken, url.origin);
        await sendPasswordResetEmail({
          to: email,
          resetUrl,
          expiresInHours: getPasswordResetExpiryHours()
        });
      } catch {
        // Swallow errors silently — we never reveal whether the email exists
        // or whether the mail send succeeded. Log server-side in future.
      }
    }

    return { sent: true };
  }
};
