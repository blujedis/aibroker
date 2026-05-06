<script lang="ts">
  import { Button, Card, Input, Label } from "$lib/components/ui";
  import { enhance } from "$app/forms";

  let { data, form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Verify MFA · AiBroker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-md p-6">
    {#if form?.setupComplete && form?.recoveryCodes?.length}
      <div class="mb-4 space-y-1">
        <h1 class="text-xl font-semibold tracking-tight">
          Save your recovery codes
        </h1>
        <p class="text-sm text-muted-foreground">
          These codes are shown only once. Store them in a safe place.
        </p>
      </div>

      <div
        class="mb-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm font-mono"
      >
        {#each form.recoveryCodes as code (code)}
          <div
            class="rounded border border-border bg-background px-2 py-1 text-center"
          >
            {code}
          </div>
        {/each}
      </div>

      <p class="mb-4 text-xs text-muted-foreground">
        Each recovery code can be used once instead of your authenticator app.
      </p>

      <Button
        type="button"
        onclick={() => (window.location.href = "/dashboard")}
      >
        Continue to dashboard
      </Button>
    {:else}
      <div class="mb-4 space-y-1">
        <h1 class="text-xl font-semibold tracking-tight">
          Verify your sign-in
        </h1>
        <p class="text-sm text-muted-foreground">
          Enter the authenticator code or a recovery code for
          <strong>{data.email}</strong>.
        </p>
      </div>

      <form
        method="POST"
        action="?/verify"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update();
            submitting = false;
          };
        }}
        class="space-y-4"
      >
        <div class="space-y-1.5">
          <Label for="token">Authenticator or recovery code</Label>
          <Input
            id="token"
            name="token"
            inputmode="text"
            autocomplete="one-time-code"
            required
          />
        </div>

        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </Button>
      </form>
    {/if}
  </Card>
</div>
