export interface CharacterCard {
  spec: string;
  spec_version: string;
  data: CharacterData;
}

export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  system_prompt: string;
  mes_example: string;
  extensions: Record<string, unknown>;
}

// ── Persona ────────────────────────────────────────────────────

export interface Persona {
  name: string;
  description: string;
}

export const PERSONA_SETTINGS_KEY = "limerence.persona";

// ── Template variables ─────────────────────────────────────────

/**
 * Replace {{char}}, {{user}}, and other template variables in text.
 */
export function applyTemplateVars(
  text: string,
  charName: string,
  userName: string,
): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{character\}\}/gi, charName)
    .replace(/\{\{persona\}\}/gi, userName);
}

// ── System prompt builder ──────────────────────────────────────

export function buildSystemPrompt(
  card: CharacterCard,
  persona?: Persona,
): string {
  const d = card.data;
  const charName = d.name;
  const userName = persona?.name || "用户";
  const parts: string[] = [];

  if (d.system_prompt) {
    parts.push(applyTemplateVars(d.system_prompt, charName, userName));
  }

  parts.push(`你的名字是${charName}。`);

  if (d.description) {
    parts.push(`角色描述：${applyTemplateVars(d.description, charName, userName)}`);
  }
  if (d.personality) {
    parts.push(`性格特征：${applyTemplateVars(d.personality, charName, userName)}`);
  }
  if (d.scenario) {
    parts.push(`场景设定：${applyTemplateVars(d.scenario, charName, userName)}`);
  }
  if (d.mes_example) {
    parts.push(`对话示例：\n${applyTemplateVars(d.mes_example, charName, userName)}`);
  }

  // Persona injection
  if (persona?.name || persona?.description) {
    const personaParts: string[] = [];
    if (persona.name) personaParts.push(`用户的名字是${persona.name}。`);
    if (persona.description) personaParts.push(`用户描述：${persona.description}`);
    parts.push(personaParts.join("\n"));
  }

  parts.push(
    `你可以使用以下工具来增强对话体验：
- memory_search：搜索与${userName}的历史对话记忆
- web_search：搜索互联网获取实时信息
- note_write：写入持久化笔记，记录${userName}的重要信息
- note_read：读取之前写的笔记
- file_read：读取工作区文件
- file_write：在工作区创建或写入文件

主动使用 memory_search 回忆${userName}之前提到的事情。
用 note_write 记录${userName}的重要信息（偏好、经历、情绪状态等）。`,
  );

  return parts.join("\n\n");
}

// ── Preset-driven system prompt builder ───────────────────

import type { PromptPresetConfig } from "../controllers/prompt-presets";

/**
 * Build system prompt from a PromptPresetConfig.
 * Expands markers to character card fields, wraps non-system roles with labels,
 * and appends tool instructions at the end.
 */
export function buildSystemPromptFromPreset(
  preset: PromptPresetConfig,
  card: CharacterCard,
  persona?: Persona,
  lorebookInjection?: string,
  toolInstructions?: string,
): string {
  const d = card.data;
  const charName = d.name;
  const userName = persona?.name || "用户";
  const parts: string[] = [];

  for (const seg of preset.segments) {
    if (!seg.enabled) continue;

    // Marker segments expand to character card fields
    if (seg.marker) {
      const expanded = expandMarker(seg.identifier, card, persona, lorebookInjection);
      if (expanded !== null) parts.push(expanded);
      continue;
    }

    // Skip empty content
    if (!seg.content.trim()) continue;

    let text = applyTemplateVars(seg.content, charName, userName);

    // Wrap non-system roles
    if (seg.role === "user") {
      text = `[User]: ${text}`;
    } else if (seg.role === "assistant") {
      text = `[Assistant]: ${text}`;
    }

    parts.push(text);
  }

  // Append tool instructions (reuse existing logic)
  if (toolInstructions) {
    parts.push(toolInstructions);
  } else {
    parts.push(buildToolInstructions(userName));
  }

  return parts.join("\n\n");
}

function expandMarker(
  identifier: string,
  card: CharacterCard,
  persona?: Persona,
  lorebookInjection?: string,
): string | null {
  const d = card.data;
  const charName = d.name;
  const userName = persona?.name || "用户";

  switch (identifier) {
    case "charDescription":
      return d.description ? applyTemplateVars(d.description, charName, userName) : null;
    case "charPersonality":
      return d.personality ? applyTemplateVars(d.personality, charName, userName) : null;
    case "scenario":
      return d.scenario ? applyTemplateVars(d.scenario, charName, userName) : null;
    case "dialogueExamples":
      return d.mes_example ? applyTemplateVars(d.mes_example, charName, userName) : null;
    case "personaDescription":
      if (persona?.name || persona?.description) {
        const pp: string[] = [];
        if (persona.name) pp.push(`用户的名字是${persona.name}。`);
        if (persona.description) pp.push(`用户描述：${persona.description}`);
        return pp.join("\n");
      }
      return null;
    case "worldInfoBefore":
    case "worldInfoAfter":
      return lorebookInjection || null;
    case "chatHistory":
      // Managed by pi-agent-core, skip
      return null;
    default:
      return null;
  }
}

function buildToolInstructions(userName: string): string {
  return `你可以使用以下工具来增强对话体验：
- memory_search：搜索与${userName}的历史对话记忆
- web_search：搜索互联网获取实时信息
- note_write：写入持久化笔记，记录${userName}的重要信息
- note_read：读取之前写的笔记
- file_read：读取工作区文件
- file_write：在工作区创建或写入文件

主动使用 memory_search 回忆${userName}之前提到的事情。
用 note_write 记录${userName}的重要信息（偏好、经历、情绪状态等）。`;
}

export async function loadDefaultCharacter(): Promise<CharacterCard> {
  const resp = await fetch("/default_character.json");
  if (!resp.ok) {
    throw new Error(`加载默认角色失败: ${resp.status}`);
  }
  return resp.json();
}
