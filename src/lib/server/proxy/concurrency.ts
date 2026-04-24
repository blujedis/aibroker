import pLimit, { type LimitFunction } from 'p-limit';

const _maxPerBackend = Number(process.env.MAX_CONCURRENT_PER_BACKEND ?? 16);
const MAX_PER_BACKEND = Number.isFinite(_maxPerBackend) && _maxPerBackend > 0 ? _maxPerBackend : 16;

const _timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 60_000);
export const UPSTREAM_TIMEOUT_MS =
  Number.isFinite(_timeoutMs) && _timeoutMs > 0 ? _timeoutMs : 60_000;

const _streamTimeoutMs = Number(process.env.UPSTREAM_STREAM_TIMEOUT_MS ?? 300_000);
export const UPSTREAM_STREAM_TIMEOUT_MS =
  Number.isFinite(_streamTimeoutMs) && _streamTimeoutMs > 0 ? _streamTimeoutMs : 300_000;

const backendLimiters = new Map<string, LimitFunction>();

export function getLimiterForBackend(backendId: string): LimitFunction {
  let limiter = backendLimiters.get(backendId);
  if (!limiter) {
    limiter = pLimit(MAX_PER_BACKEND);
    backendLimiters.set(backendId, limiter);
  }
  return limiter;
}

export function getQueueStats(): Record<string, { concurrency: number; pending: number }> {
  const stats: Record<string, { concurrency: number; pending: number }> = {};
  for (const [id, limiter] of backendLimiters) {
    stats[id] = { concurrency: limiter.activeCount, pending: limiter.pendingCount };
  }
  return stats;
}

/** @deprecated Use getLimiterForBackend */
export function currentMaxConcurrency(): number {
  return MAX_PER_BACKEND;
}
