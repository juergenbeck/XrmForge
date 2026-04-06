/**
 * Structured logger for D365 form scripts.
 * This is the ONLY file allowed to use console.* directly.
 */

/** Logger interface for structured logging with namespace prefix. */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const DEBUG_STORAGE_KEY = '{namespace}.debug'.toLowerCase();

/** Check if the current host is a dev/test environment. */
function isDebugHost(): boolean {
  try {
    const url = Xrm.Utility.getGlobalContext().getClientUrl() ?? '';
    if (url.includes('-dev') || url.includes('-test')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Check if debug mode is enabled via localStorage. */
function isDebugStorage(): boolean {
  try {
    return window?.localStorage?.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Create a namespaced logger instance.
 *
 * Debug messages are only shown in dev/test environments or when
 * localStorage key is set to '1'.
 *
 * @param namespace - Prefix for all log messages (e.g. 'MyApp.Account')
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  const debugEnabled = isDebugHost() || isDebugStorage();

  return {
    debug(message, data) {
      if (!debugEnabled) return;
      if (data !== undefined) console.debug(prefix, message, data);
      else console.debug(prefix, message);
    },
    info(message, data) {
      if (data !== undefined) console.info(prefix, message, data);
      else console.info(prefix, message);
    },
    warn(message, data) {
      if (data !== undefined) console.warn(prefix, message, data);
      else console.warn(prefix, message);
    },
    error(message, data) {
      if (data !== undefined) console.error(prefix, message, data);
      else console.error(prefix, message);
    },
  };
}
