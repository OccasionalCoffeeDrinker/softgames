/**
 * @file Magic Words — API fetch service.
 *
 * Wraps the single GET /v2/magicwords request with:
 *  - AbortController timeout (configurable via AppConfig.API_TIMEOUT_MS).
 *  - Runtime type guard validation.
 *  - Typed error class for clean error handling in the scene.
 */

import { AppConfig } from '@app/config/AppConfig';
import { isMagicWordsResponse, type MagicWordsResponse } from './types';

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class MagicWordsApiError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MagicWordsApiError';
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the Magic Words dialogue payload.
 *
 * @throws {MagicWordsApiError} on network failure, timeout, or invalid shape.
 */
export async function fetchMagicWords(): Promise<MagicWordsResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => { controller.abort(); },
    AppConfig.API_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(AppConfig.MAGIC_WORDS_API_URL, {
      signal: controller.signal,
    });
  } catch (err) {
    throw new MagicWordsApiError(
      err instanceof Error && err.name === 'AbortError'
        ? `API request timed out after ${AppConfig.API_TIMEOUT_MS} ms`
        : `Network error: ${String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new MagicWordsApiError(
      `API responded with HTTP ${response.status} ${response.statusText}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new MagicWordsApiError('API response was not valid JSON');
  }

  if (!isMagicWordsResponse(json)) {
    throw new MagicWordsApiError('API response shape does not match expected schema');
  }

  return json;
}
