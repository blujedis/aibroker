<script lang="ts">
  import { Label, Select } from "$lib/components/ui";
  import Input from "$lib/components/ui/input.svelte";
  import { RANGE_OPTIONS, type RangeKey } from "$lib/utils/date-range";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  interface Props {
    range: RangeKey;
    start?: string;
    end?: string;
  }
  let { range, start = "", end = "" }: Props = $props();

  let rangeLabel = $derived(
    RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "Select range...",
  );

  function apply() {
    const url = new URL(page.url);
    url.searchParams.set("range", range);
    if (range === "custom") {
      if (start) url.searchParams.set("start", start);
      else url.searchParams.delete("start");
      if (end) url.searchParams.set("end", end);
      else url.searchParams.delete("end");
    } else {
      url.searchParams.delete("start");
      url.searchParams.delete("end");
    }
    goto(url.toString(), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }
</script>

<div class="flex flex-wrap items-end gap-3">
  <div class="flex flex-col gap-1">
    <Label for="range-select">Date range</Label>
    <Select.Root bind:value={range} onValueChange={() => apply()}>
      <Select.Trigger id="range-select" class="w-44"
        >{rangeLabel}</Select.Trigger
      >
      <Select.Content>
        {#each RANGE_OPTIONS as opt (opt.value)}
          <Select.Item value={opt.value} label={opt.label} />
        {/each}
      </Select.Content>
    </Select.Root>
  </div>
  {#if range === "custom"}
    <div class="flex flex-col gap-1">
      <Label for="range-start">Start</Label>
      <Input
        id="range-start"
        type="date"
        bind:value={start}
        onchange={apply}
        class="w-40"
      />
    </div>
    <div class="flex flex-col gap-1">
      <Label for="range-end">End</Label>
      <Input
        id="range-end"
        type="date"
        bind:value={end}
        onchange={apply}
        class="w-40"
      />
    </div>
  {/if}
</div>
