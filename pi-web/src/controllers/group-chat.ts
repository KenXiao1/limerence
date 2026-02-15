/**
 * Group chat controller — manages multi-character conversations.
 * Pure functions for turn selection, prompt building, and member management.
 * No global state references.
 */

import type { CharacterCard, Persona } from "../lib/character";
import { buildSystemPrompt } from "../lib/character";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Types ──────────────────────────────────────────────────────

export type TurnStrategy = "natural" | "round-robin" | "random" | "manual";

export interface GroupMember {
  id: string;
  card: CharacterCard;
  enabled: boolean;
  /** How many consecutive turns this member has taken (for balancing). */
  recentTurns: number;
}

export interface GroupChatConfig {
  enabled: boolean;
  members: GroupMember[];
  strategy: TurnStrategy;
  /** How many characters respond per user message (1 = one at a time). */
  responsesPerTurn: number;
}

export const DEFAULT_GROUP_CONFIG: GroupChatConfig = {
  enabled: false,
  members: [],
  strategy: "round-robin",
  responsesPerTurn: 1,
};

export const GROUP_CHAT_KEY = "limerence.group_chat";

// ── Member management ──────────────────────────────────────────

export function createGroupMember(card: CharacterCard): GroupMember {
  return {
    id: crypto.randomUUID(),
    card,
    enabled: true,
    recentTurns: 0,
  };
}

export function addMember(config: GroupChatConfig, card: CharacterCard): GroupChatConfig {
  return {
    ...config,
    members: [...config.members, createGroupMember(card)],
  };
}

export function removeMember(config: GroupChatConfig, memberId: string): GroupChatConfig {
  return {
    ...config,
    members: config.members.filter((m) => m.id !== memberId),
  };
}

export function toggleMember(config: GroupChatConfig, memberId: string): GroupChatConfig {
  return {
    ...config,
    members: config.members.map((m) =>
      m.id === memberId ? { ...m, enabled: !m.enabled } : m,
    ),
  };
}

// ── Turn selection ─────────────────────────────────────────────

function getActiveMembers(config: GroupChatConfig): GroupMember[] {
  return config.members.filter((m) => m.enabled);
}

/**
 * Select the next speaker(s) based on the turn strategy.
 * Returns an array of member IDs to respond this turn.
 */
export function selectNextSpeakers(
  config: GroupChatConfig,
  lastSpeakerId: string | null,
  _messages: AgentMessage[],
): string[] {
  const active = getActiveMembers(config);
  if (active.length === 0) return [];

  const count = Math.min(config.responsesPerTurn, active.length);

  switch (config.strategy) {
    case "round-robin": {
      const lastIdx = lastSpeakerId
        ? active.findIndex((m) => m.id === lastSpeakerId)
        : -1;
      const selected: string[] = [];
      for (let i = 0; i < count; i++) {
        const idx = (lastIdx + 1 + i) % active.length;
        selected.push(active[idx].id);
      }
      return selected;
    }

    case "random": {
      const shuffled = [...active].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count).map((m) => m.id);
    }

    case "natural": {
      // Pick the member with fewest recent turns (balancing)
      const sorted = [...active].sort((a, b) => a.recentTurns - b.recentTurns);
      return sorted.slice(0, count).map((m) => m.id);
    }

    case "manual":
      // Manual mode: caller decides, return empty (UI will prompt user to pick)
      return [];

    default:
      return [active[0].id];
  }
}

/**
 * After a member speaks, update their recentTurns counter.
 * Decay other members' counters to prevent starvation.
 */
export function recordTurn(config: GroupChatConfig, speakerId: string): GroupChatConfig {
  return {
    ...config,
    members: config.members.map((m) => ({
      ...m,
      recentTurns: m.id === speakerId
        ? m.recentTurns + 1
        : Math.max(0, m.recentTurns - 0.5),
    })),
  };
}

// ── Prompt building ────────────────────────────────────────────

/**
 * Build a system prompt for a specific group member, including
 * context about other members in the group.
 */
export function buildGroupSystemPrompt(
  member: GroupMember,
  allMembers: GroupMember[],
  persona?: Persona,
): string {
  const basePrompt = buildSystemPrompt(member.card, persona);

  const otherNames = allMembers
    .filter((m) => m.id !== member.id && m.enabled)
    .map((m) => m.card.data.name);

  if (otherNames.length === 0) return basePrompt;

  const groupContext = [
    "\n\n[群聊模式]",
    `你正在一个群聊中。其他参与者：${otherNames.join("、")}。`,
    "请保持你自己的角色特征，自然地与其他角色和用户互动。",
    "不要模仿或扮演其他角色，只以你自己的身份发言。",
    `每条回复请以「${member.card.data.name}：」开头，以便区分发言者。`,
  ].join("\n");

  return basePrompt + groupContext;
}

/**
 * Format a group member's response with their name prefix.
 */
export function formatGroupResponse(memberName: string, text: string): string {
  // If the response already starts with the member's name, don't double-prefix
  if (text.startsWith(`${memberName}：`) || text.startsWith(`${memberName}:`)) {
    return text;
  }
  return `${memberName}：${text}`;
}

/**
 * Extract the speaker name from a group chat message.
 */
export function extractSpeakerName(text: string): string | null {
  const match = text.match(/^(.+?)[：:]\s*/);
  return match ? match[1].trim() : null;
}

// ── Serialization ──────────────────────────────────────────────

/** Serialize config for storage (strip runtime fields). */
export function serializeGroupConfig(config: GroupChatConfig): object {
  return {
    enabled: config.enabled,
    strategy: config.strategy,
    responsesPerTurn: config.responsesPerTurn,
    members: config.members.map((m) => ({
      id: m.id,
      card: m.card,
      enabled: m.enabled,
    })),
  };
}

/** Deserialize config from storage. */
export function deserializeGroupConfig(data: unknown): GroupChatConfig | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.members)) return null;

  return {
    enabled: Boolean(obj.enabled),
    strategy: (obj.strategy as TurnStrategy) || "round-robin",
    responsesPerTurn: Number(obj.responsesPerTurn) || 1,
    members: obj.members.map((m: any) => ({
      id: m.id || crypto.randomUUID(),
      card: m.card,
      enabled: m.enabled !== false,
      recentTurns: 0,
    })),
  };
}
