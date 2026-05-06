import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import { assertCanAccessProfile, getVisibleProfileIds, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = await getVisibleProfileIds(actor);

  const skills =
    visibleProfileIds === null
      ? await db.select().from(schema.skills)
      : visibleProfileIds.length === 0
        ? []
        : await db.select().from(schema.skills).where(inArray(schema.skills.profileId, visibleProfileIds));
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
  return { skills, profiles };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    if (!name) return fail(400, { error: 'name required' });
    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must choose a profile scope' });
    }
    assertCanAccessProfile(actor, profileId);

    // Validate profile exists if provided
    if (profileId) {
      const profileRows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
      if (!profileRows[0]) return fail(400, { error: 'Profile not found' });
    }

    await db.insert(schema.skills)
      .values({
        id: nanoid(),
        name,
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
        profileId,
        enabled: true
      });
    return { ok: true };
  },
  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    const existingRows = await db
      .select({ profileId: schema.skills.profileId })
      .from(schema.skills)
      .where(eq(schema.skills.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return fail(404, { error: 'Skill not found' });
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

    await db.update(schema.skills)
      .set({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
        profileId,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.skills.id, id));
    return { ok: true };
  },
  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');

    const existingRows2 = await db
      .select({ profileId: schema.skills.profileId })
      .from(schema.skills)
      .where(eq(schema.skills.id, id))
      .limit(1);
    const existing = existingRows2[0];
    if (!existing) return fail(404, { error: 'Skill not found' });
    assertCanAccessProfile(actor, existing.profileId);

    await db.delete(schema.skills).where(eq(schema.skills.id, id));
    return { ok: true };
  }
};
