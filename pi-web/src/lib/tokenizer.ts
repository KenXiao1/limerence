/**
 * Precise token counting via js-tiktoken.
 * Lazy-loads the encoding to avoid blocking initial page load.
 * Falls back to estimation if encoding fails to load.
 */

import { encodingForModel } from "js-tiktoken";

let _encoder: ReturnType<typeof encodingForModel> | null = null;
let _loadFailed = false;

/**
 * Get or lazily initialize the tiktoken encoder.
 * Uses cl100k_base (GPT-4 / Claude compatible).
 */
function getEncoder() {
  if (_encoder) return _encoder;
  if (_loadFailed) return null;

  try {
    _encoder = encodingForModel("gpt-4o");
    return _encoder;
  } catch {
    _loadFailed = true;
    return null;
  }
}

// ── Fallback estimation (same as before) ────────────────────────

const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g;

function estimateFallback(text: string): number {
  const cjkCount = (text.match(CJK_RANGE) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount * 1.5 + otherCount * 0.25);
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Count tokens precisely using tiktoken, with fallback to estimation.
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  if (enc) {
    try {
      return enc.encode(text).length;
    } catch {
      return estimateFallback(text);
    }
  }
  return estimateFallback(text);
}

/**
 * Whether precise counting is available.
 */
export function isPreciseCountingAvailable(): boolean {
  return getEncoder() !== null;
}
