import { fail, type Actions } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import { assertCanAccessProfile, getVisibleProfileIds, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = await getVisibleProfileIds(actor);

  const servers =
    visibleProfileIds === null
      ? await db.select().from(schema.mcpServers)
      : visibleProfileIds.length === 0
        ? []
        : await db
          .select()
          .from(schema.mcpServers)
          .where(inArray(schema.mcpServers.profileId, visibleProfileIds));
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
  return { servers, profiles };
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
  create: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const transport = String(form.get('transport') ?? 'stdio') as 'stdio' | 'sse' | 'http';
    const profileId = String(form.get('profileId') ?? '').trim() || null;

    if (actor.role !== 'admin' && !profileId) {
      return fail(400, { error: 'Managers must choose a profile scope' });
    }
    assertCanAccessProfile(actor, profileId);

    if (!name) return fail(400, { error: 'name required' });

    // Validate profile exists if provided
    if (profileId) {
      const profileRows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
      if (!profileRows[0]) return fail(400, { error: 'Profile not found' });
    }

    const argsRaw = String(form.get('args') ?? '[]');
    const envRaw = String(form.get('env') ?? '{}');
    if (!validJSON(argsRaw) || !validJSON(envRaw))
      return fail(400, { error: 'args/env must be valid JSON' });
    await db.insert(schema.mcpServers)
      .values({
        id: nanoid(),
        name,
        transport,
        command: String(form.get('command') ?? '') || null,
        args: argsRaw,
        env: envRaw,
        url: String(form.get('url') ?? '') || null,
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
      .select({ profileId: schema.mcpServers.profileId })
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return fail(404, { error: 'MCP server not found' });
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
        profileId,
        enabled: form.get('enabled') === 'on',
        updatedAt: new Date()
      })
      .where(eq(schema.mcpServers.id, id));
    return { ok: true };
  },
  delete: async ({ request, locals }) => {
    const actor = requireUser(locals.user);
    const form = await request.formData();
    const id = String(form.get('id') ?? '');

    const existingRows2 = await db
      .select({ profileId: schema.mcpServers.profileId })
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, id))
      .limit(1);
    const existing2 = existingRows2[0];
    if (!existing2) return fail(404, { error: 'MCP server not found' });
    assertCanAccessProfile(actor, existing2.profileId);

    await db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, id));
    return { ok: true };
  }
};
