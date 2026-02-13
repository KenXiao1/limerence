import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { Agent, type AgentMessage, type AgentState } from "@mariozechner/pi-agent-core";
import { getModel, type AssistantMessage, type Model, type Usage } from "@mariozechner/pi-ai";
import {
  ApiKeyPromptDialog,
  AppStorage,
  ChatPanel,
  CustomProvidersStore,
  IndexedDBStorageBackend,
  ProvidersModelsTab,
  ProxyTab,
  SessionListDialog,
  SessionsStore,
  SettingsDialog,
  SettingsStore,
  ProviderKeysStore,
  defaultConvertToLlm,
  setAppStorage,
} from "@mariozechner/pi-web-ui";
import { History, Plus, Settings, Server } from "lucide";
import { html, render } from "lit";
import "./app.css";
import { buildSystemPrompt, loadDefaultCharacter, type CharacterCard } from "./lib/character";
import { MemoryIndex, type MemoryEntry } from "./lib/memory";
import { getLimerenceStoreConfigs, LimerenceStorage } from "./lib/storage";
import { createLimerenceTools } from "./lib/tools";
import { mountLegacyIntro, unmountLegacyIntro } from "./legacy-intro/mount";

const DB_NAME = "limerence-pi-web";
const DB_VERSION = 1;
const PROXY_MODE_KEY = "limerence.proxy_mode";
const ROOT_PATH = "/";
const CHAT_PATH = "/chat";

type ViewMode = "intro" | "chat";

const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();

const backend = new IndexedDBStorageBackend({
  dbName: DB_NAME,
  version: DB_VERSION,
  stores: [
    settings.getConfig(),
    SessionsStore.getMetadataConfig(),
    providerKeys.getConfig(),
    customProviders.getConfig(),
    sessions.getConfig(),
    ...getLimerenceStoreConfigs(),
  ],
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
sessions.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

const limerenceStorage = new LimerenceStorage(backend);
const memoryIndex = new MemoryIndex();

let appRoot: HTMLElement | null = null;
let chatHost: HTMLElement | null = null;
let introHost: HTMLElement | null = null;
let appView: ViewMode = "intro";
let chatRuntimeReady = false;

let character: CharacterCard;
let chatPanel: ChatPanel;
let agent: Agent;
let agentUnsubscribe: (() => void) | undefined;
let currentSessionId: string | undefined;
let currentSessionCreatedAt = new Date().toISOString();
let currentTitle = "";
let isEditingTitle = false;
let proxyModeEnabled = false;
let switchingToChat = false;
const LIT_PART_KEY = "_$litPart$";

function resetLitContainer(container: HTMLElement) {
  container.replaceChildren();
  const litPart = (container as any)[LIT_PART_KEY];
  if (litPart) {
    delete (container as any)[LIT_PART_KEY];
  }
}

function renderWithRecovery(view: unknown, container: HTMLElement) {
  try {
    render(view, container);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("insertBefore")) {
      throw error;
    }
  }

  // Recover from stale lit markers left in container state.
  resetLitContainer(container);
  render(view, container);
}

function getPreferredTheme(): "light" | "dark" {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  localStorage.setItem("limerence-theme", theme);
}

function defaultUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function createProxyModel(): Model<"openai-completions"> {
  return {
    id: "deepseek-chat",
    name: "deepseek-chat (Netlify Proxy)",
    api: "openai-completions",
    provider: "limerence-proxy",
    baseUrl: "/api/llm/v1",
    reasoning: false,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

function createDirectModel(): Model<any> {
  try {
    return getModel("openai", "gpt-4o-mini");
  } catch {
    return getModel("openai", "gpt-4.1-mini");
  }
}

async function getDefaultModel(): Promise<Model<any>> {
  const proxyMode = await isProxyModeEnabled();
  return proxyMode ? createProxyModel() : createDirectModel();
}

function buildGreetingMessage(model: Model<any>): AssistantMessage | null {
  const text = character.data.first_mes?.trim();
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

function createInitialMessages(model: Model<any>): AgentMessage[] {
  const greeting = buildGreetingMessage(model);
  return greeting ? [greeting] : [];
}

function setRoute(pathname: string, sessionId?: string, replace = false) {
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

function updateUrl(sessionId: string) {
  setRoute(CHAT_PATH, sessionId, true);
}

function isChatRoute(): boolean {
  const url = new URL(window.location.href);
  return url.pathname === CHAT_PATH || url.searchParams.has("session");
}

function generateTitle(messages: AgentMessage[]): string {
  const firstUser = messages.find((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  if (!firstUser) return "";

  const content = (firstUser as any).content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join(" ");
  }

  text = text.trim();
  if (!text) return "";

  const sentenceEnd = text.search(/[.!?。！？]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return text.slice(0, sentenceEnd + 1);
  }

  return text.length <= 50 ? text : `${text.slice(0, 47)}...`;
}

function hasRealAssistantText(message: AgentMessage): boolean {
  if ((message as any).role !== "assistant") return false;
  const content = (message as any).content;
  if (!Array.isArray(content)) return false;
  return content.some((c: any) => c?.type === "text" && String(c.text ?? "").trim().length > 0);
}

function shouldSaveSession(messages: AgentMessage[]): boolean {
  const hasUser = messages.some((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  const hasAssistant = messages.some((m) => hasRealAssistantText(m));
  return hasUser && hasAssistant;
}

function extractPlainText(message: AgentMessage): string {
  const role = (message as any).role;
  const content = (message as any).content;

  if (role === "user" || role === "user-with-attachments") {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => String(c.text ?? ""))
        .join("\n")
        .trim();
    }
    return "";
  }

  if (role === "assistant") {
    if (!Array.isArray(content)) return "";
    return content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join("\n")
      .trim();
  }

  return "";
}

function summarizeUsage(messages: AgentMessage[]): Usage {
  const usage = defaultUsage();

  for (const msg of messages) {
    if ((msg as any).role !== "assistant") continue;
    const u = (msg as any).usage as Usage | undefined;
    if (!u) continue;

    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.totalTokens += u.totalTokens;
    usage.cost.input += u.cost.input;
    usage.cost.output += u.cost.output;
    usage.cost.cacheRead += u.cost.cacheRead;
    usage.cost.cacheWrite += u.cost.cacheWrite;
    usage.cost.total += u.cost.total;
  }

  return usage;
}

async function indexMessageIntoMemory(message: AgentMessage) {
  const role = (message as any).role;
  if (role !== "user" && role !== "assistant") return;

  const text = extractPlainText(message);
  if (!text) return;

  const entry: MemoryEntry = {
    session_id: currentSessionId ?? "",
    timestamp: new Date().toISOString(),
    role,
    content: text,
  };

  memoryIndex.add(entry);
  await limerenceStorage.addMemoryEntry(entry);
}

async function saveSession() {
  if (!currentSessionId || !agent) return;

  const state = agent.state;
  if (!shouldSaveSession(state.messages)) return;

  if (!currentTitle) {
    currentTitle = generateTitle(state.messages) || "未命名会话";
  }

  const now = new Date().toISOString();
  const usage = summarizeUsage(state.messages);

  const sessionData = {
    id: currentSessionId,
    title: currentTitle,
    model: state.model,
    thinkingLevel: state.thinkingLevel,
    messages: state.messages,
    createdAt: currentSessionCreatedAt,
    lastModified: now,
  };

  const metadata = {
    id: currentSessionId,
    title: currentTitle,
    createdAt: currentSessionCreatedAt,
    lastModified: now,
    messageCount: state.messages.length,
    usage,
    modelId: state.model?.id ?? null,
    thinkingLevel: state.thinkingLevel,
    preview: generateTitle(state.messages),
  };

  await storage.sessions.save(sessionData, metadata);
}

async function isProxyModeEnabled(): Promise<boolean> {
  return (await storage.settings.get<boolean>(PROXY_MODE_KEY)) ?? false;
}

async function setProxyModeEnabled(enabled: boolean): Promise<void> {
  await storage.settings.set(PROXY_MODE_KEY, enabled);
}

async function createAgent(initialState?: Partial<AgentState>) {
  if (agentUnsubscribe) {
    agentUnsubscribe();
    agentUnsubscribe = undefined;
  }

  const model = initialState?.model ?? (await getDefaultModel());
  const messages = initialState?.messages ?? createInitialMessages(model);

  agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(character),
      model,
      thinkingLevel: initialState?.thinkingLevel ?? "off",
      messages,
      tools: initialState?.tools ?? [],
    },
    convertToLlm: defaultConvertToLlm,
  });

  if (currentSessionId) {
    agent.sessionId = currentSessionId;
  }

  agentUnsubscribe = agent.subscribe((event) => {
    if (event.type === "message_end") {
      void indexMessageIntoMemory(event.message);
      if (!currentTitle) {
        currentTitle = generateTitle(agent.state.messages);
      }
      void saveSession();
      renderCurrentView();
      return;
    }

    if (event.type === "agent_end") {
      void saveSession();
      renderCurrentView();
      return;
    }

    renderCurrentView();
  });

  await chatPanel.setAgent(agent, {
    onApiKeyRequired: async (provider: string) => {
      const proxyMode = await isProxyModeEnabled();
      if (proxyMode && provider === "limerence-proxy") {
        await storage.providerKeys.set("limerence-proxy", "__PROXY__");
        return true;
      }
      return ApiKeyPromptDialog.prompt(provider);
    },
    toolsFactory: () => createLimerenceTools(memoryIndex, limerenceStorage),
  });
}

async function loadSession(sessionId: string): Promise<boolean> {
  const data = await storage.sessions.get(sessionId);
  if (!data) return false;

  appView = "chat";
  currentSessionId = sessionId;
  currentTitle = data.title ?? "";
  currentSessionCreatedAt = data.createdAt;

  await createAgent({
    model: data.model,
    thinkingLevel: data.thinkingLevel,
    messages: data.messages,
    tools: [],
  });

  updateUrl(sessionId);
  renderCurrentView();
  return true;
}

async function newSession() {
  appView = "chat";
  currentSessionId = crypto.randomUUID();
  currentSessionCreatedAt = new Date().toISOString();
  currentTitle = "";
  isEditingTitle = false;

  updateUrl(currentSessionId);
  await createAgent();
  renderCurrentView();
}

async function ensureChatRuntime() {
  if (chatRuntimeReady) return;

  character = await loadDefaultCharacter();
  proxyModeEnabled = await isProxyModeEnabled();

  const memoryEntries = await limerenceStorage.loadMemoryEntries();
  memoryIndex.load(memoryEntries);

  chatPanel = new ChatPanel();
  chatRuntimeReady = true;
}

function renderChatView() {
  if (!chatHost || !introHost || !chatPanel) return;
  unmountLegacyIntro();
  introHost.style.display = "none";
  chatHost.style.display = "block";

  const headerTitle = currentTitle || character?.data.name || "Limerence Pi Web";

  const appHtml = html`
    <div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div class="flex items-center justify-between border-b border-border shrink-0">
        <div class="flex items-center gap-2 px-4 py-2 min-w-0">
          ${Button({
            variant: "ghost",
            size: "sm",
            children: html`<span class="text-xs">Intro</span>`,
            onClick: () => {
              showIntro(true);
            },
            title: "返回首页",
          })}

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(History, "sm"),
            onClick: () => {
              SessionListDialog.open(
                async (sessionId) => {
                  await loadSession(sessionId);
                },
                (deletedSessionId) => {
                  if (deletedSessionId === currentSessionId) {
                    void newSession();
                  }
                },
              );
            },
            title: "会话列表",
          })}

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(Plus, "sm"),
            onClick: () => {
              void newSession();
            },
            title: "新会话",
          })}

          ${
            isEditingTitle
              ? Input({
                  type: "text",
                  value: headerTitle,
                  className: "text-sm w-64",
                  onChange: async (e: Event) => {
                    const next = (e.target as HTMLInputElement).value.trim();
                    if (next) {
                      currentTitle = next;
                      if (currentSessionId) {
                        await storage.sessions.updateTitle(currentSessionId, next);
                      }
                    }
                    isEditingTitle = false;
                    renderCurrentView();
                  },
                })
              : html`<button
                  class="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors truncate max-w-[24rem]"
                  @click=${() => {
                    isEditingTitle = true;
                    renderCurrentView();
                  }}
                  title="点击编辑标题"
                >
                  ${headerTitle}
                </button>`
          }
        </div>

        <div class="flex items-center gap-1 px-2">
          ${Button({
            variant: "ghost",
            size: "sm",
            children: html`<span class="inline-flex items-center gap-1">${icon(Server, "sm")}<span class="text-xs">Proxy ${proxyModeEnabled ? "ON" : "OFF"}</span></span>`,
            onClick: async () => {
              proxyModeEnabled = !proxyModeEnabled;
              await setProxyModeEnabled(proxyModeEnabled);
              if (proxyModeEnabled) {
                await storage.providerKeys.set("limerence-proxy", "__PROXY__");
              }
              agent.setModel(await getDefaultModel());
              renderCurrentView();
            },
            title: "切换 Netlify 代理模式",
          })}

          <theme-toggle></theme-toggle>

          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(Settings, "sm"),
            onClick: () => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
            title: "设置",
          })}
        </div>
      </div>

      ${chatPanel}
    </div>
  `;

  renderWithRecovery(appHtml, chatHost);
}

function renderCurrentView() {
  if (!chatHost || !introHost) return;

  if (appView === "intro") {
    resetLitContainer(chatHost);
    chatHost.style.display = "none";
    introHost.style.display = "block";
    mountLegacyIntro(introHost, () => {
      void showChat(true);
    });
    return;
  }

  renderChatView();
}

function showIntro(pushHistory: boolean) {
  appView = "intro";
  if (pushHistory) {
    setRoute(ROOT_PATH);
  }
  renderCurrentView();
}

async function showChat(pushHistory: boolean) {
  if (switchingToChat) return;
  switchingToChat = true;

  try {
    if (pushHistory) {
      setRoute(CHAT_PATH);
    }

    appView = "chat";
    await ensureChatRuntime();

    if (currentSessionId) {
      updateUrl(currentSessionId);
      renderCurrentView();
      return;
    }

    const sessionId = new URLSearchParams(window.location.search).get("session");
    if (sessionId) {
      const ok = await loadSession(sessionId);
      if (ok) return;
    }

    await newSession();
  } finally {
    switchingToChat = false;
  }
}

async function routeByLocation() {
  if (isChatRoute()) {
    await showChat(false);
  } else {
    showIntro(false);
  }
}

async function initApp() {
  appRoot = document.getElementById("app");
  if (!appRoot) throw new Error("App container not found");
  appRoot.innerHTML = "";

  chatHost = document.createElement("div");
  introHost = document.createElement("div");
  chatHost.style.width = "100%";
  chatHost.style.height = "100%";
  introHost.style.width = "100%";
  introHost.style.height = "100%";
  appRoot.append(chatHost, introHost);

  applyTheme(getPreferredTheme());

  renderWithRecovery(
    html`<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
      <div class="text-muted-foreground">Loading...</div>
    </div>`,
    chatHost,
  );
  introHost.style.display = "none";

  window.addEventListener("popstate", () => {
    void routeByLocation();
  });

  await routeByLocation();
}

void initApp();
