<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button, Card, Input, Label, Textarea } from "$lib/components/ui";

  let {
    data,
    form,
  }: {
    data: {
      valid: boolean;
      reason: "invalid" | "accepted" | "revoked" | "expired" | null;
      invitation: {
        email: string;
        role: "admin" | "manager" | "operator";
        profileId: string;
        customMessage: string | null;
        expiresAt: string | Date;
      } | null;
      profile: { id: string; name: string } | null;
      globalMfaEnabled: boolean;
    };
    form: { error?: string } | null;
  } = $props();

  let submitting = $state(false);

  function inviteMessage(reason: typeof data.reason) {
    if (reason === "accepted") return "This invitation has already been used.";
    if (reason === "revoked") return "This invitation has been revoked.";
    if (reason === "expired") return "This invitation has expired.";
    return "This invitation link is invalid.";
  }

  function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }
</script>

<svelte:head>
  <title>Accept invitation · AiBroker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-xl p-6">
    {#if !data.valid || !data.invitation}
      <div class="space-y-3">
        <h1 class="text-xl font-semibold tracking-tight">
          Invitation unavailable
        </h1>
        <p class="text-sm text-muted-foreground">
          {inviteMessage(data.reason)}
        </p>
        <a
          class="inline-flex w-fit items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          href="/login"
        >
          Back to login
        </a>
      </div>
    {:else}
      <div class="space-y-4">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold tracking-tight">
            Finish setting up your account
          </h1>
          <p class="text-sm text-muted-foreground">
            Complete your account to join AiBroker.
            {#if data.globalMfaEnabled}
              You will set up multi-factor authentication after account
              creation.
            {/if}
          </p>
        </div>

        <div
          class="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-1"
        >
          <p><strong>Email:</strong> {data.invitation.email}</p>
          <p><strong>Role:</strong> {data.invitation.role}</p>
          <p>
            <strong>Profile:</strong>
            {data.profile?.name ?? data.invitation.profileId}
          </p>
          <p>
            <strong>Expires:</strong>
            {formatDateTime(data.invitation.expiresAt)}
          </p>
        </div>

        {#if data.invitation.customMessage}
          <div class="space-y-1.5">
            <Label>Message from your administrator</Label>
            <Textarea value={data.invitation.customMessage} rows={4} readonly />
          </div>
        {/if}

        <form
          method="POST"
          use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
              await update();
              submitting = false;
            };
          }}
          class="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div class="space-y-1.5 md:col-span-2">
            <Label for="name">Name</Label>
            <Input id="name" name="name" autocomplete="name" required />
          </div>

          <div class="space-y-1.5">
            <Label for="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="space-y-1.5">
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
            <p class="md:col-span-2 text-sm text-destructive">{form.error}</p>
          {/if}

          <div class="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    {/if}
  </Card>
</div>
