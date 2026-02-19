/**
 * Context window guard controller — model-adaptive context window management.
 * Pure functions, no React imports.
 */

import { getModelContextWindow } from "./model-selection";

// ── Types ──────────────────────────────────────────────────────

export interface ContextWindowGuardResult {
  /** Effective context window size */
  contextWindow: number;
  /** Source of the context window value */
  source: "model-known" | "thread-override" | "default";
  /** Should the user be warned about small context? */
  shouldWarn: boolean;
  /** Should generation be blocked (context too small)? */
  shouldBlock: boolean;
  /** Warning message if applicable */
  warningMessage?: string;
}

// ── Thresholds ─────────────────────────────────────────────────

const WARN_THRESHOLD = 32_000;
const BLOCK_THRESHOLD = 16_000;
const DEFAULT_CONTEXT_WINDOW = 128_000;

// ── Guard evaluation ───────────────────────────────────────────

/**
 * Evaluate context window guard for a given model and configuration.
 * Returns the effective context window and any warnings.
 */
export function evaluateContextWindowGuard(
  modelId: string,
  threadContextTokensOverride?: number,
): ContextWindowGuardResult {
  // Priority: thread override > model-known > default
  let contextWindow: number;
  let source: ContextWindowGuardResult["source"];

  if (threadContextTokensOverride && threadContextTokensOverride > 0) {
    contextWindow = threadContextTokensOverride;
    source = "thread-override";
  } else {
    const known = getModelContextWindow(modelId);
    if (known) {
      contextWindow = known;
      source = "model-known";
    } else {
      contextWindow = DEFAULT_CONTEXT_WINDOW;
      source = "default";
    }
  }

  const shouldBlock = contextWindow < BLOCK_THRESHOLD;
  const shouldWarn = !shouldBlock && contextWindow < WARN_THRESHOLD;

  let warningMessage: string | undefined;
  if (shouldBlock) {
    warningMessage = `模型上下文窗口过小 (${formatTokens(contextWindow)})，可能无法正常对话。建议切换到上下文更大的模型。`;
  } else if (shouldWarn) {
    warningMessage = `模型上下文窗口较小 (${formatTokens(contextWindow)})，长对话可能被截断。`;
  }

  return { contextWindow, source, shouldWarn, shouldBlock, warningMessage };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/**
 * Get the effective context window for budget calculations.
 * Convenience wrapper that returns just the number.
 */
export function getEffectiveContextWindow(
  modelId: string,
  threadContextTokensOverride?: number,
): number {
  return evaluateContextWindowGuard(modelId, threadContextTokensOverride).contextWindow;
}
