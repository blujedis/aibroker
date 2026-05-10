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
  } from '$lib/components/ui';
  import { enhance } from '$app/forms';
  import { toast } from 'svelte-sonner';
  import { fmtCurrency, fmtDateTime } from '$lib/utils';
  import { Trash2, Pencil, X, Check } from '@lucide/svelte';

  let { data, form } = $props();
  let lastToastSignature = $state('');
  let editingId: string | null = $state(null);
  let createFreq = $state('');
  let editFreq = $state('');

  function startEditing(p: (typeof data.profiles)[number]) {
    editingId = p.id;
    editFreq = p.globalBudgetFrequency ?? '';
  }
  let confirmOpen = $state(false);
  let deleteId: string | null = $state(null);
  let deleteName = $state('');
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

  $effect(() => {
    if (!form || typeof form !== 'object') return;
    const payload = form as Record<string, unknown>;
    const signature = JSON.stringify(payload);
    if (signature === lastToastSignature) return;
    lastToastSignature = signature;

    if (typeof payload.error === 'string' && payload.error) {
      toast.error(payload.error);
      return;
    }

    if (payload.ok) {
      toast.success('Profile changes saved.');
    }
  });
</script>

<svelte:head><title>Profiles · AiBroker</title></svelte:head>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete profile?"
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
  <input type="hidden" name="id" value={deleteId ?? ''} />
</form>

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
          <Select.Root bind:value={createFreq} name="globalBudgetFrequency">
            <Select.Trigger id="globalBudgetFrequency"
              >{createFreq || 'unlimited'}</Select.Trigger
            >
            <Select.Content>
              <Select.Item value="" label="unlimited" />
              <Select.Item value="daily" />
              <Select.Item value="weekly" />
              <Select.Item value="monthly" />
            </Select.Content>
          </Select.Root>
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
                      <Input name="description" value={p.description ?? ''} />
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
                      <Select.Root
                        bind:value={editFreq}
                        name="globalBudgetFrequency"
                      >
                        <Select.Trigger
                          >{editFreq || 'unlimited'}</Select.Trigger
                        >
                        <Select.Content>
                          <Select.Item value="" label="unlimited" />
                          <Select.Item value="daily" />
                          <Select.Item value="weekly" />
                          <Select.Item value="monthly" />
                        </Select.Content>
                      </Select.Root>
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
                  >{p.description ?? '—'}</td
                >
                <td class="py-2 pr-4">
                  {p.globalBudget && p.globalBudget > 0
                    ? `${fmtCurrency(p.globalBudget)} / ${p.globalBudgetFrequency ?? '—'}`
                    : 'unlimited'}
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
                    onclick={() => startEditing(p)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onclick={() => askDelete(p.id, p.name)}
                  >
                    <Trash2 class="h-4 w-4 text-destructive" />
                  </Button>
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
