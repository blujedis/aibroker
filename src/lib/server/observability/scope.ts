export type ScopeLogLevel = 'info' | 'warn';

const SCOPE_LOGS_ENABLED =
  process.env.SCOPE_OBSERVABILITY_LOGS !== '0' && process.env.NODE_ENV !== 'test';

interface ScopeEventContext {
  [key: string]: string | number | boolean | null | undefined;
}

export function logScopeEvent(
  level: ScopeLogLevel,
  event: string,
  context: ScopeEventContext
): void {
  if (!SCOPE_LOGS_ENABLED) return;

  const payload = {
    at: new Date().toISOString(),
    event,
    ...context
  };

  const message = `[aibroker.scope] ${JSON.stringify(payload)}`;
  if (level === 'warn') {
    console.warn(message);
    return;
  }
  console.info(message);
}
