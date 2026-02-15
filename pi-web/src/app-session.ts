import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { state, storage, limerenceStorage, memoryIndex, defaultUsage, syncEngine } from "./app-state";
import { createAgent, updateUrl } from "./app-agent";
import { repairTranscript } from "./app-repair";
import { resetSwipeData } from "./app-message-actions";
import { onSessionChanged, onCharacterChanged, extractAllRegexScripts, reprocessAllMessages } from "./iframe-runner";
import {
  generateTitle as _generateTitle,
  shouldSaveSession as _shouldSaveSession,
  createMemoryEntry,
  buildSessionData,
  summarizeUsage,
} from "./controllers/session";

// ── Re-exports from controller (pure functions) ─────────────────

export const generateTitle = _generateTitle;
export const shouldSaveSession = _shouldSaveSession;
export { extractPlainText, summarizeUsage } from "./controllers/session";

// ── Memory indexing (side-effectful — uses global stores) ───────

export async function indexMessageIntoMemory(message: AgentMessage) {
  const entry = createMemoryEntry(message, state.currentSessionId ?? "");
  if (!entry) return;

  memoryIndex.add(entry);
  await limerenceStorage.addMemoryEntry(entry);
}

// ── Session persistence ─────────────────────────────────────────

export async function saveSession() {
  if (!state.currentSessionId || !state.agent) return;

  const agentState = state.agent.state;
  if (!_shouldSaveSession(agentState.messages)) return;

  const { sessionData, metadata, title } = buildSessionData({
    sessionId: state.currentSessionId,
    title: state.currentTitle,
    createdAt: state.currentSessionCreatedAt,
    messages: agentState.messages,
    model: agentState.model,
    thinkingLevel: agentState.thinkingLevel,
  });

  if (!state.currentTitle) {
    state.currentTitle = title;
  }

  const usage = summarizeUsage(agentState.messages, defaultUsage());
  await storage.sessions.save(sessionData, { ...metadata, usage });

  // Push to sync engine if active
  void syncEngine.pushSessionData(state.currentSessionId, sessionData, {
    title: metadata.title,
    createdAt: metadata.createdAt,
    model: metadata.modelId ?? "",
    messageCount: agentState.messages.length,
  });
}

// ── Session CRUD ────────────────────────────────────────────────

export async function loadSession(sessionId: string): Promise<boolean> {
  const data = await storage.sessions.get(sessionId);
  if (!data) return false;

  resetSwipeData();
  state.appView = "chat";
  state.currentSessionId = sessionId;
  state.currentTitle = data.title ?? "";
  state.currentSessionCreatedAt = data.createdAt;

  const repairedMessages = repairTranscript(data.messages ?? []);

  await createAgent({
    model: data.model,
    thinkingLevel: data.thinkingLevel,
    messages: repairedMessages,
    tools: [],
  });

  // iframe-runner: update session context and re-process existing messages
  if (state.iframeRunnerEnabled) {
    if (state.character) {
      const result = onCharacterChanged(state.character);
      state.iframeRunnerRegexScripts = extractAllRegexScripts(state.character);
      state.iframeRunnerPersistentScripts = result.persistentScripts;
    }
    onSessionChanged(sessionId);
    reprocessAllMessages(repairedMessages);
  }

  updateUrl(sessionId);
  return true;
}

export async function newSession() {
  resetSwipeData();
  state.appView = "chat";
  state.currentSessionId = crypto.randomUUID();
  state.currentSessionCreatedAt = new Date().toISOString();
  state.currentTitle = "";
  state.isEditingTitle = false;

  updateUrl(state.currentSessionId);

  // iframe-runner: update session context
  if (state.iframeRunnerEnabled) {
    if (state.character) {
      const result = onCharacterChanged(state.character);
      state.iframeRunnerRegexScripts = extractAllRegexScripts(state.character);
      state.iframeRunnerPersistentScripts = result.persistentScripts;
    }
    onSessionChanged(state.currentSessionId);
  }

  await createAgent();

  // Ensure initial greeting messages are processed too.
  if (state.iframeRunnerEnabled && state.agent) {
    reprocessAllMessages(state.agent.state.messages);
  }
}
