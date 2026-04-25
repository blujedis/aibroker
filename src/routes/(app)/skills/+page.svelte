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
  import { Trash2, Pencil, X, Check } from "lucide-svelte";

  let { data } = $props();
  let editingId: string | null = $state(null);
  let createProfileId = $state("");
  let editProfileId = $state("");
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

<svelte:head><title>Skills · AiBroker</title></svelte:head>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete skill?"
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
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Skills</h1>
    <p class="text-sm text-muted-foreground">
      Reusable instruction blocks that can be injected into requests (compatible
      with the skills pattern).
    </p>
  </div>

  <Card>
    <CardHeader title="Create skill" />
    <CardContent>
      <form
        method="POST"
        action="?/create"
        use:enhance
        class="grid grid-cols-1 gap-4"
      >
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label>Name</Label><Input name="name" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Description</Label><Input name="description" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5 md:max-w-sm">
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
        <div class="flex flex-col gap-1.5">
          <Label>Instructions (markdown)</Label>
          <Textarea name="instructions" rows={8} placeholder="# How to …" />
        </div>
        <div><Button type="submit">Create skill</Button></div>
      </form>
    </CardContent>
  </Card>

  <Card>
    <CardHeader title="Skills" description={`${data.skills.length} total`} />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Description</th>
            <th class="py-2 pr-4">Scope</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.skills as s (s.id)}
            {#if editingId === s.id}
              <tr class="border-b border-border/60 bg-secondary/40">
                <td colspan="5" class="py-3">
                  <form
                    method="POST"
                    action="?/update"
                    use:enhance={() =>
                      async ({ update }) => {
                        await update();
                        editingId = null;
                      }}
                    class="grid grid-cols-1 gap-3"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input name="name" value={s.name} required />
                      <Input name="description" value={s.description ?? ""} />
                    </div>
                    <div class="max-w-sm">
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
                    <Textarea name="instructions" rows={10}
                      >{s.instructions}</Textarea
                    >
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="enabled"
                        checked={s.enabled}
                      /> Enabled
                    </label>
                    <div class="flex justify-end gap-2">
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
              <tr class="border-b border-border/60">
                <td class="py-2 pr-4 font-medium">{s.name}</td>
                <td class="py-2 pr-4 text-muted-foreground"
                  >{s.description ?? "—"}</td
                >
                <td class="py-2 pr-4">
                  <Badge variant={s.profileId ? "default" : "outline"}>
                    {scopeLabel(s.profileId)}
                  </Badge>
                </td>
                <td class="py-2 pr-4">
                  {#if s.enabled}<Badge variant="success">enabled</Badge>{:else}
                    <Badge variant="outline">disabled</Badge>{/if}
                </td>
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => {
                      editingId = s.id;
                      editProfileId = s.profileId ?? "";
                    }}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onclick={() => askDelete(s.id, s.name)}
                  >
                    <Trash2 class="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.skills.length === 0}
            <tr>
              <td
                colspan="5"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No skills yet.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
