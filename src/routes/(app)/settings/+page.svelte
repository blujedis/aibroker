<script lang="ts">
  import { Button, Card, CardContent, CardHeader } from "$lib/components/ui";
  import { enhance } from "$app/forms";

  let { data, form } = $props();
</script>

<svelte:head><title>Settings · Nostraproxy</title></svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="text-sm text-muted-foreground">
      System-wide configuration and maintenance.
    </p>
  </div>

  <Card>
    <CardHeader
      title="Environment"
      description="Configured via environment variables at startup"
    />
    <CardContent>
      <dl class="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            MAX_CONCURRENT_UPSTREAM
          </dt>
          <dd class="font-mono">{data.env.MAX_CONCURRENT_UPSTREAM}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            BOOTSTRAP_ADMIN_EMAIL
          </dt>
          <dd class="font-mono">{data.env.BOOTSTRAP_ADMIN_EMAIL}</dd>
        </div>
      </dl>
    </CardContent>
  </Card>

  <Card>
    <CardHeader title="Maintenance" />
    <CardContent>
      <form
        method="POST"
        action="?/reapSessions"
        use:enhance
        class="flex items-center gap-3"
      >
        <Button type="submit" variant="secondary">Reap expired sessions</Button>
        {#if form && "reaped" in form}
          <span class="text-sm text-muted-foreground"
            >Removed {form.reaped} expired sessions.</span
          >
        {/if}
      </form>
    </CardContent>
  </Card>
</div>
