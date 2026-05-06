<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { ChevronDown } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    id?: string;
    children?: Snippet;
  }

  let { class: className, id, children }: Props = $props();
</script>

<SelectPrimitive.Trigger
  {id}
  class={cn(
    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs dark:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
>
  <span class="line-clamp-1 text-left">
    {#if children}
      {@render children()}
    {/if}
  </span>
  <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
</SelectPrimitive.Trigger>
