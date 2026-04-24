import { and, eq, gte, sum } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { windowStart } from './budget.js';
import type { Backend, Model, Profile, VirtualKey } from '../db/schema.js';

export interface ResolvedKey {
  profile: Profile;
  virtualKey: VirtualKey;
  model: Model;
  backend: Backend;
}

export interface AuthFailure {
  code: 'missing_key' | 'invalid_key' | 'disabled' | 'model_not_found' | 'model_not_allowed';
  message: string;
}

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function resolveKey(
  token: string | null,
  publicModel: string
): ResolvedKey | AuthFailure {
  if (!token) return { code: 'missing_key', message: 'Missing API key' };

  const vkRow = db
    .select()
    .from(schema.virtualKeys)
    .where(eq(schema.virtualKeys.token, token))
    .get();
  if (!vkRow) return { code: 'invalid_key', message: 'Invalid API key' };
  if (!vkRow.enabled) return { code: 'disabled', message: 'API key is disabled' };

  const profile = db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, vkRow.profileId))
    .get();
  if (!profile || !profile.enabled) return { code: 'disabled', message: 'Profile disabled' };

  const model = db
    .select()
    .from(schema.models)
    .where(eq(schema.models.publicId, publicModel))
    .get();
  if (!model || !model.enabled) {
    return { code: 'model_not_found', message: `Model not found: ${publicModel}` };
  }

  // Check allow-list. If no rows exist for this key, all enabled models allowed.
  const allowed = db
    .select({ modelId: schema.virtualKeyModels.modelId })
    .from(schema.virtualKeyModels)
    .where(eq(schema.virtualKeyModels.virtualKeyId, vkRow.id))
    .all();
  if (allowed.length > 0 && !allowed.some((a) => a.modelId === model.id)) {
    return {
      code: 'model_not_allowed',
      message: `Model ${publicModel} not allowed for this key`
    };
  }

  const backend = db
    .select()
    .from(schema.backends)
    .where(eq(schema.backends.id, model.backendId))
    .get();
  if (!backend || !backend.enabled) {
    return { code: 'model_not_found', message: 'Backend for model unavailable' };
  }

  return { profile, virtualKey: vkRow, model, backend };
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  keySpent?: number;
  profileSpent?: number;
}

export function checkBudgets(profile: Profile, virtualKey: VirtualKey): BudgetCheckResult {
  // Virtual key budget
  if (virtualKey.budget && virtualKey.budget > 0) {
    const start = windowStart(virtualKey.budgetFrequency ?? undefined);
    if (start != null) {
      const spent = spendSince('vkey', virtualKey.id, start);
      if (spent >= virtualKey.budget) {
        return {
          allowed: false,
          reason: `Virtual key budget exhausted (${spent.toFixed(4)} / ${virtualKey.budget})`,
          keySpent: spent
        };
      }
    }
  }

  // Profile global budget
  if (profile.globalBudget && profile.globalBudget > 0) {
    const start = windowStart(profile.globalBudgetFrequency ?? undefined);
    if (start != null) {
      const spent = spendSince('profile', profile.id, start);
      if (spent >= profile.globalBudget) {
        return {
          allowed: false,
          reason: `Profile budget exhausted (${spent.toFixed(4)} / ${profile.globalBudget})`,
          profileSpent: spent
        };
      }
    }
  }
  return { allowed: true };
}

function spendSince(kind: 'vkey' | 'profile', id: string, sinceMs: number): number {
  const since = new Date(sinceMs);
  const row = db
    .select({ total: sum(schema.requestLogs.cost).as('total') })
    .from(schema.requestLogs)
    .where(
      and(
        kind === 'vkey'
          ? eq(schema.requestLogs.virtualKeyId, id)
          : eq(schema.requestLogs.profileId, id),
        gte(schema.requestLogs.createdAt, since)
      )
    )
    .get();
  const v = row?.total;
  return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0;
}

export interface CompletedRequestLog {
  id: string;
  status: 'success' | 'failed' | 'blocked';
  httpStatus: number;
  errorMessage?: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  imageInputTokens?: number;
  audioInputTokens?: number;
  videoInputTokens?: number;
  imageOutputTokens?: number;
  videoOutputTokens?: number;
  webSearchCalls?: number;
  inputCost?: number;
  outputCost?: number;
  cachedInputCost?: number;
  imageInputCost?: number;
  audioInputCost?: number;
  videoInputCost?: number;
  imageOutputCost?: number;
  videoOutputCost?: number;
  webSearchCost?: number;
  cost: number;
  latencyMs: number;
  streaming: boolean;
  endpoint: string;
}

export function logRequest(
  ctx: {
    profile?: Profile | null;
    virtualKey?: VirtualKey | null;
    model?: Model | null;
  },
  entry: Omit<CompletedRequestLog, 'id'>
): string {
  const id = nanoid();
  db.insert(schema.requestLogs)
    .values({
      id,
      profileId: ctx.profile?.id ?? null,
      profileName: ctx.profile?.name ?? null,
      virtualKeyId: ctx.virtualKey?.id ?? null,
      virtualKeyName: ctx.virtualKey?.name ?? null,
      modelId: ctx.model?.id ?? null,
      modelPublicId: ctx.model?.publicId ?? null,
      endpoint: entry.endpoint,
      streaming: entry.streaming,
      status: entry.status,
      httpStatus: entry.httpStatus,
      errorMessage: entry.errorMessage ?? null,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cachedInputTokens: entry.cachedInputTokens ?? 0,
      imageInputTokens: entry.imageInputTokens ?? 0,
      audioInputTokens: entry.audioInputTokens ?? 0,
      videoInputTokens: entry.videoInputTokens ?? 0,
      imageOutputTokens: entry.imageOutputTokens ?? 0,
      videoOutputTokens: entry.videoOutputTokens ?? 0,
      webSearchCalls: entry.webSearchCalls ?? 0,
      inputCost: entry.inputCost ?? 0,
      outputCost: entry.outputCost ?? 0,
      cachedInputCost: entry.cachedInputCost ?? 0,
      imageInputCost: entry.imageInputCost ?? 0,
      audioInputCost: entry.audioInputCost ?? 0,
      videoInputCost: entry.videoInputCost ?? 0,
      imageOutputCost: entry.imageOutputCost ?? 0,
      videoOutputCost: entry.videoOutputCost ?? 0,
      webSearchCost: entry.webSearchCost ?? 0,
      cost: entry.cost,
      latencyMs: entry.latencyMs
    })
    .run();
  if (ctx.virtualKey) {
    db.update(schema.virtualKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.virtualKeys.id, ctx.virtualKey.id))
      .run();
  }
  return id;
}
