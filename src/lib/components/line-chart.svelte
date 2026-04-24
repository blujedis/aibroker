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
    color2 = "hsl(142 70% 45%)",
    format = (v: number) => String(v),
  }: Props = $props();

  const padding = $derived({ top: 16, right: 16, bottom: 28, left: 48 });
  const innerW = $derived(width - padding.left - padding.right);
  const innerH = $derived(height - padding.top - padding.bottom);

  const maxY = $derived(
    Math.max(1, ...data.flatMap((d) => [d.value, d.value2 ?? 0])),
  );
  const step = $derived(data.length > 1 ? innerW / (data.length - 1) : 0);

  function xy(i: number, v: number) {
    const x = padding.left + i * step;
    const y = padding.top + innerH - (v / maxY) * innerH;
    return { x, y };
  }

  const path = $derived(
    data.length === 0
      ? ""
      : data
          .map((d, i) => {
            const { x, y } = xy(i, d.value);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" "),
  );
  const path2 = $derived(
    data.length === 0 || data.every((d) => d.value2 === undefined)
      ? ""
      : data
          .map((d, i) => {
            const { x, y } = xy(i, d.value2 ?? 0);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" "),
  );

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
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
    aria-label="Line chart"
  >
    <!-- gridlines -->
    {#each gridLines as g}
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

    <!-- axis labels (x) -->
    {#each data as d, i}
      {#if i % Math.max(1, Math.ceil(data.length / 8)) === 0 || i === data.length - 1}
        {@const x = padding.left + i * step}
        <text
          {x}
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

    {#if path2}
      <path
        d={path2}
        fill="none"
        stroke={color2}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
    <path
      d={path}
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    {#each data as d, i}
      {@const a = xy(i, d.value)}
      <circle cx={a.x} cy={a.y} r="2.5" fill={color} />
      {#if d.value2 !== undefined}
        {@const b = xy(i, d.value2)}
        <circle cx={b.x} cy={b.y} r="2.5" fill={color2} />
      {/if}
    {/each}
  </svg>
{/if}
