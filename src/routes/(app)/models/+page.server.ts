import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import { encryptSecret, isEncryptedSecret } from '$lib/server/secrets.js';
import {
  assertCanAccessProfile,
  getVisibleProfileIds,
  requireUser
} from '$lib/server/authz.js';
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

function sanitizeBackendsForClient() {
  const backends = db.select().from(schema.backends).orderBy(asc(schema.backends.name)).all();

  for (const backend of backends) {
    if (backend.apiKey && !isEncryptedSecret(backend.apiKey)) {
      db.update(schema.backends)
        .set({
          apiKey: encryptSecret(backend.apiKey),
          updatedAt: new Date()
        })
        .where(eq(schema.backends.id, backend.id))
        .run();
    }
  }

  return backends.map(({ apiKey: _apiKey, ...backend }) => backend);
}

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = getVisibleProfileIds(actor);

  const backends =
    visibleProfileIds === null
      ? sanitizeBackendsForClient()
      : sanitizeBackendsForClient().filter((backend) =>
        backend.profileId ? visibleProfileIds.includes(backend.profileId) : false
      );

  const modelsQuery = db
    .select()
    .from(schema.models)
    .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId));

  const modelRows =
    visibleProfileIds === null
      ? modelsQuery.orderBy(asc(schema.models.publicId)).all()
      : visibleProfileIds.length === 0
        ? []
        : modelsQuery
          .where(inArray(schema.backends.profileId, visibleProfileIds))
          .orderBy(asc(schema.models.publicId))
          .all();

  const models = modelRows.map((row) => ({
    ...row.models,
    backendName: row.backends?.name ?? null,
    backendProfileId: row.backends?.profileId ?? null
  }));

  const profiles =
    visibleProfileIds === null
      ? db.select().from(schema.profiles).orderBy(asc(schema.profiles.name)).all()
      : visibleProfileIds.length === 0
        ? []
        : db
          .select()
          .from(schema.profiles)
          .where(inArray(schema.profiles.id, visibleProfileIds))
          .orderBy(asc(schema.profiles.name))
          .all();

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

  return { backends, models, profiles, accessibleProviders, accessibleModels };
};

export const actions: Actions = {
  backendCreate: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const name = str(form.get('name'));
    const baseUrl = str(form.get('baseUrl'));
    const apiKey = str(form.get('apiKey'));
    const kind = str(form.get('kind')) || 'openai';
    const profileId = str(form.get('profileId')) || null;

    if (!name || !baseUrl || !apiKey) return fail(400, { error: 'name, baseUrl, apiKey required' });
    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must choose a profile-scoped backend' });
    }
    assertCanAccessProfile(actor, profileId);

    // Validate profile exists if provided
    if (profileId) {
      const profile = db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
      if (!profile) return fail(400, { error: 'Profile not found' });
    }

    db.insert(schema.backends)
      .values({
        id: nanoid(),
        name,
        kind: kind as 'openai' | 'anthropic' | 'custom',
        baseUrl,
        apiKey: encryptSecret(apiKey),
        profileId,
        enabled: true
      })
      .run();
    return { ok: true };
  },
  backendUpdate: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = str(form.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });
    const nextApiKey = str(form.get('apiKey'));
    const profileId = str(form.get('profileId')) || null;

    const existing = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.backends)
      .where(eq(schema.backends.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Backend not found' });
    assertCanAccessProfile(actor, existing.profileId);

    // Validate profile exists if provided
    if (profileId) {
      const profile = db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
      if (!profile) return fail(400, { error: 'Profile not found' });
    }
    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must keep backends profile-scoped' });
    }
    assertCanAccessProfile(actor, profileId);

    const backendPatch: {
      name: string;
      baseUrl: string;
      kind: 'openai' | 'anthropic' | 'custom';
      enabled: boolean;
      profileId: string | null;
      updatedAt: Date;
      apiKey?: string;
    } = {
      name: str(form.get('name')),
      baseUrl: str(form.get('baseUrl')),
      kind: (str(form.get('kind')) || 'openai') as 'openai' | 'anthropic' | 'custom',
      profileId,
      enabled: form.get('enabled') === 'on',
      updatedAt: new Date()
    };
    if (nextApiKey) backendPatch.apiKey = encryptSecret(nextApiKey);

    db.update(schema.backends).set(backendPatch).where(eq(schema.backends.id, id)).run();
    return { ok: true };
  },
  backendDelete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = str(form.get('id'));

    const existing = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.backends)
      .where(eq(schema.backends.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Backend not found' });
    assertCanAccessProfile(actor, existing.profileId);

    db.delete(schema.backends).where(eq(schema.backends.id, id)).run();
    return { ok: true };
  },
  modelCreate: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const publicId = str(form.get('publicId'));
    const displayName = str(form.get('displayName'));
    const backendId = str(form.get('backendId'));
    const upstreamId = str(form.get('upstreamId'));
    if (!publicId || !backendId || !upstreamId)
      return fail(400, { error: 'publicId, backendId, upstreamId required' });

    const backend = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.backends)
      .where(eq(schema.backends.id, backendId))
      .get();
    if (!backend) return fail(400, { error: 'Backend not found' });
    assertCanAccessProfile(actor, backend.profileId);

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
  modelUpdate: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = str(form.get('id'));
    if (!id) return fail(400, { error: 'Missing id' });

    const existing = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.models)
      .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId))
      .where(eq(schema.models.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Model not found' });
    assertCanAccessProfile(actor, existing.profileId ?? null);

    const backendId = str(form.get('backendId'));
    const targetBackend = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.backends)
      .where(eq(schema.backends.id, backendId))
      .get();
    if (!targetBackend) return fail(400, { error: 'Backend not found' });
    assertCanAccessProfile(actor, targetBackend.profileId);

    const extras = buildModelValues(form);
    db.update(schema.models)
      .set({
        publicId: str(form.get('publicId')),
        displayName: str(form.get('displayName')),
        backendId,
        upstreamId: str(form.get('upstreamId')),
        ...extras,
        updatedAt: new Date()
      })
      .where(eq(schema.models.id, id))
      .run();
    return { ok: true };
  },
  modelDelete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = str(form.get('id'));

    const existing = db
      .select({ profileId: schema.backends.profileId })
      .from(schema.models)
      .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId))
      .where(eq(schema.models.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Model not found' });
    assertCanAccessProfile(actor, existing.profileId ?? null);

    db.delete(schema.models).where(eq(schema.models.id, id)).run();
    return { ok: true };
  }
};
