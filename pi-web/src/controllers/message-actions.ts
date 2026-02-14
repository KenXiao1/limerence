/**
 * Message actions controller — pure functions for message manipulation.
 * Handles regeneration, swipe, edit, and delete operations.
 * No global state references; all dependencies passed as parameters.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Types ──────────────────────────────────────────────────────

/** A "swipe group" is the assistant response + any tool call/result messages that follow a user message. */
export interface SwipeAlternative {
  /** The messages that make up this alternative (assistant + tool results + final assistant, etc.) */
  messages: AgentMessage[];
  /** Timestamp when this alternative was generated */
  timestamp: number;
}

export interface SwipeState {
  /** All alternatives for a given response position (keyed by user message index) */
  alternatives: SwipeAlternative[];
  /** Which alternative is currently displayed (0-based) */
  currentIndex: number;
}

/** Per-session swipe data: maps user message index → swipe state */
export type SessionSwipeData = Map<number, SwipeState>;

// ── Message group detection ────────────────────────────────────

/**
 * Find the index of the last user message in the conversation.
 * Returns -1 if no user message found.
 */
export function findLastUserMessageIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = (messages[i] as any).role;
    if (role === "user" || role === "user-with-attachments") return i;
  }
  return -1;
}

/**
 * Find the response group (assistant messages + tool results) that follows a user message.
 * Returns [startIndex, endIndex) — the slice range of the response group.
 */
export function findResponseGroup(
  messages: AgentMessage[],
  userMessageIndex: number,
): [number, number] {
  const start = userMessageIndex + 1;
  if (start >= messages.length) return [start, start];

  let end = start;
  while (end < messages.length) {
    const role = (messages[end] as any).role;
    if (role === "user" || role === "user-with-attachments") break;
    end++;
  }
  return [start, end];
}

/**
 * Check if a response group contains any real assistant text (not just tool calls).
 */
export function hasAssistantText(messages: AgentMessage[]): boolean {
  return messages.some((m) => {
    if ((m as any).role !== "assistant") return false;
    const content = (m as any).content;
    if (!Array.isArray(content)) return false;
    return content.some(
      (c: any) => c?.type === "text" && String(c.text ?? "").trim().length > 0,
    );
  });
}

// ── Regeneration ───────────────────────────────────────────────

/**
 * Prepare messages for regeneration: remove the last response group.
 * Returns the truncated messages (up to and including the last user message),
 * and the removed response group (for storing as a swipe alternative).
 */
export function prepareRegeneration(messages: AgentMessage[]): {
  truncated: AgentMessage[];
  removed: AgentMessage[];
  userMessageIndex: number;
} | null {
  const userIdx = findLastUserMessageIndex(messages);
  if (userIdx < 0) return null;

  const [start, end] = findResponseGroup(messages, userIdx);
  const removed = messages.slice(start, end);
  const truncated = messages.slice(0, start);

  return { truncated, removed, userMessageIndex: userIdx };
}

// ── Swipe ──────────────────────────────────────────────────────

/**
 * Initialize swipe state for a response position.
 * Stores the current response as the first alternative.
 */
export function initSwipeState(currentMessages: AgentMessage[]): SwipeState {
  return {
    alternatives: [{ messages: currentMessages, timestamp: Date.now() }],
    currentIndex: 0,
  };
}

/**
 * Add a new alternative to the swipe state and set it as current.
 */
export function addSwipeAlternative(
  state: SwipeState,
  newMessages: AgentMessage[],
): SwipeState {
  const alternatives = [
    ...state.alternatives,
    { messages: newMessages, timestamp: Date.now() },
  ];
  return {
    alternatives,
    currentIndex: alternatives.length - 1,
  };
}

/**
 * Switch to a different swipe alternative.
 * Returns the new swipe state and the messages to display.
 */
export function switchSwipeAlternative(
  state: SwipeState,
  direction: "prev" | "next",
): SwipeState {
  const { alternatives, currentIndex } = state;
  if (alternatives.length <= 1) return state;

  let newIndex: number;
  if (direction === "prev") {
    newIndex = currentIndex <= 0 ? alternatives.length - 1 : currentIndex - 1;
  } else {
    newIndex = currentIndex >= alternatives.length - 1 ? 0 : currentIndex + 1;
  }

  return { alternatives, currentIndex: newIndex };
}

/**
 * Apply a swipe state to the message array.
 * Replaces the response group at userMessageIndex with the current alternative.
 */
export function applySwipe(
  messages: AgentMessage[],
  userMessageIndex: number,
  swipeState: SwipeState,
): AgentMessage[] {
  const [start, end] = findResponseGroup(messages, userMessageIndex);
  const before = messages.slice(0, start);
  const after = messages.slice(end);
  const current = swipeState.alternatives[swipeState.currentIndex];
  return [...before, ...current.messages, ...after];
}

// ── Edit ───────────────────────────────────────────────────────

/**
 * Edit a user message's text content.
 * Returns the modified messages array.
 */
export function editUserMessage(
  messages: AgentMessage[],
  messageIndex: number,
  newText: string,
): AgentMessage[] {
  const msg = messages[messageIndex];
  if (!msg) return messages;

  const role = (msg as any).role;
  if (role !== "user" && role !== "user-with-attachments") return messages;

  const edited = { ...msg } as any;
  if (typeof edited.content === "string") {
    edited.content = newText;
  } else if (Array.isArray(edited.content)) {
    // Replace the first text block
    edited.content = edited.content.map((block: any, i: number) => {
      if (block?.type === "text" && i === edited.content.findIndex((b: any) => b?.type === "text")) {
        return { ...block, text: newText };
      }
      return block;
    });
  }

  const result = [...messages];
  result[messageIndex] = edited;
  return result;
}

/**
 * Edit an assistant message's text content.
 * Returns the modified messages array.
 */
export function editAssistantMessage(
  messages: AgentMessage[],
  messageIndex: number,
  newText: string,
): AgentMessage[] {
  const msg = messages[messageIndex];
  if (!msg) return messages;
  if ((msg as any).role !== "assistant") return messages;

  const edited = { ...msg } as any;
  const content = Array.isArray(edited.content) ? [...edited.content] : [];

  // Replace the first text block, or add one
  const textIdx = content.findIndex((c: any) => c?.type === "text");
  if (textIdx >= 0) {
    content[textIdx] = { ...content[textIdx], text: newText };
  } else {
    content.unshift({ type: "text", text: newText });
  }

  edited.content = content;
  const result = [...messages];
  result[messageIndex] = edited;
  return result;
}

// ── Delete ─────────────────────────────────────────────────────

/**
 * Delete a message and its associated tool calls/results.
 * If deleting an assistant message, also removes subsequent tool results
 * that belong to it (up to the next user or assistant message).
 */
export function deleteMessage(
  messages: AgentMessage[],
  messageIndex: number,
): AgentMessage[] {
  const msg = messages[messageIndex];
  if (!msg) return messages;

  const role = (msg as any).role;

  // For user messages: just remove the single message
  if (role === "user" || role === "user-with-attachments") {
    return messages.filter((_, i) => i !== messageIndex);
  }

  // For assistant messages: remove the entire response group
  // Find the preceding user message
  let userIdx = messageIndex - 1;
  while (userIdx >= 0) {
    const r = (messages[userIdx] as any).role;
    if (r === "user" || r === "user-with-attachments") break;
    userIdx--;
  }

  if (userIdx < 0) {
    // No preceding user message — just remove this single message
    return messages.filter((_, i) => i !== messageIndex);
  }

  const [start, end] = findResponseGroup(messages, userIdx);
  return [...messages.slice(0, start), ...messages.slice(end)];
}

/**
 * Delete a message and everything after it (for "regenerate from here").
 */
export function deleteFromIndex(
  messages: AgentMessage[],
  messageIndex: number,
): AgentMessage[] {
  return messages.slice(0, messageIndex);
}

// ── Message text extraction (for edit UI) ──────────────────────

/**
 * Extract the plain text content from a message for editing.
 */
export function getMessageText(message: AgentMessage): string {
  const content = (message as any).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c: any) => c?.type === "text")
    .map((c: any) => String(c.text ?? ""))
    .join("\n");
}

/**
 * Get the role of a message.
 */
export function getMessageRole(message: AgentMessage): string {
  return (message as any).role ?? "unknown";
}

/**
 * Count the number of displayable messages (user + assistant with text).
 */
export function countDisplayableMessages(messages: AgentMessage[]): number {
  return messages.filter((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments" || role === "assistant";
  }).length;
}
