<script lang="ts">
  import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Input,
    Label,
    Table,
    Textarea,
    Badge,
  } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { Trash2, Pencil, X, Check } from "lucide-svelte";

  let { data } = $props();
  let editingId: string | null = $state(null);
</script>

<svelte:head><title>Skills · Nostraproxy</title></svelte:head>

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
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.skills as s (s.id)}
            {#if editingId === s.id}
              <tr class="border-b border-border/60 bg-secondary/40">
                <td colspan="4" class="py-3">
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
                  {#if s.enabled}<Badge variant="success">enabled</Badge>{:else}
                    <Badge variant="outline">disabled</Badge>{/if}
                </td>
                <td class="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => (editingId = s.id)}
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance
                    class="inline"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </td>
              </tr>
            {/if}
          {/each}
          {#if data.skills.length === 0}
            <tr>
              <td
                colspan="4"
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
