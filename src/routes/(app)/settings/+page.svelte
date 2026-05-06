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
  import { Upload } from "@lucide/svelte";

  let { data, form } = $props();
</script>

<svelte:head><title>Settings · AiBroker</title></svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="text-sm text-muted-foreground">
      System-wide configuration and maintenance.
    </p>
  </div>

  <Card>
    <CardHeader
      title="Authentication"
      description="Superadmin controls for instance-wide MFA enforcement"
    />
    <CardContent>
      <div class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Global MFA status:
          <strong
            >{data.settings.globalMfaEnabled ? "Enabled" : "Disabled"}</strong
          >
        </p>
        {#if data.user?.isSuperadmin}
          <form
            method="POST"
            action="?/setGlobalMfa"
            use:enhance
            class="flex items-center gap-3"
          >
            <label class="flex items-center gap-2 text-sm">
              <Input
                type="checkbox"
                name="enabled"
                checked={data.settings.globalMfaEnabled}
              />
              Require MFA for all users
            </label>
            <Button type="submit" variant="secondary">Save MFA setting</Button>
          </form>
          <p class="text-xs text-muted-foreground">
            Enabling this requires MFA enrollment and verification for all users
            at next login.
          </p>
        {:else}
          <p class="text-xs text-muted-foreground">
            Only the superadmin can change this setting.
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>

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
        <div>
          <dt class="text-xs uppercase text-muted-foreground">SESSION_TTL</dt>
          <dd class="font-mono">{data.env.SESSION_TTL}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            DATABASE_DIALECT
          </dt>
          <dd class="font-mono">{data.env.DATABASE_DIALECT}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            INVITE_EXPIRY_HOURS
          </dt>
          <dd class="font-mono">{data.env.INVITE_EXPIRY_HOURS}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            MAILGUN_DOMAIN
          </dt>
          <dd class="font-mono">{data.env.MAILGUN_DOMAIN}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-muted-foreground">
            MAILGUN_FROM_EMAIL
          </dt>
          <dd class="font-mono">{data.env.MAILGUN_FROM_EMAIL}</dd>
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

  <Card>
    <CardHeader
      title="Catalog import"
      description="Upload a providersAndModels.json file to upsert the accessible providers and models tables."
    />
    <CardContent>
      <form
        method="POST"
        action="?/catalogUpload"
        enctype="multipart/form-data"
        use:enhance
        class="flex flex-wrap items-end gap-3"
      >
        <div class="flex-1 min-w-65">
          <Label for="catalog-file">JSON file</Label>
          <Input
            id="catalog-file"
            type="file"
            name="file"
            accept="application/json,.json"
            required
          />
        </div>
        <Button type="submit">
          <Upload class="h-4 w-4 mr-1" /> Upload & upsert
        </Button>
        {#if form && "catalog" in form && form.catalog}
          <p class="text-sm text-muted-foreground w-full">
            Providers: <strong>{form.catalog.providersInserted}</strong>
            inserted,
            <strong>{form.catalog.providersUpdated}</strong> updated. Models:
            <strong>{form.catalog.modelsInserted}</strong> inserted,
            <strong>{form.catalog.modelsUpdated}</strong> updated.
          </p>
        {/if}
        {#if form && "error" in form && form.error}
          <p class="text-sm text-destructive w-full">{form.error}</p>
        {/if}
      </form>
    </CardContent>
  </Card>
</div>
