CREATE TABLE "accessible_models" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"description" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"providers" text DEFAULT '[]' NOT NULL,
	"context_size" integer,
	"max_output_tokens" integer,
	"release_date" text,
	"input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"output_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"cached_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"image_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"audio_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"video_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"image_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"video_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"web_search_call_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"website_url" text,
	"model_url" text,
	"pricing_url" text,
	"playground_url" text,
	"has_zdr_provider" boolean DEFAULT false NOT NULL,
	"has_no_prompt_training_provider" boolean DEFAULT false NOT NULL,
	"has_hipaa_compliant_provider" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accessible_models_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "accessible_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'openai' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accessible_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "backends" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'openai' NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text NOT NULL,
	"profile_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardrail_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"guardrail_id" text,
	"guardrail_name" text NOT NULL,
	"stage" text NOT NULL,
	"request_id" text,
	"profile_id" text,
	"virtual_key_id" text,
	"action" text NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardrails" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stage" text NOT NULL,
	"kind" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"profile_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"global_mfa_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"transport" text DEFAULT 'stdio' NOT NULL,
	"command" text,
	"args" text,
	"env" text,
	"url" text,
	"profile_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_break_glass_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"display_name" text NOT NULL,
	"backend_id" text NOT NULL,
	"upstream_id" text NOT NULL,
	"input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"output_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"cached_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"image_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"audio_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"video_input_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"image_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"video_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"web_search_call_price_per_m_tokens" real DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"description" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"context_size" integer,
	"max_output_tokens" integer,
	"release_date" text,
	"website_url" text,
	"model_url" text,
	"pricing_url" text,
	"playground_url" text,
	"has_zdr_provider" boolean DEFAULT false NOT NULL,
	"has_no_prompt_training_provider" boolean DEFAULT false NOT NULL,
	"has_hipaa_compliant_provider" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"supports_streaming" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"code_verifier" text NOT NULL,
	"provider" text NOT NULL,
	"intent" text DEFAULT 'login' NOT NULL,
	"actor_user_id" text,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"global_budget" real,
	"global_budget_frequency" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_mfa_complete" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text,
	"profile_name" text,
	"virtual_key_id" text,
	"virtual_key_name" text,
	"model_id" text,
	"model_public_id" text,
	"endpoint" text NOT NULL,
	"streaming" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"http_status" integer NOT NULL,
	"error_message" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"image_input_tokens" integer DEFAULT 0 NOT NULL,
	"audio_input_tokens" integer DEFAULT 0 NOT NULL,
	"video_input_tokens" integer DEFAULT 0 NOT NULL,
	"image_output_tokens" integer DEFAULT 0 NOT NULL,
	"video_output_tokens" integer DEFAULT 0 NOT NULL,
	"web_search_calls" integer DEFAULT 0 NOT NULL,
	"input_cost" real DEFAULT 0 NOT NULL,
	"output_cost" real DEFAULT 0 NOT NULL,
	"cached_input_cost" real DEFAULT 0 NOT NULL,
	"image_input_cost" real DEFAULT 0 NOT NULL,
	"audio_input_cost" real DEFAULT 0 NOT NULL,
	"video_input_cost" real DEFAULT 0 NOT NULL,
	"image_output_cost" real DEFAULT 0 NOT NULL,
	"video_output_cost" real DEFAULT 0 NOT NULL,
	"web_search_cost" real DEFAULT 0 NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_mfa_complete" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"profile_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"provider_email" text,
	"linked_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"profile_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"custom_message" text,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'operator' NOT NULL,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"mfa_enrolled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "virtual_key_models" (
	"virtual_key_id" text NOT NULL,
	"model_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"budget" real,
	"budget_frequency" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virtual_keys_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "backends" ADD CONSTRAINT "backends_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_logs" ADD CONSTRAINT "guardrail_logs_guardrail_id_guardrails_id_fk" FOREIGN KEY ("guardrail_id") REFERENCES "public"."guardrails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_logs" ADD CONSTRAINT "guardrail_logs_request_id_request_logs_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrails" ADD CONSTRAINT "guardrails_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_break_glass_tokens" ADD CONSTRAINT "mfa_break_glass_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_backend_id_backends_id_fk" FOREIGN KEY ("backend_id") REFERENCES "public"."backends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_virtual_key_id_virtual_keys_id_fk" FOREIGN KEY ("virtual_key_id") REFERENCES "public"."virtual_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_key_models" ADD CONSTRAINT "virtual_key_models_virtual_key_id_virtual_keys_id_fk" FOREIGN KEY ("virtual_key_id") REFERENCES "public"."virtual_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_key_models" ADD CONSTRAINT "virtual_key_models_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD CONSTRAINT "virtual_keys_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessible_models_slug_idx" ON "accessible_models" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "backends_profile_idx" ON "backends" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "gl_created_idx" ON "guardrail_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gl_guardrail_idx" ON "guardrail_logs" USING btree ("guardrail_id");--> statement-breakpoint
CREATE INDEX "guardrails_profile_idx" ON "guardrails" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "mcp_servers_profile_idx" ON "mcp_servers" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_break_glass_tokens_token_hash_uniq" ON "mfa_break_glass_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mfa_break_glass_tokens_user_idx" ON "mfa_break_glass_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_break_glass_tokens_expires_idx" ON "mfa_break_glass_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_uniq" ON "mfa_recovery_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_user_idx" ON "mfa_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_used_idx" ON "mfa_recovery_codes" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "models_backend_idx" ON "models" USING btree ("backend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_states_state_uniq" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_uniq" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_uniq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "req_created_idx" ON "request_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "req_profile_idx" ON "request_logs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "req_vkey_idx" ON "request_logs" USING btree ("virtual_key_id");--> statement-breakpoint
CREATE INDEX "req_model_idx" ON "request_logs" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skills_profile_idx" ON "skills" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_user_uniq" ON "user_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_user_provider_uniq" ON "user_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "user_identities_user_idx" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_invitations_token_hash_uniq" ON "user_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_profile_idx" ON "user_invitations" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "user_invitations_invited_by_idx" ON "user_invitations" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "user_invitations_expires_idx" ON "user_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_uniq" ON "user_profiles" USING btree ("user_id","profile_id");--> statement-breakpoint
CREATE INDEX "user_profiles_profile_idx" ON "user_profiles" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vkey_models_uniq" ON "virtual_key_models" USING btree ("virtual_key_id","model_id");--> statement-breakpoint
CREATE INDEX "vkey_models_model_idx" ON "virtual_key_models" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "vkeys_profile_idx" ON "virtual_keys" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vkeys_token_idx" ON "virtual_keys" USING btree ("token");