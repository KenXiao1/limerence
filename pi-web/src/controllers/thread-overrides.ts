/**
 * Thread overrides controller — per-thread model and thinking level settings.
 * Pure functions, no React imports.
 */

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface ThreadOverrides {
  modelId?: string;
  providerId?: string;
  baseUrl?: string;
  thinkingLevel?: ThinkingLevel;
}

export const THREAD_OVERRIDES_STORE = "limerence:thread-overrides";

/** Map thinking level to budget tokens for different providers. */
export function thinkingBudgetTokens(level: ThinkingLevel): number {
  switch (level) {
    case "off": return 0;
    case "low": return 1024;
    case "medium": return 4096;
    case "high": return 16384;
  }
}

/** Merge global config with per-thread overrides. Thread values win. */
export function mergeOverrides(
  global: { modelId: string; providerId: string; baseUrl?: string },
  thread?: ThreadOverrides,
): { modelId: string; providerId: string; baseUrl?: string; thinkingLevel: ThinkingLevel } {
  if (!thread) return { ...global, thinkingLevel: "off" };
  return {
    modelId: thread.modelId || global.modelId,
    providerId: thread.providerId || global.providerId,
    baseUrl: thread.baseUrl || global.baseUrl,
    thinkingLevel: thread.thinkingLevel ?? "off",
  };
}
