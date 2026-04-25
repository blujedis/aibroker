<script lang="ts">
  import { Button, Input, Label, Card } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { Zap } from "lucide-svelte";

  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Sign in · AiBroker</title>
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
          Sign in to AiBroker
        </h1>
        <p class="text-sm text-muted-foreground">LLM gateway administration</p>
      </div>
    </div>
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
          value={form?.email ?? ""}
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      {#if form?.error}
        <p class="text-sm text-destructive">{form.error}</p>
      {/if}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <p class="text-center text-xs text-muted-foreground">
        Check <code>.env</code> to set the default credentials.
      </p>
    </form>
  </Card>
</div>
