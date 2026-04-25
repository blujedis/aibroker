<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { Check } from "lucide-svelte";
  import type { Snippet } from "svelte";

  interface Props {
    value: string;
    label?: string;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
  }

  let {
    value,
    label,
    disabled,
    class: className,
    children: userChildren,
  }: Props = $props();

  const resolvedLabel = $derived(label ?? value);
</script>

<SelectPrimitive.Item
  {value}
  label={resolvedLabel}
  {disabled}
  class={cn(
    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-secondary/80 focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    className,
  )}
>
  {#snippet children({ selected })}
    <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      {#if selected}
        <Check class="h-4 w-4" />
      {/if}
    </span>
    {#if userChildren}
      {@render userChildren()}
    {:else}
      {resolvedLabel}
    {/if}
  {/snippet}
</SelectPrimitive.Item>
