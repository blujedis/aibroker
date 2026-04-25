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
  let createTransport = $state<"stdio" | "sse" | "http">("stdio");
  let createProfileId = $state("");
  let editTransport = $state<"stdio" | "sse" | "http">("stdio");
  let editProfileId = $state("");

  function startEditing(s: (typeof data.servers)[number]) {
    editingId = s.id;
    editTransport = s.transport as "stdio" | "sse" | "http";
    editProfileId = s.profileId ?? "";
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

<svelte:head><title>MCP servers · AiBroker</title></svelte:head>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete MCP server?"
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
    <h1 class="text-2xl font-semibold tracking-tight">MCP servers</h1>
    <p class="text-sm text-muted-foreground">
      Model Context Protocol tool servers available to requests routed through
      this proxy.
    </p>
  </div>

  <Card>
    <CardHeader title="Register MCP server" />
    <CardContent>
      <form
        method="POST"
        action="?/create"
        use:enhance
        class="grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label>Name</Label><Input
            name="name"
            required
            placeholder="filesystem"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Transport</Label>
          <Select.Root bind:value={createTransport} name="transport">
            <Select.Trigger>{createTransport}</Select.Trigger>
            <Select.Content>
              <Select.Item value="stdio" />
              <Select.Item value="sse" />
              <Select.Item value="http" />
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-3">
          <Label>Command (stdio)</Label>
          <Input
            name="command"
            placeholder="npx -y @modelcontextprotocol/server-filesystem"
          />
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-3">
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
        <div class="flex flex-col gap-1.5 md:col-span-3">
          <Label>Args (JSON)</Label>
          <Textarea name="args" rows={2}>{`[]`}</Textarea>
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-3">
          <Label>Env (JSON)</Label>
          <Textarea name="env" rows={2}>{`{}`}</Textarea>
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-6">
          <Label>URL (sse/http)</Label>
          <Input name="url" placeholder="https://example.com/mcp" />
        </div>
        <div class="md:col-span-6"><Button type="submit">Register</Button></div>
      </form>
    </CardContent>
  </Card>

  <Card>
    <CardHeader
      title="Registered servers"
      description={`${data.servers.length} total`}
    />
    <CardContent>
      <Table>
        <thead>
          <tr
            class="border-b border-border text-left text-xs uppercase text-muted-foreground"
          >
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Transport</th>
            <th class="py-2 pr-4">Scope</th>
            <th class="py-2 pr-4">Target</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.servers as s (s.id)}
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
                    class="grid grid-cols-1 gap-3 md:grid-cols-6 items-end"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <Input name="name" value={s.name} class="md:col-span-2" />
                    <Select.Root bind:value={editTransport} name="transport">
                      <Select.Trigger>{editTransport}</Select.Trigger>
                      <Select.Content>
                        <Select.Item value="stdio" />
                        <Select.Item value="sse" />
                        <Select.Item value="http" />
                      </Select.Content>
                    </Select.Root>
                    <Input
                      name="command"
                      value={s.command ?? ""}
                      class="md:col-span-3"
                    />
                    <div class="md:col-span-3">
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
                    <div class="md:col-span-3">
                      <Label>Args (JSON)</Label>
                      <Textarea name="args" rows={2}>{s.args ?? "[]"}</Textarea>
                    </div>
                    <div class="md:col-span-3">
                      <Label>Env (JSON)</Label>
                      <Textarea name="env" rows={2}>{s.env ?? "{}"}</Textarea>
                    </div>
                    <Input
                      name="url"
                      value={s.url ?? ""}
                      class="md:col-span-6"
                      placeholder="URL"
                    />
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="enabled"
                        checked={s.enabled}
                      /> Enabled
                    </label>
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
              <tr class="border-b border-border/60">
                <td class="py-2 pr-4 font-medium">{s.name}</td>
                <td class="py-2 pr-4">{s.transport}</td>
                <td class="py-2 pr-4">
                  <Badge variant={s.profileId ? "default" : "outline"}>
                    {scopeLabel(s.profileId)}
                  </Badge>
                </td>
                <td class="py-2 pr-4 text-muted-foreground font-mono text-xs">
                  {s.transport === "stdio"
                    ? (s.command ?? "—")
                    : (s.url ?? "—")}
                </td>
                <td class="py-2 pr-4">
                  {#if s.enabled}<Badge variant="success">enabled</Badge>{:else}
                    <Badge variant="outline">disabled</Badge>{/if}
                </td>
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => startEditing(s)}
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
          {#if data.servers.length === 0}
            <tr>
              <td
                colspan="6"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No MCP servers registered.
              </td>
            </tr>
          {/if}
        </tbody>
      </Table>
    </CardContent>
  </Card>
</div>
