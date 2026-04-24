<script lang="ts">
  interface Props {
    data: Array<{ label: string; value: number; value2?: number }>;
    width?: number;
    height?: number;
    color?: string;
    color2?: string;
    format?: (v: number) => string;
  }
  let {
    data,
    width = 800,
    height = 220,
    color = "hsl(217 91% 60%)",
    color2 = "hsl(0 72% 51%)",
    format = (v: number) => String(v),
  }: Props = $props();

  const padding = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = $derived(width - padding.left - padding.right);
  const innerH = $derived(height - padding.top - padding.bottom);

  const maxY = $derived(
    Math.max(1, ...data.flatMap((d) => [d.value, d.value2 ?? 0])),
  );
  const hasSecond = $derived(data.some((d) => d.value2 !== undefined));
  const groupW = $derived(data.length > 0 ? innerW / data.length : 0);
  const barW = $derived(hasSecond ? (groupW * 0.8) / 2 : groupW * 0.8);

  function barX(i: number, which: 0 | 1 = 0) {
    const center = padding.left + i * groupW + groupW / 2;
    if (!hasSecond) return center - barW / 2;
    return center - barW + which * barW;
  }
  function barY(v: number) {
    return padding.top + innerH - (v / maxY) * innerH;
  }
  function barH(v: number) {
    return (v / maxY) * innerH;
  }
</script>

{#if data.length === 0}
  <div
    class="flex h-[180px] items-center justify-center text-sm text-muted-foreground"
  >
    No data for this range.
  </div>
{:else}
  <svg
    viewBox={`0 0 ${width} ${height}`}
    class="w-full"
    role="img"
    aria-label="Bar chart"
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
      <rect
        x={barX(i, 0)}
        y={barY(d.value)}
        width={barW}
        height={barH(d.value)}
        fill={color}
        rx="2"
      />
      {#if hasSecond}
        <rect
          x={barX(i, 1)}
          y={barY(d.value2 ?? 0)}
          width={barW}
          height={barH(d.value2 ?? 0)}
          fill={color2}
          rx="2"
        />
      {/if}
      {#if i % Math.max(1, Math.ceil(data.length / 8)) === 0 || i === data.length - 1}
        {@const cx = padding.left + i * groupW + groupW / 2}
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
{/if}
