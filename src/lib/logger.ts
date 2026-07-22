import type { LogLevel } from './types';

// ログレベルで出力を絞る、スコープ付きロガー

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

let currentLevel: LogLevel = 'error';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[UdemyTTS:${scope}]`;
  const enabled = (level: LogLevel) => LEVEL_ORDER[level] <= LEVEL_ORDER[currentLevel];
  return {
    error: (...args) => {
      if (enabled('error')) console.error(prefix, ...args);
    },
    warn: (...args) => {
      if (enabled('warn')) console.warn(prefix, ...args);
    },
    info: (...args) => {
      if (enabled('info')) console.info(prefix, ...args);
    },
    debug: (...args) => {
      if (enabled('debug')) console.debug(prefix, ...args);
    },
  };
}
