<script lang="ts" module>
  export interface StackedSeries {
    key: string;
    label: string;
    color: string;
  }
  export interface StackedDatum {
    label: string;
    values: Record<string, number>;
  }
</script>

<script lang="ts">
  interface Props {
    data: StackedDatum[];
    series: StackedSeries[];
    width?: number;
    height?: number;
    format?: (v: number) => string;
  }
  let {
    data,
    series,
    width = 800,
    height = 240,
    format = (v: number) => String(v),
  }: Props = $props();

  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = $derived(width - padding.left - padding.right);
  const innerH = $derived(height - padding.top - padding.bottom);

  const totals = $derived(
    data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0)),
  );
  const maxY = $derived(Math.max(1e-9, ...totals));
  const groupW = $derived(data.length > 0 ? innerW / data.length : 0);
  const barW = $derived(groupW * 0.72);

  function yOf(v: number) {
    return padding.top + innerH - (v / maxY) * innerH;
  }

  function stackRects(i: number) {
    const out: Array<{
      y: number;
      h: number;
      color: string;
      key: string;
      value: number;
    }> = [];
    let acc = 0;
    for (const s of series) {
      const v = data[i].values[s.key] ?? 0;
      if (v <= 0) continue;
      const y1 = yOf(acc);
      const y2 = yOf(acc + v);
      out.push({
        y: y2,
        h: Math.max(0, y1 - y2),
        color: s.color,
        key: s.key,
        value: v,
      });
      acc += v;
    }
    return out;
  }
</script>

{#if data.length === 0 || series.length === 0}
  <div
    class="flex h-[180px] items-center justify-center text-sm text-muted-foreground"
  >
    No data for this range.
  </div>
{:else}
  <div class="flex flex-col gap-2">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      class="w-full"
      role="img"
      aria-label="Stacked bar chart"
    >
      {#each [0, 0.25, 0.5, 0.75, 1] as g}
        {@const y = padding.top + innerH * (1 - g)}
        <line
          x1={padding.left}
          x2={padding.left + innerW}
          y1={y}
          y2={y}
          stroke="currentColor"
          stroke-opacity="0.08"
        />
        <text
          x={padding.left - 6}
          y={y + 3}
          fill="currentColor"
          font-size="10"
          text-anchor="end"
          opacity="0.6"
        >
          {format(maxY * g)}
        </text>
      {/each}

      {#each data as d, i}
        {@const cx = padding.left + i * groupW + groupW / 2}
        {#each stackRects(i) as seg}
          <rect
            x={cx - barW / 2}
            y={seg.y}
            width={barW}
            height={seg.h}
            fill={seg.color}
          >
            <title>{seg.key}: {format(seg.value)}</title>
          </rect>
        {/each}
        {#if i % Math.max(1, Math.floor(data.length / 8)) === 0}
          <text
            x={cx}
            y={height - 8}
            fill="currentColor"
            font-size="10"
            text-anchor="middle"
            opacity="0.6"
          >
            {d.label}
          </text>
        {/if}
      {/each}
    </svg>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {#each series as s (s.key)}
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm"
            style:background-color={s.color}
          ></span>
          <span class="text-muted-foreground">{s.label}</span>
        </span>
      {/each}
    </div>
  </div>
{/if}
