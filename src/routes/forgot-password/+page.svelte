<script lang="ts">
  import { Button, Input, Label, Card } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { Zap } from "@lucide/svelte";

  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Forgot password · AiBroker</title>
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
          Reset your password
        </h1>
        <p class="text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>
      </div>
    </div>

    {#if form?.sent}
      <div class="flex flex-col gap-4 px-6 py-6 text-center">
        <p class="text-sm text-muted-foreground">
          If that email is registered, you'll receive a password reset link
          shortly.
        </p>
        <a
          href="/login"
          class="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
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
        <div class="flex flex-col gap-1.5">
          <Label for="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
          />
        </div>
        {#if form?.error}
          <p class="text-sm text-destructive">{form.error}</p>
        {/if}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
        <a
          href="/login"
          class="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </a>
      </form>
    {/if}
  </Card>
</div>
