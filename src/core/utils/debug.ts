/**
 * @file Debug utility functions.
 *
 * These helpers are used throughout the codebase for development-time assertions
 * and logging. All functions check the `debug` flag before executing to ensure
 * zero overhead in production builds.
 *
 * The `debug` flag is set once at application startup from the URL query parameter
 * `?debug=1` and passed through {@link AppContext}.
 */

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Log levels for the application logger.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** Prefix applied to all log messages for easy filtering in DevTools. */
const LOG_PREFIX = '[Softgames]';

/**
 * Conditional logger — only emits `info` and `debug` messages when `isDebug` is true.
 * `error` and `warn` always emit regardless of the debug flag.
 *
 * @param level   - Log severity level.
 * @param message - Message string.
 * @param isDebug - Whether the application is running in debug mode.
 * @param args    - Additional values forwarded to console.
 */
export function log(
  level: LogLevel,
  message: string,
  isDebug: boolean,
  ...args: unknown[]
): void {
  if (level === 'info' || level === 'debug') {
    if (!isDebug) return;
  }

  const prefixed = `${LOG_PREFIX} ${message}`;

  switch (level) {
    case 'error':
      console.error(prefixed, ...args);
      break;
    case 'warn':
      console.warn(prefixed, ...args);
      break;
    case 'info':
      console.info(prefixed, ...args);
      break;
    case 'debug':
      console.debug(prefixed, ...args);
      break;
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Development-time assertion.
 * Throws an `Error` if `condition` is false.
 *
 * In production builds this function still runs — it is not stripped by default.
 * Use it for invariants that should never be violated.
 *
 * @param condition - The condition that must be truthy.
 * @param message   - Error message if the assertion fails.
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[Assertion failed] ${message}`);
  }
}

// ---------------------------------------------------------------------------
// URL flag parsing
// ---------------------------------------------------------------------------

/**
 * Read a boolean flag from the URL query string.
 *
 * @param key - Query parameter name (e.g. `'debug'`).
 * @returns `true` if the parameter is present and its value is `'1'` or `'true'`.
 *
 * @example
 * // URL: https://example.com/?debug=1
 * const isDebug = readUrlFlag('debug'); // true
 */
export function readUrlFlag(key: string): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(key);
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}
