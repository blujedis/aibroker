const TTL_MS = Number(process.env.BUDGET_CACHE_TTL_MS ?? 5_000);

interface BudgetEntry {
  spent: number;
  cachedAt: number;
}

const budgetCache = new Map<string, BudgetEntry>();

function cacheKey(kind: 'vkey' | 'profile', id: string, windowStart: number): string {
  return `${kind}:${id}:${windowStart}`;
}

/**
 * Return the cached spend total, or call `fallback()` to populate from DB.
 * The returned value is the spend *at the time of the last cache population*
 * plus any increments added via `addSpend` since then.
 */
export function getBudgetSpend(
  kind: 'vkey' | 'profile',
  id: string,
  windowStart: number,
  fallback: () => number
): number {
  const k = cacheKey(kind, id, windowStart);
  const entry = budgetCache.get(k);
  if (entry && Date.now() - entry.cachedAt <= TTL_MS) {
    return entry.spent;
  }
  // Cache miss or expired: query DB and populate
  const spent = fallback();
  budgetCache.set(k, { spent, cachedAt: Date.now() });
  return spent;
}

/**
 * Increment the cached spend total after a successful request.
 * Only updates the cache if an entry already exists (i.e. cache was warmed
 * by `getBudgetSpend`). This keeps the cached value monotonically increasing
 * within the TTL window, reducing DB round-trips.
 */
export function addSpend(
  kind: 'vkey' | 'profile',
  id: string,
  windowStart: number,
  cost: number
): void {
  const k = cacheKey(kind, id, windowStart);
  const entry = budgetCache.get(k);
  if (!entry) return;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    budgetCache.delete(k);
    return;
  }
  entry.spent += cost;
}
