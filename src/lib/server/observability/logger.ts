export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

export interface ServerLogger {
  child(bindings: LogFields): ServerLogger;
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const REDACTED = '[REDACTED]';
const DEFAULT_REDACT = process.env.LOG_REDACT_SENSITIVE !== '0';

function normalizeLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_LEVEL = normalizeLevel(process.env.LOG_LEVEL);

const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie'
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((part) => normalized.includes(part));
}

function serializeError(value: Error): LogFields {
  const out: LogFields = {
    name: value.name,
    message: value.message
  };
  if (value.stack) out.stack = value.stack;
  const withCause = value as Error & { cause?: unknown };
  if (withCause.cause) out.cause = serializeValue(withCause.cause, 1);
  return out;
}

function serializeValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return '[Truncated]';
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => serializeValue(item, depth + 1));
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (DEFAULT_REDACT && isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = serializeValue(nested, depth + 1);
  }
  return out;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[MIN_LEVEL];
}

function emit(level: LogLevel, payload: LogFields): void {
  if (!shouldLog(level)) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload
  });
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

function mergeFields(base: LogFields, fields?: LogFields): LogFields {
  if (!fields) return { ...base };
  return {
    ...base,
    ...(serializeValue(fields) as LogFields)
  };
}

function createLogger(bindings: LogFields): ServerLogger {
  return {
    child(childBindings: LogFields): ServerLogger {
      return createLogger(mergeFields(bindings, childBindings));
    },
    debug(event: string, fields?: LogFields): void {
      emit('debug', {
        ...mergeFields(bindings, fields),
        event
      });
    },
    info(event: string, fields?: LogFields): void {
      emit('info', {
        ...mergeFields(bindings, fields),
        event
      });
    },
    warn(event: string, fields?: LogFields): void {
      emit('warn', {
        ...mergeFields(bindings, fields),
        event
      });
    },
    error(event: string, fields?: LogFields): void {
      emit('error', {
        ...mergeFields(bindings, fields),
        event
      });
    }
  };
}

export const logger = createLogger({
  service: 'aibroker',
  env: process.env.NODE_ENV ?? 'development'
});
