<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  interface Props extends HTMLInputAttributes {
    class?: string;
    value?: string | number | null;
    checked?: boolean;
  }

  let {
    class: className,
    type = "text",
    value = $bindable(),
    checked = $bindable(false),
    ...rest
  }: Props = $props();
</script>

{#if type === "checkbox" || type === "radio"}
  <input
    {type}
    {checked}
    onchange={(event) => {
      checked = event.currentTarget.checked;
    }}
    class={cn(
      "h-4 w-4 rounded border border-input text-primary shadow-2sx dark:shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  />
{:else if type === "file"}
  <input
    {type}
    class={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2sx dark:shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  />
{:else}
  <input
    {type}
    value={value ?? undefined}
    oninput={(event) => {
      value = event.currentTarget.value;
    }}
    class={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2sx dark:shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  />
{/if}
