import { and, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
import { getVisibleProfileIds, requireUser } from '$lib/server/authz.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const actor = requireUser(locals.user);
  const visibleProfileIds = await getVisibleProfileIds(actor);

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
  if (profileId && visibleProfileIds === null) conds.push(eq(schema.requestLogs.profileId, profileId));
  if (vkeyId) conds.push(eq(schema.requestLogs.virtualKeyId, vkeyId));
  if (status === 'success' || status === 'failed' || status === 'blocked') {
    conds.push(eq(schema.requestLogs.status, status));
  }

  if (visibleProfileIds !== null) {
    if (visibleProfileIds.length === 0) {
      return {
        logs: [],
        profiles: [],
        keys: [],
        filters: { profileId, vkeyId, status, limit },
        rangeKey,
        start: start ?? '',
        end: end ?? ''
      };
    }
    if (profileId && !visibleProfileIds.includes(profileId)) {
      return {
        logs: [],
        profiles: [],
        keys: [],
        filters: { profileId, vkeyId, status, limit },
        rangeKey,
        start: start ?? '',
        end: end ?? ''
      };
    }

    if (profileId) {
      conds.push(eq(schema.requestLogs.profileId, profileId));
    } else {
      conds.push(inArray(schema.requestLogs.profileId, visibleProfileIds));
    }
  }

  const logs = await db
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
    .limit(limit);

  const profiles =
    visibleProfileIds === null
      ? await db.select().from(schema.profiles)
      : await db
        .select()
        .from(schema.profiles)
        .where(
          profileId
            ? eq(schema.profiles.id, profileId)
            : inArray(schema.profiles.id, visibleProfileIds)
        );
  const keys =
    visibleProfileIds === null
      ? await db.select().from(schema.virtualKeys)
      : await db
        .select()
        .from(schema.virtualKeys)
        .where(
          profileId
            ? eq(schema.virtualKeys.profileId, profileId)
            : inArray(schema.virtualKeys.profileId, visibleProfileIds)
        );

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
