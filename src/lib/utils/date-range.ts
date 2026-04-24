export type RangeKey = 'today' | 'last7' | 'lastMonth' | 'monthToDate' | 'lastYear' | 'custom';

export interface Range {
  start: Date;
  end: Date;
}

export function resolveRange(
  key: RangeKey,
  opts?: { start?: Date | string; end?: Date | string },
  now: Date = new Date()
): Range {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  switch (key) {
    case 'today':
      return { start: startOfToday, end: endOfToday };
    case 'last7': {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 6);
      return { start: s, end: endOfToday };
    }
    case 'monthToDate': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end: endOfToday };
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'lastYear': {
      const s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { start: s, end: endOfToday };
    }
    case 'custom': {
      const s = opts?.start ? new Date(opts.start) : startOfToday;
      const e = opts?.end ? new Date(opts.end) : endOfToday;
      return { start: s, end: e };
    }
  }
}

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'monthToDate', label: 'Month to date' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'custom', label: 'Custom range' }
];
