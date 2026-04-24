<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { cn } from "$lib/utils";
  import {
    LayoutDashboard,
    Users,
    KeyRound,
    Boxes,
    ScrollText,
    Shield,
    Server,
    Sparkles,
    Settings,
    ChevronLeft,
    ChevronRight,
    Zap,
  } from "lucide-svelte";

  interface Props {
    collapsed: boolean;
    onToggle?: () => void;
    children?: Snippet;
  }
  let { collapsed = $bindable(), onToggle }: Props = $props();

  const nav = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/profiles", label: "Profiles", icon: Users },
    { href: "/keys", label: "Virtual Keys", icon: KeyRound },
    { href: "/models", label: "Models & Backends", icon: Boxes },
    { href: "/requests", label: "Requests", icon: ScrollText },
    { href: "/guardrails", label: "Guardrails", icon: Shield },
    { href: "/mcp", label: "MCP Servers", icon: Server },
    { href: "/skills", label: "Skills", icon: Sparkles },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const current = $derived(page.url.pathname);
</script>

<aside
  class={cn(
    "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
    collapsed ? "w-16" : "w-64",
  )}
>
  <div class="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
    <div
      class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Zap class="h-4 w-4" />
    </div>
    {#if !collapsed}
      <div class="flex flex-col leading-tight">
        <span class="text-sm font-semibold">Nostraproxy</span>
        <span class="text-[11px] text-muted-foreground">LLM Gateway</span>
      </div>
    {/if}
  </div>

  <nav class="flex-1 overflow-y-auto px-2 py-3">
    <ul class="flex flex-col gap-1">
      {#each nav as item (item.href)}
        {@const active =
          current === item.href || current.startsWith(item.href + "/")}
        <li>
          <a
            href={item.href}
            class={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "hover:bg-secondary/60 text-sidebar-foreground/80",
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon class="h-4 w-4 shrink-0" />
            {#if !collapsed}
              <span class="truncate">{item.label}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="border-t border-sidebar-border p-2">
    <button
      type="button"
      onclick={onToggle}
      class="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {#if collapsed}
        <ChevronRight class="h-4 w-4" />
      {:else}
        <ChevronLeft class="h-4 w-4" />
        <span>Collapse</span>
      {/if}
    </button>
  </div>
</aside>
