import { fail, type Actions } from '@sveltejs/kit';
import { eq, inArray, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import { filterEligibleModels } from '$lib/server/scope.js';
import { logScopeEvent } from '$lib/server/observability/scope.js';
import {
  assertCanAccessProfile,
  getVisibleProfileIds,
  requireUser
} from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

function generateToken(): string {
  return 'ab-' + nanoid(40);
}

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = getVisibleProfileIds(actor);

  const rowsQuery = db
    .select({
      id: schema.virtualKeys.id,
      name: schema.virtualKeys.name,
      profileId: schema.virtualKeys.profileId,
      profileName: schema.profiles.name,
      budget: schema.virtualKeys.budget,
      budgetFrequency: schema.virtualKeys.budgetFrequency,
      enabled: schema.virtualKeys.enabled,
      lastUsedAt: schema.virtualKeys.lastUsedAt,
      createdAt: schema.virtualKeys.createdAt
    })
    .from(schema.virtualKeys)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.virtualKeys.profileId));

  const rows =
    visibleProfileIds === null
      ? rowsQuery.all()
      : visibleProfileIds.length === 0
        ? []
        : rowsQuery.where(inArray(schema.virtualKeys.profileId, visibleProfileIds)).all();

  const profiles =
    visibleProfileIds === null
      ? db.select().from(schema.profiles).all()
      : visibleProfileIds.length === 0
        ? []
        : db.select().from(schema.profiles).where(inArray(schema.profiles.id, visibleProfileIds)).all();

  const modelsQuery = db
    .select()
    .from(schema.models)
    .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId));

  const modelRows =
    visibleProfileIds === null
      ? modelsQuery.all()
      : visibleProfileIds.length === 0
        ? []
        : modelsQuery
          .where(
            or(
              isNull(schema.backends.profileId),
              inArray(schema.backends.profileId, visibleProfileIds)
            )
          )
          .all();

  const models = modelRows.map((row) => ({
    ...row.models,
    backendProfileId: row.backends?.profileId ?? null
  }));

  // gather allowed model ids per key
  const allowed = db.select().from(schema.virtualKeyModels).all();
  const allowedByKey = new Map<string, string[]>();
  for (const a of allowed) {
    const arr = allowedByKey.get(a.virtualKeyId) ?? [];
    arr.push(a.modelId);
    allowedByKey.set(a.virtualKeyId, arr);
  }

  return {
    keys: rows.map((r) => ({ ...r, allowedModelIds: allowedByKey.get(r.id) ?? [] })),
    profiles,
    models
  };
};

function parseBudget(v: FormDataEntryValue | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function parseFreq(v: FormDataEntryValue | null): 'daily' | 'weekly' | 'monthly' | null {
  const s = String(v ?? '').toLowerCase();
  if (s === 'daily' || s === 'weekly' || s === 'monthly') return s;
  return null;
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const profileId = String(form.get('profileId') ?? '');
    if (!name || !profileId) return fail(400, { error: 'Name and profile are required' });
    assertCanAccessProfile(actor, profileId);

    const id = nanoid();
    const token = generateToken();
    db.insert(schema.virtualKeys)
      .values({
        id,
        profileId,
        name,
        token,
        budget: parseBudget(form.get('budget')),
        budgetFrequency: parseFreq(form.get('budgetFrequency')),
        enabled: true
      })
      .run();

    // Filter submitted modelIds to only eligible ones (auto-clean)
    const submittedModelIds = form.getAll('modelIds').map(String).filter(Boolean);
    const allModels = db
      .select()
      .from(schema.models)
      .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId))
      .all();

    const modelsWithBackendInfo = allModels.map((row) => ({
      id: row.models.id,
      backendProfileId: row.backends?.profileId ?? null
    }));

    const eligibleModelIds = filterEligibleModels(modelsWithBackendInfo, profileId);
    const ineligibleCount = submittedModelIds.length - eligibleModelIds.length;

    if (ineligibleCount > 0) {
      logScopeEvent('info', 'virtual_key_models_pruned_on_create', {
        profileId,
        virtualKeyId: id,
        submittedModelCount: submittedModelIds.length,
        keptModelCount: eligibleModelIds.length,
        prunedModelCount: ineligibleCount
      });
    }

    for (const m of eligibleModelIds) {
      db.insert(schema.virtualKeyModels).values({ virtualKeyId: id, modelId: m }).run();
    }

    return {
      ok: true,
      createdToken: token,
      ...(ineligibleCount > 0 && { warning: `${ineligibleCount} model(s) were excluded due to profile scope mismatch` })
    };
  },
  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });

    const existing = db
      .select({ profileId: schema.virtualKeys.profileId })
      .from(schema.virtualKeys)
      .where(eq(schema.virtualKeys.id, id))
      .get();

    if (!existing) return fail(404, { error: 'Virtual key not found' });
    assertCanAccessProfile(actor, existing.profileId);

    const profileId = String(form.get('profileId') ?? '');
    assertCanAccessProfile(actor, profileId);
    db.update(schema.virtualKeys)
      .set({
        name: String(form.get('name') ?? '').trim(),
        profileId,
        budget: parseBudget(form.get('budget')),
        budgetFrequency: parseFreq(form.get('budgetFrequency')),
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.virtualKeys.id, id))
      .run();

    // replace allow-list with eligible models only (auto-clean)
    db.delete(schema.virtualKeyModels)
      .where(eq(schema.virtualKeyModels.virtualKeyId, id))
      .run();

    const submittedModelIds = form.getAll('modelIds').map(String).filter(Boolean);
    const allModels = db
      .select()
      .from(schema.models)
      .leftJoin(schema.backends, eq(schema.backends.id, schema.models.backendId))
      .all();

    const modelsWithBackendInfo = allModels.map((row) => ({
      id: row.models.id,
      backendProfileId: row.backends?.profileId ?? null
    }));

    const eligibleModelIds = filterEligibleModels(modelsWithBackendInfo, profileId);
    const ineligibleCount = submittedModelIds.length - eligibleModelIds.length;

    if (ineligibleCount > 0) {
      logScopeEvent('info', 'virtual_key_models_pruned_on_update', {
        profileId,
        virtualKeyId: id,
        submittedModelCount: submittedModelIds.length,
        keptModelCount: eligibleModelIds.length,
        prunedModelCount: ineligibleCount
      });
    }

    for (const m of eligibleModelIds) {
      db.insert(schema.virtualKeyModels).values({ virtualKeyId: id, modelId: m }).run();
    }

    return {
      ok: true,
      ...(ineligibleCount > 0 && { warning: `${ineligibleCount} model(s) were excluded due to profile scope mismatch` })
    };
  },
  rotate: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });

    const existing = db
      .select({ profileId: schema.virtualKeys.profileId })
      .from(schema.virtualKeys)
      .where(eq(schema.virtualKeys.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Virtual key not found' });
    assertCanAccessProfile(actor, existing.profileId);

    const token = generateToken();
    db.update(schema.virtualKeys)
      .set({ token, updatedAt: new Date() })
      .where(eq(schema.virtualKeys.id, id))
      .run();
    return { ok: true, rotatedToken: token };
  },
  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });

    const existing = db
      .select({ profileId: schema.virtualKeys.profileId })
      .from(schema.virtualKeys)
      .where(eq(schema.virtualKeys.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Virtual key not found' });
    assertCanAccessProfile(actor, existing.profileId);

    db.delete(schema.virtualKeys).where(eq(schema.virtualKeys.id, id)).run();
    return { ok: true };
  }
};
