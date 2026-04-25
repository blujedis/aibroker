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
    ConfirmDialog,
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { fmtCurrency, fmtDateTime } from "$lib/utils";
  import { Trash2, Pencil, X, Check, RotateCw } from "lucide-svelte";

  let { data, form } = $props();
  let editingId: string | null = $state(null);
  let createProfileId = $state("");
  let createFreq = $state("");
  let editProfileId = $state("");
  let editFreq = $state("");
  let keyDialogOpen = $state(false);
  let keyDialogCopied = $state(false);
  let keyDialogToken = $state("");
  let keyDialogTitle = $state("Copy API key");
  let keyDialogDescription = $state("");

  function startEditing(k: (typeof data.keys)[number]) {
    editingId = k.id;
    editProfileId = k.profileId;
    editFreq = k.budgetFrequency ?? "";
  }
  let confirmOpen = $state(false);
  let deleteId: string | null = $state(null);
  let deleteName = $state("");
  let deleteFormEl: HTMLFormElement | null = null;

  function openKeyDialog(token: string, reason: "create" | "rotate") {
    keyDialogToken = token;
    keyDialogCopied = false;
    keyDialogTitle =
      reason === "create" ? "API key created" : "API key regenerated";
    keyDialogDescription =
      "For security reasons, this key is shown only once. Save it now. If it is lost, you must regenerate it and copy it again.";
    keyDialogOpen = true;
  }

  async function copyGeneratedKey() {
    try {
      await navigator.clipboard.writeText(keyDialogToken);
      keyDialogCopied = true;
    } catch {
      keyDialogCopied = false;
    }
  }

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

  function isModelEligible(
    backendProfileId: string | null,
    keyProfileId: string,
  ): boolean {
    if (!keyProfileId) return false;
    return backendProfileId === null || backendProfileId === keyProfileId;
  }

  const createVisibleModels = $derived.by(() =>
    data.models.filter((model) =>
      isModelEligible(model.backendProfileId, createProfileId),
    ),
  );

  const actionWarning = $derived.by(() => {
    if (!form || typeof form !== "object") return null;
    const warning = (form as { warning?: unknown }).warning;
    return typeof warning === "string" ? warning : null;
  });
</script>

<svelte:head><title>Virtual keys · AiBroker</title></svelte:head>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete API key?"
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

{#if keyDialogOpen}
  <div class="fixed inset-0 z-50 bg-black/50"></div>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      class="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl"
    >
      <h2 class="text-lg font-semibold">{keyDialogTitle}</h2>
      <p class="mt-2 text-sm text-muted-foreground">{keyDialogDescription}</p>
      <div class="mt-4 rounded-md border border-border bg-secondary/40 p-3">
        <code class="break-all text-sm">{keyDialogToken}</code>
      </div>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onclick={copyGeneratedKey}>
          Copy key
        </Button>
        <Button
          type="button"
          disabled={!keyDialogCopied}
          onclick={() => {
            keyDialogOpen = false;
            keyDialogToken = "";
          }}
        >
          I saved the key
        </Button>
      </div>
    </div>
  </div>
{/if}

<div class="flex flex-col gap-6">
  {#if actionWarning}
    <div
      class="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
    >
      {actionWarning}
    </div>
  {/if}
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
        use:enhance={() => {
          return async ({ result, update }) => {
            await update();
            if (result.type !== "success") return;
            const payload = (result.data ?? {}) as { createdToken?: unknown };
            if (
              typeof payload.createdToken === "string" &&
              payload.createdToken
            ) {
              openKeyDialog(payload.createdToken, "create");
            }
          };
        }}
        class="grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label for="k-name">Name</Label>
          <Input id="k-name" name="name" required placeholder="prod-api" />
        </div>
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <Label for="k-profile">Profile</Label>
          <Select.Root bind:value={createProfileId} name="profileId">
            <Select.Trigger id="k-profile">
              {data.profiles.find((p) => p.id === createProfileId)?.name ??
                "Select profile..."}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="" label="Select profile..." />
              {#each data.profiles as p (p.id)}
                <Select.Item value={p.id} label={p.name} />
              {/each}
            </Select.Content>
          </Select.Root>
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
          <Select.Root bind:value={createFreq} name="budgetFrequency">
            <Select.Trigger id="k-freq"
              >{createFreq || "unlimited"}</Select.Trigger
            >
            <Select.Content>
              <Select.Item value="" label="unlimited" />
              <Select.Item value="daily" />
              <Select.Item value="weekly" />
              <Select.Item value="monthly" />
            </Select.Content>
          </Select.Root>
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
            {#each createVisibleModels as m (m.id)}
              <label
                class="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                <input type="checkbox" name="modelIds" value={m.id} />
                <span>{m.publicId}</span>
                <Badge variant={m.backendProfileId ? "default" : "outline"}
                  >{scopeLabel(m.backendProfileId)}</Badge
                >
              </label>
            {:else}
              <span class="text-sm text-muted-foreground"
                >{createProfileId
                  ? "No eligible models for this profile yet."
                  : "Select a profile to load eligible models."}</span
              >
            {/each}
          </div>
          <p class="text-xs text-muted-foreground">
            Only global models and models from the selected profile are shown.
          </p>
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
                      <Select.Root bind:value={editProfileId} name="profileId">
                        <Select.Trigger>
                          {data.profiles.find((p) => p.id === editProfileId)
                            ?.name ?? "Select profile..."}
                        </Select.Trigger>
                        <Select.Content>
                          {#each data.profiles as p (p.id)}
                            <Select.Item value={p.id} label={p.name} />
                          {/each}
                        </Select.Content>
                      </Select.Root>
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
                      <Select.Root bind:value={editFreq} name="budgetFrequency">
                        <Select.Trigger
                          >{editFreq || "unlimited"}</Select.Trigger
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
                          {@const eligible = isModelEligible(
                            m.backendProfileId,
                            editProfileId,
                          )}
                          <label
                            class="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              name="modelIds"
                              value={m.id}
                              disabled={!eligible}
                              checked={k.allowedModelIds.includes(m.id)}
                            />
                            <span>{m.publicId}</span>
                            <Badge
                              variant={m.backendProfileId
                                ? "default"
                                : "outline"}
                              >{scopeLabel(m.backendProfileId)}</Badge
                            >
                          </label>
                        {/each}
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">
                        Ineligible models are disabled and automatically removed
                        on save.
                      </p>
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
                  <span class="text-xs text-muted-foreground">
                    Hidden for security
                  </span>
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
                    onclick={() => startEditing(k)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <form
                    method="POST"
                    action="?/rotate"
                    use:enhance={() => {
                      return async ({ result, update }) => {
                        await update();
                        if (result.type !== "success") return;
                        const payload = (result.data ?? {}) as {
                          rotatedToken?: unknown;
                        };
                        if (
                          typeof payload.rotatedToken === "string" &&
                          payload.rotatedToken
                        ) {
                          openKeyDialog(payload.rotatedToken, "rotate");
                        }
                      };
                    }}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onclick={() => askDelete(k.id, k.name)}
                  >
                    <Trash2 class="h-4 w-4 text-destructive" />
                  </Button>
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
