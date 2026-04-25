<script lang="ts">
  import {
    User as UserIcon,
    Settings,
    LogOut,
    ChevronDown,
    Moon,
    Sun,
    Monitor,
  } from "lucide-svelte";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { cn } from "$lib/utils";
  import { clickOutside } from "$lib/components/click-outside";

  interface Props {
    user: { name: string; email: string } | null;
  }
  let { user }: Props = $props();
  let open = $state(false);

  // border border-border bg-card
  // light - ? "bg-secondary text-foreground"
  // dark -  ? "bg-secondary text-foreground"
  // system - ? "bg-secondary text-foreground"
</script>

<header
  class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur"
>
  <div class="flex items-center gap-3">
    <span class="text-sm text-muted-foreground">LLM Gateway Dashboard</span>
  </div>

  <div class="flex items-center gap-2">
    <div
      class="inline-flex h-9 items-center rounded-md p-1"
      role="group"
      aria-label="Theme mode"
    >
      <button
        type="button"
        aria-label="Set light mode"
        class={cn(
          "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs transition-colors",
          $userPrefersMode === "light"
            ? "text-sky-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={() => setMode("light")}
      >
        <Sun class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        aria-label="Set dark mode"
        class={cn(
          "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs transition-colors",
          $userPrefersMode === "dark"
            ? "text-sky-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={() => setMode("dark")}
      >
        <Moon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Dark</span>
      </button>

      <button
        type="button"
        aria-label="Use system mode"
        class={cn(
          "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs transition-colors",
          $userPrefersMode === "system"
            ? "text-sky-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={() => setMode("system")}
      >
        <Monitor class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">System</span>
      </button>
    </div>

    <div class="relative" use:clickOutside={() => (open = false)}>
      <button
        type="button"
        onclick={() => (open = !open)}
        class={cn(
          "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary",
        )}
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {(user?.name ?? "U").charAt(0).toUpperCase()}
        </span>
        <span class="hidden sm:inline">{user?.name ?? "User"}</span>
        <ChevronDown class="h-3.5 w-3.5" />
      </button>

      {#if open}
        <div
          class="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div class="border-b border-border px-3 py-2.5">
            <div class="text-sm font-medium">{user?.name}</div>
            <div class="truncate text-xs text-muted-foreground">
              {user?.email}
            </div>
          </div>
          <div class="flex flex-col py-1">
            <a
              href="/profile"
              class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
            >
              <UserIcon class="h-4 w-4" /> Profile
            </a>
            <a
              href="/settings"
              class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
            >
              <Settings class="h-4 w-4" /> Settings
            </a>
            <form method="POST" action="/logout">
              <button
                type="submit"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <LogOut class="h-4 w-4" /> Logout
              </button>
            </form>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>
