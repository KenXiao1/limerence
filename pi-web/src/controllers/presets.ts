/**
 * Generation presets controller — pure functions for managing LLM generation parameters.
 * No global state references.
 */

export interface GenerationPreset {
  id: string;
  name: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export const DEFAULT_PRESET: GenerationPreset = {
  id: "default",
  name: "默认",
  temperature: 0.8,
  topP: 1.0,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export const CREATIVE_PRESET: GenerationPreset = {
  id: "creative",
  name: "创意写作",
  temperature: 1.2,
  topP: 0.95,
  maxTokens: 8192,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
};

export const PRECISE_PRESET: GenerationPreset = {
  id: "precise",
  name: "精确回答",
  temperature: 0.3,
  topP: 0.8,
  maxTokens: 2048,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export const BUILTIN_PRESETS: GenerationPreset[] = [
  DEFAULT_PRESET,
  CREATIVE_PRESET,
  PRECISE_PRESET,
];

export const PRESETS_SETTINGS_KEY = "limerence.generation_presets";
export const ACTIVE_PRESET_KEY = "limerence.active_preset";

/**
 * Create a new custom preset.
 */
export function createPreset(name: string, base?: Partial<GenerationPreset>): GenerationPreset {
  return {
    id: crypto.randomUUID(),
    name,
    temperature: base?.temperature ?? DEFAULT_PRESET.temperature,
    topP: base?.topP ?? DEFAULT_PRESET.topP,
    maxTokens: base?.maxTokens ?? DEFAULT_PRESET.maxTokens,
    frequencyPenalty: base?.frequencyPenalty ?? DEFAULT_PRESET.frequencyPenalty,
    presencePenalty: base?.presencePenalty ?? DEFAULT_PRESET.presencePenalty,
  };
}

/**
 * Validate preset parameter ranges.
 */
export function clampPreset(preset: GenerationPreset): GenerationPreset {
  return {
    ...preset,
    temperature: Math.max(0, Math.min(2, preset.temperature)),
    topP: Math.max(0, Math.min(1, preset.topP)),
    maxTokens: Math.max(1, Math.min(128000, Math.round(preset.maxTokens))),
    frequencyPenalty: Math.max(-2, Math.min(2, preset.frequencyPenalty)),
    presencePenalty: Math.max(-2, Math.min(2, preset.presencePenalty)),
  };
}
