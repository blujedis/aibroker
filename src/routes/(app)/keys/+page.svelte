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
    Badge,
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { fmtCurrency, fmtDateTime } from "$lib/utils";
  import { Trash2, Pencil, X, Check, Copy, RotateCw } from "lucide-svelte";

  let { data } = $props();
  let editingId: string | null = $state(null);
  let revealed: Record<string, boolean> = $state({});

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }
</script>

<svelte:head><title>Virtual keys · Nostraproxy</title></svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Virtual API keys</h1>
    <p class="text-sm text-muted-foreground">
      Tokens clients use to call this proxy. Each is tied to a profile and
      optionally scoped to specific models.
    </p>
  </div>

  <Card>
    <CardHeader title="Create key" />
    <CardContent>
      <form
        method="POST"
        action="?/create"
        use:enhance
        class="grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label for="k-name">Name</Label>
          <Input id="k-name" name="name" required placeholder="prod-api" />
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label for="k-profile">Profile</Label>
          <Select id="k-profile" name="profileId" required>
            <option value="">Select profile…</option>
            {#each data.profiles as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="k-budget">Budget</Label>
          <Input
            id="k-budget"
            name="budget"
            type="number"
            step="0.01"
            min="0"
            placeholder="0 = unlimited"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="k-freq">Frequency</Label>
          <Select id="k-freq" name="budgetFrequency">
            <option value="">unlimited</option>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-6">
          <Label
            >Allowed models <span class="text-muted-foreground"
              >(leave empty = all enabled models)</span
            ></Label
          >
          <div
            class="flex flex-wrap gap-2 rounded-md border border-border bg-background p-3"
          >
            {#each data.models as m (m.id)}
              <label
                class="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                <input type="checkbox" name="modelIds" value={m.id} />
                <span>{m.publicId}</span>
              </label>
            {:else}
              <span class="text-sm text-muted-foreground"
                >No models configured yet.</span
              >
            {/each}
          </div>
        </div>
        <div class="md:col-span-6">
          <Button type="submit">Create key</Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <Card>
    <CardHeader title="Keys" description={`${data.keys.length} total`} />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Profile</th>
            <th class="py-2 pr-4">Token</th>
            <th class="py-2 pr-4">Budget</th>
            <th class="py-2 pr-4">Models</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 pr-4">Last used</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.keys as k (k.id)}
            {#if editingId === k.id}
              <tr class="border-b border-border/60 bg-secondary/40">
                <td colspan="8" class="py-3">
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
                    <input type="hidden" name="id" value={k.id} />
                    <div class="flex flex-col gap-1.5">
                      <Label>Name</Label>
                      <Input name="name" value={k.name} required />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Profile</Label>
                      <Select name="profileId" value={k.profileId}>
                        {#each data.profiles as p (p.id)}
                          <option value={p.id}>{p.name}</option>
                        {/each}
                      </Select>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Budget</Label>
                      <Input
                        name="budget"
                        type="number"
                        step="0.01"
                        min="0"
                        value={k.budget ?? 0}
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Frequency</Label>
                      <Select
                        name="budgetFrequency"
                        value={k.budgetFrequency ?? ""}
                      >
                        <option value="">unlimited</option>
                        <option value="daily">daily</option>
                        <option value="weekly">weekly</option>
                        <option value="monthly">monthly</option>
                      </Select>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="enabled"
                          checked={k.enabled}
                        /> Enabled
                      </label>
                    </div>
                    <div class="md:col-span-6">
                      <Label>Allowed models</Label>
                      <div
                        class="mt-1 flex flex-wrap gap-2 rounded-md border border-border bg-background p-3"
                      >
                        {#each data.models as m (m.id)}
                          <label
                            class="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              name="modelIds"
                              value={m.id}
                              checked={k.allowedModelIds.includes(m.id)}
                            />
                            <span>{m.publicId}</span>
                          </label>
                        {/each}
                      </div>
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
              <tr class="border-b border-border/60 align-top">
                <td class="py-2 pr-4 font-medium">{k.name}</td>
                <td class="py-2 pr-4">{k.profileName ?? "—"}</td>
                <td class="py-2 pr-4">
                  <div class="flex items-center gap-1">
                    <code class="rounded bg-secondary px-2 py-0.5 text-xs">
                      {revealed[k.id]
                        ? k.token
                        : k.token.slice(0, 8) + "…" + k.token.slice(-4)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onclick={() => (revealed[k.id] = !revealed[k.id])}
                      title="Show/hide"
                    >
                      <Pencil class="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onclick={() => copy(k.token)}
                      title="Copy"
                    >
                      <Copy class="h-3 w-3" />
                    </Button>
                  </div>
                </td>
                <td class="py-2 pr-4">
                  {k.budget && k.budget > 0
                    ? `${fmtCurrency(k.budget)} / ${k.budgetFrequency ?? "—"}`
                    : "unlimited"}
                </td>
                <td class="py-2 pr-4">
                  <span class="text-xs text-muted-foreground">
                    {k.allowedModelIds.length === 0
                      ? "all"
                      : `${k.allowedModelIds.length} scoped`}
                  </span>
                </td>
                <td class="py-2 pr-4">
                  {#if k.enabled}
                    <Badge variant="success">enabled</Badge>
                  {:else}
                    <Badge variant="outline">disabled</Badge>
                  {/if}
                </td>
                <td class="py-2 pr-4 text-muted-foreground">
                  {k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : "never"}
                </td>
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => (editingId = k.id)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <form
                    method="POST"
                    action="?/rotate"
                    use:enhance
                    class="inline"
                  >
                    <input type="hidden" name="id" value={k.id} />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="submit"
                      title="Rotate token"
                    >
                      <RotateCw class="h-4 w-4" />
                    </Button>
                  </form>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance
                    class="inline"
                  >
                    <input type="hidden" name="id" value={k.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.keys.length === 0}
            <tr>
              <td
                colspan="8"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No keys yet. Create a profile first, then a key.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
