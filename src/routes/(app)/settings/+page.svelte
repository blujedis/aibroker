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
            MAX_CONCURRENT_PER_BACKEND
          </dt>
          <dd class="font-mono">{data.env.MAX_CONCURRENT_PER_BACKEND}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            UPSTREAM_TIMEOUT_MS
          </dt>
          <dd class="font-mono">{data.env.UPSTREAM_TIMEOUT_MS}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            UPSTREAM_STREAM_TIMEOUT_MS
          </dt>
          <dd class="font-mono">{data.env.UPSTREAM_STREAM_TIMEOUT_MS}</dd>
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

  {#if Object.keys(data.queueStats).length > 0}
    <Card>
      <CardHeader
        title="Queue Status"
        description="Active and pending upstream requests per backend (snapshot at page load)"
      />
      <CardContent>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs uppercase text-muted-foreground text-left">
              <th class="pb-2 pr-4">Backend ID</th>
              <th class="pb-2 pr-4">Active</th>
              <th class="pb-2">Pending</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries(data.queueStats) as [id, stats]}
              <tr class="border-t">
                <td class="py-1.5 pr-4 font-mono text-xs">{id}</td>
                <td class="py-1.5 pr-4">{stats.concurrency}</td>
                <td class="py-1.5">{stats.pending}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </CardContent>
    </Card>
  {/if}

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
