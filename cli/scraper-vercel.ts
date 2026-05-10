/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';
import { join } from 'path';
import { removeSlashes } from 'slashes';

const outputPath = join(import.meta.dirname, 'providersAndModels.json');

const knownProviders = [
  {
    "name": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "kind": "openai"
  },
  {
    "name": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "kind": "openai"
  },
  {
    "name": "azure",
    "baseUrl": "https://{your-resource-name}.openai.azure.com/openai/v1",
    "kind": "openai"
  },
  {
    "name": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "kind": "anthropic"
  },
  {
    "name": "vertexAnthropic",
    "baseUrl": "https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/anthropic/models",
    "kind": "anthropic"
  },
  {
    "name": "bedrock",
    "baseUrl": "",
    "kind": "anthropic"
  },
  {
    "name": "google",
    "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
    "kind": "custom"
  },
  {
    "name": "vertex",
    "baseUrl": "https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}",
    "kind": "custom"
  },
  {
    "name": "xai",
    "baseUrl": "https://api.x.ai/v1",
    "kind": "openai"
  },
  {
    "name": "groq",
    "baseUrl": "https://api.groq.com/openai/v1",
    "kind": "openai"
  },
  {
    "name": "cerebras",
    "baseUrl": "https://api.cerebras.ai/v1",
    "kind": "openai"
  },
  {
    "name": "deepseek",
    "baseUrl": "https://api.deepseek.com",
    "kind": "openai"
  },
  {
    "name": "mistral",
    "baseUrl": "https://api.mistral.ai/v1/",
    "kind": "openai"
  },
  {
    "name": "perplexity",
    "baseUrl": "https://api.perplexity.ai/v1",
    "kind": "openai"
  },
  {
    "name": "fireworks",
    "baseUrl": "https://api.fireworks.ai/inference/v1",
    "kind": "openai"
  },
  {
    "name": "togetherai",
    "baseUrl": "https://api.together.xyz/v1",
    "kind": "openai"
  },
  {
    "name": "moonshotai",
    "baseUrl": "https://api.moonshot.ai/v1",
    "kind": "openai"
  },
  {
    "name": "novita",
    "baseUrl": "https://api.novita.ai/v3/openai",
    "kind": "openai"
  },
  {
    "name": "nebius",
    "baseUrl": "https://api.tokenfactory.nebius.com/v1",
    "kind": "openai"
  },
  {
    "name": "parasail",
    "baseUrl": "https://api.saas.parasail.io/v1",
    "kind": "openai"
  },
  {
    "name": "deepinfra",
    "baseUrl": "https://api.deepinfra.com/v1/openai",
    "kind": "openai"
  },
  {
    "name": "voyage",
    "baseUrl": "https://api.voyageai.com/v1",
    "kind": "openai"
  },
  {
    "name": "baseten",
    "baseUrl": "https://inference.baseten.co/v1",
    "kind": "openai"
  },
  {
    "name": "cohere",
    "baseUrl": "https://api.cohere.ai/v1",
    "kind": "custom"
  },
  {
    "name": "sambanova",
    "baseUrl": "https://api.sambanova.ai/v1",
    "kind": ""
  },
  {
    "name": "chutes",
    "baseUrl": "https://llm.chutes.ai/v1",
    "kind": "openai"
  },
  {
    "name": "minimax",
    "baseUrl": "https://api.minimax.io/v1",
    "kind": "openai"
  },
  {
    "name": "zai",
    "baseUrl": "https://api.z.ai/api/paas/v4",
    "kind": "openai"
  },
  {
    "name": "alibaba",
    "baseUrl": "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
    "kind": "openai"
  },
  {
    "name": "streamlake",
    "baseUrl": "https://vanchin.streamlake.ai/api/gateway/coding/v1",
    "kind": "openai"
  },
  {
    "name": "morph",
    "baseUrl": "https://api.morphllm.com/v1",
    "kind": "openai"
  },
  {
    "name": "xiaomi",
    "baseUrl": "https://token-plan-ams.xiaomimimo.com/v1",
    "kind": "openai"
  },
  {
    "name": "meituan",
    "baseUrl": "",
    "kind": ""
  },
  {
    "name": "inception",
    "baseUrl": "https://api.inceptionlabs.ai/v1/chat/completions",
    "kind": "openai"
  },
  {
    "name": "bytedance",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/v3",
    "kind": "openai"
  },
  {
    "name": "bfl",
    "baseUrl": "https://bfl.ai",
    "kind": "custom"
  },
  {
    "name": "recraft",
    "baseUrl": "https://external.api.recraft.ai/v1",
    "kind": "custom"
  },
  {
    "name": "klingai",
    "baseUrl": "https://api.klingapi.com",
    "kind": "custom"
  },
  {
    "name": "arcee-ai",
    "baseUrl": "https://api.arcee.ai/api/v1/chat/completions",
    "kind": "openai"
  },
  {
    "name": "prodia",
    "baseUrl": "https://inference.prodia.com/",
    "kind": "custom"
  }
];

function saveFile(data: string | Record<string, any>, path = outputPath) {
  if (typeof data !== 'string')
    data = JSON.stringify(data, null, 2);
  writeFileSync(path, data);
  console.log(`AI model pricing output to: "${path}"`);
}

async function fetchURL(url: string) {
  if (!url)
    return console.error(`Cannot fetch HTML using url of undefined.`);
  const $ = await fetch(url)
    .then(res => {
      if (!res.ok)
        throw Error(res.statusText);
      return res.text();
    })
    .then(html => {
      return cheerio.load(html);
    })
    .catch(err => console.error(err));
  return $;
}

const transformMap = {
  displayName: 'displayName',
  // creatorOrganization: 'creator',
  copyString: 'providerModel',
  description: 'description',
  releaseDate: 'releaseDate',
  contextSize: 'contextSize',
  inputCost: 'inputCost',
  outputCost: 'outputCost',
  tags: 'tags',
  providers: 'providers',
  imageCost: 'imageCost',
  videoCost: 'videoCost',
  cachedInputCost: 'cachedInputCost',
  imageInputCost: 'imageInputCost',
  audioInputCost: 'audioInputCost',
  videoInputCost: 'videoInputCost',
  webSearchCallCost: 'webSearchCallCost'
};

const excludeKeys = ['rerankingQueryCost', 'inputCostTiers', 'outputCostTiers', 'cachedInputListCostTiers', 'cacheCreationInputCostTiers', 'cacheCreationInputListCostTiers', 'cacheCreation1hInputCostTiers', 'cacheCreation1hInputListCostTiers', 'imageDimensionQualityPricing', 'isPreGateway', 'providerModelVariants', 'metrics', 'inputListCostTiers', 'outputListCostTiers', 'cachedInputCostTiers', 'cacheCreationInputCost', 'cacheCreation1hInputCost', 'isAggregated', 'copyString', 'creatorOrganization'];

const transformMapKeys = Object.keys(transformMap);

const toNumber = (v: string) => {
  if (v === '$undefined')
    return 0;
  return Number(v);
};

const refactorMap = {
  releaseDate: (v: string) => (new Date(v)),
  context: toNumber,
  maxOutputTokens: toNumber,
  inputCost: toNumber,
  outputCost: toNumber,
  cachedInputCost: toNumber,
  cacheCreationInputCost: toNumber,
  webSearchCallCost: toNumber,
  imageCost: toNumber,
  videoCost: toNumber,
  imageInputCost: toNumber,
  audioInputCost: toNumber,
  videoInputCost: toNumber,
} as { [key: string]: (value: any, model: Record<string, any>) => any; };


function transformModel(model: Record<string, any>) {

  for (const [k, v] of Object.entries(model)) {

    if (k === 'videoDimensionPricing') { // set video cost to max poss value.
      const arr = (v || []) as Record<string, any>[];
      if (Array.isArray(arr)) {
        const sorted = arr.map(item => Number((item as any).cost)).sort((a, b) => a - b);
        const max = sorted.pop();
        model['videoCost'] = max;
      }
    }

    if (!transformMapKeys.includes(k)) continue; // only process required keys.
    if (Array.isArray(v)) {
      v.forEach((n, i) => {
        if (n.amount)
          v[i].amount = Number(n.amount);
      });
    }
    else if (typeof refactorMap[k as keyof typeof refactorMap] !== 'undefined') {
      const transformed = refactorMap[k as keyof typeof refactorMap](model[k], model);
      if (transformMap[k as keyof typeof transformMap])
        model[transformMap[k as keyof typeof transformMap]] = transformed;
      else
        model[k] = transformed;
    }
    else if (v === '$undefined') {
      if (transformMap[k as keyof typeof transformMap])
        model[transformMap[k as keyof typeof transformMap]] = "";
      else
        model[k] = "";
    }
  }
  excludeKeys.forEach(k => {
    delete model[k];
  });
  return model;
}

function parseScriptAsJSON(str: string) {
  const originalStr = str.slice(0, 125);
  str = str.trim().replace('self.__next_f.push(', ''); // remove prefixed func call.
  str = str.slice(str.indexOf('{')).trim().slice(0, -5); // slice before the first "{" then trim end.
  let json = JSON.parse(str); // parse as an object so we can get "models".
  if (!json.models) { // if models doesn't exist return empty string.
    console.log(`Failed to parse models from string:\n${originalStr}`);
    return '';
  }
  json = (json.models as Record<string, any>[]).reduce((a, c) => { // convert array of models to indexed object of.
    const key = c.slug;
    if (a[key]) {
      console.error(`Ignoring model "${key}", a duplicate was detected.`);
      return a;
    }
    // c.releaseDate = new Date(c.releaseDate);
    a[key] = transformModel(c); // ensure numeric values perhaps others in future.
    return a;
  }, {} as Record<string, any>);

  // const providers = [] as string[];

  const providers = {} as Record<string, { baseUrl: string; kind: string; }>;

  Object.entries(json as Record<string, { providers: string[] }>).forEach(([k, v]) => {
    if (v.providers) {
      v.providers.forEach(p => {
        const found = knownProviders.find(v => v.name === p);
        if (found) {
          const { name, baseUrl, kind } = found;
          providers[name] = { baseUrl, kind }
        }
        else {
          providers[p] = { baseUrl: '', kind: '' };
        }
        // if (!providers.includes(p)) providers.push(p);
      });
    }
  });

  const obj = {
    providers, // providers.map(p => ({ name: p, baseUrl: '', kind: '' })),
    models: json
  };

  return JSON.stringify(obj, null, 2);
}

function isMatchingScript(str: string) {
  const exp = /{"isPublic":false,"models":/;
  return exp.test(str);
}

export async function parseModels() {
  const url = 'https://vercel.com/ai-gateway/models';
  const $ = await fetchURL(url); // use fetch then convert to document using Cheerio.

  if (!$) {
    console.log(`Failed to load HTML from url "${url}". `);
    process.exit();
  }

  const scripts = $('script'); // find all the scripts in the HTML document.

  let models = '';

  for (const el of scripts) {
    if ($(el).attr('src')) continue; // we don't care about scripts referencing a source.
    if (models.length) break; // if we've found models break the loop.
    let scriptContent = $(el).text(); // text in script elements which have contents.
    scriptContent = removeSlashes(scriptContent); // remove "\" escapes.
    if (!isMatchingScript(scriptContent)) continue; // continue loop if not matching script.
    models = parseScriptAsJSON(scriptContent); // gets stringified object of models.
    break;
  }

  if (!models.length) {
    console.log(`Failed to load models from "${url}".`);
    process.exit(0);
  }

  saveFile(models, outputPath);

}
