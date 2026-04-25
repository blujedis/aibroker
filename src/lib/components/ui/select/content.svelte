<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    children: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<SelectPrimitive.Portal>
  <SelectPrimitive.Content
    class={cn(
      "relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background text-foreground shadow-md",
      className,
    )}
    sideOffset={4}
  >
    <SelectPrimitive.Viewport class="p-1">
      {@render children()}
    </SelectPrimitive.Viewport>
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
