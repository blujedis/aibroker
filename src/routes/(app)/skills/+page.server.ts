import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return { skills: db.select().from(schema.skills).all() };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return fail(400, { error: 'name required' });
    db.insert(schema.skills)
      .values({
        id: nanoid(),
        name,
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
        enabled: true
      })
      .run();
    return { ok: true };
  },
  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    db.update(schema.skills)
      .set({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? '') || null,
        instructions: String(form.get('instructions') ?? ''),
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
