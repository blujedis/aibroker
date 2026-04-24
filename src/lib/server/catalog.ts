import { nanoid } from 'nanoid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from './db/index.js';
import { inferProvider } from '../provider-catalog.js';

// Shape of providersAndModels.json at ingest time.
export interface RawProvider {
  name: string;
  baseUrl?: string;
  kind?: string;
}

export interface RawModel {
  slug: string;
  displayName: string;
  type?: string;
  tags?: string[];
  providers?: string[];
  description?: string;
  contextSize?: number;
  maxOutputTokens?: number;
  releaseDate?: string;
  inputCost?: number;
  outputCost?: number;
  cachedInputCost?: number;
  imageCost?: number;
  videoCost?: number;
  imageInputCost?: number;
  audioInputCost?: number;
  videoInputCost?: number;
  webSearchCallCost?: number;
  playgroundUrl?: string;
  websiteUrl?: string;
  modelUrl?: string;
  pricingUrl?: string;
  hasZdrProvider?: boolean;
  hasNoPromptTrainingProvider?: boolean;
  hasHipaaCompliantProvider?: boolean;
}

export interface RawCatalog {
  providers: RawProvider[];
  models: Record<string, RawModel>;
}

export interface IngestResult {
  providersInserted: number;
  providersUpdated: number;
  modelsInserted: number;
  modelsUpdated: number;
}

function normalizeKind(k?: string): 'openai' | 'anthropic' | 'custom' {
  if (k === 'openai' || k === 'anthropic' || k === 'custom') return k;
  return 'openai';
}

/**
 * Upsert the catalog of accessible providers and models. For existing rows,
 * we preserve the local `enabled` flag and only overwrite descriptive fields
 * (so operators can toggle visibility without fear of imports clobbering it).
 */
export function ingestCatalog(raw: RawCatalog): IngestResult {
  const result: IngestResult = {
    providersInserted: 0,
    providersUpdated: 0,
    modelsInserted: 0,
    modelsUpdated: 0
  };

  db.transaction(() => {
    // Providers -----------------------------------------------------------
    for (const p of raw.providers ?? []) {
      const name = String(p.name ?? '').trim();
      if (!name) continue;
      const inferred = inferProvider(name);
      const baseUrl = p.baseUrl?.trim() || inferred.baseUrl;
      const kind = p.kind ? normalizeKind(p.kind) : inferred.kind;
      const existing = db
        .select({ id: schema.accessibleProviders.id })
        .from(schema.accessibleProviders)
        .where(eq(schema.accessibleProviders.name, name))
        .get();
      if (existing) {
        db.update(schema.accessibleProviders)
          .set({
            // Only fill in missing connection info — never clobber user edits.
            baseUrl: sql`CASE WHEN COALESCE(${schema.accessibleProviders.baseUrl}, '') = '' THEN ${baseUrl} ELSE ${schema.accessibleProviders.baseUrl} END`,
            kind,
            updatedAt: new Date()
          })
          .where(eq(schema.accessibleProviders.id, existing.id))
          .run();
        result.providersUpdated++;
      } else {
        db.insert(schema.accessibleProviders)
          .values({ id: nanoid(), name, baseUrl, kind, enabled: true })
          .run();
        result.providersInserted++;
      }
    }

    // Models --------------------------------------------------------------
    for (const [slugKey, m] of Object.entries(raw.models ?? {})) {
      const slug = String(m.slug ?? slugKey ?? '').trim();
      if (!slug) continue;
      const values = {
        slug,
        displayName: m.displayName ?? slug,
        type: m.type ?? 'chat',
        description: m.description ?? null,
        tags: JSON.stringify(Array.isArray(m.tags) ? m.tags : []),
        providers: JSON.stringify(Array.isArray(m.providers) ? m.providers : []),
        contextSize: m.contextSize ?? null,
        maxOutputTokens: m.maxOutputTokens ?? null,
        releaseDate: m.releaseDate ?? null,
        inputPricePerMTokens: m.inputCost ?? 0,
        outputPricePerMTokens: m.outputCost ?? 0,
        cachedInputPricePerMTokens: m.cachedInputCost ?? 0,
        imageInputPricePerMTokens: m.imageInputCost ?? 0,
        audioInputPricePerMTokens: m.audioInputCost ?? 0,
        videoInputPricePerMTokens: m.videoInputCost ?? 0,
        imagePricePerMTokens: m.imageCost ?? 0,
        videoPricePerMTokens: m.videoCost ?? 0,
        webSearchCallPricePerMTokens: m.webSearchCallCost ?? 0,
        websiteUrl: m.websiteUrl ?? null,
        modelUrl: m.modelUrl ?? null,
        pricingUrl: m.pricingUrl ?? null,
        playgroundUrl: m.playgroundUrl ?? null,
        hasZdrProvider: Boolean(m.hasZdrProvider),
        hasNoPromptTrainingProvider: Boolean(m.hasNoPromptTrainingProvider),
        hasHipaaCompliantProvider: Boolean(m.hasHipaaCompliantProvider)
      };
      const existing = db
        .select({ id: schema.accessibleModels.id })
        .from(schema.accessibleModels)
        .where(eq(schema.accessibleModels.slug, slug))
        .get();
      if (existing) {
        db.update(schema.accessibleModels)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.accessibleModels.id, existing.id))
          .run();
        result.modelsUpdated++;
      } else {
        db.insert(schema.accessibleModels)
          .values({ id: nanoid(), ...values, enabled: true })
          .run();
        result.modelsInserted++;
      }
    }
  });
  return result;
}
