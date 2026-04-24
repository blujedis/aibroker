import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import { ingestCatalog, type RawCatalog } from '$lib/server/catalog.js';
import type { PageServerLoad } from './$types';

const BOOL_FIELDS = [
  'enabled',
  'supportsStreaming',
  'hasZdrProvider',
  'hasNoPromptTrainingProvider',
  'hasHipaaCompliantProvider'
] as const;

const PRICE_FIELDS = [
  'inputPricePerMTokens',
  'outputPricePerMTokens',
  'cachedInputPricePerMTokens',
  'imageInputPricePerMTokens',
  'audioInputPricePerMTokens',
  'videoInputPricePerMTokens',
  'imagePricePerMTokens',
  'videoPricePerMTokens',
  'webSearchCallPricePerMTokens'
] as const;

const INT_FIELDS = ['contextSize', 'maxOutputTokens'] as const;

const META_TEXT_FIELDS = [
  'type',
  'description',
  'releaseDate',
  'websiteUrl',
  'modelUrl',
  'pricingUrl',
  'playgroundUrl'
] as const;

function num(v: FormDataEntryValue | null): number {
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim();
}

function parseTags(v: FormDataEntryValue | null): string {
  const raw = String(v ?? '[]');
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return JSON.stringify(arr.filter((x) => typeof x === 'string'));
  } catch {
    /* fall through */
  }
  return '[]';
}

function buildModelValues(form: FormData): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const k of PRICE_FIELDS) v[k] = num(form.get(k));
  for (const k of INT_FIELDS) v[k] = intOrNull(form.get(k));
  for (const k of META_TEXT_FIELDS) {
    const s = str(form.get(k));
    v[k] = s === '' ? null : s;
  }
  if (!v.type) v.type = 'chat';
  v.tags = parseTags(form.get('tags'));
  for (const k of BOOL_FIELDS) v[k] = form.get(k) === 'on';
  return v;
}

function safeJsonArray(v: string): string[] {
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const load: PageServerLoad = () => {
  const backends = db.select().from(schema.backends).orderBy(asc(schema.backends.name)).all();

  const models = db
    .select()
    .from(schema.models)
    .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId))
    .orderBy(asc(schema.models.publicId))
    .all()
    .map((row) => ({
      ...row.models,
      backendName: row.backends?.name ?? null
    }));

  const accessibleProviders = db
    .select()
    .from(schema.accessibleProviders)
    .where(eq(schema.accessibleProviders.enabled, true))
    .orderBy(asc(schema.accessibleProviders.name))
    .all();

  const accessibleModels = db
    .select()
    .from(schema.accessibleModels)
    .where(eq(schema.accessibleModels.enabled, true))
    .orderBy(asc(schema.accessibleModels.slug))
    .all()
    .map((m) => ({
      ...m,
      tagsParsed: safeJsonArray(m.tags),
      providersParsed: safeJsonArray(m.providers)
    }));

  return { backends, models, accessibleProviders, accessibleModels };
};

export const actions: Actions = {
  backendCreate: async ({ request }) => {
    const form = await request.formData();
    const name = str(form.get('name'));
    const baseUrl = str(form.get('baseUrl'));
    const apiKey = str(form.get('apiKey'));
    const kind = str(form.get('kind')) || 'openai';
    if (!name || !baseUrl || !apiKey) return fail(400, { error: 'name, baseUrl, apiKey required' });
    db.insert(schema.backends)
      .values({
        id: nanoid(),
        name,
        kind: kind as 'openai' | 'anthropic' | 'custom',
        baseUrl,
        apiKey,
        enabled: true
      })
      .run();
    return { ok: true };
  },
  backendUpdate: async ({ request }) => {
    const form = await request.formData();
    const id = str(form.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    db.update(schema.backends)
      .set({
        name: str(form.get('name')),
        baseUrl: str(form.get('baseUrl')),
        apiKey: str(form.get('apiKey')),
        kind: (str(form.get('kind')) || 'openai') as 'openai' | 'anthropic' | 'custom',
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.backends.id, id))
      .run();
    return { ok: true };
  },
  backendDelete: async ({ request }) => {
    const form = await request.formData();
    const id = str(form.get('id'));
    db.delete(schema.backends).where(eq(schema.backends.id, id)).run();
    return { ok: true };
  },
  modelCreate: async ({ request }) => {
    const form = await request.formData();
    const publicId = str(form.get('publicId'));
    const displayName = str(form.get('displayName'));
    const backendId = str(form.get('backendId'));
    const upstreamId = str(form.get('upstreamId'));
    if (!publicId || !backendId || !upstreamId)
      return fail(400, { error: 'publicId, backendId, upstreamId required' });
    const extras = buildModelValues(form);
    db.insert(schema.models)
      .values({
        id: nanoid(),
        publicId,
        displayName: displayName || publicId,
        backendId,
        upstreamId,
        ...extras,
        enabled: form.has('enabled') ? form.get('enabled') === 'on' : true,
        supportsStreaming: form.has('supportsStreaming')
          ? form.get('supportsStreaming') === 'on'
          : true
      })
      .run();
    return { ok: true };
  },
  modelUpdate: async ({ request }) => {
    const form = await request.formData();
    const id = str(form.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    const extras = buildModelValues(form);
    db.update(schema.models)
      .set({
        publicId: str(form.get('publicId')),
        displayName: str(form.get('displayName')),
        backendId: str(form.get('backendId')),
        upstreamId: str(form.get('upstreamId')),
        ...extras,
        updatedAt: new Date()
      })
      .where(eq(schema.models.id, id))
      .run();
    return { ok: true };
  },
  modelDelete: async ({ request }) => {
    const form = await request.formData();
    const id = str(form.get('id'));
    db.delete(schema.models).where(eq(schema.models.id, id)).run();
    return { ok: true };
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
