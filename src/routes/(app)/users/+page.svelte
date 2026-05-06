<script lang="ts">
  import { Check, Pencil, Trash2, X } from "@lucide/svelte";
  import { enhance } from "$app/forms";
  import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    ConfirmDialog,
    Input,
    Label,
    SegmentSwitcher,
    Select,
    Textarea,
  } from "$lib/components/ui";

  let {
    data,
    form,
  }: {
    data: {
      actor: {
        role: "admin" | "manager" | "operator";
        isSuperadmin: boolean;
      };
      actorId: string;
      globalMfaEnabled: boolean;
      users: Array<{
        id: string;
        name: string;
        email: string;
        role: "admin" | "manager" | "operator";
        isSuperadmin: boolean;
        profileIds: string[];
        mfaEnabled: boolean;
        linkedProviders: string[];
      }>;
      profiles: Array<{ id: string; name: string }>;
      invitations: Array<{
        id: string;
        email: string;
        role: "admin" | "manager" | "operator";
        profileId: string;
        expiresAt: string | Date;
        acceptedAt: string | Date | null;
        revokedAt: string | Date | null;
      }>;
    };
    form: { error?: string } | null;
  } = $props();

  let editingId = $state<string | null>(null);
  let createFormEl = $state<HTMLFormElement | null>(null);
  let createRole = $state<"admin" | "manager" | "operator">("operator");
  let createPassword = $state(generatePassword());
  let createProfileIds = $state<string[]>([]);
  let inviteRole = $state<"manager" | "operator">("operator");
  let inviteEmail = $state("");
  let inviteProfileId = $state("");
  let inviteCustomMessage = $state("");
  let inviteConfirmOpen = $state(false);
  let inviteFormEl = $state<HTMLFormElement | null>(null);
  let mfaConfirmOpen = $state(false);
  let mfaToggleFormEl = $state<HTMLFormElement | null>(null);
  let editing = $state<{
    name: string;
    email: string;
    role: "admin" | "manager" | "operator";
    profileIds: string[];
    mfaEnabled: boolean;
  }>({
    name: "",
    email: "",
    role: "operator",
    profileIds: [],
    mfaEnabled: false,
  });

  const canManageRoles = $derived(data.actor.role === "admin");

  let view = $state<"users" | "invitations">("users");
  const pendingInvitationCount = $derived(
    data.invitations.filter((inv) => invitationStatus(inv) === "pending")
      .length,
  );

  function openInviteConfirm() {
    if (!inviteEmail.trim() || !inviteProfileId.trim()) return;
    inviteConfirmOpen = true;
  }

  function submitInvite() {
    inviteFormEl?.requestSubmit();
    inviteConfirmOpen = false;
  }

  function startEdit(user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "manager" | "operator";
    profileIds: string[];
    mfaEnabled: boolean;
  }) {
    editingId = user.id;
    editing = {
      name: user.name,
      email: user.email,
      role: user.role,
      profileIds: [...user.profileIds],
      mfaEnabled: user.mfaEnabled,
    };
  }

  function cancelEdit() {
    editingId = null;
    editing = {
      name: "",
      email: "",
      role: "operator",
      profileIds: [],
      mfaEnabled: false,
    };
  }

  function toggleProfile(profileId: string) {
    editing.profileIds = editing.profileIds.includes(profileId)
      ? editing.profileIds.filter((id) => id !== profileId)
      : [...editing.profileIds, profileId];
  }

  function toggleCreateProfile(profileId: string) {
    createProfileIds = createProfileIds.includes(profileId)
      ? createProfileIds.filter((id) => id !== profileId)
      : [...createProfileIds, profileId];
  }

  function generatePassword(length = 18): string {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const bytes = new Uint32Array(length);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(
      "",
    );
  }

  function refreshCreatePassword() {
    createPassword = generatePassword();
  }

  function resetCreateForm() {
    createFormEl?.reset();
    createRole = "operator";
    createProfileIds = [];
    refreshCreatePassword();
  }

  function roleTone(role: string) {
    if (role === "admin") return "info" as const;
    if (role === "manager") return "warning" as const;
    return "outline" as const;
  }

  // function providerLabel(provider: string): string {
  //   return provider
  //     .split(/[-_\s]+/g)
  //     .filter(Boolean)
  //     .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  //     .join(" ");
  // }

  function profileNameById(profileId: string): string {
    const profile = data.profiles.find(
      (item: { id: string; name: string }) => item.id === profileId,
    );
    return profile?.name ?? profileId;
  }

  function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }

  function invitationStatus(invitation: {
    acceptedAt: string | Date | null;
    revokedAt: string | Date | null;
    expiresAt: string | Date;
  }): "accepted" | "revoked" | "expired" | "pending" {
    if (invitation.acceptedAt) return "accepted";
    if (invitation.revokedAt) return "revoked";
    const expiresAt =
      invitation.expiresAt instanceof Date
        ? invitation.expiresAt
        : new Date(invitation.expiresAt);
    return expiresAt.getTime() <= Date.now() ? "expired" : "pending";
  }

  function invitationTone(status: ReturnType<typeof invitationStatus>) {
    if (status === "accepted") return "default" as const;
    if (status === "revoked") return "destructive" as const;
    if (status === "expired") return "warning" as const;
    return "outline" as const;
  }
</script>

<svelte:head><title>Users · AiBroker</title></svelte:head>

{#snippet getIcon(name: string)}
  {#if name === "google"}
    <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"
      ><path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      ></path><path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      ></path><path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      ></path><path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      ></path></svg
    >
  {/if}
{/snippet}

<ConfirmDialog
  bind:open={inviteConfirmOpen}
  title="Send invitation?"
  description={`This will send a signup link to ${inviteEmail || "the selected email"}.`}
  confirmLabel="Send invitation"
  on:confirm={submitInvite}
>
  {#snippet children()}
    <div class="mt-4 space-y-3 text-sm">
      <div class="rounded-md border border-border bg-muted/40 p-3">
        <p><strong>Email:</strong> {inviteEmail || "-"}</p>
        <p><strong>Role:</strong> {inviteRole}</p>
        <p>
          <strong>Profile:</strong>
          {profileNameById(inviteProfileId) || "-"}
        </p>
      </div>
      <div class="space-y-1.5">
        <Label for="invite-custom-message">Custom message</Label>
        <Textarea
          id="invite-custom-message"
          bind:value={inviteCustomMessage}
          rows={4}
          placeholder="Optional note to include in the invitation email"
        />
      </div>
    </div>
  {/snippet}
</ConfirmDialog>

<ConfirmDialog
  bind:open={mfaConfirmOpen}
  title={editing.mfaEnabled
    ? "Disable two-factor authentication?"
    : "Enable two-factor authentication?"}
  description={editing.mfaEnabled
    ? "You will be logged out and must sign in again. MFA will be disabled and you will no longer need a verification code to log in."
    : "You will be logged out and must sign in again. On your next login you will be guided through the MFA setup process."}
  confirmLabel="Continue"
  on:confirm={() => mfaToggleFormEl?.submit()}
  on:cancel={() => (mfaConfirmOpen = false)}
/>

<form
  bind:this={mfaToggleFormEl}
  method="POST"
  action="?/toggleMfa"
  use:enhance
  hidden
></form>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Users</h1>
      <p class="text-sm text-muted-foreground">
        Admins can manage everyone. Managers can manage themselves and operators
        they created.
      </p>
    </div>
    <SegmentSwitcher
      bind:value={view}
      options={[
        { value: "users", label: "Users" },
        {
          value: "invitations",
          label: "Invitations",
          badge:
            pendingInvitationCount > 0 ? pendingInvitationCount : undefined,
        },
      ]}
    />
  </div>

  {#if view === "users"}
    {#if data.actor.role !== "operator"}
      <Card>
        <CardHeader
          title="Create user"
          description="Create a new account with role and profile assignments."
        />
        <CardContent>
          <form
            method="POST"
            action="?/create"
            use:enhance={() => {
              return async ({ result, update }) => {
                await update();
                if (result.type !== "success") return;
                resetCreateForm();
              };
            }}
            class="grid grid-cols-1 gap-4 md:grid-cols-2"
            bind:this={createFormEl}
          >
            <div class="space-y-1.5">
              <Label for="create-name">Name</Label>
              <Input id="create-name" name="name" required />
            </div>

            <div class="space-y-1.5">
              <Label for="create-email">Email</Label>
              <Input id="create-email" name="email" type="email" required />
            </div>

            <div class="space-y-1.5">
              <Label for="create-password">Password</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="create-password"
                  name="password"
                  type="text"
                  autocomplete="new-password"
                  bind:value={createPassword}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onclick={refreshCreatePassword}
                >
                  Generate
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                A password is generated automatically. Regenerate it if needed.
              </p>
            </div>

            <div class="space-y-1.5">
              <Label for="create-role">Role</Label>
              <Select.Root bind:value={createRole} name="role">
                <Select.Trigger id="create-role">{createRole}</Select.Trigger>
                <Select.Content>
                  {#if data.actor.role === "admin"}
                    <Select.Item value="operator" />
                    <Select.Item value="manager" />
                    <Select.Item value="admin" />
                  {:else}
                    <Select.Item value="operator" />
                  {/if}
                </Select.Content>
              </Select.Root>
            </div>

            {#if data.profiles.length > 0}
              <div class="space-y-2 md:col-span-2">
                <Label>Profile assignments</Label>
                {#each createProfileIds as profileId (profileId)}
                  <input type="hidden" name="profileIds" value={profileId} />
                {/each}
                <div
                  class="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-2xs dark:shadow-sm"
                >
                  {#each createProfileIds as profileId (profileId)}
                    <span
                      class="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {profileNameById(profileId)}
                      <button
                        type="button"
                        aria-label="Remove {profileNameById(profileId)}"
                        class="rounded-sm hover:bg-secondary-foreground/10"
                        onclick={() => toggleCreateProfile(profileId)}
                      >
                        <X class="h-3 w-3" />
                      </button>
                    </span>
                  {/each}
                  {#if data.profiles.some((p) => !createProfileIds.includes(p.id))}
                    <select
                      class="flex-1 min-w-32 bg-transparent text-xs text-muted-foreground outline-none"
                      onchange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        if (val) {
                          toggleCreateProfile(val);
                          (e.target as HTMLSelectElement).value = "";
                        }
                      }}
                    >
                      <option value="">+ Add profile</option>
                      {#each data.profiles.filter((p) => !createProfileIds.includes(p.id)) as profile (profile.id)}
                        <option value={profile.id}>{profile.name}</option>
                      {/each}
                    </select>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="md:col-span-2">
              <Button type="submit">Create user</Button>
            </div>
          </form>
          {#if form?.error}
            <p class="mt-3 text-sm text-destructive">{form.error}</p>
          {/if}
        </CardContent>
      </Card>
    {/if}

    <Card>
      <CardHeader title="User accounts" />
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="border-b border-border text-left text-xs uppercase text-muted-foreground"
              >
                <th class="px-3 py-2">Name</th>
                <th class="px-3 py-2">Email</th>
                <th class="px-3 py-2">Role</th>
                <th class="px-3 py-2">Profiles</th>
                <th class="px-3 py-2">MFA</th>
                <th class="px-3 py-2">Linked auth</th>
                <th class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each data.users as user (user.id)}
                {#if editingId === user.id}
                  <tr class="border-b border-border bg-secondary/40">
                    <td colspan="7" class="p-3">
                      <form
                        method="POST"
                        action="?/update"
                        use:enhance={() => {
                          return async ({ result, update }) => {
                            await update();
                            if (result.type !== "success") return;
                            cancelEdit();
                          };
                        }}
                        class="space-y-3"
                      >
                        <input type="hidden" name="id" value={user.id} />
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div class="space-y-1.5">
                            <Label for="edit-name">Name</Label>
                            <Input
                              id="edit-name"
                              name="name"
                              bind:value={editing.name}
                            />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="edit-email">Email</Label>
                            <Input
                              id="edit-email"
                              name="email"
                              type="email"
                              bind:value={editing.email}
                            />
                          </div>
                          <div class="space-y-1.5">
                            <Label for="edit-password">Password</Label>
                            <Input
                              id="edit-password"
                              name="password"
                              type="password"
                              autocomplete="new-password"
                              placeholder="Leave blank to keep"
                            />
                          </div>
                        </div>

                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div class="space-y-1.5">
                            <Label>Role</Label>
                            {#if canManageRoles}
                              <Select.Root
                                bind:value={editing.role}
                                name="role"
                              >
                                <Select.Trigger>{editing.role}</Select.Trigger>
                                <Select.Content>
                                  <Select.Item value="operator" />
                                  <Select.Item value="manager" />
                                  <Select.Item value="admin" />
                                </Select.Content>
                              </Select.Root>
                            {:else}
                              <Input value={editing.role} disabled />
                              <input
                                type="hidden"
                                name="role"
                                value={editing.role}
                              />
                            {/if}
                          </div>

                          {#if data.actor.role === "admin" && data.profiles.length > 0}
                            <div
                              class="space-y-1.5 {user.isSuperadmin
                                ? 'opacity-50'
                                : ''}"
                            >
                              <Label>Profile assignments</Label>

                              {#each editing.profileIds as profileId (profileId)}
                                <input
                                  type="hidden"
                                  name="profileIds"
                                  value={profileId}
                                />
                              {/each}

                              <div
                                class="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-2xs dark:shadow-sm {user.isSuperadmin
                                  ? 'pointer-events-none'
                                  : ''}"
                              >
                                {#each editing.profileIds as profileId (profileId)}
                                  <span
                                    class="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                                  >
                                    {profileNameById(profileId)}
                                    <button
                                      type="button"
                                      aria-label="Remove {profileNameById(
                                        profileId,
                                      )}"
                                      class="rounded-sm hover:bg-secondary-foreground/10"
                                      onclick={() => toggleProfile(profileId)}
                                    >
                                      <X class="h-3 w-3" />
                                    </button>
                                  </span>
                                {/each}
                                {#if !user.isSuperadmin && data.profiles.some((p) => !editing.profileIds.includes(p.id))}
                                  <select
                                    class="flex-1 min-w-32 bg-transparent text-xs text-muted-foreground outline-none"
                                    onchange={(e) => {
                                      const val = (
                                        e.target as HTMLSelectElement
                                      ).value;
                                      if (val) {
                                        toggleProfile(val);
                                        (e.target as HTMLSelectElement).value =
                                          "";
                                      }
                                    }}
                                  >
                                    <option value="">+ Add profile</option>
                                    {#each data.profiles.filter((p) => !editing.profileIds.includes(p.id)) as profile (profile.id)}
                                      <option value={profile.id}
                                        >{profile.name}</option
                                      >
                                    {/each}
                                  </select>
                                {/if}
                              </div>
                              {#if user.isSuperadmin}
                                <p class="text-xs text-muted-foreground">
                                  Superadmin accounts cannot be assigned to
                                  client profiles.
                                </p>
                              {/if}
                            </div>
                          {/if}
                        </div>

                        {#if data.actor.role === "admin"}
                          <div
                            class="space-y-1.5 {data.globalMfaEnabled
                              ? 'opacity-50'
                              : ''}"
                          >
                            <Label>Multi-factor authentication</Label>
                            <input
                              type="hidden"
                              name="mfaEnabledProvided"
                              value="1"
                            />
                            <label class="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="mfaEnabled"
                                checked={editing.mfaEnabled}
                                disabled={data.globalMfaEnabled}
                                onchange={(e) => {
                                  if (user.id === data.actorId) {
                                    (
                                      e.currentTarget as HTMLInputElement
                                    ).checked = editing.mfaEnabled;
                                    mfaConfirmOpen = true;
                                  } else {
                                    editing.mfaEnabled = (
                                      e.currentTarget as HTMLInputElement
                                    ).checked;
                                  }
                                }}
                              />
                              Require MFA for this user
                            </label>
                            {#if data.globalMfaEnabled}
                              <p class="text-xs text-muted-foreground">
                                MFA is globally enforced and cannot be changed.
                              </p>
                            {/if}
                          </div>
                        {/if}

                        <div class="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onclick={cancelEdit}
                          >
                            <X class="mr-1 h-4 w-4" /> Cancel
                          </Button>
                          <Button type="submit" variant="secondary">
                            <Check class="mr-1 h-4 w-4" /> Save
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                {:else}
                  <tr class="border-b border-border">
                    <td class="px-3 py-2 font-medium">{user.name}</td>
                    <td class="px-3 py-2">{user.email}</td>
                    <td class="px-3 py-2">
                      <Badge variant={roleTone(user.role)}>{user.role}</Badge>
                      {#if user.isSuperadmin}
                        <Badge variant="primary" class="ml-1">superadmin</Badge>
                      {/if}
                    </td>
                    <td class="px-3 py-2">
                      {#if user.profileIds.length === 0}
                        <span class="text-muted-foreground">-</span>
                      {:else}
                        {#each user.profileIds as profileId, idx (profileId)}
                          {#if idx > 0},
                          {/if}{profileNameById(profileId)}
                        {/each}
                      {/if}
                    </td>
                    <td class="px-3 py-2"
                      >{user.mfaEnabled ? "Enabled" : "Not enrolled"}</td
                    >
                    <td class="px-3 py-2">
                      {#if user.linkedProviders.length === 0}
                        <span class="text-muted-foreground">Not linked</span>
                      {:else}
                        {#each user.linkedProviders as provider, idx (provider)}
                          {#if idx > 0},
                          {/if}
                          <!-- {providerLabel(provider)} -->
                          {@render getIcon(provider)}
                        {/each}
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-right">
                      <div class="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onclick={() => startEdit(user)}
                        >
                          <Pencil class="h-4 w-4" />
                        </Button>
                        <form method="POST" action="?/delete" use:enhance>
                          <input type="hidden" name="id" value={user.id} />
                          <Button
                            size="icon"
                            variant="ghost"
                            type="submit"
                            disabled={user.id === data.actorId ||
                              (user.isSuperadmin && !data.actor.isSuperadmin)}
                          >
                            <Trash2 class="h-4 w-4 text-destructive" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {:else}
    {#if data.actor.role !== "operator"}
      <Card>
        <CardHeader
          title="Invite user"
          description="Send a signup link for a role and profile assignment."
        />
        <CardContent>
          <form
            method="POST"
            action="?/invite"
            use:enhance
            class="grid grid-cols-1 gap-4 md:grid-cols-2"
            bind:this={inviteFormEl}
          >
            <input
              type="hidden"
              name="customMessage"
              value={inviteCustomMessage}
            />

            <div class="space-y-1.5">
              <Label for="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                bind:value={inviteEmail}
                required
              />
            </div>

            <div class="space-y-1.5">
              <Label for="invite-role">Role</Label>
              <Select.Root bind:value={inviteRole} name="role">
                <Select.Trigger id="invite-role">{inviteRole}</Select.Trigger>
                <Select.Content>
                  <Select.Item value="operator" />
                  {#if data.actor.role === "admin"}
                    <Select.Item value="manager" />
                  {/if}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="space-y-1.5 md:col-span-2">
              <Label for="invite-profile">Profile assignment</Label>
              <Select.Root bind:value={inviteProfileId} name="profileId">
                <Select.Trigger id="invite-profile">
                  {inviteProfileId
                    ? profileNameById(inviteProfileId)
                    : "Select profile"}
                </Select.Trigger>
                <Select.Content>
                  {#each data.profiles as profile (profile.id)}
                    <Select.Item value={profile.id} label={profile.name} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="md:col-span-2 flex items-center gap-2">
              <Button type="button" onclick={openInviteConfirm}
                >Review invitation</Button
              >
              <span class="text-sm text-muted-foreground">
                The signup link expires after 72 hours unless configured
                otherwise.
              </span>
            </div>
          </form>
          {#if form?.error}
            <p class="mt-3 text-sm text-destructive">{form.error}</p>
          {/if}
        </CardContent>
      </Card>
    {/if}

    <Card>
      <CardHeader
        title="Invitations"
        description={`${data.invitations.length} total`}
      />
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="border-b border-border text-left text-xs uppercase text-muted-foreground"
              >
                <th class="px-3 py-2">Email</th>
                <th class="px-3 py-2">Role</th>
                <th class="px-3 py-2">Profile</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Expires</th>
                <th class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#if data.invitations.length === 0}
                <tr>
                  <td
                    colspan="6"
                    class="px-3 py-6 text-center text-muted-foreground"
                  >
                    No invitations yet.
                  </td>
                </tr>
              {:else}
                {#each data.invitations as invitation (invitation.id)}
                  {@const status = invitationStatus(invitation)}
                  <tr class="border-b border-border">
                    <td class="px-3 py-2 font-medium">{invitation.email}</td>
                    <td class="px-3 py-2">
                      <Badge variant={roleTone(invitation.role)}
                        >{invitation.role}</Badge
                      >
                    </td>
                    <td class="px-3 py-2"
                      >{profileNameById(invitation.profileId)}</td
                    >
                    <td class="px-3 py-2">
                      <Badge variant={invitationTone(status)}>{status}</Badge>
                    </td>
                    <td class="px-3 py-2"
                      >{formatDateTime(invitation.expiresAt)}</td
                    >
                    <td class="px-3 py-2 text-right">
                      <div class="inline-flex items-center gap-2">
                        {#if status === "pending" || status === "expired"}
                          <form
                            method="POST"
                            action="?/resendInvite"
                            use:enhance
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={invitation.id}
                            />
                            <Button type="submit" variant="outline"
                              >Resend</Button
                            >
                          </form>
                        {/if}
                        {#if status === "pending"}
                          <form
                            method="POST"
                            action="?/revokeInvite"
                            use:enhance
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={invitation.id}
                            />
                            <Button type="submit" variant="ghost">Revoke</Button
                            >
                          </form>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/if}
</div>
