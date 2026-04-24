<script lang="ts">
  import { enhance } from "$app/forms";
  import {
    Button,
    Input,
    Label,
    Card,
    CardHeader,
    CardContent,
    Table,
    Select,
    Textarea,
    Badge,
    Combobox,
    TagsInput,
    type ComboboxItem,
  } from "$lib/components/ui";
  import { Trash2, Pencil, Plus, Upload } from "lucide-svelte";

  let { data, form } = $props();

  // ───── Backend form state ─────
  interface BackendDraft {
    id: string | null;
    name: string;
    kind: "openai" | "anthropic" | "custom";
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
  }
  const emptyBackend = (): BackendDraft => ({
    id: null,
    name: "",
    kind: "openai",
    baseUrl: "",
    apiKey: "",
    enabled: true,
  });
  let backendDraft = $state<BackendDraft>(emptyBackend());
  let backendProviderPick = $state<string | null>(null);

  const providerItems: ComboboxItem[] = $derived(
    data.accessibleProviders.map((p) => ({
      value: p.name,
      label: p.name,
      description: p.baseUrl || p.kind,
    })),
  );

  function editBackend(b: (typeof data.backends)[number]) {
    backendDraft = {
      id: b.id,
      name: b.name,
      kind: b.kind,
      baseUrl: b.baseUrl,
      apiKey: "",
      enabled: b.enabled,
    };
    backendProviderPick = null;
  }
  function resetBackend() {
    backendDraft = emptyBackend();
    backendProviderPick = null;
  }
  function onProviderPicked(item: ComboboxItem | null) {
    if (!item) return;
    const p = data.accessibleProviders.find((x) => x.name === item.value);
    if (!p) return;
    backendDraft.name = p.name;
    backendDraft.kind = (p.kind as BackendDraft["kind"]) ?? "openai";
    backendDraft.baseUrl = p.baseUrl ?? "";
  }

  // ───── Model form state ─────
  interface ModelDraft {
    id: string | null;
    publicId: string;
    displayName: string;
    backendId: string;
    upstreamId: string;
    enabled: boolean;
    supportsStreaming: boolean;
    type: string;
    description: string;
    releaseDate: string;
    websiteUrl: string;
    modelUrl: string;
    pricingUrl: string;
    playgroundUrl: string;
    contextSize: number | null;
    maxOutputTokens: number | null;
    hasZdrProvider: boolean;
    hasNoPromptTrainingProvider: boolean;
    hasHipaaCompliantProvider: boolean;
    inputPricePerMTokens: number;
    outputPricePerMTokens: number;
    cachedInputPricePerMTokens: number;
    imageInputPricePerMTokens: number;
    audioInputPricePerMTokens: number;
    videoInputPricePerMTokens: number;
    imagePricePerMTokens: number;
    videoPricePerMTokens: number;
    webSearchCallPricePerMTokens: number;
    tags: string[];
  }
  const emptyModel = (): ModelDraft => ({
    id: null,
    publicId: "",
    displayName: "",
    backendId: data.backends[0]?.id ?? "",
    upstreamId: "",
    enabled: true,
    supportsStreaming: true,
    type: "chat",
    description: "",
    releaseDate: "",
    websiteUrl: "",
    modelUrl: "",
    pricingUrl: "",
    playgroundUrl: "",
    contextSize: null,
    maxOutputTokens: null,
    hasZdrProvider: false,
    hasNoPromptTrainingProvider: false,
    hasHipaaCompliantProvider: false,
    inputPricePerMTokens: 0,
    outputPricePerMTokens: 0,
    cachedInputPricePerMTokens: 0,
    imageInputPricePerMTokens: 0,
    audioInputPricePerMTokens: 0,
    videoInputPricePerMTokens: 0,
    imagePricePerMTokens: 0,
    videoPricePerMTokens: 0,
    webSearchCallPricePerMTokens: 0,
    tags: [],
  });
  let modelDraft = $state<ModelDraft>(emptyModel());
  let modelPick = $state<string | null>(null);
  let tagsJson = $state("[]");

  const modelItems: ComboboxItem[] = $derived(
    data.accessibleModels.map((m) => ({
      value: m.slug,
      label: m.displayName,
      description: m.slug,
    })),
  );

  function editModel(m: (typeof data.models)[number]) {
    modelDraft = {
      id: m.id,
      publicId: m.publicId,
      displayName: m.displayName,
      backendId: m.backendId,
      upstreamId: m.upstreamId,
      enabled: m.enabled,
      supportsStreaming: m.supportsStreaming,
      type: m.type ?? "chat",
      description: m.description ?? "",
      releaseDate: m.releaseDate ?? "",
      websiteUrl: m.websiteUrl ?? "",
      modelUrl: m.modelUrl ?? "",
      pricingUrl: m.pricingUrl ?? "",
      playgroundUrl: m.playgroundUrl ?? "",
      contextSize: m.contextSize ?? null,
      maxOutputTokens: m.maxOutputTokens ?? null,
      hasZdrProvider: !!m.hasZdrProvider,
      hasNoPromptTrainingProvider: !!m.hasNoPromptTrainingProvider,
      hasHipaaCompliantProvider: !!m.hasHipaaCompliantProvider,
      inputPricePerMTokens: m.inputPricePerMTokens,
      outputPricePerMTokens: m.outputPricePerMTokens,
      cachedInputPricePerMTokens: m.cachedInputPricePerMTokens,
      imageInputPricePerMTokens: m.imageInputPricePerMTokens,
      audioInputPricePerMTokens: m.audioInputPricePerMTokens,
      videoInputPricePerMTokens: m.videoInputPricePerMTokens,
      imagePricePerMTokens: m.imagePricePerMTokens,
      videoPricePerMTokens: m.videoPricePerMTokens,
      webSearchCallPricePerMTokens: m.webSearchCallPricePerMTokens,
      tags: safeTags(m.tags),
    };
    modelPick = null;
  }
  function resetModel() {
    modelDraft = emptyModel();
    modelPick = null;
  }
  function safeTags(s: string): string[] {
    try {
      const arr = JSON.parse(s ?? "[]");
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  function onAccessibleModelPicked(item: ComboboxItem | null) {
    if (!item) return;
    const m = data.accessibleModels.find((x) => x.slug === item.value);
    if (!m) return;
    modelDraft.publicId ||= m.slug;
    modelDraft.upstreamId ||= m.slug;
    modelDraft.displayName = m.displayName;
    modelDraft.type = m.type ?? "chat";
    modelDraft.description = m.description ?? "";
    modelDraft.releaseDate = m.releaseDate ?? "";
    modelDraft.websiteUrl = m.websiteUrl ?? "";
    modelDraft.modelUrl = m.modelUrl ?? "";
    modelDraft.pricingUrl = m.pricingUrl ?? "";
    modelDraft.playgroundUrl = m.playgroundUrl ?? "";
    modelDraft.contextSize = m.contextSize ?? null;
    modelDraft.maxOutputTokens = m.maxOutputTokens ?? null;
    modelDraft.hasZdrProvider = !!m.hasZdrProvider;
    modelDraft.hasNoPromptTrainingProvider = !!m.hasNoPromptTrainingProvider;
    modelDraft.hasHipaaCompliantProvider = !!m.hasHipaaCompliantProvider;
    modelDraft.inputPricePerMTokens = m.inputPricePerMTokens;
    modelDraft.outputPricePerMTokens = m.outputPricePerMTokens;
    modelDraft.cachedInputPricePerMTokens = m.cachedInputPricePerMTokens;
    modelDraft.imageInputPricePerMTokens = m.imageInputPricePerMTokens;
    modelDraft.audioInputPricePerMTokens = m.audioInputPricePerMTokens;
    modelDraft.videoInputPricePerMTokens = m.videoInputPricePerMTokens;
    modelDraft.imagePricePerMTokens = m.imagePricePerMTokens;
    modelDraft.videoPricePerMTokens = m.videoPricePerMTokens;
    modelDraft.webSearchCallPricePerMTokens = m.webSearchCallPricePerMTokens;
    modelDraft.tags = m.tagsParsed.slice();
  }

  const priceFields: { key: keyof ModelDraft; label: string }[] = [
    { key: "inputPricePerMTokens", label: "Input" },
    { key: "outputPricePerMTokens", label: "Output" },
    { key: "cachedInputPricePerMTokens", label: "Cached input" },
    { key: "imageInputPricePerMTokens", label: "Image input" },
    { key: "audioInputPricePerMTokens", label: "Audio input" },
    { key: "videoInputPricePerMTokens", label: "Video input" },
    { key: "imagePricePerMTokens", label: "Image output" },
    { key: "videoPricePerMTokens", label: "Video output" },
    { key: "webSearchCallPricePerMTokens", label: "Web search call" },
  ];

  const backendSelectItems = $derived(
    data.backends.map((b) => ({ value: b.id, label: `${b.name} (${b.kind})` })),
  );
</script>

<div class="space-y-8">
  <header>
    <h1 class="text-2xl font-semibold">Models & backends</h1>
    <p class="text-sm text-muted-foreground">
      Configure upstream providers and the models the proxy exposes. Pick from
      the accessible catalog to prefill fields automatically.
    </p>
  </header>

  <!-- Catalog upload -->
  <Card>
    <CardHeader>
      <h2 class="text-lg font-medium">Catalog import</h2>
      <p class="text-sm text-muted-foreground">
        Upload a providersAndModels.json file to upsert the accessible providers
        and models tables.
      </p>
    </CardHeader>
    <CardContent>
      <form
        method="POST"
        action="?/catalogUpload"
        enctype="multipart/form-data"
        use:enhance
        class="flex flex-wrap items-end gap-3"
      >
        <div class="flex-1 min-w-65">
          <Label for="catalog-file">JSON file</Label>
          <Input
            id="catalog-file"
            type="file"
            name="file"
            accept="application/json,.json"
            required
          />
        </div>
        <Button type="submit">
          <Upload class="h-4 w-4 mr-1" /> Upload & upsert
        </Button>
        {#if form && "catalog" in form && form.catalog}
          <p class="text-sm text-muted-foreground w-full">
            Providers: <strong>{form.catalog.providersInserted}</strong>
            inserted,
            <strong>{form.catalog.providersUpdated}</strong> updated. Models:
            <strong>{form.catalog.modelsInserted}</strong> inserted,
            <strong>{form.catalog.modelsUpdated}</strong> updated.
          </p>
        {/if}
        {#if form && "error" in form && form.error}
          <p class="text-sm text-destructive w-full">{form.error}</p>
        {/if}
      </form>
    </CardContent>
  </Card>

  <!-- Backends -->
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium">Backends</h2>
          <p class="text-sm text-muted-foreground">
            Upstream providers this proxy will route to.
          </p>
        </div>
        {#if backendDraft.id}
          <Button variant="outline" onclick={resetBackend}>Cancel edit</Button>
        {/if}
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <Table>
        <thead>
          <tr>
            <th class="text-left">Name</th>
            <th class="text-left">Kind</th>
            <th class="text-left">Base URL</th>
            <th class="text-left">Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.backends as b (b.id)}
            <tr>
              <td>{b.name}</td>
              <td><Badge variant="outline">{b.kind}</Badge></td>
              <td class="font-mono text-xs">{b.baseUrl}</td>
              <td>
                {#if b.enabled}<Badge>Active</Badge>{:else}<Badge
                    variant="outline">Off</Badge
                  >{/if}
              </td>
              <td class="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => editBackend(b)}
                >
                  <Pencil class="h-4 w-4" />
                </Button>
                <form
                  method="POST"
                  action="?/backendDelete"
                  use:enhance
                  class="inline"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <Button variant="ghost" size="sm" type="submit">
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>

      <form
        method="POST"
        action={backendDraft.id ? "?/backendUpdate" : "?/backendCreate"}
        use:enhance={() =>
          async ({ update }) => {
            await update({ reset: false });
            if (!form || !("error" in form)) resetBackend();
          }}
        class="grid gap-4 md:grid-cols-2"
      >
        {#if backendDraft.id}
          <input type="hidden" name="id" value={backendDraft.id} />
        {/if}

        <div class="md:col-span-2">
          <Label>Prefill from accessible provider</Label>
          <Combobox
            items={providerItems}
            bind:value={backendProviderPick}
            placeholder="Select a provider…"
            emptyText="No accessible providers — import the catalog first"
            onSelect={onProviderPicked}
          />
        </div>

        <div>
          <Label for="backend-name">Name</Label>
          <Input
            id="backend-name"
            name="name"
            bind:value={backendDraft.name}
            required
          />
        </div>
        <div>
          <Label for="backend-kind">Kind</Label>
          <Select id="backend-kind" name="kind" bind:value={backendDraft.kind}>
            <option value="openai">openai</option>
            <option value="anthropic">anthropic</option>
            <option value="custom">custom</option>
          </Select>
        </div>
        <div class="md:col-span-2">
          <Label for="backend-baseurl">Base URL</Label>
          <Input
            id="backend-baseurl"
            name="baseUrl"
            bind:value={backendDraft.baseUrl}
            placeholder="https://api.example.com/v1"
            required
          />
        </div>
        <div class="md:col-span-2">
          <Label for="backend-apikey"
            >API key {backendDraft.id ? "(leave blank to keep)" : ""}</Label
          >
          <Input
            id="backend-apikey"
            name="apiKey"
            type="password"
            bind:value={backendDraft.apiKey}
            required={!backendDraft.id}
          />
        </div>
        {#if backendDraft.id}
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              checked={backendDraft.enabled}
            />
            Enabled
          </label>
        {/if}
        <div class="md:col-span-2">
          <Button type="submit">
            <Plus class="h-4 w-4 mr-1" />
            {backendDraft.id ? "Save backend" : "Add backend"}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <!-- Models -->
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium">Models</h2>
          <p class="text-sm text-muted-foreground">
            Models exposed by this proxy.
          </p>
        </div>
        {#if modelDraft.id}
          <Button variant="outline" onclick={resetModel}>Cancel edit</Button>
        {/if}
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <Table>
        <thead>
          <tr>
            <th class="text-left">Public id</th>
            <th class="text-left">Backend</th>
            <th class="text-left">Upstream</th>
            <th class="text-left">Input / Output $</th>
            <th class="text-left">Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.models as m (m.id)}
            <tr>
              <td>
                <div class="font-medium">{m.publicId}</div>
                <div class="text-xs text-muted-foreground">{m.displayName}</div>
              </td>
              <td>{m.backendName ?? "—"}</td>
              <td class="font-mono text-xs">{m.upstreamId}</td>
              <td class="text-xs font-mono">
                ${m.inputPricePerMTokens.toFixed(2)} / ${m.outputPricePerMTokens.toFixed(
                  2,
                )}
              </td>
              <td>
                {#if m.enabled}<Badge>Active</Badge>{:else}<Badge
                    variant="outline">Off</Badge
                  >{/if}
              </td>
              <td class="text-right">
                <Button variant="ghost" size="sm" onclick={() => editModel(m)}>
                  <Pencil class="h-4 w-4" />
                </Button>
                <form
                  method="POST"
                  action="?/modelDelete"
                  use:enhance
                  class="inline"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <Button variant="ghost" size="sm" type="submit">
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>

      <form
        method="POST"
        action={modelDraft.id ? "?/modelUpdate" : "?/modelCreate"}
        use:enhance={() =>
          async ({ update }) => {
            await update({ reset: false });
            if (!form || !("error" in form)) resetModel();
          }}
        class="space-y-6"
      >
        {#if modelDraft.id}
          <input type="hidden" name="id" value={modelDraft.id} />
        {/if}

        <div>
          <Label>Prefill from accessible model</Label>
          <Combobox
            items={modelItems}
            bind:value={modelPick}
            placeholder="Select a catalog model…"
            emptyText="No accessible models — import the catalog first"
            onSelect={onAccessibleModelPicked}
          />
        </div>

        <!-- Identity -->
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <Label for="model-public-id">Public id</Label>
            <Input
              id="model-public-id"
              name="publicId"
              bind:value={modelDraft.publicId}
              required
            />
          </div>
          <div>
            <Label for="model-display-name">Display name</Label>
            <Input
              id="model-display-name"
              name="displayName"
              bind:value={modelDraft.displayName}
            />
          </div>
          <div>
            <Label for="model-backend">Backend</Label>
            <Select
              id="model-backend"
              name="backendId"
              bind:value={modelDraft.backendId}
              required
            >
              {#each backendSelectItems as item (item.value)}
                <option value={item.value}>{item.label}</option>
              {/each}
            </Select>
          </div>
          <div>
            <Label for="model-upstream">Upstream id</Label>
            <Input
              id="model-upstream"
              name="upstreamId"
              bind:value={modelDraft.upstreamId}
              required
            />
          </div>
          <div>
            <Label for="model-type">Type</Label>
            <Input id="model-type" name="type" bind:value={modelDraft.type} />
          </div>
          <div>
            <Label>Tags</Label>
            <TagsInput
              bind:value={modelDraft.tags}
              bind:jsonValue={tagsJson}
              name="tags"
            />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              checked={modelDraft.enabled}
            />
            Enabled
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="supportsStreaming"
              checked={modelDraft.supportsStreaming}
            />
            Supports streaming
          </label>
        </div>

        <!-- Costs -->
        <section class="space-y-3">
          <h3
            class="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Cost (USD per 1M tokens)
          </h3>
          <div class="grid gap-3 md:grid-cols-3">
            {#each priceFields as pf (pf.key)}
              <div>
                <Label for={`price-${pf.key}`}>{pf.label}</Label>
                <Input
                  id={`price-${pf.key}`}
                  type="number"
                  step="0.0001"
                  min="0"
                  name={pf.key}
                  bind:value={modelDraft[pf.key] as number}
                />
              </div>
            {/each}
          </div>
        </section>

        <!-- Metadata -->
        <section class="space-y-3">
          <h3
            class="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Additional metadata
          </h3>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <Label for="model-context">Context size</Label>
              <Input
                id="model-context"
                type="number"
                min="0"
                name="contextSize"
                bind:value={modelDraft.contextSize as number}
              />
            </div>
            <div>
              <Label for="model-max-output">Max output tokens</Label>
              <Input
                id="model-max-output"
                type="number"
                min="0"
                name="maxOutputTokens"
                bind:value={modelDraft.maxOutputTokens as number}
              />
            </div>
            <div>
              <Label for="model-release">Release date</Label>
              <Input
                id="model-release"
                name="releaseDate"
                placeholder="YYYY-MM-DD"
                bind:value={modelDraft.releaseDate}
              />
            </div>
            <div>
              <Label for="model-website">Website URL</Label>
              <Input
                id="model-website"
                name="websiteUrl"
                bind:value={modelDraft.websiteUrl}
              />
            </div>
            <div>
              <Label for="model-url">Model URL</Label>
              <Input
                id="model-url"
                name="modelUrl"
                bind:value={modelDraft.modelUrl}
              />
            </div>
            <div>
              <Label for="model-pricing">Pricing URL</Label>
              <Input
                id="model-pricing"
                name="pricingUrl"
                bind:value={modelDraft.pricingUrl}
              />
            </div>
            <div class="md:col-span-2">
              <Label for="model-playground">Playground URL</Label>
              <Input
                id="model-playground"
                name="playgroundUrl"
                bind:value={modelDraft.playgroundUrl}
              />
            </div>
            <div class="md:col-span-2">
              <Label for="model-description">Description</Label>
              <Textarea
                id="model-description"
                name="description"
                rows={3}
                bind:value={modelDraft.description}
              />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="hasZdrProvider"
                checked={modelDraft.hasZdrProvider}
              />
              Has ZDR provider
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="hasNoPromptTrainingProvider"
                checked={modelDraft.hasNoPromptTrainingProvider}
              />
              No-prompt-training provider available
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="hasHipaaCompliantProvider"
                checked={modelDraft.hasHipaaCompliantProvider}
              />
              HIPAA-compliant provider available
            </label>
          </div>
        </section>

        <div>
          <Button type="submit">
            <Plus class="h-4 w-4 mr-1" />
            {modelDraft.id ? "Save model" : "Add model"}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
</div>
