import { fail } from '@sveltejs/kit';
import { reapExpiredSessions } from '$lib/server/auth/session.js';
import { getQueueStats } from '$lib/server/proxy/concurrency.js';
import { ingestCatalog, type RawCatalog } from '$lib/server/catalog.js';
import { requireAdmin, requireSuperadmin } from '$lib/server/authz.js';
import { getGlobalSettings, setGlobalMfaEnabled } from '$lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireAdmin(locals.user);
  const settings = await getGlobalSettings();

  return {
    user,
    env: {
      MAX_CONCURRENT_PER_BACKEND: process.env.MAX_CONCURRENT_PER_BACKEND ?? '16',
      UPSTREAM_TIMEOUT_MS: process.env.UPSTREAM_TIMEOUT_MS ?? '60000',
      UPSTREAM_STREAM_TIMEOUT_MS: process.env.UPSTREAM_STREAM_TIMEOUT_MS ?? '300000',
      BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@local',
      SESSION_TTL: process.env.SESSION_TTL ?? '30d',
      INVITE_EXPIRY_HOURS: process.env.INVITE_EXPIRY_HOURS ?? '72',
      MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN ?? '-',
      MAILGUN_FROM_EMAIL: process.env.MAILGUN_FROM_EMAIL ?? '-'
    },
    settings,
    queueStats: getQueueStats()
  };
};

export const actions: Actions = {
  reapSessions: async ({ locals }) => {
    requireAdmin(locals.user);
    const n = await reapExpiredSessions();
    return { ok: true, reaped: n };
  },
  catalogUpload: async ({ request, locals }) => {
    requireAdmin(locals.user);
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
    const result = await ingestCatalog(parsed);
    return { ok: true, catalog: result };
  },
  setGlobalMfa: async ({ request, locals }) => {
    requireSuperadmin(locals.user);
    const form = await request.formData();
    const enabled = String(form.get('enabled') ?? '') === 'on';
    await setGlobalMfaEnabled(enabled);
    return { ok: true, globalMfaEnabled: enabled };
  }
};
