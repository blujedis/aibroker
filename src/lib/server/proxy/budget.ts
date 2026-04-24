import type { Frequency } from '../db/schema.js';

/** Returns the inclusive start of the current budget window, in epoch ms. */
export function windowStart(freq: Frequency | null | undefined, now = new Date()): number | null {
  if (!freq) return null;
  const d = new Date(now);
  d.setMilliseconds(0);
  d.setSeconds(0);
  d.setMinutes(0);
  d.setHours(0);
  switch (freq) {
    case 'daily':
      return d.getTime();
    case 'weekly': {
      const day = d.getDay(); // 0 = Sunday
      const diff = (day + 6) % 7; // make Monday the start of week
      d.setDate(d.getDate() - diff);
      return d.getTime();
    }
    case 'monthly':
      d.setDate(1);
      return d.getTime();
  }
}
