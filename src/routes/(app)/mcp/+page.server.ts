import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return { servers: db.select().from(schema.mcpServers).all() };
};

function validJSON(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const transport = String(form.get('transport') ?? 'stdio') as 'stdio' | 'sse' | 'http';
    if (!name) return fail(400, { error: 'name required' });
    const argsRaw = String(form.get('args') ?? '[]');
    const envRaw = String(form.get('env') ?? '{}');
    if (!validJSON(argsRaw) || !validJSON(envRaw))
      return fail(400, { error: 'args/env must be valid JSON' });
    db.insert(schema.mcpServers)
      .values({
        id: nanoid(),
        name,
        transport,
        command: String(form.get('command') ?? '') || null,
        args: argsRaw,
        env: envRaw,
        url: String(form.get('url') ?? '') || null,
        enabled: true
      })
      .run();
    return { ok: true };
  },
  update: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing id' });
    const argsRaw = String(form.get('args') ?? '[]');
    const envRaw = String(form.get('env') ?? '{}');
    if (!validJSON(argsRaw) || !validJSON(envRaw))
      return fail(400, { error: 'args/env must be valid JSON' });
    db.update(schema.mcpServers)
      .set({
        name: String(form.get('name') ?? ''),
        transport: String(form.get('transport') ?? 'stdio') as 'stdio' | 'sse' | 'http',
        command: String(form.get('command') ?? '') || null,
        args: argsRaw,
        env: envRaw,
        url: String(form.get('url') ?? '') || null,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.mcpServers.id, id))
      .run();
    return { ok: true };
  },
  delete: async ({ request }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, id)).run();
    return { ok: true };
  }
};
