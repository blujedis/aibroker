import { fail } from '@sveltejs/kit';
import { reapExpiredSessions } from '$lib/server/auth/session.js';
import { getQueueStats } from '$lib/server/proxy/concurrency.js';
import { ingestCatalog, type RawCatalog } from '$lib/server/catalog.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return {
    env: {
      MAX_CONCURRENT_PER_BACKEND: process.env.MAX_CONCURRENT_PER_BACKEND ?? '16',
      UPSTREAM_TIMEOUT_MS: process.env.UPSTREAM_TIMEOUT_MS ?? '60000',
      UPSTREAM_STREAM_TIMEOUT_MS: process.env.UPSTREAM_STREAM_TIMEOUT_MS ?? '300000',
      BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@local'
    },
    queueStats: getQueueStats()
  };
};

export const actions: Actions = {
  reapSessions: () => {
    const n = reapExpiredSessions();
    return { ok: true, reaped: n };
  },
  catalogUpload: async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail(400, { error: 'Missing file' });
    let parsed: RawCatalog;
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as RawCatalog;
    } catch (err) {
      return fail(400, { error: `Invalid JSON: ${(err as Error).message}` });
    }
    const result = ingestCatalog(parsed);
    return { ok: true, catalog: result };
  }
};
