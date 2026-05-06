<script lang="ts">
  import { Button, Card, Input, Label } from "$lib/components/ui";
  import { enhance } from "$app/forms";

  let { data, form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Set up MFA · AiBroker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-lg p-6">
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
          Set up multi-factor authentication
        </h1>
        <p class="text-sm text-muted-foreground">
          MFA is required for this instance. Scan the QR code with your
          authenticator app, then enter the generated code.
        </p>
      </div>

      <div
        class="mb-4 flex flex-col items-center rounded-md border border-border bg-muted/30 p-4"
      >
        {#if data.qrCodeDataUrl}
          <img
            src={data.qrCodeDataUrl}
            alt="Authenticator setup QR code"
            class="h-56 w-56 rounded-md border border-border bg-white p-2"
          />
        {:else}
          <p class="text-sm text-muted-foreground">
            QR generation is unavailable right now. Use the manual details
            below.
          </p>
        {/if}
      </div>

      <div class="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p><strong>Account:</strong> {data.email}</p>
        <p><strong>Secret:</strong> <code>{data.secret}</code></p>
        <p class="mt-2 break-all text-xs text-muted-foreground">
          <strong>OTP URI:</strong>
          {data.otpauth}
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
          <Label for="token">Authenticator code</Label>
          <Input
            id="token"
            name="token"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
          />
        </div>

        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Complete setup"}
        </Button>
      </form>
    {/if}
  </Card>
</div>
