import { Agent, type AgentState } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import {
  ApiKeyPromptDialog,
  ChatPanel,
  defaultConvertToLlm,
} from "@mariozechner/pi-web-ui";
import {
  state,
  storage,
  limerenceStorage,
  memoryIndex,
  defaultUsage,
  PROXY_MODE_KEY,
  CHAT_PATH,
} from "./app-state";
import { buildSystemPrompt, loadDefaultCharacter } from "./lib/character";
import { createLimerenceTools } from "./lib/tools";
import { handleAgentFileOperation } from "./app-workspace";
import { generateTitle, indexMessageIntoMemory, saveSession, newSession } from "./app-session";
import { compactMessages, estimateMessagesTokens } from "./app-compaction";
import {
  parseChatCommand,
  createProxyModel,
  createDirectModel,
  buildGreetingMessage,
  getToolLabel,
  buildRouteUrl,
} from "./controllers/agent";

// ── Routing helpers ────────────────────────────────────────────

export function setRoute(pathname: string, sessionId?: string, replace = false) {
  const url = buildRouteUrl(window.location.href, pathname, sessionId);
  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
}

export function updateUrl(sessionId: string) {
  setRoute(CHAT_PATH, sessionId, true);
}

// ── Proxy mode ─────────────────────────────────────────────────

export async function isProxyModeEnabled(): Promise<boolean> {
  return (await storage.settings.get<boolean>(PROXY_MODE_KEY)) ?? false;
}

export async function setProxyModeEnabled(enabled: boolean): Promise<void> {
  await storage.settings.set(PROXY_MODE_KEY, enabled);
}

// ── Model factories (delegate to controller) ───────────────────

export { createProxyModel, createDirectModel } from "./controllers/agent";

export async function getDefaultModel(): Promise<Model<any>> {
  const proxyMode = await isProxyModeEnabled();
  return proxyMode ? createProxyModel() : createDirectModel();
}

// ── Initial messages ───────────────────────────────────────────

function createInitialMessages(model: Model<any>) {
  const greeting = buildGreetingMessage(state.character, model, defaultUsage());
  return greeting ? [greeting] : [];
}

// ── Chat commands ──────────────────────────────────────────────

export function handleChatCommand(text: string): boolean {
  const result = parseChatCommand(text);
  if (result === "stop") {
    state.agent?.abort();
    return true;
  }
  if (result === "new") {
    void newSession();
    return true;
  }
  return false;
}

// ── Message queue ──────────────────────────────────────────────

function isAgentBusy(agent: Agent): boolean {
  return agent.state.isStreaming || agent.state.pendingToolCalls.size > 0;
}

function drainMessageQueue() {
  if (state.messageQueue.length === 0 || !state.agent) return;
  if (isAgentBusy(state.agent)) return;

  const next = state.messageQueue.shift();
  if (next) {
    void state.agent.prompt(next);
  }
}

// ── Agent creation ─────────────────────────────────────────────

export async function createAgent(initialState?: Partial<AgentState>) {
  if (state.agentUnsubscribe) {
    state.agentUnsubscribe();
    state.agentUnsubscribe = undefined;
  }

  const model = initialState?.model ?? (await getDefaultModel());
  const messages = initialState?.messages ?? createInitialMessages(model);

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(state.character!),
      model,
      thinkingLevel: initialState?.thinkingLevel ?? "off",
      messages,
      tools: initialState?.tools ?? [],
    },
    convertToLlm: defaultConvertToLlm,
  });

  if (state.currentSessionId) {
    agent.sessionId = state.currentSessionId;
  }

  // Wrap agent.prompt to support chat commands, message queue, compaction, and draft recovery
  const originalPrompt = agent.prompt.bind(agent);
  const DRAFT_KEY = "limerence-draft";

  agent.prompt = ((message: any, images?: any) => {
    if (typeof message === "string" && handleChatCommand(message)) return Promise.resolve();

    if (typeof message === "string" && isAgentBusy(agent)) {
      state.messageQueue.push(message);
      return Promise.resolve();
    }

    // Auto-compact before sending if approaching context limit
    const contextWindow = agent.state.model?.contextWindow ?? 128000;
    const compacted = compactMessages(agent.state.messages, contextWindow);
    if (compacted) {
      agent.replaceMessages(compacted);
    }

    // Save draft for recovery on failure
    if (typeof message === "string") {
      try { sessionStorage.setItem(DRAFT_KEY, message); } catch {}
    }

    return originalPrompt(message, images).then(
      (result: any) => {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        return result;
      },
      (err: any) => {
        const draft = sessionStorage.getItem(DRAFT_KEY);
        if (draft && state.chatPanel?.agentInterface) {
          state.chatPanel.agentInterface.setInput(draft);
        }
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        throw err;
      },
    );
  }) as typeof agent.prompt;

  state.agentUnsubscribe = agent.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      state.activeToolCalls = [
        ...state.activeToolCalls,
        { id: event.toolCallId, name: event.toolName, label: getToolLabel(event.toolName) },
      ];
      return;
    }

    if (event.type === "tool_execution_end") {
      state.activeToolCalls = state.activeToolCalls.filter((t) => t.id !== event.toolCallId);
      return;
    }

    if (event.type === "message_end") {
      void indexMessageIntoMemory(event.message);
      if (!state.currentTitle) {
        state.currentTitle = generateTitle(agent.state.messages);
      }
      void saveSession();
      return;
    }

    if (event.type === "agent_end") {
      state.activeToolCalls = [];
      state.estimatedTokens = estimateMessagesTokens(agent.state.messages);
      state.contextWindow = agent.state.model?.contextWindow ?? 128000;
      void saveSession();
      drainMessageQueue();
      return;
    }
  });

  state.agent = agent;

  await state.chatPanel!.setAgent(agent, {
    onApiKeyRequired: async (provider: string) => {
      const proxyMode = await isProxyModeEnabled();
      if (proxyMode && provider === "limerence-proxy") {
        await storage.providerKeys.set("limerence-proxy", "__PROXY__");
        return true;
      }
      return ApiKeyPromptDialog.prompt(provider);
    },
    toolsFactory: () =>
      createLimerenceTools(memoryIndex, limerenceStorage, {
        onFileOperation: (event) => {
          handleAgentFileOperation(event);
        },
      }),
  });

  // Enable image paste/drag attachments
  if (state.chatPanel!.agentInterface) {
    state.chatPanel!.agentInterface.enableAttachments = true;
  }
}

// ── Runtime bootstrap ──────────────────────────────────────────

export async function ensureChatRuntime() {
  if (state.chatRuntimeReady) return;

  state.character = await loadDefaultCharacter();

  // Settings validation: ensure proxy mode is a boolean
  try {
    const raw = await storage.settings.get<unknown>(PROXY_MODE_KEY);
    state.proxyModeEnabled = typeof raw === "boolean" ? raw : false;
  } catch {
    state.proxyModeEnabled = false;
  }

  const memoryEntries = await limerenceStorage.loadMemoryEntries();
  memoryIndex.load(memoryEntries);

  state.chatPanel = new ChatPanel();
  state.chatRuntimeReady = true;
}
