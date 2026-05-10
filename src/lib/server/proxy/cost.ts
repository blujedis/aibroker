import type { Model } from '../db/schema.postgres.js';

export interface UsageTokens {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  imageInputTokens?: number;
  audioInputTokens?: number;
  videoInputTokens?: number;
  imageOutputTokens?: number;
  videoOutputTokens?: number;
  webSearchCalls?: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cachedInputCost: number;
  imageInputCost: number;
  audioInputCost: number;
  videoInputCost: number;
  imageOutputCost: number;
  videoOutputCost: number;
  webSearchCost: number;
  total: number;
}

type PricingModel = Pick<
  Model,
  | 'inputPricePerMTokens'
  | 'outputPricePerMTokens'
  | 'cachedInputPricePerMTokens'
  | 'imageInputPricePerMTokens'
  | 'audioInputPricePerMTokens'
  | 'videoInputPricePerMTokens'
  | 'imagePricePerMTokens'
  | 'videoPricePerMTokens'
  | 'webSearchCallPricePerMTokens'
>;

const PER_M = 1_000_000;

function per(tokens: number | undefined, rate: number): number {
  if (!tokens || !rate) return 0;
  return (tokens / PER_M) * rate;
}

/**
 * Compute a full cost breakdown from a model's per-type pricing and a usage
 * record. All prices are expressed per 1M tokens (or per 1M calls for web
 * search), consistent with our schema naming convention.
 */
export function computeCostBreakdown(model: PricingModel, usage: UsageTokens): CostBreakdown {
  const inputCost = per(usage.inputTokens, model.inputPricePerMTokens);
  const outputCost = per(usage.outputTokens, model.outputPricePerMTokens);
  const cachedInputCost = per(usage.cachedInputTokens, model.cachedInputPricePerMTokens);
  const imageInputCost = per(usage.imageInputTokens, model.imageInputPricePerMTokens);
  const audioInputCost = per(usage.audioInputTokens, model.audioInputPricePerMTokens);
  const videoInputCost = per(usage.videoInputTokens, model.videoInputPricePerMTokens);
  const imageOutputCost = per(usage.imageOutputTokens, model.imagePricePerMTokens);
  const videoOutputCost = per(usage.videoOutputTokens, model.videoPricePerMTokens);
  const webSearchCost = per(usage.webSearchCalls, model.webSearchCallPricePerMTokens);
  const total =
    inputCost +
    outputCost +
    cachedInputCost +
    imageInputCost +
    audioInputCost +
    videoInputCost +
    imageOutputCost +
    videoOutputCost +
    webSearchCost;
  return {
    inputCost,
    outputCost,
    cachedInputCost,
    imageInputCost,
    audioInputCost,
    videoInputCost,
    imageOutputCost,
    videoOutputCost,
    webSearchCost,
    total
  };
}

/**
 * Back-compat convenience: only input/output token totals (used by simple
 * completions flows that don't report multimodal usage).
 */
export function computeCost(model: Pick<Model, 'inputPricePerMTokens' | 'outputPricePerMTokens'>, input: number, output: number): number {
  const per = 1_000_000;
  return (input / per) * model.inputPricePerMTokens + (output / per) * model.outputPricePerMTokens;
}

// Rough token estimate when upstream doesn't return usage (e.g. streaming w/o usage).
// ~4 chars per token is a widely-used heuristic for English text.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
