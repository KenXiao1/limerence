/**
 * Model selection controller — aliases, parsing, normalization.
 * Pure functions, no React imports.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ModelRef {
  provider: string;
  model: string;
}

// ── Provider normalization ──────────────────────────────────────

const PROVIDER_ALIASES: Record<string, string> = {
  "z.ai": "zai",
  "zai": "zai",
  "qwen": "qwen-portal",
  "qwen-portal": "qwen-portal",
  "dashscope": "qwen-portal",
  "openai": "openai",
  "anthropic": "anthropic",
  "google": "google",
  "gemini": "google",
  "deepseek": "deepseek",
  "mistral": "mistral",
  "groq": "groq",
  "together": "together",
  "fireworks": "fireworks",
  "openrouter": "openrouter",
  "limerence-proxy": "limerence-proxy",
};

export function normalizeProviderId(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return PROVIDER_ALIASES[lower] ?? lower;
}

// ── Model aliases ──────────────────────────────────────────────

/** Default alias index: short names → provider/model */
const DEFAULT_ALIASES: Record<string, string> = {
  // Anthropic
  "opus": "anthropic/claude-opus-4",
  "opus-4": "anthropic/claude-opus-4",
  "sonnet": "anthropic/claude-sonnet-4-5",
  "sonnet-4": "anthropic/claude-sonnet-4-5",
  "sonnet-4.5": "anthropic/claude-sonnet-4-5",
  "haiku": "anthropic/claude-haiku-3-5",
  "haiku-3.5": "anthropic/claude-haiku-3-5",
  // OpenAI
  "gpt4o": "openai/gpt-4o",
  "gpt-4o": "openai/gpt-4o",
  "gpt4o-mini": "openai/gpt-4o-mini",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "o3": "openai/o3",
  "o4-mini": "openai/o4-mini",
  // Google
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-3-flash": "google/gemini-3-flash-preview",
  // DeepSeek
  "deepseek-v3": "deepseek/deepseek-chat",
  "deepseek-r1": "deepseek/deepseek-reasoner",
  // Short aliases
  "fast": "google/gemini-2.5-flash",
  "smart": "anthropic/claude-sonnet-4-5",
  "cheap": "openai/gpt-4o-mini",
};

export type ModelAliasIndex = Record<string, string>;

/**
 * Parse a model reference from a string.
 * Accepts formats:
 *   - "provider/model" → direct parse
 *   - "alias" → look up in alias index
 *   - "model-id" → returned with empty provider (caller must fill)
 */
export function parseModelRef(
  raw: string,
  customAliases: ModelAliasIndex = {},
): ModelRef {
  const trimmed = raw.trim();
  if (!trimmed) return { provider: "", model: "" };

  // Check custom aliases first (case-insensitive)
  const lower = trimmed.toLowerCase();
  const customTarget = customAliases[lower];
  if (customTarget) {
    return splitProviderModel(customTarget);
  }

  // Check default aliases
  const defaultTarget = DEFAULT_ALIASES[lower];
  if (defaultTarget) {
    return splitProviderModel(defaultTarget);
  }

  // Direct provider/model format
  if (trimmed.includes("/")) {
    return splitProviderModel(trimmed);
  }

  // Bare model ID — no provider prefix
  return { provider: "", model: trimmed };
}

function splitProviderModel(ref: string): ModelRef {
  const slashIndex = ref.indexOf("/");
  if (slashIndex === -1) return { provider: "", model: ref };
  return {
    provider: normalizeProviderId(ref.slice(0, slashIndex)),
    model: ref.slice(slashIndex + 1),
  };
}

/**
 * Format a ModelRef back to "provider/model" string.
 */
export function formatModelRef(ref: ModelRef): string {
  if (!ref.provider) return ref.model;
  return `${ref.provider}/${ref.model}`;
}

/**
 * Resolve a model input (which may be an alias) to provider ID and model ID.
 * Returns the resolved values, falling back to defaults if empty.
 */
export function resolveModelInput(
  input: string,
  customAliases: ModelAliasIndex = {},
  defaultProviderId?: string,
): { providerId: string; modelId: string } {
  const ref = parseModelRef(input, customAliases);
  return {
    providerId: ref.provider || defaultProviderId || "",
    modelId: ref.model,
  };
}

// ── Known model context windows ────────────────────────────────

const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic
  "claude-opus-4": 200_000,
  "claude-opus-4-5": 200_000,
  "claude-sonnet-4": 200_000,
  "claude-sonnet-4-5": 200_000,
  "claude-haiku-3-5": 200_000,
  // OpenAI
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
  // Google
  "gemini-2.5-pro": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-3-flash-preview": 1_000_000,
  // DeepSeek
  "deepseek-chat": 128_000,
  "deepseek-reasoner": 128_000,
  // QWen
  "qwen-max": 128_000,
  "qwen-plus": 128_000,
  "qwen-turbo": 128_000,
};

/**
 * Look up the context window size for a model.
 * Returns undefined if unknown.
 */
export function getModelContextWindow(modelId: string): number | undefined {
  return KNOWN_CONTEXT_WINDOWS[modelId];
}

/**
 * Get all default aliases (for display in settings).
 */
export function getDefaultAliases(): ModelAliasIndex {
  return { ...DEFAULT_ALIASES };
}
