<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button, Card, Input, Label } from '$lib/components/ui';
  import { Zap } from '@lucide/svelte';

  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Setup · AiBroker</title>
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
          Welcome to AiBroker
        </h1>
        <p class="text-sm text-muted-foreground">
          Create your administrator account to get started.
        </p>
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
        <Label for="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autocomplete="name"
          placeholder="Your full name"
          value={form?.name ?? ''}
          required
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="admin@example.com"
          value={form?.email ?? ''}
          required
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autocomplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
        />
      </div>

      {#if form?.error}
        <p class="text-sm text-destructive">{form.error}</p>
      {/if}

      <Button type="submit" disabled={submitting} class="mt-1">
        {submitting ? 'Creating account…' : 'Create administrator account'}
      </Button>
    </form>
  </Card>
</div>
