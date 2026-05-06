<script lang="ts">
  interface Option {
    value: string;
    label: string;
    badge?: string | number;
  }

  let {
    options,
    value = $bindable(),
  }: {
    options: Option[];
    value: string;
  } = $props();
</script>

<div
  class="inline-flex rounded-md border border-border bg-muted p-0.5 text-sm"
  role="tablist"
>
  {#each options as option (option.value)}
    <button
      type="button"
      role="tab"
      aria-selected={value === option.value}
      class="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors {value ===
      option.value
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => (value = option.value)}
    >
      {option.label}
      {#if option.badge !== undefined}
        <span
          class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs leading-none {value ===
          option.value
            ? 'bg-muted text-foreground'
            : 'bg-muted text-muted-foreground'}"
        >
          {option.badge}
        </span>
      {/if}
    </button>
  {/each}
</div>
