import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import { assertCanAccessProfile, getVisibleProfileIds, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = getVisibleProfileIds(actor);

  const skills =
    visibleProfileIds === null
      ? db.select().from(schema.skills).all()
      : visibleProfileIds.length === 0
        ? []
        : db.select().from(schema.skills).where(inArray(schema.skills.profileId, visibleProfileIds)).all();
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
      const profile = db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
      if (!profile) return fail(400, { error: 'Profile not found' });
    }

    db.insert(schema.skills)
      .values({
        id: nanoid(),
        name,
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
        profileId,
        enabled: true
      })
      .run();
    return { ok: true };
  },
  update: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    const existing = db
      .select({ profileId: schema.skills.profileId })
      .from(schema.skills)
      .where(eq(schema.skills.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Skill not found' });
    assertCanAccessProfile(actor, existing.profileId);
    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must keep profile scope' });
    }
    assertCanAccessProfile(actor, profileId);

    // Validate profile exists if provided
    if (profileId) {
      const profile = db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
      if (!profile) return fail(400, { error: 'Profile not found' });
    }

    db.update(schema.skills)
      .set({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
        profileId,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.skills.id, id))
      .run();
    return { ok: true };
  },
  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');

    const existing = db
      .select({ profileId: schema.skills.profileId })
      .from(schema.skills)
      .where(eq(schema.skills.id, id))
      .get();
    if (!existing) return fail(404, { error: 'Skill not found' });
    assertCanAccessProfile(actor, existing.profileId);

    db.delete(schema.skills).where(eq(schema.skills.id, id)).run();
    return { ok: true };
  }
};
