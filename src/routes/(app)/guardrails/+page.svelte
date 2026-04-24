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
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import DateRangePicker from "$lib/components/date-range-picker.svelte";
  import { Trash2, Pencil, X, Check } from "lucide-svelte";
  import { fmtInt } from "$lib/utils";

  let { data } = $props();
  let editingId: string | null = $state(null);

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
</script>

<svelte:head><title>Guardrails · Nostraproxy</title></svelte:head>

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
          <Select name="stage">
            <option value="pre">pre</option>
            <option value="during">during</option>
            <option value="post">post</option>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Kind</Label>
          <Select name="kind">
            <option value="regex_block">regex_block</option>
            <option value="regex_redact">regex_redact</option>
            <option value="keyword_block">keyword_block</option>
            <option value="max_tokens">max_tokens</option>
            <option value="pii_redact">pii_redact</option>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Priority</Label><Input
            name="priority"
            type="number"
            value="100"
          />
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
                    <Select name="stage" value={g.stage}>
                      <option value="pre">pre</option>
                      <option value="during">during</option>
                      <option value="post">post</option>
                    </Select>
                    <Select name="kind" value={g.kind}>
                      <option value="regex_block">regex_block</option>
                      <option value="regex_redact">regex_redact</option>
                      <option value="keyword_block">keyword_block</option>
                      <option value="max_tokens">max_tokens</option>
                      <option value="pii_redact">pii_redact</option>
                    </Select>
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
                    onclick={() => (editingId = g.id)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance
                    class="inline"
                  >
                    <input type="hidden" name="id" value={g.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.guardrails.length === 0}
            <tr>
              <td
                colspan="9"
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
