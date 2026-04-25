<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Snippet } from "svelte";
  import Button from "./button.svelte";

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  let {
    open = $bindable(false),
    title = "Confirm delete",
    description = "This action cannot be undone.",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    busy = false,
    children,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    children?: Snippet;
  } = $props();

  function close() {
    open = false;
  }

  function onConfirm() {
    dispatch("confirm");
  }

  function onCancel() {
    dispatch("cancel");
    close();
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") onCancel();
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-50 bg-black/50 appearance-none border-0 p-0"
    aria-label="Close confirmation dialog"
    onclick={onCancel}
  ></button>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      class="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      tabindex="-1"
    >
      <h2 id="confirm-dialog-title" class="text-lg font-semibold">{title}</h2>
      <p
        id="confirm-dialog-description"
        class="mt-2 text-sm text-muted-foreground"
      >
        {description}
      </p>

      {@render children?.()}

      <div class="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onclick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onclick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}
