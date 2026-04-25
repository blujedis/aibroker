<script lang="ts">
  import {
    Card,
    CardHeader,
    CardContent,
    Badge,
    Table,
  } from "$lib/components/ui";
  import DateRangePicker from "$lib/components/date-range-picker.svelte";
  import LineChart from "$lib/components/line-chart.svelte";
  import BarChart from "$lib/components/bar-chart.svelte";
  import StackedBarChart, {
    type StackedSeries,
  } from "$lib/components/stacked-bar-chart.svelte";
  import { fmtCurrency, fmtInt } from "$lib/utils";

  let { data } = $props();

  const COST_SERIES: StackedSeries[] = [
    { key: "inputCost", label: "Input", color: "hsl(217 91% 60%)" },
    { key: "outputCost", label: "Output", color: "hsl(142 71% 45%)" },
    {
      key: "cachedInputCost",
      label: "Cached input",
      color: "hsl(199 89% 48%)",
    },
    { key: "imageInputCost", label: "Image input", color: "hsl(262 83% 58%)" },
    { key: "audioInputCost", label: "Audio input", color: "hsl(292 76% 60%)" },
    { key: "videoInputCost", label: "Video input", color: "hsl(24 95% 53%)" },
    {
      key: "imageOutputCost",
      label: "Image output",
      color: "hsl(340 82% 52%)",
    },
    { key: "videoOutputCost", label: "Video output", color: "hsl(38 92% 50%)" },
    { key: "webSearchCost", label: "Web search", color: "hsl(173 80% 40%)" },
  ];

  const series = $derived(
    data.series.map((s) => ({
      label: s.day.slice(5),
      value: s.requests,
      value2: s.cost,
    })),
  );
  const costStackData = $derived(
    data.series.map((s) => ({
      label: s.day.slice(5),
      values: {
        inputCost: s.inputCost,
        outputCost: s.outputCost,
        cachedInputCost: s.cachedInputCost,
        imageInputCost: s.imageInputCost,
        audioInputCost: s.audioInputCost,
        videoInputCost: s.videoInputCost,
        imageOutputCost: s.imageOutputCost,
        videoOutputCost: s.videoOutputCost,
        webSearchCost: s.webSearchCost,
      },
    })),
  );
  const guardSeries = $derived(
    data.guardrailSeries.map((g) => ({
      label: g.day.slice(5),
      value: g.runs,
      value2: g.blocks,
    })),
  );

  const costBreakdown = $derived(
    COST_SERIES.map((s) => ({
      ...s,
      value: (data.summary as unknown as Record<string, number>)[s.key] ?? 0,
    })).filter((c) => c.value > 0),
  );
  const totalInputCost = $derived(
    data.summary.inputCost +
      data.summary.cachedInputCost +
      data.summary.imageInputCost +
      data.summary.audioInputCost +
      data.summary.videoInputCost,
  );
</script>

<svelte:head><title>Overview · AiBroker</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
      <p class="text-sm text-muted-foreground">
        Requests, spend and guardrail activity at a glance.
      </p>
    </div>
    <DateRangePicker range={data.rangeKey} start={data.start} end={data.end} />
  </div>

  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <Card>
      <CardHeader title="Total requests" />
      <CardContent>
        <div class="text-2xl font-semibold">
          {fmtInt(data.summary.totalRequests)}
        </div>
        <div class="mt-2 flex gap-2 text-xs">
          <Badge variant="success"
            >{fmtInt(data.summary.successRequests)} ok</Badge
          >
          <Badge variant="destructive"
            >{fmtInt(data.summary.failedRequests)} failed</Badge
          >
          <Badge variant="warning"
            >{fmtInt(data.summary.blockedRequests)} blocked</Badge
          >
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader title="Total spend" />
      <CardContent>
        <div class="text-2xl font-semibold">
          {fmtCurrency(data.summary.totalCost)}
        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          avg {fmtCurrency(data.summary.avgCost, 6)} / request
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader title="Tokens in / out" />
      <CardContent>
        <div class="text-2xl font-semibold">
          {fmtInt(data.summary.totalInputTokens)}
          <span class="text-muted-foreground">/</span>
          {fmtInt(data.summary.totalOutputTokens)}
        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          input / output tokens
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader title="Guardrail blocks" />
      <CardContent>
        {@const blocks = data.guardrailSummary.reduce(
          (a, b) => a + b.blocks,
          0,
        )}
        {@const redacts = data.guardrailSummary.reduce(
          (a, b) => a + b.redacts,
          0,
        )}
        <div class="text-2xl font-semibold">{fmtInt(blocks)}</div>
        <div class="mt-2 text-xs text-muted-foreground">
          {fmtInt(redacts)} redactions
        </div>
      </CardContent>
    </Card>
  </div>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader
        title="Requests and cost over time"
        description="Blue = requests, green = cost"
      />
      <CardContent>
        <LineChart data={series} />
      </CardContent>
    </Card>
    <Card>
      <CardHeader
        title="Daily spend by type"
        description={`Total input spend ${fmtCurrency(totalInputCost)} · output ${fmtCurrency(data.summary.outputCost)}`}
      />
      <CardContent>
        <StackedBarChart
          data={costStackData}
          series={COST_SERIES}
          format={(v) => `$${v.toFixed(2)}`}
        />
      </CardContent>
    </Card>
  </div>

  <Card>
    <CardHeader
      title="Cost by type"
      description="Breakdown of spend across all metered categories for the selected range."
    />
    <CardContent>
      {#if costBreakdown.length === 0}
        <div class="py-6 text-center text-sm text-muted-foreground">
          No spend recorded in this range.
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {#each costBreakdown as c (c.key)}
            {@const pct =
              data.summary.totalCost > 0
                ? (c.value / data.summary.totalCost) * 100
                : 0}
            <div class="rounded-md border border-border/60 p-3">
              <div
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  class="inline-block h-2.5 w-2.5 rounded-sm"
                  style:background-color={c.color}
                ></span>
                {c.label}
              </div>
              <div class="mt-1 text-lg font-semibold tabular-nums">
                {fmtCurrency(c.value)}
              </div>
              <div class="text-xs text-muted-foreground">
                {pct.toFixed(1)}% of total
              </div>
            </div>
          {/each}
        </div>
        <div
          class="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-sm"
        >
          <span class="text-muted-foreground">Total</span>
          <span class="font-semibold tabular-nums">
            {fmtCurrency(data.summary.totalCost)}
          </span>
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader title="Daily spend (total)" />
    <CardContent>
      <BarChart
        data={data.series.map((s) => ({
          label: s.day.slice(5),
          value: s.cost,
        }))}
        format={(v) => `$${v.toFixed(2)}`}
      />
    </CardContent>
  </Card>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader
        title="Guardrail activity"
        description="Blue = runs, red = blocks"
      />
      <CardContent>
        <LineChart data={guardSeries} color2="hsl(0 72% 51%)" />
      </CardContent>
    </Card>
    <Card>
      <CardHeader title="Usage by model" />
      <CardContent>
        <Table>
          <thead>
            <tr
              class="border-b border-border text-left text-xs uppercase text-muted-foreground"
            >
              <th class="py-2 pr-4">Model</th>
              <th class="py-2 pr-4">Requests</th>
              <th class="py-2 pr-4">Tokens</th>
              <th class="py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {#each data.byModel as m (m.modelPublicId)}
              <tr class="border-b border-border/60">
                <td class="py-2 pr-4 font-medium">{m.modelPublicId}</td>
                <td class="py-2 pr-4">{fmtInt(m.requests)}</td>
                <td class="py-2 pr-4 tabular-nums">
                  {fmtInt(m.inputTokens)} / {fmtInt(m.outputTokens)}
                </td>
                <td class="py-2 tabular-nums">{fmtCurrency(m.cost)}</td>
              </tr>
            {/each}
            {#if data.byModel.length === 0}
              <tr>
                <td
                  colspan="4"
                  class="py-6 text-center text-sm text-muted-foreground"
                >
                  No requests in this range.
                </td>
              </tr>
            {/if}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  </div>
</div>
