import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveRange, type RangeKey } from '$lib/utils/date-range.js';
import {
  guardrailSeries,
  guardrailSummary,
  usageByModel,
  usageSeries,
  usageSummary
} from '$lib/server/stats.js';

export const load: PageServerLoad = async ({ url, locals }) => {
  if (locals.user?.role !== 'admin') throw redirect(303, '/profiles');

  const rangeKey = (url.searchParams.get('range') as RangeKey) ?? 'last7';
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const range = resolveRange(rangeKey, { start, end });

  return {
    rangeKey,
    start: start ?? '',
    end: end ?? '',
    summary: await usageSummary(range),
    series: await usageSeries(range),
    byModel: await usageByModel(range),
    guardrailSummary: await guardrailSummary(range),
    guardrailSeries: await guardrailSeries(range)
  };
};
