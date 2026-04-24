import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.user) throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  return { user: locals.user };
};
