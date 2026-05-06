<script lang="ts">
  import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Input,
    Label,
    Select,
    Table,
    Textarea,
    Badge,
    ConfirmDialog,
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import DateRangePicker from "$lib/components/date-range-picker.svelte";
  import { Trash2, Pencil, X, Check } from "@lucide/svelte";
  import { fmtInt } from "$lib/utils";

  let { data } = $props();
  let editingId: string | null = $state(null);
  let createStage = $state("pre");
  let createKind = $state("regex_block");
  let createProfileId = $state("");
  let editStage = $state("pre");
  let editKind = $state("regex_block");
  let editProfileId = $state("");

  function startEditing(g: (typeof data.guardrails)[number]) {
    editingId = g.id;
    editStage = g.stage;
    editKind = g.kind;
    editProfileId = g.profileId ?? "";
  }
  let confirmOpen = $state(false);
  let deleteId: string | null = $state(null);
  let deleteName = $state("");
  let deleteFormEl: HTMLFormElement | null = null;

  function askDelete(id: string, name: string) {
    deleteId = id;
    deleteName = name;
    confirmOpen = true;
  }

  function submitDelete() {
    if (!deleteId) return;
    deleteFormEl?.requestSubmit();
    confirmOpen = false;
  }

  const summaryById = $derived.by(() => {
    const m = new Map<
      string,
      {
        totalRuns: number;
        blocks: number;
        redacts: number;
        avgLatencyMs: number;
      }
    >();
    for (const row of data.summary) {
      if (row.guardrailId) m.set(row.guardrailId, row);
    }
    return m;
  });

  const profileNameById = $derived.by(() => {
    const entries = data.profiles.map(
      (profile) => [profile.id, profile.name] as const,
    );
    return new Map(entries);
  });

  function scopeLabel(profileId: string | null | undefined): string {
    if (!profileId) return "Global";
    return profileNameById.get(profileId) ?? "Profile-scoped";
  }
</script>

<svelte:head><title>Guardrails · AiBroker</title></svelte:head>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete guardrail?"
  description={`This will permanently delete ${deleteName}.`}
  confirmLabel="Delete"
  on:confirm={submitDelete}
/>

<form
  method="POST"
  action="?/delete"
  use:enhance
  class="hidden"
  bind:this={deleteFormEl}
>
  <input type="hidden" name="id" value={deleteId ?? ""} />
</form>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Guardrails</h1>
      <p class="text-sm text-muted-foreground">
        Pre, during, and post-stage rules that can redact or block traffic.
      </p>
    </div>
    <DateRangePicker range={data.rangeKey} start={data.start} end={data.end} />
  </div>

  <Card>
    <CardHeader title="Create guardrail" />
    <CardContent>
      <form
        method="POST"
        action="?/create"
        use:enhance
        class="grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label>Name</Label><Input name="name" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Stage</Label>
          <Select.Root bind:value={createStage} name="stage">
            <Select.Trigger>{createStage}</Select.Trigger>
            <Select.Content>
              <Select.Item value="pre" />
              <Select.Item value="during" />
              <Select.Item value="post" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Kind</Label>
          <Select.Root bind:value={createKind} name="kind">
            <Select.Trigger>{createKind}</Select.Trigger>
            <Select.Content>
              <Select.Item value="regex_block" />
              <Select.Item value="regex_redact" />
              <Select.Item value="keyword_block" />
              <Select.Item value="max_tokens" />
              <Select.Item value="pii_redact" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Priority</Label><Input
            name="priority"
            type="number"
            value="100"
          />
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label>Scope</Label>
          <Select.Root bind:value={createProfileId} name="profileId">
            <Select.Trigger>{scopeLabel(createProfileId)}</Select.Trigger>
            <Select.Content>
              <Select.Item value="" label="Global" />
              {#each data.profiles as profile (profile.id)}
                <Select.Item value={profile.id} label={profile.name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-6">
          <Label>Config (JSON)</Label>
          <Textarea
            name="config"
            rows={4}
            placeholder={`{"pattern":"(?i)ssn","flags":"g"}`}>{`{}`}</Textarea
          >
        </div>
        <div class="md:col-span-6">
          <Button type="submit">Create guardrail</Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <Card>
    <CardHeader
      title="Guardrails"
      description={`${data.guardrails.length} total`}
    />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Stage</th>
            <th class="py-2 pr-4">Kind</th>
            <th class="py-2 pr-4">Scope</th>
            <th class="py-2 pr-4">Prio</th>
            <th class="py-2 pr-4">Runs</th>
            <th class="py-2 pr-4">Blocks</th>
            <th class="py-2 pr-4">Avg latency</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.guardrails as g (g.id)}
            {#if editingId === g.id}
              <tr class="border-b border-border/60 bg-secondary/40">
                <td colspan="9" class="py-3">
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={() =>
                      async ({ update }) => {
                        await update();
                        editingId = null;
                      }}
                    class="grid grid-cols-1 gap-3 md:grid-cols-6 items-end"
                  >
                    <input type="hidden" name="id" value={g.id} />
                    <div class="md:col-span-2">
                      <Label>Name</Label><Input
                        name="name"
                        value={g.name}
                        required
                      />
                    </div>
                    <Select.Root bind:value={editStage} name="stage">
                      <Select.Trigger>{editStage}</Select.Trigger>
                      <Select.Content>
                        <Select.Item value="pre" />
                        <Select.Item value="during" />
                        <Select.Item value="post" />
                      </Select.Content>
                    </Select.Root>
                    <Select.Root bind:value={editKind} name="kind">
                      <Select.Trigger>{editKind}</Select.Trigger>
                      <Select.Content>
                        <Select.Item value="regex_block" />
                        <Select.Item value="regex_redact" />
                        <Select.Item value="keyword_block" />
                        <Select.Item value="max_tokens" />
                        <Select.Item value="pii_redact" />
                      </Select.Content>
                    </Select.Root>
                    <div>
                      <Label>Scope</Label>
                      <Select.Root bind:value={editProfileId} name="profileId">
                        <Select.Trigger
                          >{scopeLabel(editProfileId)}</Select.Trigger
                        >
                        <Select.Content>
                          <Select.Item value="" label="Global" />
                          {#each data.profiles as profile (profile.id)}
                            <Select.Item
                              value={profile.id}
                              label={profile.name}
                            />
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </div>
                    <Input name="priority" type="number" value={g.priority} />
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="enabled"
                        checked={g.enabled}
                      /> Enabled
                    </label>
                    <div class="md:col-span-6">
                      <Label>Config (JSON)</Label>
                      <Textarea name="config" rows={4}
                        >{g.config ?? "{}"}</Textarea
                      >
                    </div>
                    <div class="md:col-span-6 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onclick={() => (editingId = null)}
                      >
                        <X class="h-4 w-4" /> Cancel
                      </Button>
                      <Button type="submit"
                        ><Check class="h-4 w-4" /> Save</Button
                      >
                    </div>
                  </form>
                </td>
              </tr>
            {:else}
              {@const s = summaryById.get(g.id)}
              <tr class="border-b border-border/60">
                <td class="py-2 pr-4 font-medium">{g.name}</td>
                <td class="py-2 pr-4">{g.stage}</td>
                <td class="py-2 pr-4 text-muted-foreground">{g.kind}</td>
                <td class="py-2 pr-4">
                  <Badge variant={g.profileId ? "default" : "outline"}>
                    {scopeLabel(g.profileId)}
                  </Badge>
                </td>
                <td class="py-2 pr-4 tabular-nums">{g.priority}</td>
                <td class="py-2 pr-4 tabular-nums"
                  >{fmtInt(s?.totalRuns ?? 0)}</td
                >
                <td class="py-2 pr-4 tabular-nums">{fmtInt(s?.blocks ?? 0)}</td>
                <td class="py-2 pr-4 tabular-nums"
                  >{Math.round(s?.avgLatencyMs ?? 0)} ms</td
                >
                <td class="py-2 pr-4">
                  {#if g.enabled}<Badge variant="success">enabled</Badge>{:else}
                    <Badge variant="outline">disabled</Badge>{/if}
                </td>
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => startEditing(g)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onclick={() => askDelete(g.id, g.name)}
                  >
                    <Trash2 class="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.guardrails.length === 0}
            <tr>
              <td
                colspan="10"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No guardrails yet.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
