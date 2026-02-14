/**
 * Character management controller — pure functions for character CRUD.
 * No global state references.
 */

import type { CharacterCard } from "../lib/character";

// ── Types ──────────────────────────────────────────────────────

export interface CharacterEntry {
  id: string;
  name: string;
  description: string;
  card: CharacterCard;
  addedAt: string;
}

// ── Validation ─────────────────────────────────────────────────

/**
 * Validate a character card JSON object.
 * Returns the card if valid, or null with an error message.
 */
export function validateCharacterCard(
  data: unknown,
): { card: CharacterCard; error: null } | { card: null; error: string } {
  if (!data || typeof data !== "object") {
    return { card: null, error: "无效的 JSON 数据" };
  }

  const obj = data as Record<string, unknown>;

  // SillyTavern V2 format
  if (obj.spec === "chara_card_v2" && obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    if (typeof d.name !== "string" || !d.name.trim()) {
      return { card: null, error: "角色卡缺少名字 (data.name)" };
    }
    return { card: data as CharacterCard, error: null };
  }

  // Simple format: just has name + description at top level
  if (typeof obj.name === "string" && obj.name.trim()) {
    const card: CharacterCard = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: String(obj.name),
        description: String(obj.description ?? ""),
        personality: String(obj.personality ?? ""),
        scenario: String(obj.scenario ?? ""),
        first_mes: String(obj.first_mes ?? ""),
        system_prompt: String(obj.system_prompt ?? ""),
        mes_example: String(obj.mes_example ?? ""),
        extensions: (obj.extensions as Record<string, unknown>) ?? {},
      },
    };
    return { card, error: null };
  }

  return { card: null, error: "无法识别的角色卡格式（需要 SillyTavern V2 或包含 name 字段）" };
}

/**
 * Create a CharacterEntry from a validated card.
 */
export function createCharacterEntry(card: CharacterCard): CharacterEntry {
  return {
    id: crypto.randomUUID(),
    name: card.data.name,
    description: card.data.description.slice(0, 200),
    card,
    addedAt: new Date().toISOString(),
  };
}

/**
 * Extract a short preview from a character card.
 */
export function characterPreview(card: CharacterCard): string {
  const d = card.data;
  const parts: string[] = [];
  if (d.personality) parts.push(d.personality.slice(0, 80));
  else if (d.description) parts.push(d.description.slice(0, 80));
  if (d.scenario) parts.push(d.scenario.slice(0, 60));
  return parts.join(" · ") || "无描述";
}
