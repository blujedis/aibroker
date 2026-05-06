import { sqlite } from './index.js';
import { encryptSecret, isEncryptedSecret } from '../secrets.js';

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  is_superadmin INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_secret TEXT,
  mfa_enrolled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  is_mfa_complete INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  is_mfa_complete INTEGER NOT NULL DEFAULT 1,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uniq ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS mfa_recovery_codes_code_hash_uniq ON mfa_recovery_codes(code_hash);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_idx ON mfa_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_used_idx ON mfa_recovery_codes(used_at);

CREATE TABLE IF NOT EXISTS mfa_break_glass_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS mfa_break_glass_tokens_token_hash_uniq ON mfa_break_glass_tokens(token_hash);
CREATE INDEX IF NOT EXISTS mfa_break_glass_tokens_user_idx ON mfa_break_glass_tokens(user_id);
CREATE INDEX IF NOT EXISTS mfa_break_glass_tokens_expires_idx ON mfa_break_glass_tokens(expires_at);

CREATE TABLE IF NOT EXISTS user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  linked_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_user_uniq ON user_identities(provider, provider_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_user_provider_uniq ON user_identities(user_id, provider);
CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  provider TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'login',
  actor_user_id TEXT,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_states_state_uniq ON oauth_states(state);
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  custom_message TEXT,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_token_hash_uniq ON user_invitations(token_hash);
CREATE INDEX IF NOT EXISTS user_invitations_email_idx ON user_invitations(email);
CREATE INDEX IF NOT EXISTS user_invitations_profile_idx ON user_invitations(profile_id);
CREATE INDEX IF NOT EXISTS user_invitations_invited_by_idx ON user_invitations(invited_by_user_id);
CREATE INDEX IF NOT EXISTS user_invitations_expires_idx ON user_invitations(expires_at);

CREATE TABLE IF NOT EXISTS instance_settings (
  id TEXT PRIMARY KEY,
  global_mfa_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

INSERT OR IGNORE INTO instance_settings (id, global_mfa_enabled)
VALUES ('global', 0);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  global_budget REAL,
  global_budget_frequency TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_uniq ON user_profiles(user_id, profile_id);
CREATE INDEX IF NOT EXISTS user_profiles_profile_idx ON user_profiles(profile_id);

CREATE TABLE IF NOT EXISTS backends (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS backends_profile_idx ON backends(profile_id);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  backend_id TEXT NOT NULL REFERENCES backends(id) ON DELETE CASCADE,
  upstream_id TEXT NOT NULL,
  input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  output_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  cached_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  image_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  audio_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  video_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  image_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  video_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  web_search_call_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'chat',
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  context_size INTEGER,
  max_output_tokens INTEGER,
  release_date TEXT,
  website_url TEXT,
  model_url TEXT,
  pricing_url TEXT,
  playground_url TEXT,
  has_zdr_provider INTEGER NOT NULL DEFAULT 0,
  has_no_prompt_training_provider INTEGER NOT NULL DEFAULT 0,
  has_hipaa_compliant_provider INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  supports_streaming INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS models_backend_idx ON models(backend_id);

CREATE TABLE IF NOT EXISTS accessible_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS accessible_models (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  providers TEXT NOT NULL DEFAULT '[]',
  context_size INTEGER,
  max_output_tokens INTEGER,
  release_date TEXT,
  input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  output_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  cached_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  image_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  audio_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  video_input_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  image_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  video_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  web_search_call_price_per_m_tokens REAL NOT NULL DEFAULT 0,
  website_url TEXT,
  model_url TEXT,
  pricing_url TEXT,
  playground_url TEXT,
  has_zdr_provider INTEGER NOT NULL DEFAULT 0,
  has_no_prompt_training_provider INTEGER NOT NULL DEFAULT 0,
  has_hipaa_compliant_provider INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS accessible_models_slug_idx ON accessible_models(slug);

CREATE TABLE IF NOT EXISTS virtual_keys (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  budget REAL,
  budget_frequency TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS vkeys_profile_idx ON virtual_keys(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS vkeys_token_idx ON virtual_keys(token);

CREATE TABLE IF NOT EXISTS virtual_key_models (
  virtual_key_id TEXT NOT NULL REFERENCES virtual_keys(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS vkey_models_uniq ON virtual_key_models(virtual_key_id, model_id);
CREATE INDEX IF NOT EXISTS vkey_models_model_idx ON virtual_key_models(model_id);

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  profile_name TEXT,
  virtual_key_id TEXT REFERENCES virtual_keys(id) ON DELETE SET NULL,
  virtual_key_name TEXT,
  model_id TEXT REFERENCES models(id) ON DELETE SET NULL,
  model_public_id TEXT,
  endpoint TEXT NOT NULL,
  streaming INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  error_message TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  image_input_tokens INTEGER NOT NULL DEFAULT 0,
  audio_input_tokens INTEGER NOT NULL DEFAULT 0,
  video_input_tokens INTEGER NOT NULL DEFAULT 0,
  image_output_tokens INTEGER NOT NULL DEFAULT 0,
  video_output_tokens INTEGER NOT NULL DEFAULT 0,
  web_search_calls INTEGER NOT NULL DEFAULT 0,
  input_cost REAL NOT NULL DEFAULT 0,
  output_cost REAL NOT NULL DEFAULT 0,
  cached_input_cost REAL NOT NULL DEFAULT 0,
  image_input_cost REAL NOT NULL DEFAULT 0,
  audio_input_cost REAL NOT NULL DEFAULT 0,
  video_input_cost REAL NOT NULL DEFAULT 0,
  image_output_cost REAL NOT NULL DEFAULT 0,
  video_output_cost REAL NOT NULL DEFAULT 0,
  web_search_cost REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS req_created_idx ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS req_profile_idx ON request_logs(profile_id);
CREATE INDEX IF NOT EXISTS req_vkey_idx ON request_logs(virtual_key_id);
CREATE INDEX IF NOT EXISTS req_model_idx ON request_logs(model_id);

CREATE TABLE IF NOT EXISTS guardrails (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL,
  kind TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS guardrails_profile_idx ON guardrails(profile_id);

CREATE TABLE IF NOT EXISTS guardrail_logs (
  id TEXT PRIMARY KEY,
  guardrail_id TEXT REFERENCES guardrails(id) ON DELETE SET NULL,
  guardrail_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  request_id TEXT REFERENCES request_logs(id) ON DELETE SET NULL,
  profile_id TEXT,
  virtual_key_id TEXT,
  action TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS gl_created_idx ON guardrail_logs(created_at);
CREATE INDEX IF NOT EXISTS gl_guardrail_idx ON guardrail_logs(guardrail_id);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  transport TEXT NOT NULL DEFAULT 'stdio',
  command TEXT,
  args TEXT,
  env TEXT,
  url TEXT,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS mcp_servers_profile_idx ON mcp_servers(profile_id);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS skills_profile_idx ON skills(profile_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_uniq ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id);
`;

// Columns added after initial release. SQLite lacks `ADD COLUMN IF NOT EXISTS`,
// so we introspect PRAGMA and add missing ones.
const COLUMN_MIGRATIONS: Record<string, Record<string, string>> = {
  users: {
    is_superadmin: 'INTEGER NOT NULL DEFAULT 0',
    created_by_user_id: 'TEXT REFERENCES users(id) ON DELETE SET NULL',
    mfa_enabled: 'INTEGER NOT NULL DEFAULT 0',
    mfa_secret: 'TEXT',
    mfa_enrolled_at: 'INTEGER'
  },
  sessions: {
    is_mfa_complete: 'INTEGER NOT NULL DEFAULT 1'
  },
  backends: {
    profile_id: 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'
  },
  models: {
    cached_input_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    image_input_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    audio_input_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    video_input_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    image_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    video_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    web_search_call_price_per_m_tokens: 'REAL NOT NULL DEFAULT 0',
    type: "TEXT NOT NULL DEFAULT 'chat'",
    description: 'TEXT',
    tags: "TEXT NOT NULL DEFAULT '[]'",
    context_size: 'INTEGER',
    max_output_tokens: 'INTEGER',
    release_date: 'TEXT',
    website_url: 'TEXT',
    model_url: 'TEXT',
    pricing_url: 'TEXT',
    playground_url: 'TEXT',
    has_zdr_provider: 'INTEGER NOT NULL DEFAULT 0',
    has_no_prompt_training_provider: 'INTEGER NOT NULL DEFAULT 0',
    has_hipaa_compliant_provider: 'INTEGER NOT NULL DEFAULT 0'
  },
  guardrails: {
    profile_id: 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'
  },
  mcp_servers: {
    profile_id: 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'
  },
  skills: {
    profile_id: 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'
  },
  request_logs: {
    cached_input_tokens: 'INTEGER NOT NULL DEFAULT 0',
    image_input_tokens: 'INTEGER NOT NULL DEFAULT 0',
    audio_input_tokens: 'INTEGER NOT NULL DEFAULT 0',
    video_input_tokens: 'INTEGER NOT NULL DEFAULT 0',
    image_output_tokens: 'INTEGER NOT NULL DEFAULT 0',
    video_output_tokens: 'INTEGER NOT NULL DEFAULT 0',
    web_search_calls: 'INTEGER NOT NULL DEFAULT 0',
    input_cost: 'REAL NOT NULL DEFAULT 0',
    output_cost: 'REAL NOT NULL DEFAULT 0',
    cached_input_cost: 'REAL NOT NULL DEFAULT 0',
    image_input_cost: 'REAL NOT NULL DEFAULT 0',
    audio_input_cost: 'REAL NOT NULL DEFAULT 0',
    video_input_cost: 'REAL NOT NULL DEFAULT 0',
    image_output_cost: 'REAL NOT NULL DEFAULT 0',
    video_output_cost: 'REAL NOT NULL DEFAULT 0',
    web_search_cost: 'REAL NOT NULL DEFAULT 0'
  }
};

function migrateColumns(): void {
  for (const [table, cols] of Object.entries(COLUMN_MIGRATIONS)) {
    const existing = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    const have = new Set(existing.map((c) => c.name));
    if (have.size === 0) continue; // table not created yet — DDL above handles it
    for (const [col, defn] of Object.entries(cols)) {
      if (!have.has(col)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defn}`);
      }
    }
  }
}

function migrateBackendSecrets(): void {
  const rows = sqlite
    .prepare('SELECT id, api_key FROM backends')
    .all() as Array<{ id: string; api_key: string }>;

  const updateBackendSecret = sqlite.prepare(
    'UPDATE backends SET api_key = ?, updated_at = (unixepoch() * 1000) WHERE id = ?'
  );

  for (const row of rows) {
    if (!row.api_key || isEncryptedSecret(row.api_key)) continue;
    updateBackendSecret.run(encryptSecret(row.api_key), row.id);
  }
}

let ran = false;

export function ensureSchema(): void {
  if (ran) return;
  sqlite.exec(DDL);
  migrateColumns();
  migrateBackendSecrets();
  ran = true;
}
