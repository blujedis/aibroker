import type { PageServerLoad } from './$types';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
import {
  guardrailSeries,
  guardrailSummary,
  usageByModel,
  usageSeries,
  usageSummary
} from '$lib/server/stats.js';

export const load: PageServerLoad = ({ url }) => {
  const rangeKey = (url.searchParams.get('range') as RangeKey) ?? 'last7';
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const range = resolveRange(rangeKey, { start, end });

  return {
    rangeKey,
    start: start ?? '',
    end: end ?? '',
    summary: usageSummary(range),
    series: usageSeries(range),
    byModel: usageByModel(range),
    guardrailSummary: guardrailSummary(range),
    guardrailSeries: guardrailSeries(range)
  };
};
