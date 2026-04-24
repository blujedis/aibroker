<script lang="ts" module>
  export interface ComboboxItem {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { cn } from "$lib/utils";
  import { ChevronsUpDown, Check, X } from "lucide-svelte";

  interface Props {
    items: ComboboxItem[];
    value?: string | null;
    placeholder?: string;
    emptyText?: string;
    searchPlaceholder?: string;
    class?: string;
    disabled?: boolean;
    allowClear?: boolean;
    onSelect?: (item: ComboboxItem | null) => void;
  }

  let {
    items,
    value = $bindable(null),
    placeholder = "Select…",
    emptyText = "No matches",
    searchPlaceholder = "Search…",
    class: className,
    disabled = false,
    allowClear = true,
    onSelect,
  }: Props = $props();

  let open = $state(false);
  let query = $state("");
  let root: HTMLDivElement | null = $state(null);
  let inputEl: HTMLInputElement | null = $state(null);

  const selected = $derived(items.find((i) => i.value === value) ?? null);
  const filtered = $derived(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.value.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q),
    );
  });

  function toggle() {
    if (disabled) return;
    open = !open;
    if (open)
      queueMicrotask(() => {
        inputEl?.focus();
      });
  }

  function pick(item: ComboboxItem) {
    if (item.disabled) return;
    value = item.value;
    open = false;
    query = "";
    onSelect?.(item);
  }

  function clear(e: Event) {
    e.stopPropagation();
    value = null;
    query = "";
    onSelect?.(null);
  }

  function handleDocClick(e: MouseEvent) {
    if (!root) return;
    if (!root.contains(e.target as Node)) open = false;
  }

  $effect(() => {
    if (open) {
      document.addEventListener("mousedown", handleDocClick);
      return () => document.removeEventListener("mousedown", handleDocClick);
    }
  });
</script>

<div bind:this={root} class={cn("relative w-full", className)}>
  <button
    type="button"
    {disabled}
    onclick={toggle}
    class={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      !selected && "text-muted-foreground",
    )}
  >
    <span class="truncate text-left">
      {selected ? selected.label : placeholder}
    </span>
    <div class="flex items-center gap-1">
      {#if allowClear && selected}
        <span
          role="button"
          tabindex="0"
          aria-label="Clear"
          class="rounded p-0.5 hover:bg-secondary cursor-pointer"
          onclick={clear}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") clear(e);
          }}
        >
          <X class="h-3 w-3 text-muted-foreground" />
        </span>
      {/if}
      <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
    </div>
  </button>

  {#if open}
    <div
      class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
    >
      <div class="border-b border-border p-2">
        <input
          bind:this={inputEl}
          bind:value={query}
          placeholder={searchPlaceholder}
          class="h-8 w-full rounded-sm bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div class="max-h-64 overflow-y-auto p-1">
        {#if filtered().length === 0}
          <div class="px-2 py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        {:else}
          {#each filtered() as item (item.value)}
            <button
              type="button"
              disabled={item.disabled}
              onclick={() => pick(item)}
              class={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50",
                value === item.value && "bg-secondary",
              )}
            >
              <div class="min-w-0 flex-1">
                <div class="truncate">{item.label}</div>
                {#if item.description}
                  <div class="truncate text-xs text-muted-foreground">
                    {item.description}
                  </div>
                {/if}
              </div>
              {#if value === item.value}
                <Check class="h-4 w-4 shrink-0" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
