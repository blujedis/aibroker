import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const rangeKey = (url.searchParams.get('range') as RangeKey) ?? 'last7';
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const range = resolveRange(rangeKey, { start, end });

  const profileId = url.searchParams.get('profileId') ?? '';
  const vkeyId = url.searchParams.get('vkeyId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const limit = Math.min(500, Math.max(25, Number(url.searchParams.get('limit') ?? 100)));

  const conds: SQL[] = [
    gte(schema.requestLogs.createdAt, range.start),
    lte(schema.requestLogs.createdAt, range.end)
  ];
  if (profileId) conds.push(eq(schema.requestLogs.profileId, profileId));
  if (vkeyId) conds.push(eq(schema.requestLogs.virtualKeyId, vkeyId));
  if (status === 'success' || status === 'failed' || status === 'blocked') {
    conds.push(eq(schema.requestLogs.status, status));
  }

  const logs = db
    .select({
      id: schema.requestLogs.id,
      createdAt: schema.requestLogs.createdAt,
      profileName: schema.requestLogs.profileName,
      vkeyName: schema.requestLogs.virtualKeyName,
      modelPublicId: schema.requestLogs.modelPublicId,
      endpoint: schema.requestLogs.endpoint,
      status: schema.requestLogs.status,
      httpStatus: schema.requestLogs.httpStatus,
      streaming: schema.requestLogs.streaming,
      inputTokens: schema.requestLogs.inputTokens,
      outputTokens: schema.requestLogs.outputTokens,
      cost: schema.requestLogs.cost,
      latencyMs: schema.requestLogs.latencyMs,
      errorMessage: schema.requestLogs.errorMessage
    })
    .from(schema.requestLogs)
    .where(and(...conds))
    .orderBy(desc(schema.requestLogs.createdAt))
    .limit(limit)
    .all();

  const profiles = db.select().from(schema.profiles).all();
  const keys = db.select().from(schema.virtualKeys).all();

  return {
    logs,
    profiles,
    keys,
    filters: { profileId, vkeyId, status, limit },
    rangeKey,
    start: start ?? '',
    end: end ?? ''
  };
};
