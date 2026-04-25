<script lang="ts">
  import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Input,
    Label,
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";

  let { data, form } = $props();
</script>

<svelte:head><title>Profile · AiBroker</title></svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Your account</h1>
    <p class="text-sm text-muted-foreground">Signed in as {data.user?.email}</p>
  </div>

  <Card>
    <CardHeader title="Change password" />
    <CardContent>
      <form
        method="POST"
        action="?/changePassword"
        use:enhance
        class="grid grid-cols-1 gap-4 md:max-w-md"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="current">Current password</Label>
          <Input id="current" name="current" type="password" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="next">New password</Label>
          <Input id="next" name="next" type="password" required minlength={6} />
        </div>
        {#if form && "error" in form}
          <p class="text-sm text-destructive">{form.error}</p>
        {:else if form && "ok" in form}
          <p class="text-sm text-emerald-500">Password updated.</p>
        {/if}
        <div><Button type="submit">Update password</Button></div>
      </form>
    </CardContent>
  </Card>
</div>
