import { and, eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { isResourceAccessibleToProfile } from '../scope.js';
import type { Guardrail } from '../db/schema.js';

export type GuardrailStage = 'pre' | 'during' | 'post';

export interface GuardrailContext {
  profileId: string | null;
  virtualKeyId: string | null;
  requestId?: string | null;
}

export interface GuardrailOutcome {
  action: 'allow' | 'redact' | 'block';
  reason?: string;
  /** If redact, the replacement text / payload. */
  payload?: unknown;
}

export type ChatMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
};

// ───────────────────────────────────────────────────────────────
// Kind implementations
// ───────────────────────────────────────────────────────────────

function messagesToText(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content))
        return m.content
          .map((p) => (typeof p === 'string' ? p : (p?.text ?? '')))
          .join(' ');
      return '';
    })
    .join('\n');
}

function applyTextTransform(
  messages: ChatMessage[],
  transform: (text: string) => string
): ChatMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { ...m, content: transform(m.content) };
    if (Array.isArray(m.content))
      return {
        ...m,
        content: m.content.map((p) =>
          typeof p === 'object' && p && 'text' in p && typeof p.text === 'string'
            ? { ...p, text: transform(p.text) }
            : p
        )
      };
    return m;
  });
}

interface RegexBlockCfg {
  pattern: string;
  flags?: string;
  reason?: string;
}
interface RegexRedactCfg {
  pattern: string;
  flags?: string;
  replacement?: string;
}
interface KeywordBlockCfg {
  keywords: string[];
  reason?: string;
}
interface MaxTokensCfg {
  maxInputChars: number;
}
interface PiiRedactCfg {
  redactEmail?: boolean;
  redactPhone?: boolean;
  redactCreditCard?: boolean;
}

function parseConfig<T>(g: Guardrail, fallback: T): T {
  try {
    const parsed = JSON.parse(g.config);
    return { ...fallback, ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

// ───────────────────────────────────────────────────────────────
// Stage execution
// ───────────────────────────────────────────────────────────────

export interface PreStageInput {
  messages: ChatMessage[];
  model: string;
  profileId?: string | null;
}

export interface PreStageResult {
  outcome: GuardrailOutcome;
  messages: ChatMessage[];
  logs: InternalGuardrailLog[];
}

export interface PostStageInput {
  responseText: string;
  profileId?: string | null;
}

export interface PostStageResult {
  outcome: GuardrailOutcome;
  responseText: string;
  logs: InternalGuardrailLog[];
}

interface InternalGuardrailLog {
  guardrailId: string;
  guardrailName: string;
  stage: GuardrailStage;
  action: 'allow' | 'redact' | 'block';
  latencyMs: number;
  reason: string | null;
}

export function loadGuardrails(stage: GuardrailStage, profileId?: string | null): Guardrail[] {
  const guardrails = db
    .select()
    .from(schema.guardrails)
    .where(eq(schema.guardrails.enabled, true))
    .all();

  // Filter by stage
  let filtered = guardrails.filter((g) => g.stage === stage);

  // Filter by profile scope if profileId provided
  if (profileId !== undefined && profileId !== null) {
    filtered = filtered.filter((g) => isResourceAccessibleToProfile(g.profileId, profileId));
  }

  return filtered.sort((a, b) => a.priority - b.priority);
}

export function runPreStage(input: PreStageInput): PreStageResult {
  const logs: InternalGuardrailLog[] = [];
  let messages = input.messages;

  for (const g of loadGuardrails('pre', input.profileId)) {
    const started = performance.now();
    let action: 'allow' | 'redact' | 'block' = 'allow';
    let reason: string | null = null;

    try {
      if (g.kind === 'regex_block') {
        const cfg = parseConfig<RegexBlockCfg>(g, { pattern: '' });
        if (cfg.pattern) {
          const re = new RegExp(cfg.pattern, cfg.flags ?? 'i');
          if (re.test(messagesToText(messages))) {
            action = 'block';
            reason = cfg.reason ?? 'Blocked by regex guardrail';
          }
        }
      } else if (g.kind === 'regex_redact') {
        const cfg = parseConfig<RegexRedactCfg>(g, { pattern: '' });
        if (cfg.pattern) {
          const re = new RegExp(cfg.pattern, cfg.flags ?? 'gi');
          const replacement = cfg.replacement ?? '[REDACTED]';
          let changed = false;
          messages = applyTextTransform(messages, (t) => {
            const nt = t.replace(re, replacement);
            if (nt !== t) changed = true;
            return nt;
          });
          if (changed) {
            action = 'redact';
            reason = 'Redacted by regex guardrail';
          }
        }
      } else if (g.kind === 'keyword_block') {
        const cfg = parseConfig<KeywordBlockCfg>(g, { keywords: [] });
        const text = messagesToText(messages).toLowerCase();
        const hit = cfg.keywords.find((k) => text.includes(k.toLowerCase()));
        if (hit) {
          action = 'block';
          reason = cfg.reason ?? `Blocked by keyword: ${hit}`;
        }
      } else if (g.kind === 'max_tokens') {
        const cfg = parseConfig<MaxTokensCfg>(g, { maxInputChars: 20000 });
        if (messagesToText(messages).length > cfg.maxInputChars) {
          action = 'block';
          reason = `Input exceeds configured limit (${cfg.maxInputChars} chars)`;
        }
      } else if (g.kind === 'pii_redact') {
        const cfg = parseConfig<PiiRedactCfg>(g, {
          redactEmail: true,
          redactPhone: true,
          redactCreditCard: true
        });
        let changed = false;
        messages = applyTextTransform(messages, (t) => {
          let out = t;
          if (cfg.redactEmail)
            out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED_EMAIL]');
          if (cfg.redactPhone)
            out = out.replace(
              /(\+?\d[\d\s().-]{7,}\d)/g,
              '[REDACTED_PHONE]'
            );
          if (cfg.redactCreditCard)
            out = out.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CC]');
          if (out !== t) changed = true;
          return out;
        });
        if (changed) {
          action = 'redact';
          reason = 'PII redaction applied';
        }
      }
    } catch (e) {
      action = 'allow';
      reason = `Guardrail error: ${(e as Error).message}`;
    }

    const latencyMs = Math.round(performance.now() - started);
    logs.push({
      guardrailId: g.id,
      guardrailName: g.name,
      stage: 'pre',
      action,
      latencyMs,
      reason
    });

    if (action === 'block') {
      return {
        outcome: { action: 'block', reason: reason ?? 'Blocked' },
        messages,
        logs
      };
    }
  }

  return { outcome: { action: 'allow' }, messages, logs };
}

export function runPostStage(input: PostStageInput): PostStageResult {
  const logs: InternalGuardrailLog[] = [];
  let responseText = input.responseText;

  for (const g of loadGuardrails('post', input.profileId)) {
    const started = performance.now();
    let action: 'allow' | 'redact' | 'block' = 'allow';
    let reason: string | null = null;

    try {
      if (g.kind === 'regex_redact') {
        const cfg = parseConfig<RegexRedactCfg>(g, { pattern: '' });
        if (cfg.pattern) {
          const re = new RegExp(cfg.pattern, cfg.flags ?? 'gi');
          const replacement = cfg.replacement ?? '[REDACTED]';
          const next = responseText.replace(re, replacement);
          if (next !== responseText) {
            responseText = next;
            action = 'redact';
            reason = 'Response redacted by regex guardrail';
          }
        }
      } else if (g.kind === 'pii_redact') {
        const cfg = parseConfig<PiiRedactCfg>(g, {
          redactEmail: true,
          redactPhone: true,
          redactCreditCard: true
        });
        let next = responseText;
        if (cfg.redactEmail)
          next = next.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED_EMAIL]');
        if (cfg.redactPhone)
          next = next.replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[REDACTED_PHONE]');
        if (cfg.redactCreditCard)
          next = next.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CC]');
        if (next !== responseText) {
          responseText = next;
          action = 'redact';
          reason = 'Response PII redacted';
        }
      }
    } catch (e) {
      action = 'allow';
      reason = `Guardrail error: ${(e as Error).message}`;
    }

    const latencyMs = Math.round(performance.now() - started);
    logs.push({
      guardrailId: g.id,
      guardrailName: g.name,
      stage: 'post',
      action,
      latencyMs,
      reason
    });
  }

  return { outcome: { action: 'allow' }, responseText, logs };
}

// During-stage: inspects individual streaming chunks. Returns transformed text and
// optional block signal.
export function runDuringChunk(chunk: string, profileId?: string | null): { text: string; block: boolean; logs: InternalGuardrailLog[] } {
  const logs: InternalGuardrailLog[] = [];
  let text = chunk;
  let block = false;
  for (const g of loadGuardrails('during', profileId)) {
    const started = performance.now();
    let action: 'allow' | 'redact' | 'block' = 'allow';
    let reason: string | null = null;
    try {
      if (g.kind === 'regex_block') {
        const cfg = parseConfig<RegexBlockCfg>(g, { pattern: '' });
        if (cfg.pattern) {
          const re = new RegExp(cfg.pattern, cfg.flags ?? 'i');
          if (re.test(text)) {
            action = 'block';
            reason = cfg.reason ?? 'Blocked mid-stream by regex guardrail';
            block = true;
          }
        }
      } else if (g.kind === 'regex_redact') {
        const cfg = parseConfig<RegexRedactCfg>(g, { pattern: '' });
        if (cfg.pattern) {
          const re = new RegExp(cfg.pattern, cfg.flags ?? 'gi');
          const replacement = cfg.replacement ?? '[REDACTED]';
          const next = text.replace(re, replacement);
          if (next !== text) {
            text = next;
            action = 'redact';
            reason = 'Stream redacted';
          }
        }
      }
    } catch (e) {
      reason = `Guardrail error: ${(e as Error).message}`;
    }
    const latencyMs = Math.round(performance.now() - started);
    logs.push({
      guardrailId: g.id,
      guardrailName: g.name,
      stage: 'during',
      action,
      latencyMs,
      reason
    });
    if (block) break;
  }
  return { text, block, logs };
}

// ───────────────────────────────────────────────────────────────
// Persist logs
// ───────────────────────────────────────────────────────────────
export function persistGuardrailLogs(
  entries: InternalGuardrailLog[],
  ctx: GuardrailContext
): void {
  if (entries.length === 0) return;
  for (const e of entries) {
    db.insert(schema.guardrailLogs)
      .values({
        id: nanoid(),
        guardrailId: e.guardrailId,
        guardrailName: e.guardrailName,
        stage: e.stage,
        requestId: ctx.requestId ?? null,
        profileId: ctx.profileId,
        virtualKeyId: ctx.virtualKeyId,
        action: e.action,
        latencyMs: e.latencyMs,
        reason: e.reason
      })
      .run();
  }
}
