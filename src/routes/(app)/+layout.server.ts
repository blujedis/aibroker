import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (locals.pendingUser) {
    throw redirect(303, locals.pendingUser.mfaEnabled ? '/mfa/verify' : '/mfa/setup');
  }
  if (!locals.user) throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  if (locals.user.role === 'operator' && !url.pathname.startsWith('/profile')) {
    throw redirect(303, '/profile');
  }
  return { user: locals.user };
};
