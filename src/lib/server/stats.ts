import { and, count, gte, lte, sql, sum } from 'drizzle-orm';
import { db, schema } from './db/postgres.js';
import type { Range } from '$lib/utils/date-range.js';

export interface CostBreakdownTotals {
  inputCost: number;
  outputCost: number;
  cachedInputCost: number;
  imageInputCost: number;
  audioInputCost: number;
  videoInputCost: number;
  imageOutputCost: number;
  videoOutputCost: number;
  webSearchCost: number;
}

export interface UsageSummary extends CostBreakdownTotals {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  blockedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  avgCost: number;
}

export interface UsagePoint extends CostBreakdownTotals {
  day: string; // yyyy-mm-dd
  requests: number;
  successes: number;
  failures: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

export async function usageSummary(range: Range): Promise<UsageSummary> {
  const summaryRows = await db
    .select({
      total: count(schema.requestLogs.id),
      inputTokens: sum(schema.requestLogs.inputTokens),
      outputTokens: sum(schema.requestLogs.outputTokens),
      cost: sum(schema.requestLogs.cost),
      inputCost: sum(schema.requestLogs.inputCost),
      outputCost: sum(schema.requestLogs.outputCost),
      cachedInputCost: sum(schema.requestLogs.cachedInputCost),
      imageInputCost: sum(schema.requestLogs.imageInputCost),
      audioInputCost: sum(schema.requestLogs.audioInputCost),
      videoInputCost: sum(schema.requestLogs.videoInputCost),
      imageOutputCost: sum(schema.requestLogs.imageOutputCost),
      videoOutputCost: sum(schema.requestLogs.videoOutputCost),
      webSearchCost: sum(schema.requestLogs.webSearchCost)
    })
    .from(schema.requestLogs)
    .where(
      and(
        gte(schema.requestLogs.createdAt, range.start),
        lte(schema.requestLogs.createdAt, range.end)
      )
    );
  const rows = summaryRows[0];

  const byStatus = await db
    .select({
      status: schema.requestLogs.status,
      n: count(schema.requestLogs.id)
    })
    .from(schema.requestLogs)
    .where(
      and(
        gte(schema.requestLogs.createdAt, range.start),
        lte(schema.requestLogs.createdAt, range.end)
      )
    )
    .groupBy(schema.requestLogs.status);

  const success = byStatus.find((r) => r.status === 'success')?.n ?? 0;
  const failed = byStatus.find((r) => r.status === 'failed')?.n ?? 0;
  const blocked = byStatus.find((r) => r.status === 'blocked')?.n ?? 0;
  const totalReq = Number(rows?.total ?? 0);
  const totalCost = Number(rows?.cost ?? 0);

  return {
    totalRequests: totalReq,
    successRequests: success,
    failedRequests: failed,
    blockedRequests: blocked,
    totalInputTokens: Number(rows?.inputTokens ?? 0),
    totalOutputTokens: Number(rows?.outputTokens ?? 0),
    totalCost,
    avgCost: totalReq > 0 ? totalCost / totalReq : 0,
    inputCost: Number(rows?.inputCost ?? 0),
    outputCost: Number(rows?.outputCost ?? 0),
    cachedInputCost: Number(rows?.cachedInputCost ?? 0),
    imageInputCost: Number(rows?.imageInputCost ?? 0),
    audioInputCost: Number(rows?.audioInputCost ?? 0),
    videoInputCost: Number(rows?.videoInputCost ?? 0),
    imageOutputCost: Number(rows?.imageOutputCost ?? 0),
    videoOutputCost: Number(rows?.videoOutputCost ?? 0),
    webSearchCost: Number(rows?.webSearchCost ?? 0)
  };
}

export async function usageSeries(range: Range): Promise<UsagePoint[]> {
  const dayExpr = sql<string>`to_char(date_trunc('day', ${schema.requestLogs.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day: dayExpr,
      requests: count(schema.requestLogs.id),
      successes: sql<number>`sum(case when ${schema.requestLogs.status} = 'success' then 1 else 0 end)`,
      failures: sql<number>`sum(case when ${schema.requestLogs.status} = 'failed' then 1 else 0 end)`,
      cost: sum(schema.requestLogs.cost),
      inputTokens: sum(schema.requestLogs.inputTokens),
      outputTokens: sum(schema.requestLogs.outputTokens),
      inputCost: sum(schema.requestLogs.inputCost),
      outputCost: sum(schema.requestLogs.outputCost),
      cachedInputCost: sum(schema.requestLogs.cachedInputCost),
      imageInputCost: sum(schema.requestLogs.imageInputCost),
      audioInputCost: sum(schema.requestLogs.audioInputCost),
      videoInputCost: sum(schema.requestLogs.videoInputCost),
      imageOutputCost: sum(schema.requestLogs.imageOutputCost),
      videoOutputCost: sum(schema.requestLogs.videoOutputCost),
      webSearchCost: sum(schema.requestLogs.webSearchCost)
    })
    .from(schema.requestLogs)
    .where(
      and(
        gte(schema.requestLogs.createdAt, range.start),
        lte(schema.requestLogs.createdAt, range.end)
      )
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  return rows.map((r) => ({
    day: r.day,
    requests: Number(r.requests ?? 0),
    successes: Number(r.successes ?? 0),
    failures: Number(r.failures ?? 0),
    cost: Number(r.cost ?? 0),
    inputTokens: Number(r.inputTokens ?? 0),
    outputTokens: Number(r.outputTokens ?? 0),
    inputCost: Number(r.inputCost ?? 0),
    outputCost: Number(r.outputCost ?? 0),
    cachedInputCost: Number(r.cachedInputCost ?? 0),
    imageInputCost: Number(r.imageInputCost ?? 0),
    audioInputCost: Number(r.audioInputCost ?? 0),
    videoInputCost: Number(r.videoInputCost ?? 0),
    imageOutputCost: Number(r.imageOutputCost ?? 0),
    videoOutputCost: Number(r.videoOutputCost ?? 0),
    webSearchCost: Number(r.webSearchCost ?? 0)
  }));
}

export interface ModelUsageRow {
  modelPublicId: string;
  requests: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

export async function usageByModel(range: Range): Promise<ModelUsageRow[]> {
  const rows = await db
    .select({
      modelPublicId: schema.requestLogs.modelPublicId,
      requests: count(schema.requestLogs.id),
      cost: sum(schema.requestLogs.cost),
      inputTokens: sum(schema.requestLogs.inputTokens),
      outputTokens: sum(schema.requestLogs.outputTokens)
    })
    .from(schema.requestLogs)
    .where(
      and(
        gte(schema.requestLogs.createdAt, range.start),
        lte(schema.requestLogs.createdAt, range.end)
      )
    )
    .groupBy(schema.requestLogs.modelPublicId);
  return rows.map((r) => ({
    modelPublicId: r.modelPublicId ?? 'unknown',
    requests: Number(r.requests ?? 0),
    cost: Number(r.cost ?? 0),
    inputTokens: Number(r.inputTokens ?? 0),
    outputTokens: Number(r.outputTokens ?? 0)
  }));
}

// ────────────────────────────────────────────────────────────────
// Guardrail analytics
// ────────────────────────────────────────────────────────────────
export interface GuardrailSummary {
  guardrailId: string | null;
  guardrailName: string;
  stage: 'pre' | 'during' | 'post';
  totalRuns: number;
  blocks: number;
  redacts: number;
  avgLatencyMs: number;
}

export async function guardrailSummary(range: Range): Promise<GuardrailSummary[]> {
  const rows = await db
    .select({
      guardrailId: schema.guardrailLogs.guardrailId,
      guardrailName: schema.guardrailLogs.guardrailName,
      stage: schema.guardrailLogs.stage,
      totalRuns: count(schema.guardrailLogs.id),
      blocks: sql<number>`sum(case when ${schema.guardrailLogs.action} = 'block' then 1 else 0 end)`,
      redacts: sql<number>`sum(case when ${schema.guardrailLogs.action} = 'redact' then 1 else 0 end)`,
      avgLatencyMs: sql<number>`avg(${schema.guardrailLogs.latencyMs})`
    })
    .from(schema.guardrailLogs)
    .where(
      and(
        gte(schema.guardrailLogs.createdAt, range.start),
        lte(schema.guardrailLogs.createdAt, range.end)
      )
    )
    .groupBy(
      schema.guardrailLogs.guardrailId,
      schema.guardrailLogs.guardrailName,
      schema.guardrailLogs.stage
    );
  return rows.map((r) => ({
    guardrailId: r.guardrailId,
    guardrailName: r.guardrailName,
    stage: r.stage as 'pre' | 'during' | 'post',
    totalRuns: Number(r.totalRuns ?? 0),
    blocks: Number(r.blocks ?? 0),
    redacts: Number(r.redacts ?? 0),
    avgLatencyMs: Math.round(Number(r.avgLatencyMs ?? 0))
  }));
}

export interface GuardrailPoint {
  day: string;
  runs: number;
  blocks: number;
  redacts: number;
}

export async function guardrailSeries(range: Range): Promise<GuardrailPoint[]> {
  const dayExpr = sql<string>`to_char(date_trunc('day', ${schema.guardrailLogs.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day: dayExpr,
      runs: count(schema.guardrailLogs.id),
      blocks: sql<number>`sum(case when ${schema.guardrailLogs.action} = 'block' then 1 else 0 end)`,
      redacts: sql<number>`sum(case when ${schema.guardrailLogs.action} = 'redact' then 1 else 0 end)`
    })
    .from(schema.guardrailLogs)
    .where(
      and(
        gte(schema.guardrailLogs.createdAt, range.start),
        lte(schema.guardrailLogs.createdAt, range.end)
      )
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr);
  return rows.map((r) => ({
    day: r.day,
    runs: Number(r.runs ?? 0),
    blocks: Number(r.blocks ?? 0),
    redacts: Number(r.redacts ?? 0)
  }));
}

export interface ProfileUsageRow {
  profileId: string | null;
  profileName: string;
  requests: number;
  cost: number;
}

export async function usageByProfile(range: Range): Promise<ProfileUsageRow[]> {
  const rows = await db
    .select({
      profileId: schema.requestLogs.profileId,
      profileName: schema.requestLogs.profileName,
      requests: count(schema.requestLogs.id),
      cost: sum(schema.requestLogs.cost)
    })
    .from(schema.requestLogs)
    .where(
      and(
        gte(schema.requestLogs.createdAt, range.start),
        lte(schema.requestLogs.createdAt, range.end)
      )
    )
    .groupBy(schema.requestLogs.profileId, schema.requestLogs.profileName);
  return rows.map((r) => ({
    profileId: r.profileId,
    profileName: r.profileName ?? 'unknown',
    requests: Number(r.requests ?? 0),
    cost: Number(r.cost ?? 0)
  }));
}
