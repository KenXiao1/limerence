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
  memoryDB,
  defaultUsage,
  PROXY_MODE_KEY,
  CHAT_PATH,
} from "./app-state";
import { buildSystemPrompt, buildSystemPromptFromPreset, buildMemoryInjection, loadDefaultCharacter, PERSONA_SETTINGS_KEY, type Persona } from "./lib/character";
import type { PromptPresetConfig } from "./controllers/prompt-presets";
import { ACTIVE_PROMPT_PRESET_KEY, PROMPT_PRESETS_KEY } from "./controllers/prompt-presets";
import { createLimerenceTools } from "./lib/tools";
import { handleAgentFileOperation, refreshMemoryFiles } from "./app-workspace";
import type { MemoryOp } from "./app-state";
import { generateTitle, indexMessageIntoMemory, saveSession, newSession } from "./app-session";
import { compactMessages, estimateMessagesTokens } from "./app-compaction";
import {
  parseChatCommand,
  createProxyModel,
  createDirectModel,
  buildGreetingMessage,
  getToolLabel,
  buildRouteUrl,
  hasDirectProviderKeys,
  shouldUseProxyModel,
  shouldEnableModelSelector,
} from "./controllers/agent";
import { parseSlashCommand } from "./controllers/slash-commands";
import { scanLorebook, buildLorebookInjection, extractRecentText } from "./controllers/lorebook";
import { applyRegexRules } from "./controllers/regex-rules";
import { smartCompact } from "./controllers/context-budget";
import { buildExportData, downloadJson } from "./controllers/session-io";
import { showLeniaBubble, hideLeniaBubble } from "./lib/particle-lenia";
import {
  selectNextSpeakers,
  recordTurn,
  buildGroupSystemPrompt,
  deserializeGroupConfig,
  GROUP_CHAT_KEY,
} from "./controllers/group-chat";
import type { RegexRule } from "./controllers/regex-rules";
import type { GenerationPreset } from "./controllers/presets";
import { ACTIVE_PRESET_KEY } from "./controllers/presets";
import { REGEX_RULES_KEY } from "./controllers/regex-rules";

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
  return (await storage.settings.get<boolean>(PROXY_MODE_KEY)) ?? true;
}

export async function setProxyModeEnabled(enabled: boolean): Promise<void> {
  await storage.settings.set(PROXY_MODE_KEY, enabled);
}

// ── Model factories (delegate to controller) ───────────────────

export { createProxyModel, createDirectModel } from "./controllers/agent";

export async function hasDirectProviderKeyConfigured(): Promise<boolean> {
  const providers = await storage.providerKeys.list();
  return hasDirectProviderKeys(providers);
}

export async function getDefaultModel(): Promise<Model<any>> {
  const hasDirectKey = await hasDirectProviderKeyConfigured();
  const proxyMode = await isProxyModeEnabled();
  return shouldUseProxyModel(proxyMode, hasDirectKey) ? createProxyModel() : createDirectModel();
}

// ── Initial messages ───────────────────────────────────────────

function createInitialMessages(model: Model<any>) {
  const greeting = buildGreetingMessage(state.character, model, defaultUsage());
  return greeting ? [greeting] : [];
}

// ── Chat commands ──────────────────────────────────────────────

export function handleChatCommand(text: string): boolean {
  // Try enhanced slash commands first
  const slash = parseSlashCommand(text);
  if (slash) {
    switch (slash.type) {
      case "stop":
        state.agent?.abort();
        return true;
      case "new":
        void newSession();
        return true;
      case "retry":
        // Handled via app-message-actions regenerateLastResponse
        void import("./app-message-actions").then((m) => m.regenerateLastResponse());
        return true;
      case "clear":
        if (state.agent) {
          const model = state.agent.state.model;
          const greeting = buildGreetingMessage(state.character, model, defaultUsage());
          state.agent.replaceMessages(greeting ? [greeting] : []);
        }
        return true;
      case "export":
        void exportCurrentSession();
        return true;
      case "help":
        // Inject help text as a system-like assistant message
        if (state.agent) {
          const helpMsg = {
            role: "assistant" as const,
            content: [{ type: "text" as const, text: slash.text }],
            api: state.agent.state.model?.api ?? "openai-completions",
            provider: state.agent.state.model?.provider ?? "unknown",
            model: state.agent.state.model?.id ?? "unknown",
            usage: defaultUsage(),
            stopReason: "stop" as const,
            timestamp: Date.now(),
          };
          state.agent.appendMessage(helpMsg as any);
        }
        return true;
      case "handled":
        return true;
    }
  }

  // Fall back to legacy simple commands
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

// ── Session export ──────────────────────────────────────────────

export async function exportCurrentSession() {
  if (!state.currentSessionId || !state.agent) return;

  const data = buildExportData(
    state.currentSessionId,
    state.currentTitle,
    state.currentSessionCreatedAt,
    state.agent.state.model,
    state.agent.state.thinkingLevel,
    state.agent.state.messages,
  );

  const filename = `limerence-${state.currentTitle || "session"}-${new Date().toISOString().slice(0, 10)}.json`;
  downloadJson(data, filename);
}

// ── Regex output processing ─────────────────────────────────────

function applyRegexToMessage(message: any) {
  const content = message.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      block.text = applyRegexRules(block.text, state.regexRules, "output");
    }
  }
}

// ── Memory context injection ─────────────────────────────────────

/** Cached memory injection text, rebuilt on each prompt. */
let _memoryInjectionCache: string | null = null;

async function refreshMemoryInjection(): Promise<string | null> {
  const userName = state.persona?.name || "用户";
  const profileContent = await limerenceStorage.readWorkspaceFile("memory/PROFILE.md");
  const memoryContent = await limerenceStorage.readWorkspaceFile("memory/MEMORY.md");
  _memoryInjectionCache = buildMemoryInjection(profileContent, memoryContent, userName);
  return _memoryInjectionCache;
}

// ── Lorebook + memory injection ─────────────────────────────────

async function injectContextIntoPrompt(agent: Agent) {
  // 1. Refresh memory injection
  const memInjection = await refreshMemoryInjection();

  // 2. Lorebook injection
  let lorebookInjection: string | undefined;
  if (state.lorebookEntries.length > 0) {
    const recentText = extractRecentText(agent.state.messages, 10);
    const charId = state.character?.data?.name ?? null;
    const matched = scanLorebook(state.lorebookEntries, recentText, charId);
    lorebookInjection = buildLorebookInjection(matched) ?? undefined;
  }

  // 3. Rebuild system prompt with both injections
  if (state.activePromptPreset) {
    agent.state.systemPrompt = buildSystemPromptFromPreset(
      state.activePromptPreset,
      state.character!,
      state.persona,
      lorebookInjection,
      undefined,
      memInjection ?? undefined,
    );
  } else {
    let prompt = buildSystemPrompt(state.character!, state.persona, memInjection ?? undefined);
    if (lorebookInjection) {
      prompt = `${prompt}\n\n${lorebookInjection}`;
    }
    agent.state.systemPrompt = prompt;
  }
}

// ── Group chat turn management ──────────────────────────────────

/** Queue of pending group chat speaker IDs for the current user turn. */
let _groupTurnQueue: string[] = [];

/**
 * When group chat is enabled, set up the speaker queue for this user turn.
 * Returns the first speaker's member, or null if group chat is off.
 */
function setupGroupTurn(): import("./controllers/group-chat").GroupMember | null {
  const gc = state.groupChat;
  if (!gc.enabled || gc.members.filter((m) => m.enabled).length === 0) {
    _groupTurnQueue = [];
    return null;
  }

  const speakers = selectNextSpeakers(gc, state.groupChatLastSpeakerId, state.agent?.state.messages ?? []);
  if (speakers.length === 0) {
    _groupTurnQueue = [];
    return null;
  }

  // First speaker responds immediately; rest go into queue
  const [firstId, ...rest] = speakers;
  _groupTurnQueue = rest;

  const member = gc.members.find((m) => m.id === firstId);
  if (!member) return null;

  return member;
}

/**
 * After a group member finishes speaking, continue with the next queued speaker.
 */
function continueGroupTurn(agent: Agent) {
  if (_groupTurnQueue.length === 0) return;

  const nextId = _groupTurnQueue.shift()!;
  const member = state.groupChat.members.find((m) => m.id === nextId);
  if (!member) return;

  // Update tracking
  state.groupChatLastSpeakerId = nextId;
  state.groupChat = recordTurn(state.groupChat, nextId);

  // Swap system prompt to next speaker
  agent.state.systemPrompt = buildGroupSystemPrompt(member, state.groupChat.members, state.persona);

  // Use agent.continue() to generate the next character's response
  void agent.continue();
}

// ── Message queue ──────────────────────────────────────────────

function isAgentBusy(agent: Agent): boolean {
  // `pendingToolCalls` may transiently stay non-empty around UI/session boundaries.
  // Gate queueing only on active streaming, otherwise prompts can be swallowed.
  return agent.state.isStreaming;
}

function drainMessageQueue() {
  if (state.messageQueue.length === 0 || !state.agent) return;
  if (isAgentBusy(state.agent)) return;

  const next = state.messageQueue.shift();
  if (next) {
    void state.agent.prompt(next);
  }
}

function normalizeModelBaseUrl(model: Model<any>): Model<any> {
  const raw = model.baseUrl?.trim();
  const trimmed = raw?.replace(/\/+$/, "");

  // The OpenAI JS SDK (used by @mariozechner/pi-ai) requires an absolute baseURL.
  // Additionally, sessions may persist the model object; keep the hosted proxy baseUrl
  // pinned to the current origin so loading an exported session on another host works.
  if (model.provider === "limerence-proxy") {
    try {
      const absolute = new URL("/api/llm/v1", window.location.origin).toString().replace(/\/+$/, "");
      return absolute !== model.baseUrl ? { ...model, baseUrl: absolute } : model;
    } catch {
      // Fall through to best-effort normalization below.
    }
  }

  if (!trimmed) return model;

  if (trimmed.startsWith("/")) {
    try {
      const absolute = new URL(trimmed, window.location.origin).toString().replace(/\/+$/, "");
      return { ...model, baseUrl: absolute };
    } catch {
      return model;
    }
  }

  return trimmed !== model.baseUrl ? { ...model, baseUrl: trimmed } : model;
}

function installSafeSendMessagePatch(agentInterface: any) {
  if (!agentInterface || agentInterface.__limerenceSafeSendPatched) return;
  const originalSendMessage = agentInterface.sendMessage?.bind(agentInterface);
  if (typeof originalSendMessage !== "function") return;

  agentInterface.sendMessage = async (input: string, attachments?: any[]) => {
    try {
      await originalSendMessage(input, attachments);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isEditorRefError =
        error instanceof TypeError && message.includes("Cannot set properties of undefined");
      if (!isEditorRefError) {
        throw error;
      }
    }

    const session = agentInterface.session as Agent | undefined;
    const text = typeof input === "string" ? input : "";
    const files = Array.isArray(attachments) ? attachments : [];
    if ((!text.trim() && files.length === 0) || session?.state.isStreaming) return;
    if (!session) throw new Error("No session set on AgentInterface");
    if (!session.state.model) throw new Error("No model set on AgentInterface");

    const provider = session.state.model.provider;
    const apiKey = await storage.providerKeys.get(provider);
    if (!apiKey) {
      if (!agentInterface.onApiKeyRequired) {
        console.error("No API key configured and no onApiKeyRequired handler set");
        return;
      }
      const success = await agentInterface.onApiKeyRequired(provider);
      if (!success) return;
    }

    if (agentInterface.onBeforeSend) {
      await agentInterface.onBeforeSend();
    }

    const editor = agentInterface.querySelector?.("message-editor") as
      | { value: string; attachments: any[] }
      | null;
    if (editor) {
      editor.value = "";
      editor.attachments = [];
    }
    agentInterface._autoScroll = true;

    if (files.length > 0) {
      await session.prompt({
        role: "user-with-attachments",
        content: text,
        attachments: files,
        timestamp: Date.now(),
      } as any);
    } else {
      await session.prompt(text);
    }
  };

  agentInterface.__limerenceSafeSendPatched = true;
}

function unshadowLitReactiveProperty(el: any, prop: string) {
  if (!el || !Object.prototype.hasOwnProperty.call(el, prop)) return;
  const value = el[prop];
  try {
    // Remove instance field created via `useDefineForClassFields` which shadows Lit's accessor.
    // Re-assigning after delete will go through the accessor and schedule a render.
    delete el[prop];
  } catch {
    return;
  }
  try {
    el[prop] = value;
  } catch {
    // ignore
  }
}

function ensureMessageListReactivity(agentInterface: any) {
  if (!agentInterface || agentInterface.__limerenceMessageListReactivityPatched) return;
  agentInterface.__limerenceMessageListReactivityPatched = true;

  const props = ["messages", "tools", "pendingToolCalls", "isStreaming", "onCostClick"];

  const tryFix = () => {
    const messageList = agentInterface.querySelector?.("message-list") as any;
    if (!messageList) {
      requestAnimationFrame(tryFix);
      return;
    }
    if (messageList.__limerenceUnshadowed) return;
    for (const p of props) unshadowLitReactiveProperty(messageList, p);
    messageList.__limerenceUnshadowed = true;
  };

  tryFix();
}

// ── Agent creation ─────────────────────────────────────────────

export async function createAgent(initialState?: Partial<AgentState>) {
  if (state.agentUnsubscribe) {
    state.agentUnsubscribe();
    state.agentUnsubscribe = undefined;
  }

  const hasDirectKey = await hasDirectProviderKeyConfigured();
  let model = initialState?.model ?? (await getDefaultModel());
  if (!hasDirectKey && model.provider !== "limerence-proxy") {
    model = createProxyModel();
  }
  model = normalizeModelBaseUrl(model);
  const messages = initialState?.messages ?? createInitialMessages(model);

  const agent = new Agent({
    initialState: {
      systemPrompt: state.activePromptPreset
        ? buildSystemPromptFromPreset(state.activePromptPreset, state.character!, state.persona)
        : buildSystemPrompt(state.character!, state.persona),
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

  // Wrap agent.prompt to support chat commands, message queue, compaction, lorebook, and draft recovery
  const originalPrompt = agent.prompt.bind(agent);
  const DRAFT_KEY = "limerence-draft";

  agent.prompt = ((message: any, images?: any) => {
    if (typeof message === "string" && handleChatCommand(message)) return Promise.resolve();

    if (typeof message === "string" && isAgentBusy(agent)) {
      state.messageQueue.push(message);
      return Promise.resolve();
    }

    // Smart compaction: try lossless strategies before lossy
    const contextWindow = agent.state.model?.contextWindow ?? 128000;
    const systemTokens = estimateMessagesTokens([]);
    const smartResult = smartCompact(agent.state.messages, contextWindow, systemTokens);
    if (smartResult) {
      agent.replaceMessages(smartResult);
    } else {
      // Fall back to simple compaction
      const compacted = compactMessages(agent.state.messages, contextWindow);
      if (compacted) {
        agent.replaceMessages(compacted);
      }
    }

    // Memory + lorebook injection: update system prompt with PROFILE.md, MEMORY.md, and lorebook
    void injectContextIntoPrompt(agent);

    // Group chat: set up turn queue and swap system prompt to first speaker
    const groupMember = setupGroupTurn();
    if (groupMember) {
      agent.state.systemPrompt = buildGroupSystemPrompt(groupMember, state.groupChat.members, state.persona);
      state.groupChatLastSpeakerId = groupMember.id;
      state.groupChat = recordTurn(state.groupChat, groupMember.id);
    }

    // Apply regex rules to user input if configured
    if (typeof message === "string" && state.regexRules.length > 0) {
      message = applyRegexRules(message, state.regexRules, "input");
    }

    // Save draft for recovery on failure
    if (typeof message === "string") {
      try { sessionStorage.setItem(DRAFT_KEY, message); } catch {}
    }

    // Show Lenia loading bubble immediately so user sees feedback
    showLeniaBubble();

    return originalPrompt(message, images).then(
      (result: any) => {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        return result;
      },
      (err: any) => {
        hideLeniaBubble();
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
    if (event.type === "message_start") {
      // Hide Lenia loading bubble — actual streaming content is arriving
      hideLeniaBubble();
      // Touch reactive state to trigger header re-render (typing indicator)
      state.activeToolCalls = [...state.activeToolCalls];
      return;
    }

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
      // Apply regex rules to AI output
      if (state.regexRules.length > 0 && (event.message as any).role === "assistant") {
        applyRegexToMessage(event.message);
      }
      void indexMessageIntoMemory(event.message);
      if (!state.currentTitle) {
        state.currentTitle = generateTitle(agent.state.messages);
      }
      void saveSession();
      return;
    }

    if (event.type === "agent_end") {
      hideLeniaBubble();
      state.activeToolCalls = [];
      state.estimatedTokens = estimateMessagesTokens(agent.state.messages);
      state.contextWindow = agent.state.model?.contextWindow ?? 128000;
      void saveSession();

      // Group chat: continue with next queued speaker before draining message queue
      if (_groupTurnQueue.length > 0) {
        continueGroupTurn(agent);
        return;
      }

      drainMessageQueue();
      return;
    }
  });

  state.agent = agent;

  await state.chatPanel!.setAgent(agent, {
    onApiKeyRequired: async (provider: string) => {
      if (provider === "limerence-proxy") {
        await storage.providerKeys.set("limerence-proxy", "__PROXY__");
        return true;
      }
      return ApiKeyPromptDialog.prompt(provider);
    },
    toolsFactory: () =>
      createLimerenceTools(memoryIndex, memoryDB, limerenceStorage, {
        onFileOperation: (event) => {
          handleAgentFileOperation(event);
        },
        onMemoryFileWrite: async (path, content) => {
          await memoryDB.indexFile(path, content);
        },
        onMemoryOperation: (op) => {
          state.memoryOps = [
            { ...op, id: crypto.randomUUID(), timestamp: new Date().toISOString() } as MemoryOp,
            ...state.memoryOps,
          ].slice(0, 80);
          if (op.tool === "memory_write") void refreshMemoryFiles();
        },
      }),
  });

  // Enable image paste/drag attachments
  if (state.chatPanel!.agentInterface) {
    const agentInterface = state.chatPanel!.agentInterface;
    agentInterface.enableAttachments = true;
    agentInterface.enableModelSelector = shouldEnableModelSelector(hasDirectKey);
    installSafeSendMessagePatch(agentInterface as any);
    ensureMessageListReactivity(agentInterface as any);
  }
}

// ── Runtime bootstrap ──────────────────────────────────────────

let _chatRuntimeInitPromise: Promise<void> | null = null;

export async function ensureChatRuntime() {
  if (state.chatRuntimeReady) return;
  if (_chatRuntimeInitPromise) {
    await _chatRuntimeInitPromise;
    return;
  }

  _chatRuntimeInitPromise = (async () => {
    state.character = await loadDefaultCharacter();

    // Load persona from settings
    try {
      const persona = await storage.settings.get<Persona>(PERSONA_SETTINGS_KEY);
      if (persona?.name || persona?.description) {
        state.persona = persona;
      }
    } catch {
      // ignore
    }

    // Settings validation: ensure proxy mode is a boolean
    try {
      const raw = await storage.settings.get<unknown>(PROXY_MODE_KEY);
      state.proxyModeEnabled = typeof raw === "boolean" ? raw : true;
    } catch {
      state.proxyModeEnabled = true;
    }

    // If user has no direct provider keys, always force hosted proxy mode.
    if (!(await hasDirectProviderKeyConfigured())) {
      state.proxyModeEnabled = true;
      await setProxyModeEnabled(true);
      await storage.providerKeys.set("limerence-proxy", "__PROXY__");
    }

    // Load lorebook entries
    try {
      state.lorebookEntries = await limerenceStorage.loadLorebookEntries();
    } catch {
      state.lorebookEntries = [];
    }

    // Load active preset
    try {
      const preset = await storage.settings.get<GenerationPreset>(ACTIVE_PRESET_KEY);
      if (preset) state.activePreset = preset;
    } catch {
      // ignore
    }

    // Load regex rules
    try {
      const rules = await storage.settings.get<RegexRule[]>(REGEX_RULES_KEY);
      if (Array.isArray(rules)) state.regexRules = rules;
    } catch {
      // ignore
    }

    // Load prompt presets
    try {
      const presets = await storage.settings.get<PromptPresetConfig[]>(PROMPT_PRESETS_KEY);
      if (Array.isArray(presets)) state.promptPresets = presets;
    } catch {
      // ignore
    }

    // Load active prompt preset
    try {
      const activePreset = await storage.settings.get<PromptPresetConfig>(ACTIVE_PROMPT_PRESET_KEY);
      if (activePreset?.id) state.activePromptPreset = activePreset;
    } catch {
      // ignore
    }

    // Load character list
    try {
      state.characterList = await limerenceStorage.loadCharacters();
    } catch {
      state.characterList = [];
    }

    // Load group chat config
    try {
      const raw = await storage.settings.get<unknown>(GROUP_CHAT_KEY);
      const gc = deserializeGroupConfig(raw);
      if (gc) state.groupChat = gc;
    } catch {
      // ignore
    }

    const memoryEntries = await limerenceStorage.loadMemoryEntries();
    memoryIndex.load(memoryEntries);

    // Initialize SQLite WASM memory database
    await memoryDB.init();
    if (memoryDB.listFiles().length === 0) {
      const memoryFiles = await limerenceStorage.readAllMemoryFiles();
      for (const { path, content } of memoryFiles) {
        await memoryDB.indexFile(path, content, { persist: false });
      }
      if (memoryFiles.length > 0) {
        await memoryDB.persist();
      }
    }
    state.memoryDBReady = true;

    state.chatPanel = new ChatPanel();
    state.chatRuntimeReady = true;
  })();

  try {
    await _chatRuntimeInitPromise;
  } finally {
    _chatRuntimeInitPromise = null;
  }
}
