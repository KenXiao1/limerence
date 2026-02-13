import { Agent, type AgentState } from "@mariozechner/pi-agent-core";
import { getModel, type AssistantMessage, type Model } from "@mariozechner/pi-ai";
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
  renderCurrentView,
  PROXY_MODE_KEY,
  CHAT_PATH,
} from "./app-state";
import { buildSystemPrompt, loadDefaultCharacter } from "./lib/character";
import { createLimerenceTools } from "./lib/tools";
import { handleAgentFileOperation } from "./app-workspace";
import { generateTitle, indexMessageIntoMemory, saveSession, newSession } from "./app-session";

// ── Routing helpers ────────────────────────────────────────────────

export function setRoute(pathname: string, sessionId?: string, replace = false) {
  const url = new URL(window.location.href);
  url.pathname = pathname;
  if (sessionId) {
    url.searchParams.set("session", sessionId);
  } else {
    url.searchParams.delete("session");
  }

  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
}

export function updateUrl(sessionId: string) {
  setRoute(CHAT_PATH, sessionId, true);
}

// ── Proxy mode ─────────────────────────────────────────────────────

export async function isProxyModeEnabled(): Promise<boolean> {
  return (await storage.settings.get<boolean>(PROXY_MODE_KEY)) ?? false;
}

export async function setProxyModeEnabled(enabled: boolean): Promise<void> {
  await storage.settings.set(PROXY_MODE_KEY, enabled);
}

// ── Model factories ────────────────────────────────────────────────

export function createProxyModel(): Model<"openai-completions"> {
  return {
    id: "deepseek-chat",
    name: "deepseek-chat (Netlify Proxy)",
    api: "openai-completions",
    provider: "limerence-proxy",
    baseUrl: "/api/llm/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function createDirectModel(): Model<any> {
  try {
    return getModel("openai", "gpt-4o-mini");
  } catch {
    return getModel("openai", "gpt-4.1-mini");
  }
}

export async function getDefaultModel(): Promise<Model<any>> {
  const proxyMode = await isProxyModeEnabled();
  return proxyMode ? createProxyModel() : createDirectModel();
}

// ── Initial messages ───────────────────────────────────────────────

function buildGreetingMessage(model: Model<any>): AssistantMessage | null {
  const text = state.character?.data.first_mes?.trim();
  if (!text) return null;

  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: defaultUsage(),
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function createInitialMessages(model: Model<any>) {
  const greeting = buildGreetingMessage(model);
  return greeting ? [greeting] : [];
}

// ── Chat commands ──────────────────────────────────────────────────

const STOP_COMMANDS = new Set(["/stop", "stop", "esc", "abort", "/abort"]);
const NEW_COMMANDS = new Set(["/new", "/reset"]);

/**
 * Check if text is a chat command. Returns true if handled (message should not be sent).
 */
export function handleChatCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return false;

  if (STOP_COMMANDS.has(trimmed)) {
    state.agent?.abort();
    return true;
  }

  if (NEW_COMMANDS.has(trimmed)) {
    void newSession();
    return true;
  }

  return false;
}

// ── Message queue ──────────────────────────────────────────────────

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

// ── Agent creation ─────────────────────────────────────────────────

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

  // Wrap agent.prompt to support chat commands and message queue
  const originalPrompt = agent.prompt.bind(agent);
  agent.prompt = ((message: any, images?: any) => {
    if (typeof message === "string" && handleChatCommand(message)) return Promise.resolve();

    if (typeof message === "string" && isAgentBusy(agent)) {
      state.messageQueue.push(message);
      return Promise.resolve();
    }

    return originalPrompt(message, images);
  }) as typeof agent.prompt;

  state.agentUnsubscribe = agent.subscribe((event) => {
    if (event.type === "message_end") {
      void indexMessageIntoMemory(event.message);
      if (!state.currentTitle) {
        state.currentTitle = generateTitle(agent.state.messages);
      }
      void saveSession();
      renderCurrentView();
      return;
    }

    if (event.type === "agent_end") {
      void saveSession();
      drainMessageQueue();
      renderCurrentView();
      return;
    }

    renderCurrentView();
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
}

// ── Runtime bootstrap ──────────────────────────────────────────────

export async function ensureChatRuntime() {
  if (state.chatRuntimeReady) return;

  state.character = await loadDefaultCharacter();
  state.proxyModeEnabled = await isProxyModeEnabled();

  const memoryEntries = await limerenceStorage.loadMemoryEntries();
  memoryIndex.load(memoryEntries);

  state.chatPanel = new ChatPanel();
  state.chatRuntimeReady = true;
}
