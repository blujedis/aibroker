import type { Backend } from '../db/schema.js';

export interface UpstreamRequestInit {
  backend: Backend;
  /** Upstream model id (NOT the public id). */
  upstreamModel: string;
  body: Record<string, unknown>;
  stream: boolean;
  signal?: AbortSignal;
}

export async function callUpstreamChat(init: UpstreamRequestInit): Promise<Response> {
  const { backend, upstreamModel, body, stream, signal } = init;
  const url = backend.baseUrl.replace(/\/$/, '') + '/chat/completions';

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (backend.kind === 'anthropic') {
    headers['x-api-key'] = backend.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['authorization'] = `Bearer ${backend.apiKey}`;
  }

  const upstreamBody = {
    ...body,
    model: upstreamModel,
    stream
  };

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(upstreamBody),
    signal
  });
}

export async function listUpstreamModels(backend: Backend): Promise<unknown> {
  const url = backend.baseUrl.replace(/\/$/, '') + '/models';
  const headers: Record<string, string> = {};
  if (backend.kind === 'anthropic') {
    headers['x-api-key'] = backend.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['authorization'] = `Bearer ${backend.apiKey}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`upstream models list failed (${res.status})`);
  return res.json();
}
