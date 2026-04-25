import { fail, type Actions } from '@sveltejs/kit';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const skills = db.select().from(schema.skills).all();
  const profiles = db
    .select()
    .from(schema.profiles)
    .orderBy(asc(schema.profiles.name))
    .all();
  return { skills, profiles };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    if (!name) return fail(400, { error: 'name required' });

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
  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const profileId = String(form.get('profileId') ?? '').trim() || null;

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
  delete: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    db.delete(schema.skills).where(eq(schema.skills.id, id)).run();
    return { ok: true };
  }
};
