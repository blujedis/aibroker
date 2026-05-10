import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
  getLimiterForBackend,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_STREAM_TIMEOUT_MS
} from '$lib/server/proxy/concurrency.js';
import { callUpstreamChat } from '$lib/server/proxy/backend.js';
import {
  checkBudgets,
  extractBearer,
  logRequest,
  resolveKey
} from '$lib/server/proxy/router.js';
import { computeCostBreakdown, estimateTokens } from '$lib/server/proxy/cost.js';
import {
  persistGuardrailLogs,
  runDuringChunk,
  runPostStage,
  runPreStage,
  type ChatMessage
} from '$lib/server/guardrails/engine.js';

const errBody = (code: string, message: string, type = 'invalid_request_error') => ({
  error: { message, type, code }
});

export const POST: RequestHandler = async ({ request }) => {
  const started = performance.now();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(errBody('invalid_json', 'Invalid JSON body'), { status: 400 });
  }

  const publicModel = typeof body.model === 'string' ? body.model : '';
  const streaming = Boolean(body.stream);
  const messages: ChatMessage[] = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];

  const token = extractBearer(request);
  const resolved = await resolveKey(token, publicModel);
  if ('code' in resolved) {
    return json(errBody(resolved.code, resolved.message), {
      status:
        resolved.code === 'missing_key' || resolved.code === 'invalid_key'
          ? 401
          : resolved.code === 'disabled'
            ? 403
            : 404
    });
  }

  const { profile, virtualKey, model, backend } = resolved;

  const budget = await checkBudgets(profile, virtualKey);
  if (!budget.allowed) {
    logRequest(
      { profile, virtualKey, model },
      {
        endpoint: '/v1/chat/completions',
        streaming,
        status: 'blocked',
        httpStatus: 402,
        errorMessage: budget.reason,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      }
    );
    return json(errBody('budget_exhausted', budget.reason ?? 'Budget exhausted'), {
      status: 402
    });
  }

  // Pre-stage guardrails
  const pre = await runPreStage({ messages, model: publicModel, profileId: profile.id });

  if (pre.outcome.action === 'block') {
    const preLogs = pre.logs;
    const preProfile = profile;
    const preVirtualKey = virtualKey;
    logRequest(
      { profile, virtualKey, model },
      {
        endpoint: '/v1/chat/completions',
        streaming,
        status: 'blocked',
        httpStatus: 403,
        errorMessage: pre.outcome.reason,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      },
      async (id) => persistGuardrailLogs(preLogs, {
        profileId: preProfile.id,
        virtualKeyId: preVirtualKey.id,
        requestId: id
      })
    );
    return json(errBody('guardrail_block', pre.outcome.reason ?? 'Request blocked'), {
      status: 403
    });
  }

  const outgoingBody = { ...body, messages: pre.messages };
  delete (outgoingBody as Record<string, unknown>).model; // will be set in callUpstreamChat
  delete (outgoingBody as Record<string, unknown>).stream;

  if (streaming) {
    return handleStreaming({
      started,
      outgoingBody,
      backend,
      profile,
      virtualKey,
      model,
      preLogs: pre.logs
    });
  }

  // Non-streaming path
  let upstreamRes: Response;
  try {
    upstreamRes = await getLimiterForBackend(backend.id)(() =>
      callUpstreamChat({
        backend,
        upstreamModel: model.upstreamId,
        body: outgoingBody,
        stream: false,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      })
    );
  } catch (err) {
    const isTimeout =
      (err instanceof DOMException && err.name === 'TimeoutError') ||
      (err instanceof Error && err.name === 'AbortError');
    logRequest(
      { profile, virtualKey, model },
      {
        endpoint: '/v1/chat/completions',
        streaming: false,
        status: 'failed',
        httpStatus: 504,
        errorMessage: isTimeout ? 'Upstream timeout' : String(err),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      }
    );
    return json(errBody('upstream_timeout', 'Upstream request timed out'), { status: 504 });
  }

  let upstreamJson: Record<string, unknown> | null = null;
  try {
    upstreamJson = (await upstreamRes.clone().json()) as Record<string, unknown>;
  } catch {
    upstreamJson = null;
  }

  if (!upstreamRes.ok) {
    const failLogs = pre.logs;
    const failProfile = profile;
    const failVirtualKey = virtualKey;
    logRequest(
      { profile, virtualKey, model },
      {
        endpoint: '/v1/chat/completions',
        streaming: false,
        status: 'failed',
        httpStatus: upstreamRes.status,
        errorMessage: JSON.stringify(upstreamJson ?? (await upstreamRes.text())),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      },
      async (id) => persistGuardrailLogs(failLogs, {
        profileId: failProfile.id,
        virtualKeyId: failVirtualKey.id,
        requestId: id
      })
    );
    return new Response(JSON.stringify(upstreamJson ?? { error: 'upstream error' }), {
      status: upstreamRes.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Post-stage guardrails on the text content
  const choices = Array.isArray(upstreamJson?.choices)
    ? (upstreamJson!.choices as Array<{ message?: { content?: string } }>)
    : [];
  const respText = choices.map((c) => c.message?.content ?? '').join('\n');
  const post = await runPostStage({ responseText: respText, profileId: profile.id });
  if (choices.length > 0 && post.responseText !== respText) {
    // Replace each message's content with redacted equivalents (rough — put the whole
    // redacted text on the first choice for simplicity).
    if (choices[0].message) choices[0].message.content = post.responseText;
  }

  const usage = (upstreamJson?.usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      audio_tokens?: number;
      image_tokens?: number;
    };
  };
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const cachedInputTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const audioInputTokens = usage.prompt_tokens_details?.audio_tokens ?? 0;
  const imageInputTokens = usage.prompt_tokens_details?.image_tokens ?? 0;
  const breakdown = computeCostBreakdown(model, {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    audioInputTokens,
    imageInputTokens
  });
  const cost = breakdown.total;
  const latencyMs = Math.round(performance.now() - started);

  const allLogs = [...pre.logs, ...post.logs];
  const successProfile = profile;
  const successVirtualKey = virtualKey;
  logRequest(
    { profile, virtualKey, model },
    {
      endpoint: '/v1/chat/completions',
      streaming: false,
      status: 'success',
      httpStatus: 200,
      errorMessage: null,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      audioInputTokens,
      imageInputTokens,
      inputCost: breakdown.inputCost,
      outputCost: breakdown.outputCost,
      cachedInputCost: breakdown.cachedInputCost,
      audioInputCost: breakdown.audioInputCost,
      imageInputCost: breakdown.imageInputCost,
      cost,
      latencyMs
    },
    async (id) => persistGuardrailLogs(allLogs, {
      profileId: successProfile.id,
      virtualKeyId: successVirtualKey.id,
      requestId: id
    })
  );

  // Replace model in response with the public id so clients see what they asked for.
  if (upstreamJson) upstreamJson.model = model.publicId;
  return json(upstreamJson ?? {});
};

async function handleStreaming(opts: {
  started: number;
  outgoingBody: Record<string, unknown>;
  backend: Parameters<typeof callUpstreamChat>[0]['backend'];
  profile: { id: string; name: string };
  virtualKey: { id: string; name: string };
  model: import('$lib/server/db/schema.postgres.js').Model;
  preLogs: Awaited<ReturnType<typeof runPreStage>>['logs'];
}): Promise<Response> {
  const { started, outgoingBody, backend, profile, virtualKey, model, preLogs } = opts;

  let upstreamRes: Response;
  try {
    upstreamRes = await getLimiterForBackend(backend.id)(() =>
      callUpstreamChat({
        backend,
        upstreamModel: model.upstreamId,
        body: outgoingBody,
        stream: true,
        signal: AbortSignal.timeout(UPSTREAM_STREAM_TIMEOUT_MS)
      })
    );
  } catch (err) {
    const isTimeout =
      (err instanceof DOMException && err.name === 'TimeoutError') ||
      (err instanceof Error && err.name === 'AbortError');
    logRequest(
      { profile: profile as never, virtualKey: virtualKey as never, model: model as never },
      {
        endpoint: '/v1/chat/completions',
        streaming: true,
        status: 'failed',
        httpStatus: 504,
        errorMessage: isTimeout ? 'Upstream timeout' : String(err),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      }
    );
    return new Response(
      JSON.stringify(errBody('upstream_timeout', 'Upstream request timed out')),
      { status: 504, headers: { 'content-type': 'application/json' } }
    );
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const errText = await upstreamRes.text().catch(() => 'upstream error');
    const streamFailLogs = preLogs;
    const streamFailProfile = profile;
    const streamFailVirtualKey = virtualKey;
    logRequest(
      {
        profile: profile as never,
        virtualKey: virtualKey as never,
        model: model as never
      },
      {
        endpoint: '/v1/chat/completions',
        streaming: true,
        status: 'failed',
        httpStatus: upstreamRes.status,
        errorMessage: errText,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyMs: Math.round(performance.now() - started)
      },
      async (id) => persistGuardrailLogs(streamFailLogs, {
        profileId: streamFailProfile.id,
        virtualKeyId: streamFailVirtualKey.id,
        requestId: id
      })
    );
    return new Response(errText, { status: upstreamRes.status });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let bufferedText = '';
  let aggregatedContent = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let duringLogs: Awaited<ReturnType<typeof runDuringChunk>>['logs'] = [];
  let blocked = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamRes.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bufferedText += decoder.decode(value, { stream: true });

          // Parse SSE frames terminated by \n\n
          let idx: number;
          while ((idx = bufferedText.indexOf('\n\n')) !== -1) {
            const frame = bufferedText.slice(0, idx);
            bufferedText = bufferedText.slice(idx + 2);
            const processed = await processFrame(frame);
            if (processed.done) {
              controller.enqueue(encoder.encode(frame + '\n\n'));
              continue;
            }
            if (processed.blocked) {
              const errFrame = `data: ${JSON.stringify({
                error: {
                  message: processed.reason ?? 'Blocked mid-stream',
                  type: 'guardrail_block'
                }
              })}\n\n`;
              controller.enqueue(encoder.encode(errFrame));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              blocked = true;
              return;
            }
            controller.enqueue(encoder.encode(processed.frame + '\n\n'));
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    }
  });

  async function processFrame(frame: string): Promise<{
    frame: string;
    done: boolean;
    blocked: boolean;
    reason?: string;
  }> {
    // SSE frame may contain multiple "data:" lines; just work with them.
    const lines = frame.split('\n');
    const outLines: string[] = [];
    for (const line of lines) {
      if (!line.startsWith('data:')) {
        outLines.push(line);
        continue;
      }
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        outLines.push(line);
        continue;
      }
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        if (obj.usage) {
          promptTokens = obj.usage.prompt_tokens ?? promptTokens;
          completionTokens = obj.usage.completion_tokens ?? completionTokens;
        }
        const delta = obj.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          const res = await runDuringChunk(delta, profile.id);
          duringLogs = duringLogs.concat(res.logs);
          if (res.block) {
            return { frame: line, done: false, blocked: true, reason: res.logs.at(-1)?.reason ?? undefined };
          }
          if (res.text !== delta && obj.choices?.[0]?.delta) {
            obj.choices[0].delta.content = res.text;
          }
          aggregatedContent += res.text;
        }
        outLines.push('data: ' + JSON.stringify(obj));
      } catch {
        outLines.push(line);
      }
    }
    return {
      frame: outLines.join('\n'),
      done: frame.includes('data: [DONE]'),
      blocked: false
    };
  }

  const response = new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    }
  });

  // When the response finishes, finalize logging.
  const finalize = async () => {
    const post = await runPostStage({ responseText: aggregatedContent, profileId: profile.id });
    const inputTokens = promptTokens || estimateTokens(JSON.stringify(outgoingBody.messages ?? ''));
    const outputTokens = completionTokens || estimateTokens(aggregatedContent);
    const breakdown = computeCostBreakdown(model, { inputTokens, outputTokens });
    const cost = breakdown.total;
    const latencyMs = Math.round(performance.now() - started);
    const streamAllLogs = [...preLogs, ...duringLogs, ...post.logs];
    const streamProfile = profile;
    const streamVirtualKey = virtualKey;
    logRequest(
      {
        profile: profile as never,
        virtualKey: virtualKey as never,
        model: model as never
      },
      {
        endpoint: '/v1/chat/completions',
        streaming: true,
        status: blocked ? 'blocked' : 'success',
        httpStatus: blocked ? 403 : 200,
        errorMessage: null,
        inputTokens,
        outputTokens,
        inputCost: breakdown.inputCost,
        outputCost: breakdown.outputCost,
        cost,
        latencyMs
      },
      async (id) => persistGuardrailLogs(streamAllLogs, {
        profileId: streamProfile.id,
        virtualKeyId: streamVirtualKey.id,
        requestId: id
      })
    );
  };

  // Kick off finalize once the upstream readable is drained. We schedule it via
  // a clone trick: re-consume the stream is impossible here, so instead hook
  // finalization into the background after the response body ends.
  // We use `waitUntil`-style fire-and-forget.
  queueMicrotask(() => {
    // no-op — finalization happens in the tail below
  });

  // Attach finalizer via an async function that observes stream closure.
  return wrapWithFinalizer(response, finalize);
}

function wrapWithFinalizer(res: Response, finalize: () => Promise<void>): Response {
  // Tee the body so we can observe it closing while still streaming to client.
  if (!res.body) {
    finalize();
    return res;
  }
  const [forClient, forFinalize] = res.body.tee();
  (async () => {
    const reader = forFinalize.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      /* ignore */
    } finally {
      await finalize().catch(() => undefined);
    }
  })();
  return new Response(forClient, { status: res.status, headers: res.headers });
}
