/**
 * Model fallback chain controller — pure functions, no React imports.
 * Tries models in order until one succeeds.
 */

export interface FallbackAttempt {
  provider: string;
  model: string;
  error: string;
  status?: number;
}

export interface FallbackCandidate {
  providerId: string;
  modelId: string;
  baseUrl?: string;
}

export interface FallbackResult<T> {
  value: T;
  candidate: FallbackCandidate;
  attempts: FallbackAttempt[];
}

/**
 * Run an async operation with model fallback.
 * Tries each candidate in order; AbortError is re-thrown immediately.
 * On all-fail, throws an aggregated error.
 */
export async function runWithModelFallback<T>(
  candidates: FallbackCandidate[],
  fn: (candidate: FallbackCandidate) => Promise<T>,
  signal?: AbortSignal,
): Promise<FallbackResult<T>> {
  if (candidates.length === 0) {
    throw new Error("No model candidates provided for fallback");
  }

  const attempts: FallbackAttempt[] = [];

  for (const candidate of candidates) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const value = await fn(candidate);
      return { value, candidate, attempts };
    } catch (err: unknown) {
      // AbortError: user cancelled — do not fallback
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }

      const error = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status ?? (err as any)?.statusCode;
      attempts.push({
        provider: candidate.providerId,
        model: candidate.modelId,
        error,
        status: typeof status === "number" ? status : undefined,
      });
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}/${a.model}: ${a.error}`)
    .join(" | ");
  throw new Error(`All models failed (${attempts.length}): ${summary}`);
}

/**
 * Build a fallback candidate list from primary + optional fallbacks.
 */
export function buildFallbackCandidates(
  primary: FallbackCandidate,
  fallbacks: FallbackCandidate[] = [],
): FallbackCandidate[] {
  return [primary, ...fallbacks];
}
