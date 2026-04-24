import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types';

function generateToken(): string {
  return 'np-' + nanoid(40);
}

export const load: PageServerLoad = () => {
  const rows = db
    .select({
      id: schema.virtualKeys.id,
      name: schema.virtualKeys.name,
      token: schema.virtualKeys.token,
      profileId: schema.virtualKeys.profileId,
      profileName: schema.profiles.name,
      budget: schema.virtualKeys.budget,
      budgetFrequency: schema.virtualKeys.budgetFrequency,
      enabled: schema.virtualKeys.enabled,
      lastUsedAt: schema.virtualKeys.lastUsedAt,
      createdAt: schema.virtualKeys.createdAt
    })
    .from(schema.virtualKeys)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.virtualKeys.profileId))
    .all();

  const profiles = db.select().from(schema.profiles).all();
  const models = db.select().from(schema.models).all();

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
  create: async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const profileId = String(form.get('profileId') ?? '');
    if (!name || !profileId) return fail(400, { error: 'Name and profile are required' });
    const id = nanoid();
    db.insert(schema.virtualKeys)
      .values({
        id,
        profileId,
        name,
        token: generateToken(),
        budget: parseBudget(form.get('budget')),
        budgetFrequency: parseFreq(form.get('budgetFrequency')),
        enabled: true
      })
      .run();
    const modelIds = form.getAll('modelIds').map(String).filter(Boolean);
    for (const m of modelIds) {
      db.insert(schema.virtualKeyModels).values({ virtualKeyId: id, modelId: m }).run();
    }
    return { ok: true };
  },
  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    db.update(schema.virtualKeys)
      .set({
        name: String(form.get('name') ?? '').trim(),
        profileId: String(form.get('profileId') ?? ''),
        budget: parseBudget(form.get('budget')),
        budgetFrequency: parseFreq(form.get('budgetFrequency')),
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.virtualKeys.id, id))
      .run();

    // replace allow-list
    db.delete(schema.virtualKeyModels)
      .where(eq(schema.virtualKeyModels.virtualKeyId, id))
      .run();
    const modelIds = form.getAll('modelIds').map(String).filter(Boolean);
    for (const m of modelIds) {
      db.insert(schema.virtualKeyModels).values({ virtualKeyId: id, modelId: m }).run();
    }
    return { ok: true };
  },
  rotate: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    db.update(schema.virtualKeys)
      .set({ token: generateToken(), updatedAt: new Date() })
      .where(eq(schema.virtualKeys.id, id))
      .run();
    return { ok: true };
  },
  delete: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    db.delete(schema.virtualKeys).where(eq(schema.virtualKeys.id, id)).run();
    return { ok: true };
  }
};
