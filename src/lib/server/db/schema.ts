import { sql } from 'drizzle-orm';
import {
  integer,
  real,
  sqliteTable,
  text,
  index,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
};

// ────────────────────────────────────────────────────────────────
// Auth (dashboard users / operators)
// ────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'operator'] })
    .notNull()
    .default('operator'),
  ...timestamps
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

// ────────────────────────────────────────────────────────────────
// Upstream backends (OpenAI, Anthropic, etc.) — raw providers
// ────────────────────────────────────────────────────────────────
export const backends = sqliteTable(
  'backends',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['openai', 'anthropic', 'custom'] })
      .notNull()
      .default('openai'),
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key').notNull(), // stored server-side; never exposed to client
    profileId: text('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps
  },
  (t) => [index('backends_profile_idx').on(t.profileId)]
);

// Models that the proxy advertises. Each maps to a backend + upstream model id.
export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    // Public name exposed by the proxy (e.g. "gpt-4o-mini")
    publicId: text('public_id').notNull().unique(),
    displayName: text('display_name').notNull(),
    backendId: text('backend_id')
      .notNull()
      .references(() => backends.id, { onDelete: 'cascade' }),
    // Upstream identifier sent to the backend
    upstreamId: text('upstream_id').notNull(),
    // Pricing per 1M tokens (USD) — matches OpenAI doc style
    inputPricePerMTokens: real('input_price_per_m_tokens').notNull().default(0),
    outputPricePerMTokens: real('output_price_per_m_tokens').notNull().default(0),
    cachedInputPricePerMTokens: real('cached_input_price_per_m_tokens').notNull().default(0),
    imageInputPricePerMTokens: real('image_input_price_per_m_tokens').notNull().default(0),
    audioInputPricePerMTokens: real('audio_input_price_per_m_tokens').notNull().default(0),
    videoInputPricePerMTokens: real('video_input_price_per_m_tokens').notNull().default(0),
    imagePricePerMTokens: real('image_price_per_m_tokens').notNull().default(0),
    videoPricePerMTokens: real('video_price_per_m_tokens').notNull().default(0),
    webSearchCallPricePerMTokens: real('web_search_call_price_per_m_tokens').notNull().default(0),
    // Metadata
    type: text('type').notNull().default('chat'),
    description: text('description'),
    tags: text('tags').notNull().default('[]'), // JSON-serialized string[]
    contextSize: integer('context_size'),
    maxOutputTokens: integer('max_output_tokens'),
    releaseDate: text('release_date'),
    websiteUrl: text('website_url'),
    modelUrl: text('model_url'),
    pricingUrl: text('pricing_url'),
    playgroundUrl: text('playground_url'),
    hasZdrProvider: integer('has_zdr_provider', { mode: 'boolean' }).notNull().default(false),
    hasNoPromptTrainingProvider: integer('has_no_prompt_training_provider', { mode: 'boolean' })
      .notNull()
      .default(false),
    hasHipaaCompliantProvider: integer('has_hipaa_compliant_provider', { mode: 'boolean' })
      .notNull()
      .default(false),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    supportsStreaming: integer('supports_streaming', { mode: 'boolean' })
      .notNull()
      .default(true),
    ...timestamps
  },
  (t) => [index('models_backend_idx').on(t.backendId)]
);

// ────────────────────────────────────────────────────────────────
// Accessible catalog — read-only reference data loaded from
// providersAndModels.json. Used to populate/refresh the forms on
// the Models & Backends page. Only enabled entries are shown.
// ────────────────────────────────────────────────────────────────
export const accessibleProviders = sqliteTable('accessible_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: ['openai', 'anthropic', 'custom'] })
    .notNull()
    .default('openai'),
  baseUrl: text('base_url').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
});

export const accessibleModels = sqliteTable(
  'accessible_models',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    type: text('type').notNull().default('chat'),
    description: text('description'),
    tags: text('tags').notNull().default('[]'), // JSON string[]
    providers: text('providers').notNull().default('[]'), // JSON string[] of provider names
    contextSize: integer('context_size'),
    maxOutputTokens: integer('max_output_tokens'),
    releaseDate: text('release_date'),
    inputPricePerMTokens: real('input_price_per_m_tokens').notNull().default(0),
    outputPricePerMTokens: real('output_price_per_m_tokens').notNull().default(0),
    cachedInputPricePerMTokens: real('cached_input_price_per_m_tokens').notNull().default(0),
    imageInputPricePerMTokens: real('image_input_price_per_m_tokens').notNull().default(0),
    audioInputPricePerMTokens: real('audio_input_price_per_m_tokens').notNull().default(0),
    videoInputPricePerMTokens: real('video_input_price_per_m_tokens').notNull().default(0),
    imagePricePerMTokens: real('image_price_per_m_tokens').notNull().default(0),
    videoPricePerMTokens: real('video_price_per_m_tokens').notNull().default(0),
    webSearchCallPricePerMTokens: real('web_search_call_price_per_m_tokens').notNull().default(0),
    websiteUrl: text('website_url'),
    modelUrl: text('model_url'),
    pricingUrl: text('pricing_url'),
    playgroundUrl: text('playground_url'),
    hasZdrProvider: integer('has_zdr_provider', { mode: 'boolean' }).notNull().default(false),
    hasNoPromptTrainingProvider: integer('has_no_prompt_training_provider', { mode: 'boolean' })
      .notNull()
      .default(false),
    hasHipaaCompliantProvider: integer('has_hipaa_compliant_provider', { mode: 'boolean' })
      .notNull()
      .default(false),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps
  },
  (t) => [index('accessible_models_slug_idx').on(t.slug)]
);

// ────────────────────────────────────────────────────────────────
// Client profiles & virtual API keys
// ────────────────────────────────────────────────────────────────
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  // Global budget cap for all attached virtual keys.
  // 0 / null = unlimited.
  globalBudget: real('global_budget'),
  globalBudgetFrequency: text('global_budget_frequency', {
    enum: ['daily', 'weekly', 'monthly']
  }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
});

export const virtualKeys = sqliteTable(
  'virtual_keys',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // The API key exposed to clients. Stored as-is so it can be viewed; hash in
    // a future hardening pass if you want stricter security.
    token: text('token').notNull().unique(),
    // Per-key budget. 0 / null = unlimited.
    budget: real('budget'),
    budgetFrequency: text('budget_frequency', {
      enum: ['daily', 'weekly', 'monthly']
    }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    ...timestamps
  },
  (t) => [
    index('vkeys_profile_idx').on(t.profileId),
    uniqueIndex('vkeys_token_idx').on(t.token)
  ]
);

// Models a virtual key is allowed to use. If none present, all enabled models
// are allowed by default.
export const virtualKeyModels = sqliteTable(
  'virtual_key_models',
  {
    virtualKeyId: text('virtual_key_id')
      .notNull()
      .references(() => virtualKeys.id, { onDelete: 'cascade' }),
    modelId: text('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' })
  },
  (t) => [
    uniqueIndex('vkey_models_uniq').on(t.virtualKeyId, t.modelId),
    index('vkey_models_model_idx').on(t.modelId)
  ]
);

// ────────────────────────────────────────────────────────────────
// Request tracking / usage
// ────────────────────────────────────────────────────────────────
export const requestLogs = sqliteTable(
  'request_logs',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').references(() => profiles.id, {
      onDelete: 'set null'
    }),
    profileName: text('profile_name'),
    virtualKeyId: text('virtual_key_id').references(() => virtualKeys.id, {
      onDelete: 'set null'
    }),
    virtualKeyName: text('virtual_key_name'),
    modelId: text('model_id').references(() => models.id, {
      onDelete: 'set null'
    }),
    modelPublicId: text('model_public_id'),
    endpoint: text('endpoint').notNull(), // e.g. /v1/chat/completions
    streaming: integer('streaming', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['success', 'failed', 'blocked'] }).notNull(),
    httpStatus: integer('http_status').notNull(),
    errorMessage: text('error_message'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    imageInputTokens: integer('image_input_tokens').notNull().default(0),
    audioInputTokens: integer('audio_input_tokens').notNull().default(0),
    videoInputTokens: integer('video_input_tokens').notNull().default(0),
    imageOutputTokens: integer('image_output_tokens').notNull().default(0),
    videoOutputTokens: integer('video_output_tokens').notNull().default(0),
    webSearchCalls: integer('web_search_calls').notNull().default(0),
    inputCost: real('input_cost').notNull().default(0),
    outputCost: real('output_cost').notNull().default(0),
    cachedInputCost: real('cached_input_cost').notNull().default(0),
    imageInputCost: real('image_input_cost').notNull().default(0),
    audioInputCost: real('audio_input_cost').notNull().default(0),
    videoInputCost: real('video_input_cost').notNull().default(0),
    imageOutputCost: real('image_output_cost').notNull().default(0),
    videoOutputCost: real('video_output_cost').notNull().default(0),
    webSearchCost: real('web_search_cost').notNull().default(0),
    cost: real('cost').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
  },
  (t) => [
    index('req_created_idx').on(t.createdAt),
    index('req_profile_idx').on(t.profileId),
    index('req_vkey_idx').on(t.virtualKeyId),
    index('req_model_idx').on(t.modelId)
  ]
);

// ────────────────────────────────────────────────────────────────
// Guardrails
// ────────────────────────────────────────────────────────────────
export const guardrails = sqliteTable(
  'guardrails',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    stage: text('stage', { enum: ['pre', 'during', 'post'] }).notNull(),
    kind: text('kind', {
      enum: ['regex_block', 'regex_redact', 'max_tokens', 'pii_redact', 'keyword_block']
    }).notNull(),
    // JSON-serialized configuration for the kind
    config: text('config').notNull().default('{}'),
    profileId: text('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    priority: integer('priority').notNull().default(100),
    ...timestamps
  },
  (t) => [index('guardrails_profile_idx').on(t.profileId)]
);

export const guardrailLogs = sqliteTable(
  'guardrail_logs',
  {
    id: text('id').primaryKey(),
    guardrailId: text('guardrail_id').references(() => guardrails.id, {
      onDelete: 'set null'
    }),
    guardrailName: text('guardrail_name').notNull(),
    stage: text('stage', { enum: ['pre', 'during', 'post'] }).notNull(),
    requestId: text('request_id').references(() => requestLogs.id, {
      onDelete: 'set null'
    }),
    profileId: text('profile_id'),
    virtualKeyId: text('virtual_key_id'),
    action: text('action', { enum: ['allow', 'redact', 'block'] }).notNull(),
    latencyMs: integer('latency_ms').notNull().default(0),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
  },
  (t) => [
    index('gl_created_idx').on(t.createdAt),
    index('gl_guardrail_idx').on(t.guardrailId)
  ]
);

// ────────────────────────────────────────────────────────────────
// MCP servers & skills instructions
// ────────────────────────────────────────────────────────────────
export const mcpServers = sqliteTable(
  'mcp_servers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    transport: text('transport', { enum: ['stdio', 'sse', 'http'] })
      .notNull()
      .default('stdio'),
    // stdio: command + args. sse/http: url.
    command: text('command'),
    args: text('args'), // JSON array
    env: text('env'), // JSON object
    url: text('url'),
    profileId: text('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps
  },
  (t) => [index('mcp_servers_profile_idx').on(t.profileId)]
);

export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    instructions: text('instructions').notNull(),
    profileId: text('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps
  },
  (t) => [index('skills_profile_idx').on(t.profileId)]
);

// ────────────────────────────────────────────────────────────────
// Inferred types
// ────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Backend = typeof backends.$inferSelect;
export type Model = typeof models.$inferSelect;
export type AccessibleProvider = typeof accessibleProviders.$inferSelect;
export type AccessibleModel = typeof accessibleModels.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type VirtualKey = typeof virtualKeys.$inferSelect;
export type RequestLog = typeof requestLogs.$inferSelect;
export type Guardrail = typeof guardrails.$inferSelect;
export type GuardrailLog = typeof guardrailLogs.$inferSelect;
export type McpServer = typeof mcpServers.$inferSelect;
export type Skill = typeof skills.$inferSelect;

export type Frequency = 'daily' | 'weekly' | 'monthly';
