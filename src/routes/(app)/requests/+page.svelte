<script lang="ts">
  import {
    Card,
    CardContent,
    CardHeader,
    Label,
    Select,
    Table,
    Badge,
  } from "$lib/components/ui";
  import DateRangePicker from "$lib/components/date-range-picker.svelte";
  import { fmtCurrency, fmtDateTime, fmtInt } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { data } = $props();
  let expanded: string | null = $state(null);

  function updateQuery(changes: Record<string, string>) {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(changes)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    goto(url.toString(), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }
</script>

<svelte:head><title>Requests · AiBroker</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Request log</h1>
      <p class="text-sm text-muted-foreground">
        Every request that flowed through the proxy.
      </p>
    </div>
    <DateRangePicker range={data.rangeKey} start={data.start} end={data.end} />
  </div>

  <Card>
    <CardContent>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div class="flex flex-col gap-1.5">
          <Label>Profile</Label>
          <Select.Root
            value={data.filters.profileId || undefined}
            onValueChange={(v) => updateQuery({ profileId: v ?? "" })}
          >
            <Select.Trigger>
              {data.profiles.find((p) => p.id === data.filters.profileId)
                ?.name ?? "all"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="" label="all" />
              {#each data.profiles as p (p.id)}
                <Select.Item value={p.id} label={p.name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Virtual key</Label>
          <Select.Root
            value={data.filters.vkeyId || undefined}
            onValueChange={(v) => updateQuery({ vkeyId: v ?? "" })}
          >
            <Select.Trigger>
              {data.keys.find((k) => k.id === data.filters.vkeyId)?.name ??
                "all"}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="" label="all" />
              {#each data.keys as k (k.id)}
                <Select.Item value={k.id} label={k.name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select.Root
            value={data.filters.status || undefined}
            onValueChange={(v) => updateQuery({ status: v ?? "" })}
          >
            <Select.Trigger>{data.filters.status || "all"}</Select.Trigger>
            <Select.Content>
              <Select.Item value="" label="all" />
              <Select.Item value="success" />
              <Select.Item value="failed" />
              <Select.Item value="blocked" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Limit</Label>
          <Select.Root
            value={String(data.filters.limit)}
            onValueChange={(v) => updateQuery({ limit: v ?? "25" })}
          >
            <Select.Trigger>{data.filters.limit}</Select.Trigger>
            <Select.Content>
              <Select.Item value="25" />
              <Select.Item value="100" />
              <Select.Item value="250" />
              <Select.Item value="500" />
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader title={`Showing ${data.logs.length} requests`} />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">When</th>
            <th class="py-2 pr-4">Profile</th>
            <th class="py-2 pr-4">Key</th>
            <th class="py-2 pr-4">Model</th>
            <th class="py-2 pr-4">In</th>
            <th class="py-2 pr-4">Out</th>
            <th class="py-2 pr-4">Cost</th>
            <th class="py-2 pr-4">Latency</th>
            <th class="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.logs as l (l.id)}
            <tr
              class="border-b border-border/60 cursor-pointer hover:bg-secondary/40"
              onclick={() => (expanded = expanded === l.id ? null : l.id)}
            >
              <td class="py-2 pr-4 text-muted-foreground"
                >{fmtDateTime(l.createdAt)}</td
              >
              <td class="py-2 pr-4">{l.profileName ?? "—"}</td>
              <td class="py-2 pr-4">{l.vkeyName ?? "—"}</td>
              <td class="py-2 pr-4">{l.modelPublicId ?? "—"}</td>
              <td class="py-2 pr-4 tabular-nums">{fmtInt(l.inputTokens)}</td>
              <td class="py-2 pr-4 tabular-nums">{fmtInt(l.outputTokens)}</td>
              <td class="py-2 pr-4 tabular-nums">{fmtCurrency(l.cost)}</td>
              <td class="py-2 pr-4 tabular-nums">{l.latencyMs} ms</td>
              <td class="py-2 pr-4">
                {#if l.status === "success"}
                  <Badge variant="success">{l.httpStatus}</Badge>
                {:else if l.status === "blocked"}
                  <Badge variant="warning">blocked</Badge>
                {:else}
                  <Badge variant="destructive">{l.httpStatus}</Badge>
                {/if}
                {#if l.streaming}<Badge variant="outline">stream</Badge>{/if}
              </td>
            </tr>
            {#if expanded === l.id}
              <tr class="border-b border-border/60 bg-secondary/30">
                <td colspan="9" class="p-4 text-xs">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <div class="text-muted-foreground">Request id</div>
                      <div class="font-mono">{l.id}</div>
                    </div>
                    <div>
                      <div class="text-muted-foreground">Endpoint</div>
                      <div class="font-mono">{l.endpoint}</div>
                    </div>
                    <div class="col-span-2">
                      <div class="text-muted-foreground">Error</div>
                      <div class="font-mono whitespace-pre-wrap">
                        {l.errorMessage ?? "—"}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.logs.length === 0}
            <tr>
              <td
                colspan="9"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No requests match the current filters.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
