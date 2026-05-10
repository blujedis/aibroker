import { and, eq, gte, sum } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/postgres.js';
import { windowStart } from './budget.js';
import { isResourceAccessibleToProfile } from '../scope.js';
import type { Backend, Model, Profile, VirtualKey } from '../db/schema.postgres.js';
import { getCachedAuth, setCachedAuth } from './auth-cache.js';
import { addSpend, getBudgetSpend } from './budget-cache.js';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../secrets.js';
import { logScopeEvent } from '../observability/scope.js';
import { logger } from '../observability/logger.js';

const routerLogger = logger.child({ component: 'proxy.router' });

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

export async function resolveKey(
  token: string | null,
  publicModel: string
): Promise<ResolvedKey | AuthFailure> {
  if (!token) return { code: 'missing_key', message: 'Missing API key' };

  // Fast path: return cached resolution
  const cached = getCachedAuth(token, publicModel);
  if (cached) return cached;

  const vkRows = await db
    .select()
    .from(schema.virtualKeys)
    .where(eq(schema.virtualKeys.token, token))
    .limit(1);
  const vkRow = vkRows[0];
  if (!vkRow) return { code: 'invalid_key', message: 'Invalid API key' };
  if (!vkRow.enabled) return { code: 'disabled', message: 'API key is disabled' };

  const profileRows = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, vkRow.profileId))
    .limit(1);
  const profile = profileRows[0];
  if (!profile || !profile.enabled) return { code: 'disabled', message: 'Profile disabled' };

  const modelRows = await db
    .select()
    .from(schema.models)
    .where(eq(schema.models.publicId, publicModel))
    .limit(1);
  const model = modelRows[0];
  if (!model || !model.enabled) {
    return { code: 'model_not_found', message: `Model not found: ${publicModel}` };
  }

  // Check allow-list. If no rows exist for this key, all enabled models allowed.
  const allowed = await db
    .select({ modelId: schema.virtualKeyModels.modelId })
    .from(schema.virtualKeyModels)
    .where(eq(schema.virtualKeyModels.virtualKeyId, vkRow.id));
  if (allowed.length > 0 && !allowed.some((a: { modelId: string }) => a.modelId === model.id)) {
    logScopeEvent('warn', 'model_allowlist_denied', {
      profileId: profile.id,
      virtualKeyId: vkRow.id,
      modelId: model.id,
      modelPublicId: publicModel
    });
    return {
      code: 'model_not_allowed',
      message: `Model ${publicModel} not allowed for this key`
    };
  }

  const backendRows = await db
    .select()
    .from(schema.backends)
    .where(eq(schema.backends.id, model.backendId))
    .limit(1);
  const backend = backendRows[0];
  if (!backend || !backend.enabled) {
    return { code: 'model_not_found', message: 'Backend for model unavailable' };
  }

  // Enforce backend scope: backend must be global or match key's profile
  if (!isResourceAccessibleToProfile(backend.profileId, profile.id)) {
    logScopeEvent('warn', 'backend_scope_denied', {
      profileId: profile.id,
      virtualKeyId: vkRow.id,
      modelId: model.id,
      modelPublicId: publicModel,
      backendId: backend.id,
      backendProfileId: backend.profileId
    });
    return {
      code: 'model_not_allowed',
      message: `Model ${publicModel} backend is not accessible to this profile`
    };
  }

  if (backend.apiKey && !isEncryptedSecret(backend.apiKey)) {
    await db.update(schema.backends)
      .set({
        apiKey: encryptSecret(backend.apiKey),
        updatedAt: new Date()
      })
      .where(eq(schema.backends.id, backend.id));
  }

  const resolved: ResolvedKey = {
    profile,
    virtualKey: vkRow,
    model,
    backend: { ...backend, apiKey: decryptSecret(backend.apiKey) }
  };
  setCachedAuth(token, publicModel, resolved);
  return resolved;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  keySpent?: number;
  profileSpent?: number;
}

export async function checkBudgets(
  profile: Profile,
  virtualKey: VirtualKey
): Promise<BudgetCheckResult> {
  // Virtual key budget
  if (virtualKey.budget && virtualKey.budget > 0) {
    const start = windowStart(virtualKey.budgetFrequency ?? undefined);
    if (start != null) {
      const spent = await spendSince('vkey', virtualKey.id, start);
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
      const spent = await spendSince('profile', profile.id, start);
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

async function spendSince(kind: 'vkey' | 'profile', id: string, sinceMs: number): Promise<number> {
  return getBudgetSpend(kind, id, sinceMs, async () => {
    const since = new Date(sinceMs);
    const rows = await db
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
      .limit(1);
    const row = rows[0];
    const v = row?.total;
    return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0;
  });
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
  entry: Omit<CompletedRequestLog, 'id'>,
  andThen?: (id: string) => void | Promise<void>
): string {
  const id = nanoid();

  // Accumulate spend into budget cache so subsequent requests in the same
  // TTL window see an up-to-date figure without hitting the DB.
  if (entry.cost > 0) {
    const vkStart = ctx.virtualKey
      ? windowStart(ctx.virtualKey.budgetFrequency ?? undefined)
      : null;
    const profileStart = ctx.profile
      ? windowStart((ctx.profile as Profile & { globalBudgetFrequency?: string | null }).globalBudgetFrequency ?? undefined)
      : null;
    if (vkStart != null && ctx.virtualKey) {
      addSpend('vkey', ctx.virtualKey.id, vkStart, entry.cost);
    }
    if (profileStart != null && ctx.profile) {
      addSpend('profile', ctx.profile.id, profileStart, entry.cost);
    }
  }

  // Deferred write: enqueue and drain off the critical path.
  enqueueWrite(async () => {
    await db.insert(schema.requestLogs)
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
      .execute();
    if (ctx.virtualKey) {
      await db.update(schema.virtualKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.virtualKeys.id, ctx.virtualKey.id));
    }
    await andThen?.(id);
  });

  return id;
}

// ---------------------------------------------------------------------------
// Deferred write queue — drains on the next microtask tick, off the hot path
// ---------------------------------------------------------------------------
type WriteTask = () => Promise<void>;
const writeQueue: WriteTask[] = [];
let drainScheduled = false;

function enqueueWrite(task: WriteTask): void {
  writeQueue.push(task);
  if (!drainScheduled) {
    drainScheduled = true;
    queueMicrotask(() => {
      void drainWrites();
    });
  }
}

async function drainWrites(): Promise<void> {
  drainScheduled = false;
  // Drain all tasks queued up to this point (tasks added during drain run next tick).
  const batch = writeQueue.splice(0);
  for (const task of batch) {
    try {
      await task();
    } catch (err) {
      routerLogger.error('proxy.deferred_write.failed', { err });
    }
  }
}
