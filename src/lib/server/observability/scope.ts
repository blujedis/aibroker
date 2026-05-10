export type ScopeLogLevel = 'info' | 'warn';

import { logger } from './logger.js';

const SCOPE_LOGS_ENABLED =
  process.env.SCOPE_OBSERVABILITY_LOGS !== '0' && process.env.NODE_ENV !== 'test';

const scopeLogger = logger.child({ component: 'scope' });

interface ScopeEventContext {
  [key: string]: string | number | boolean | null | undefined;
}

export function logScopeEvent(
  level: ScopeLogLevel,
  event: string,
  context: ScopeEventContext
): void {
  if (!SCOPE_LOGS_ENABLED) return;

  if (level === 'warn') {
    scopeLogger.warn(event, context);
    return;
  }
  scopeLogger.info(event, context);
}
