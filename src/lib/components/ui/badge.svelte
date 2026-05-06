<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
    variant?: keyof typeof variants;
    children?: Snippet;
  }
  let { class: className, variant = "default", children }: Props = $props();

  const variants = {
    primary: "bg-primary text-primary-foreground",
    destructive: "bg-destructive/15 text-destructive",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    info: "text-white",
    outline: "border border-border text-foreground",
    default: "bg-secondary text-secondary-foreground",
  } as const;
</script>

<span
  class={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    variants[variant],
    className,
  )}
>
  {@render children?.()}
</span>