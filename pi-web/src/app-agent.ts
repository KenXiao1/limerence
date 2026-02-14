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
  PROXY_MODE_KEY,
  CHAT_PATH,
} from "./app-state";
import { buildSystemPrompt, loadDefaultCharacter } from "./lib/character";
import { createLimerenceTools } from "./lib/tools";
import { handleAgentFileOperation } from "./app-workspace";
import { generateTitle, indexMessageIntoMemory, saveSession, newSession } from "./app-session";
import { compactMessages, estimateMessagesTokens } from "./app-compaction";

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

    // Save draft for recovery on failure (#13)
    if (typeof message === "string") {
      try { sessionStorage.setItem(DRAFT_KEY, message); } catch {}
    }

    return originalPrompt(message, images).then(
      (result: any) => {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        return result;
      },
      (err: any) => {
        // Restore draft to input on failure
        const draft = sessionStorage.getItem(DRAFT_KEY);
        if (draft && state.chatPanel?.agentInterface) {
          state.chatPanel.agentInterface.setInput(draft);
        }
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        throw err;
      },
    );
  }) as typeof agent.prompt;

  const TOOL_LABELS: Record<string, string> = {
    memory_search: "记忆搜索",
    web_search: "网络搜索",
    note_write: "写笔记",
    note_read: "读笔记",
    file_read: "读文件",
    file_write: "写文件",
  };

  state.agentUnsubscribe = agent.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      state.activeToolCalls = [
        ...state.activeToolCalls,
        { id: event.toolCallId, name: event.toolName, label: TOOL_LABELS[event.toolName] ?? event.toolName },
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

// ── Runtime bootstrap ──────────────────────────────────────────────

export async function ensureChatRuntime() {
  if (state.chatRuntimeReady) return;

  state.character = await loadDefaultCharacter();

  // Settings validation (#11): ensure proxy mode is a boolean
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
