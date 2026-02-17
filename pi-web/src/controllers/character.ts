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

type LooseObject = Record<string, unknown>;

function isObject(value: unknown): value is LooseObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toStringField(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function preferPrimaryString(primary: unknown, fallback: unknown): string {
  const primaryStr = toStringField(primary);
  if (primaryStr.trim()) return primaryStr;
  return toStringField(fallback);
}

function toExtensions(value: unknown): Record<string, unknown> {
  if (isObject(value)) return { ...value };
  return {};
}

function normalizeCardData(primary: LooseObject, fallback?: LooseObject): CharacterCard["data"] {
  return {
    name: preferPrimaryString(primary.name, fallback?.name),
    description: preferPrimaryString(primary.description, fallback?.description),
    personality: preferPrimaryString(primary.personality, fallback?.personality),
    scenario: preferPrimaryString(primary.scenario, fallback?.scenario),
    first_mes: preferPrimaryString(primary.first_mes, fallback?.first_mes),
    system_prompt: preferPrimaryString(primary.system_prompt, fallback?.system_prompt),
    mes_example: preferPrimaryString(primary.mes_example, fallback?.mes_example),
    extensions: toExtensions(primary.extensions ?? fallback?.extensions),
  };
}

/**
 * Validate a character card JSON object.
 * Returns the card if valid, or null with an error message.
 */
export function validateCharacterCard(
  data: unknown,
): { card: CharacterCard; error: null } | { card: null; error: string } {
  if (!isObject(data)) {
    return { card: null, error: "无效的 JSON 数据" };
  }

  const obj = data;
  const topLevelName = toStringField(obj.name).trim();

  // SillyTavern V2 format
  if (obj.spec === "chara_card_v2" && isObject(obj.data)) {
    const cardData = normalizeCardData(obj.data, obj);
    if (!cardData.name.trim() && topLevelName) cardData.name = topLevelName;
    if (!cardData.name.trim()) {
      return { card: null, error: "角色卡缺少名字 (data.name)" };
    }
    return {
      card: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: cardData,
      },
      error: null,
    };
  }

  // SillyTavern V3 format — normalize to V2 (V3 data is a superset of V2)
  if (obj.spec === "chara_card_v3") {
    const source = isObject(obj.data) ? obj.data : obj;
    const cardData = normalizeCardData(source, obj);
    if (!cardData.name.trim() && topLevelName) cardData.name = topLevelName;
    if (!cardData.name.trim()) {
      return { card: null, error: "角色卡缺少名字 (data.name)" };
    }
    return {
      card: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: cardData,
      },
      error: null,
    };
  }

  // Simple format: just has name + description at top level
  if (topLevelName) {
    const card: CharacterCard = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: normalizeCardData(obj),
    };
    return { card, error: null };
  }

  return { card: null, error: "无法识别的角色卡格式（需要 SillyTavern V2/V3 或包含 name 字段）" };
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
 * Load a character card from a JSON file.
 * Reads the file, validates, and returns a CharacterEntry or null.
 */
export async function loadCharacterFromFile(file: File): Promise<CharacterEntry | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const { card, error } = validateCharacterCard(data);
    if (error || !card) {
      console.error("[CharImport]", error);
      return null;
    }
    return createCharacterEntry(card);
  } catch (err) {
    console.error("[CharImport] Failed to read file:", err);
    return null;
  }
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
