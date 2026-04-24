import type { ResolvedKey } from './router.js';

const TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 30_000);

interface AuthCacheEntry {
  resolved: ResolvedKey;
  cachedAt: number;
}

const authCache = new Map<string, AuthCacheEntry>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function cacheKey(token: string, publicModel: string): string {
  return `${token}\0${publicModel}`;
}

function startSweep(): void {
  if (sweepTimer !== null || authCache.size === 0) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (now - v.cachedAt > TTL_MS) authCache.delete(k);
    }
    if (authCache.size === 0) {
      clearInterval(sweepTimer!);
      sweepTimer = null;
    }
  }, 60_000);
  // Don't prevent process exit while idling
  if (sweepTimer.unref) sweepTimer.unref();
}

export function getCachedAuth(token: string, publicModel: string): ResolvedKey | null {
  const entry = authCache.get(cacheKey(token, publicModel));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    authCache.delete(cacheKey(token, publicModel));
    return null;
  }
  return entry.resolved;
}

export function setCachedAuth(token: string, publicModel: string, resolved: ResolvedKey): void {
  authCache.set(cacheKey(token, publicModel), { resolved, cachedAt: Date.now() });
  startSweep();
}

/**
 * Evict cache entries.
 * - No argument: clear everything.
 * - With token: clear all entries whose key starts with that token.
 */
export function invalidateAuthCache(token?: string): void {
  if (token === undefined) {
    authCache.clear();
    return;
  }
  const prefix = `${token}\0`;
  for (const k of authCache.keys()) {
    if (k.startsWith(prefix)) authCache.delete(k);
  }
}
