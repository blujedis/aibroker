import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import { guardrailSummary } from '$lib/server/stats.js';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
import { assertCanAccessProfile, getVisibleProfileIds, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

type GuardrailKind =
  | 'regex_block'
  | 'regex_redact'
  | 'keyword_block'
  | 'max_tokens'
  | 'pii_redact';

const VALID_KINDS: readonly GuardrailKind[] = [
  'regex_block',
  'regex_redact',
  'keyword_block',
  'max_tokens',
  'pii_redact'
];

function parseKind(v: FormDataEntryValue | null): GuardrailKind {
  const s = String(v ?? '') as GuardrailKind;
  return VALID_KINDS.includes(s) ? s : 'regex_block';
}

export const load: PageServerLoad = async ({ url, locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = await getVisibleProfileIds(actor);

  const rangeKey = (url.searchParams.get('range') as RangeKey) ?? 'last7';
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const range = resolveRange(rangeKey, { start, end });
  const guardrails =
    visibleProfileIds === null
      ? await db.select().from(schema.guardrails)
      : visibleProfileIds.length === 0
        ? []
        : await db
          .select()
          .from(schema.guardrails)
          .where(inArray(schema.guardrails.profileId, visibleProfileIds));

  const profiles =
    visibleProfileIds === null
      ? await db.select().from(schema.profiles).orderBy(asc(schema.profiles.name))
      : visibleProfileIds.length === 0
        ? []
        : await db
          .select()
          .from(schema.profiles)
          .where(inArray(schema.profiles.id, visibleProfileIds))
          .orderBy(asc(schema.profiles.name));
  const summary = await guardrailSummary(range);
  return {
    guardrails,
    profiles,
    summary,
    rangeKey,
    start: start ?? '',
    end: end ?? ''
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const stage = String(form.get('stage') ?? 'pre') as 'pre' | 'during' | 'post';
    const configRaw = String(form.get('config') ?? '{}');
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must choose a profile scope' });
    }
    assertCanAccessProfile(actor, profileId);

    if (!name) return fail(400, { error: 'name required' });

    // Validate profile exists if provided
    if (profileId) {
      const profileRows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
      if (!profileRows[0]) return fail(400, { error: 'Profile not found' });
    }

    try {
      JSON.parse(configRaw);
    } catch {
      return fail(400, { error: 'config must be valid JSON' });
    }
    await db.insert(schema.guardrails)
      .values({
        id: nanoid(),
        name,
        stage,
        kind: parseKind(form.get('kind')),
        config: configRaw,
        profileId,
        priority: Number(form.get('priority') ?? 100) | 0,
        enabled: true
      })
    return { ok: true };
  },
  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const configRaw = String(form.get('config') ?? '{}');
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    const existingRows = await db
      .select({ profileId: schema.guardrails.profileId })
      .from(schema.guardrails)
      .where(eq(schema.guardrails.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return fail(404, { error: 'Guardrail not found' });
    assertCanAccessProfile(actor, existing.profileId);
    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must keep profile scope' });
    }
    assertCanAccessProfile(actor, profileId);

    // Validate profile exists if provided
    if (profileId) {
      const profileRows2 = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
      if (!profileRows2[0]) return fail(400, { error: 'Profile not found' });
    }

    try {
      JSON.parse(configRaw);
    } catch {
      return fail(400, { error: 'config must be valid JSON' });
    }
    await db.update(schema.guardrails)
      .set({
        name: String(form.get('name') ?? ''),
        stage: String(form.get('stage') ?? 'pre') as 'pre' | 'during' | 'post',
        kind: parseKind(form.get('kind')),
        config: configRaw,
        profileId,
        priority: Number(form.get('priority') ?? 100) | 0,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.guardrails.id, id))
    return { ok: true };
  },
  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');

    const existingRows = await db
      .select({ profileId: schema.guardrails.profileId })
      .from(schema.guardrails)
      .where(eq(schema.guardrails.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return fail(404, { error: 'Guardrail not found' });
    assertCanAccessProfile(actor, existing.profileId);

    await db.delete(schema.guardrails).where(eq(schema.guardrails.id, id));
    return { ok: true };
  }
};
