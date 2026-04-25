<script lang="ts">
  // Simple tags input inspired by shadcn-svelte-extras. Adds tags on Enter or
  // comma; deletes the last tag on Backspace when the input is empty. The
  // parent receives the tag list via bound `value` and can also bind the
  // serialized JSON through `jsonValue` for easy form submission.
  import { cn } from "$lib/utils";
  import { X } from "lucide-svelte";

  interface Props {
    value?: string[];
    jsonValue?: string;
    name?: string;
    placeholder?: string;
    class?: string;
    disabled?: boolean;
  }

  let {
    value = $bindable([]),
    jsonValue = $bindable(""),
    name,
    placeholder = "Add tag…",
    class: className,
    disabled = false,
  }: Props = $props();

  let draft = $state("");

  $effect(() => {
    jsonValue = JSON.stringify(value);
  });

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) return;
    value = [...value, t];
    draft = "";
  }

  function removeTag(idx: number) {
    value = value.filter((_, i) => i !== idx);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      value = value.slice(0, -1);
    }
  }

  function onBlur() {
    if (draft.trim()) addTag(draft);
  }
</script>

<div
  class={cn(
    "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-2xs dark:shadow-sm focus-within:ring-1 focus-within:ring-ring",
    disabled && "pointer-events-none opacity-50",
    className,
  )}
>
  {#each value as tag, i (tag)}
    <span
      class="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
    >
      {tag}
      <button
        type="button"
        aria-label="Remove {tag}"
        class="rounded-sm hover:bg-secondary-foreground/10"
        onclick={() => removeTag(i)}
      >
        <X class="h-3 w-3" />
      </button>
    </span>
  {/each}
  <input
    type="text"
    bind:value={draft}
    onkeydown={onKey}
    onblur={onBlur}
    {placeholder}
    {disabled}
    class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[6rem]"
  />
  {#if name}
    <input type="hidden" {name} value={jsonValue} />
  {/if}
</div>
