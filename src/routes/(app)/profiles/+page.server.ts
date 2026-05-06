import { fail, type Actions } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import { getVisibleProfileIds, requireAdmin, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = await getVisibleProfileIds(actor);
  const profiles =
    visibleProfileIds === null
      ? await db.select().from(schema.profiles)
      : visibleProfileIds.length === 0
        ? []
        : await db.select().from(schema.profiles).where(inArray(schema.profiles.id, visibleProfileIds));
  return { profiles };
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
    requireAdmin(locals.user);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return fail(400, { error: 'Name is required' });
    await db.insert(schema.profiles)
      .values({
        id: nanoid(),
        name,
        description: String(form.get('description') ?? '') || null,
        globalBudget: parseBudget(form.get('globalBudget')),
        globalBudgetFrequency: parseFreq(form.get('globalBudgetFrequency')),
        enabled: true
      });
    return { ok: true };
  },
  update: async ({ request, locals }) => {
    requireAdmin(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    await db.update(schema.profiles)
      .set({
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '') || null,
        globalBudget: parseBudget(form.get('globalBudget')),
        globalBudgetFrequency: parseFreq(form.get('globalBudgetFrequency')),
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.profiles.id, id));
    return { ok: true };
  },
  delete: async ({ request, locals }) => {
    requireAdmin(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    await db.delete(schema.profiles).where(eq(schema.profiles.id, id));
    return { ok: true };
  }
};
