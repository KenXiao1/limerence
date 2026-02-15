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

// ── Memory injection ──────────────────────────────────────────

const MEMORY_INJECTION_MAX_CHARS = 3000;

function truncateFromHead(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return "...\n" + text.slice(text.length - maxChars);
}

/**
 * Build memory context injection text from PROFILE.md and MEMORY.md contents.
 */
export function buildMemoryInjection(
  profileContent: string | null,
  memoryContent: string | null,
  userName: string,
): string | null {
  const parts: string[] = [];

  if (profileContent?.trim()) {
    const truncated = truncateFromHead(profileContent.trim(), MEMORY_INJECTION_MAX_CHARS);
    parts.push(`[${userName}的记忆档案]\n${truncated}`);
  }

  if (memoryContent?.trim()) {
    const truncated = truncateFromHead(memoryContent.trim(), MEMORY_INJECTION_MAX_CHARS);
    parts.push(`[长期记忆摘要]\n${truncated}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

// ── System prompt builder ──────────────────────────────────────

export function buildSystemPrompt(
  card: CharacterCard,
  persona?: Persona,
  memoryInjection?: string,
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

  // Memory injection (PROFILE.md + MEMORY.md)
  if (memoryInjection) {
    parts.push(memoryInjection);
  }

  parts.push(buildToolInstructions(userName));

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
  memoryInjection?: string,
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

  // Memory injection (PROFILE.md + MEMORY.md)
  if (memoryInjection) {
    parts.push(memoryInjection);
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
- memory_search：搜索历史对话和持久记忆文件
- memory_write：写入持久记忆文件（memory/PROFILE.md, memory/MEMORY.md, memory/YYYY-MM-DD.md）
- memory_get：读取记忆文件的指定行范围（搜索后精确获取）
- web_search：搜索互联网获取实时信息
- note_write：写入临时笔记
- note_read：读取临时笔记
- file_read：读取工作区文件
- file_write：在工作区创建或写入文件

## 记忆管理
你有一个持久记忆系统。以下文件会在每次对话时自动加载到你的上下文中：
- memory/PROFILE.md：${userName}的基本信息、偏好、重要关系（保持简洁，只记录确认的事实）
- memory/MEMORY.md：长期重要记忆的精炼摘要

回忆之前的事情时：先用 memory_search 搜索，再用 memory_get 获取完整内容。
日常对话中的观察和事件应记录到 memory/YYYY-MM-DD.md（今日日期的日志，只追加不覆盖）。
定期将日志中的重要信息整理到 PROFILE.md 或 MEMORY.md，删除过时内容。
发现${userName}的新信息时，立即用 memory_write 记录。`;
}

export async function loadDefaultCharacter(): Promise<CharacterCard> {
  const resp = await fetch("/default_character.json");
  if (!resp.ok) {
    throw new Error(`加载默认角色失败: ${resp.status}`);
  }
  return resp.json();
}
