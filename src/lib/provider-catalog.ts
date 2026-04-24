// Inferred connection info for providers referenced in providersAndModels.json.
// Values here are used when upserting accessible_providers — users can still
// override any field once the row exists.

export interface ProviderInfo {
  kind: 'openai' | 'anthropic' | 'custom';
  baseUrl: string;
}

export const PROVIDER_CATALOG: Record<string, ProviderInfo> = {
  openrouter: { kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  openai: { kind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  azure: { kind: 'openai', baseUrl: 'https://{your-resource-name}.openai.azure.com/openai/v1' },
  anthropic: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com' },
  vertexAnthropic: { kind: 'anthropic', baseUrl: '' },
  bedrock: { kind: 'anthropic', baseUrl: '' },
  google: { kind: 'custom', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  vertex: { kind: 'custom', baseUrl: '' },
  xai: { kind: 'openai', baseUrl: 'https://api.x.ai/v1' },
  groq: { kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  cerebras: { kind: 'openai', baseUrl: 'https://api.cerebras.ai/v1' },
  deepseek: { kind: 'openai', baseUrl: 'https://api.deepseek.com' },
  mistral: { kind: 'openai', baseUrl: 'https://api.mistral.ai/v1' },
  perplexity: { kind: 'openai', baseUrl: 'https://api.perplexity.ai/v1' },
  fireworks: { kind: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  togetherai: { kind: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  moonshotai: { kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1' },
  novita: { kind: 'openai', baseUrl: 'https://api.novita.ai/v3/openai' },
  nebius: { kind: 'openai', baseUrl: 'https://api.studio.nebius.com/v1' },
  parasail: { kind: 'openai', baseUrl: 'https://api.parasail.io/v1' },
  deepinfra: { kind: 'openai', baseUrl: 'https://api.deepinfra.com/v1/openai' },
  voyage: { kind: 'openai', baseUrl: 'https://api.voyageai.com/v1' },
  baseten: { kind: 'openai', baseUrl: '' },
  cohere: { kind: 'custom', baseUrl: 'https://api.cohere.ai/v1' },
  sambanova: { kind: 'openai', baseUrl: 'https://api.sambanova.ai/v1' },
  chutes: { kind: 'openai', baseUrl: 'https://llm.chutes.ai/v1' },
  minimax: { kind: 'openai', baseUrl: 'https://api.minimax.io/v1' },
  zai: { kind: 'openai', baseUrl: 'https://api.z.ai/api/paas/v4' },
  alibaba: { kind: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  streamlake: { kind: 'openai', baseUrl: '' },
  morph: { kind: 'openai', baseUrl: 'https://api.morphllm.com/v1' },
  xiaomi: { kind: 'openai', baseUrl: '' },
  meituan: { kind: 'openai', baseUrl: '' },
  inception: { kind: 'openai', baseUrl: '' },
  bytedance: { kind: 'openai', baseUrl: '' },
  bfl: { kind: 'custom', baseUrl: '' },
  recraft: { kind: 'custom', baseUrl: '' },
  klingai: { kind: 'custom', baseUrl: '' },
  'arcee-ai': { kind: 'openai', baseUrl: '' },
  prodia: { kind: 'custom', baseUrl: '' }
};

export function inferProvider(name: string): ProviderInfo {
  return PROVIDER_CATALOG[name] ?? { kind: 'openai', baseUrl: '' };
}
