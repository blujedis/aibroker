import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db/index.js';
import { extractBearer } from '$lib/server/proxy/router.js';
import { eq } from 'drizzle-orm';

// OpenAI-compatible /v1/models. Only returns models the virtual key is allowed to use.
export const GET: RequestHandler = async ({ request }) => {
  const token = extractBearer(request);
  if (!token) return json({ error: { message: 'Missing API key' } }, { status: 401 });

  const vk = db
    .select()
    .from(schema.virtualKeys)
    .where(eq(schema.virtualKeys.token, token))
    .get();
  if (!vk || !vk.enabled)
    return json({ error: { message: 'Invalid API key' } }, { status: 401 });

  const allowed = db
    .select({ modelId: schema.virtualKeyModels.modelId })
    .from(schema.virtualKeyModels)
    .where(eq(schema.virtualKeyModels.virtualKeyId, vk.id))
    .all();

  const all = db.select().from(schema.models).where(eq(schema.models.enabled, true)).all();
  const filtered =
    allowed.length === 0 ? all : all.filter((m) => allowed.some((a) => a.modelId === m.id));

  return json({
    object: 'list',
    data: filtered.map((m) => ({
      id: m.publicId,
      object: 'model',
      created: Math.floor(m.createdAt.getTime() / 1000),
      owned_by: 'nostraproxy'
    }))
  });
};
