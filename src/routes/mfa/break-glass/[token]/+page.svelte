<script lang="ts">
  import { Button, Card } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { Zap } from "@lucide/svelte";

  let { data, form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>MFA Recovery · AiBroker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-md">
    <div
      class="flex flex-col items-center gap-3 border-b border-border px-6 py-6"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      >
        <Zap class="h-6 w-6" />
      </div>
      <div class="text-center">
        <h1 class="text-lg font-semibold tracking-tight">
          Emergency MFA recovery
        </h1>
      </div>
    </div>

    {#if !data.valid}
      <div class="flex flex-col gap-4 px-6 py-6 text-center">
        <p class="text-sm text-destructive">
          This recovery link is invalid or has expired.
        </p>
        <a
          href="/login"
          class="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Return to login
        </a>
      </div>
    {:else}
      <form
        method="POST"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update();
            submitting = false;
          };
        }}
        class="flex flex-col gap-4 px-6 py-6"
      >
        <p class="text-sm text-muted-foreground">
          This will disable MFA on your account so you can sign in with email
          and password. For security, all active sessions will be revoked.
        </p>

        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Applying…" : "Disable MFA and continue"}
        </Button>
      </form>
    {/if}
  </Card>
</div>
