import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import { guardrailSummary } from '$lib/server/stats.js';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
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

export const load: PageServerLoad = ({ url }) => {
  const rangeKey = (url.searchParams.get('range') as RangeKey) ?? 'last7';
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const range = resolveRange(rangeKey, { start, end });
  const guardrails = db.select().from(schema.guardrails).all();
  const summary = guardrailSummary(range);
  return {
    guardrails,
    summary,
    rangeKey,
    start: start ?? '',
    end: end ?? ''
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const stage = String(form.get('stage') ?? 'pre') as 'pre' | 'during' | 'post';
    const configRaw = String(form.get('config') ?? '{}');
    if (!name) return fail(400, { error: 'name required' });
    try {
      JSON.parse(configRaw);
    } catch {
      return fail(400, { error: 'config must be valid JSON' });
    }
    db.insert(schema.guardrails)
      .values({
        id: nanoid(),
        name,
        stage,
        kind: parseKind(form.get('kind')),
        config: configRaw,
        priority: Number(form.get('priority') ?? 100) | 0,
        enabled: true
      })
      .run();
    return { ok: true };
  },
  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const configRaw = String(form.get('config') ?? '{}');
    try {
      JSON.parse(configRaw);
    } catch {
      return fail(400, { error: 'config must be valid JSON' });
    }
    db.update(schema.guardrails)
      .set({
        name: String(form.get('name') ?? ''),
        stage: String(form.get('stage') ?? 'pre') as 'pre' | 'during' | 'post',
        kind: parseKind(form.get('kind')),
        config: configRaw,
        priority: Number(form.get('priority') ?? 100) | 0,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.guardrails.id, id))
      .run();
    return { ok: true };
  },
  delete: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    db.delete(schema.guardrails).where(eq(schema.guardrails.id, id)).run();
    return { ok: true };
  }
};
