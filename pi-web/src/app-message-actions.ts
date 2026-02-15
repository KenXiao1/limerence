/**
 * App-level message actions — side-effectful wrappers around
 * controllers/message-actions.ts pure functions.
 * Handles regeneration, swipe, edit, delete using global state.
 */

import { state } from "./app-state";
import { saveSession } from "./app-session";
import { estimateMessagesTokens } from "./app-compaction";
import {
  prepareRegeneration,
  findLastUserMessageIndex,
  findResponseGroup,
  initSwipeState,
  addSwipeAlternative,
  switchSwipeAlternative,
  applySwipe,
  editUserMessage,
  editAssistantMessage,
  getMessageText,
  getMessageRole,
  type SwipeState,
} from "./controllers/message-actions";

// ── Regenerate ─────────────────────────────────────────────────

export async function regenerateLastResponse() {
  const agent = state.agent;
  if (!agent || agent.state.isStreaming) return;

  const messages = agent.state.messages;
  const result = prepareRegeneration(messages);
  if (!result) return;

  const { truncated, removed, userMessageIndex } = result;

  // Store the current response as a swipe alternative
  if (removed.length > 0) {
    const existing = state.swipeData.get(userMessageIndex);
    if (existing) {
      // Already have swipe data — current display is already tracked
    } else {
      // First regeneration — save the original as the first alternative
      state.swipeData = new Map(state.swipeData).set(
        userMessageIndex,
        initSwipeState(removed),
      );
    }
  }

  // Truncate messages to just before the response
  agent.replaceMessages(truncated);

  // Get the user message text to re-prompt
  const userMsg = messages[userMessageIndex];
  const userText = getMessageText(userMsg);

  if (userText) {
    // Re-prompt with the same user message (remove the user message first, then prompt)
    agent.replaceMessages(truncated.slice(0, -1));
    await agent.prompt(userText);
  } else {
    // If no text (e.g., image-only), use continue
    await agent.prompt(userMsg);
  }

  // After regeneration, store the new response as another alternative
  const newMessages = agent.state.messages;
  const [newStart, newEnd] = findResponseGroup(newMessages, userMessageIndex);
  const newResponse = newMessages.slice(newStart, newEnd);

  if (newResponse.length > 0) {
    const swipe = state.swipeData.get(userMessageIndex);
    if (swipe) {
      state.swipeData = new Map(state.swipeData).set(
        userMessageIndex,
        addSwipeAlternative(swipe, newResponse),
      );
    }
  }

  updateTokenEstimate();
  void saveSession();
}

// ── Swipe ──────────────────────────────────────────────────────

export function swipePrev() {
  swipeDirection("prev");
}

export function swipeNext() {
  swipeDirection("next");
}

function swipeDirection(direction: "prev" | "next") {
  const agent = state.agent;
  if (!agent || agent.state.isStreaming) return;

  const messages = agent.state.messages;
  const userIdx = findLastUserMessageIndex(messages);
  if (userIdx < 0) return;

  const swipe = state.swipeData.get(userIdx);
  if (!swipe || swipe.alternatives.length <= 1) return;

  const newSwipe = switchSwipeAlternative(swipe, direction);
  state.swipeData = new Map(state.swipeData).set(userIdx, newSwipe);

  const newMessages = applySwipe(messages, userIdx, newSwipe);
  agent.replaceMessages(newMessages);

  updateTokenEstimate();
  void saveSession();
}

// ── Edit ───────────────────────────────────────────────────────

export function startEditLastUserMessage() {
  const agent = state.agent;
  if (!agent || agent.state.isStreaming) return;

  const messages = agent.state.messages;
  const userIdx = findLastUserMessageIndex(messages);
  if (userIdx < 0) return;

  const msg = messages[userIdx];
  state.editMode = true;
  state.editingIndex = userIdx;
  state.editText = getMessageText(msg);
  state.editRole = getMessageRole(msg);
}

export function startEditLastAssistantMessage() {
  const agent = state.agent;
  if (!agent || agent.state.isStreaming) return;

  const messages = agent.state.messages;
  // Find the last assistant message with text
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = getMessageRole(messages[i]);
    if (role === "assistant") {
      const text = getMessageText(messages[i]);
      if (text.trim()) {
        state.editMode = true;
        state.editingIndex = i;
        state.editText = text;
        state.editRole = role;
        return;
      }
    }
  }
}

export function cancelEdit() {
  state.editMode = false;
  state.editingIndex = -1;
  state.editText = "";
  state.editRole = "";
}

export function saveEdit() {
  const agent = state.agent;
  if (!agent || state.editingIndex < 0) return;

  const messages = agent.state.messages;
  const role = state.editRole;

  let newMessages: typeof messages;
  if (role === "user" || role === "user-with-attachments") {
    newMessages = editUserMessage(messages, state.editingIndex, state.editText);
  } else if (role === "assistant") {
    newMessages = editAssistantMessage(messages, state.editingIndex, state.editText);
  } else {
    cancelEdit();
    return;
  }

  agent.replaceMessages(newMessages);
  cancelEdit();
  updateTokenEstimate();
  void saveSession();
}

export async function saveEditAndRegenerate() {
  const agent = state.agent;
  if (!agent || state.editingIndex < 0) return;

  const messages = agent.state.messages;
  const editIdx = state.editingIndex;
  const editText = state.editText;
  const role = state.editRole;

  cancelEdit();

  if (role !== "user" && role !== "user-with-attachments") return;

  // Edit the user message
  const edited = editUserMessage(messages, editIdx, editText);

  // Remove everything after the user message and re-prompt
  const truncated = edited.slice(0, editIdx);
  agent.replaceMessages(truncated);
  await agent.prompt(editText);

  updateTokenEstimate();
  void saveSession();
}

// ── Delete ─────────────────────────────────────────────────────

export function deleteLastResponseGroup() {
  const agent = state.agent;
  if (!agent || agent.state.isStreaming) return;

  const messages = agent.state.messages;
  const userIdx = findLastUserMessageIndex(messages);
  if (userIdx < 0) return;

  // Delete the response group and the user message
  const [, end] = findResponseGroup(messages, userIdx);
  const newMessages = [...messages.slice(0, userIdx), ...messages.slice(end)];

  // Clean up swipe data for this position
  const newSwipeData = new Map(state.swipeData);
  newSwipeData.delete(userIdx);
  state.swipeData = newSwipeData;

  agent.replaceMessages(newMessages);
  updateTokenEstimate();
  void saveSession();
}

// ── Helpers ────────────────────────────────────────────────────

function updateTokenEstimate() {
  if (!state.agent) return;
  state.estimatedTokens = estimateMessagesTokens(state.agent.state.messages);
  state.contextWindow = state.agent.state.model?.contextWindow ?? 128000;
}

/**
 * Get the current swipe state for the last response.
 */
export function getLastSwipeState(): SwipeState | null {
  const agent = state.agent;
  if (!agent) return null;

  const messages = agent.state.messages;
  const userIdx = findLastUserMessageIndex(messages);
  if (userIdx < 0) return null;

  return state.swipeData.get(userIdx) ?? null;
}

/**
 * Reset swipe data (e.g., when switching sessions).
 */
export function resetSwipeData() {
  state.swipeData = new Map();
  cancelEdit();
}
