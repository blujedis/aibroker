import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  if (locals.pendingUser) {
    throw redirect(303, locals.pendingUser.mfaEnabled ? '/mfa/verify' : '/mfa/setup');
  }
  throw redirect(303, '/login');
};
