import { reapExpiredSessions } from '$lib/server/auth/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return {
    env: {
      MAX_CONCURRENT_UPSTREAM: process.env.MAX_CONCURRENT_UPSTREAM ?? '32',
      BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@local'
    }
  };
};

export const actions: Actions = {
  reapSessions: () => {
    const n = reapExpiredSessions();
    return { ok: true, reaped: n };
  }
};
