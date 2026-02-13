import type { CharacterCard } from "./types";

/** Build system prompt from character card, ported from Rust character.rs */
export function buildSystemPrompt(card: CharacterCard): string {
  const d = card.data;
  const parts: string[] = [];

  if (d.system_prompt) parts.push(d.system_prompt);

  parts.push(`你的名字是${d.name}。`);

  if (d.description) parts.push(`角色描述：${d.description}`);
  if (d.personality) parts.push(`性格特征：${d.personality}`);
  if (d.scenario) parts.push(`场景设定：${d.scenario}`);
  if (d.mes_example) parts.push(`对话示例：\n${d.mes_example}`);

  parts.push(
    `你可以使用以下工具来增强对话体验：
- memory_search：搜索与用户的历史对话记忆
- web_search：搜索互联网获取实时信息
- note_write：写入持久化笔记，记录用户的重要信息
- note_read：读取之前写的笔记
- file_read：读取工作区文件
- file_write：在工作区创建或写入文件

主动使用 memory_search 回忆用户之前提到的事情。
用 note_write 记录用户的重要信息（偏好、经历、情绪状态等）。`,
  );

  return parts.join("\n\n");
}

/** Load default character card from /default_character.json */
export async function loadDefaultCharacter(): Promise<CharacterCard> {
  const resp = await fetch("/default_character.json");
  return resp.json();
}
