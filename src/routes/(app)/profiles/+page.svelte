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
  import { fmtCurrency, fmtDateTime } from "$lib/utils";
  import { Trash2, Pencil, X, Check } from "lucide-svelte";

  let { data } = $props();
  let editingId: string | null = $state(null);
</script>

<svelte:head><title>Profiles · Nostraproxy</title></svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Client profiles</h1>
    <p class="text-sm text-muted-foreground">
      Groups of virtual API keys with a shared global budget cap.
    </p>
  </div>

  <Card>
    <CardHeader title="Create profile" />
    <CardContent>
      <form
        method="POST"
        action="?/create"
        use:enhance
        class="grid grid-cols-1 gap-4 md:grid-cols-4"
      >
        <div class="flex flex-col gap-1.5">
          <Label for="name">Name</Label>
          <Input id="name" name="name" required placeholder="Acme Corp" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="description">Description</Label>
          <Input id="description" name="description" placeholder="optional" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="globalBudget">Global budget (USD)</Label>
          <Input
            id="globalBudget"
            name="globalBudget"
            type="number"
            step="0.01"
            min="0"
            placeholder="0 = unlimited"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="globalBudgetFrequency">Frequency</Label>
          <Select id="globalBudgetFrequency" name="globalBudgetFrequency">
            <option value="">unlimited</option>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </Select>
        </div>
        <div class="md:col-span-4">
          <Button type="submit">Create profile</Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <Card>
    <CardHeader
      title="Profiles"
      description={`${data.profiles.length} total`}
    />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Description</th>
            <th class="py-2 pr-4">Budget</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 pr-4">Created</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.profiles as p (p.id)}
            {#if editingId === p.id}
              <tr class="border-b border-border/60 bg-secondary/40">
                <td colspan="6" class="py-3">
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
                    <input type="hidden" name="id" value={p.id} />
                    <div class="flex flex-col gap-1.5">
                      <Label>Name</Label>
                      <Input name="name" value={p.name} required />
                    </div>
                    <div class="flex flex-col gap-1.5 md:col-span-2">
                      <Label>Description</Label>
                      <Input name="description" value={p.description ?? ""} />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Budget</Label>
                      <Input
                        name="globalBudget"
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.globalBudget ?? 0}
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Frequency</Label>
                      <Select
                        name="globalBudgetFrequency"
                        value={p.globalBudgetFrequency ?? ""}
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
                          checked={p.enabled}
                        /> Enabled
                      </label>
                    </div>
                    <div class="md:col-span-6 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onclick={() => (editingId = null)}
                      >
                        <X class="h-4 w-4" /> Cancel
                      </Button>
                      <Button type="submit">
                        <Check class="h-4 w-4" /> Save
                      </Button>
                    </div>
                  </form>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-border/60">
                <td class="py-2 pr-4 font-medium">{p.name}</td>
                <td class="py-2 pr-4 text-muted-foreground"
                  >{p.description ?? "—"}</td
                >
                <td class="py-2 pr-4">
                  {p.globalBudget && p.globalBudget > 0
                    ? `${fmtCurrency(p.globalBudget)} / ${p.globalBudgetFrequency ?? "—"}`
                    : "unlimited"}
                </td>
                <td class="py-2 pr-4">
                  {#if p.enabled}
                    <Badge variant="success">enabled</Badge>
                  {:else}
                    <Badge variant="outline">disabled</Badge>
                  {/if}
                </td>
                <td class="py-2 pr-4 text-muted-foreground"
                  >{fmtDateTime(p.createdAt)}</td
                >
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => (editingId = p.id)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance
                    class="inline"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.profiles.length === 0}
            <tr>
              <td
                colspan="6"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No profiles yet.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
