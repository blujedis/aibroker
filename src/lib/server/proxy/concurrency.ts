import pLimit from 'p-limit';

const max = Number(process.env.MAX_CONCURRENT_UPSTREAM ?? 32);
export const upstreamLimit = pLimit(Number.isFinite(max) && max > 0 ? max : 32);

export function currentMaxConcurrency(): number {
  return max;
}
