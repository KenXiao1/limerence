/**
 * Prompt preset controller — SillyTavern-style prompt ordering and management.
 * Pure functions, no global state references.
 */

export interface PromptSegment {
  identifier: string;
  name: string;
  content: string;
  role: "system" | "user" | "assistant";
  enabled: boolean;
  marker: boolean;
  injection_depth: number;
}

export interface PromptPresetConfig {
  id: string;
  name: string;
  segments: PromptSegment[];
}

export const PROMPT_PRESETS_KEY = "limerence.prompt_presets";
export const ACTIVE_PROMPT_PRESET_KEY = "limerence.active_prompt_preset";

/**
 * Import a SillyTavern preset JSON and convert to PromptPresetConfig.
 * Validates structure, applies prompt_order sorting.
 */
export function importSTPreset(data: unknown): { preset?: PromptPresetConfig; error?: string } {
  if (!data || typeof data !== "object") {
    return { error: "无效的预设数据" };
  }

  const obj = data as Record<string, unknown>;
  const prompts = obj.prompts;
  if (!Array.isArray(prompts)) {
    return { error: "预设缺少 prompts 数组" };
  }

  // Parse prompts into segments
  const segmentMap = new Map<string, PromptSegment>();
  for (const p of prompts) {
    if (!p || typeof p !== "object") continue;
    const seg = p as Record<string, unknown>;
    const identifier = String(seg.identifier ?? "");
    if (!identifier) continue;

    segmentMap.set(identifier, {
      identifier,
      name: String(seg.name ?? ""),
      content: String(seg.content ?? ""),
      role: normalizeRole(seg.role),
      enabled: seg.enabled !== false,
      marker: seg.marker === true,
      injection_depth: typeof seg.injection_depth === "number" ? seg.injection_depth : 0,
    });
  }

  // Apply prompt_order if present
  const promptOrder = obj.prompt_order;
  let orderedSegments: PromptSegment[];

  if (Array.isArray(promptOrder) && promptOrder.length > 0) {
    const firstEntry = promptOrder[0] as Record<string, unknown>;
    const order = firstEntry?.order;

    if (Array.isArray(order)) {
      orderedSegments = [];
      const seen = new Set<string>();

      for (const item of order) {
        if (!item || typeof item !== "object") continue;
        const entry = item as Record<string, unknown>;
        const id = String(entry.identifier ?? "");
        const seg = segmentMap.get(id);
        if (!seg) continue;

        // prompt_order can override enabled state
        const orderEnabled = entry.enabled;
        orderedSegments.push({
          ...seg,
          enabled: typeof orderEnabled === "boolean" ? orderEnabled : seg.enabled,
        });
        seen.add(id);
      }

      // Append any prompts not in the order
      for (const [id, seg] of segmentMap) {
        if (!seen.has(id)) orderedSegments.push(seg);
      }
    } else {
      orderedSegments = [...segmentMap.values()];
    }
  } else {
    orderedSegments = [...segmentMap.values()];
  }

  // Derive a name from the data or use a default
  const presetName = derivePresetName(obj);

  return {
    preset: {
      id: crypto.randomUUID(),
      name: presetName,
      segments: orderedSegments,
    },
  };
}

/**
 * Export a preset in pi-web's own format.
 */
export function exportPreset(preset: PromptPresetConfig): object {
  return {
    version: 1,
    format: "limerence-prompt-preset",
    ...preset,
  };
}

/**
 * Toggle a segment's enabled state. Returns a new preset.
 */
export function toggleSegment(preset: PromptPresetConfig, segmentId: string): PromptPresetConfig {
  return {
    ...preset,
    segments: preset.segments.map((s) =>
      s.identifier === segmentId ? { ...s, enabled: !s.enabled } : s,
    ),
  };
}

/**
 * Create a new preset from scratch.
 */
export function createPromptPreset(name: string, segments: PromptSegment[]): PromptPresetConfig {
  return {
    id: crypto.randomUUID(),
    name,
    segments,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function normalizeRole(role: unknown): "system" | "user" | "assistant" {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  return "system";
}

function derivePresetName(obj: Record<string, unknown>): string {
  // Try common name fields
  if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  if (typeof obj.preset_name === "string" && obj.preset_name.trim()) return obj.preset_name.trim();

  // Count non-marker prompts as a fallback name
  const prompts = obj.prompts as unknown[];
  const count = prompts.filter((p: any) => !p?.marker).length;
  return `ST 预设 (${count} 条)`;
}
