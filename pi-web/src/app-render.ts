import {
  ProvidersModelsTab,
  ProxyTab,
  SettingsDialog,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { state, storage, limerenceStorage } from "./app-state";
import { getDefaultModel, setProxyModeEnabled, setRoute, exportCurrentSession, createAgent } from "./app-agent";
import { ROOT_PATH } from "./app-state";
import { loadSession, newSession } from "./app-session";
import { renderWorkspacePanel, toggleWorkspacePanel } from "./app-workspace";
import { mountLegacyIntro, unmountLegacyIntro } from "./legacy-intro/mount";
import { startThemeTransition } from "./theme-transition";
import { renderHeader, type HeaderState, type HeaderActions } from "./views/header";
import { renderMessageActions, type MessageActionsState, type MessageActionsCallbacks } from "./views/message-actions";
import { renderCharacterSelector, type CharacterSelectorState, type CharacterSelectorActions } from "./views/character-selector";
import { renderLimerenceSettings, type LimerenceSettingsState, type LimerenceSettingsActions } from "./views/settings-panels";
import {
  regenerateLastResponse,
  swipePrev,
  swipeNext,
  startEditLastUserMessage,
  deleteLastResponseGroup,
  saveEdit,
  cancelEdit,
  saveEditAndRegenerate,
  getLastSwipeState,
} from "./app-message-actions";
import { countDisplayableMessages } from "./controllers/message-actions";
import { validateCharacterCard, createCharacterEntry } from "./controllers/character";
import { validateImportData, readFileAsJson } from "./controllers/session-io";
import { createLorebookEntry } from "./controllers/lorebook";
import { createRegexRule, validateRegex } from "./controllers/regex-rules";
import { REGEX_RULES_KEY } from "./controllers/regex-rules";
import { ACTIVE_PRESET_KEY } from "./controllers/presets";
import { loadDefaultCharacter, PERSONA_SETTINGS_KEY } from "./lib/character";
import type { Persona } from "./lib/character";
import {
  addMember,
  removeMember,
  toggleMember,
  serializeGroupConfig,
  GROUP_CHAT_KEY,
} from "./controllers/group-chat";
import type { TurnStrategy } from "./controllers/group-chat";
import { t } from "./lib/i18n";

// ── Lit render helpers ─────────────────────────────────────────

const LIT_PART_KEY = "_$litPart$";

function resetLitContainer(container: HTMLElement) {
  container.replaceChildren();
  const litPart = (container as any)[LIT_PART_KEY];
  if (litPart) {
    delete (container as any)[LIT_PART_KEY];
  }
}

export function renderWithRecovery(view: unknown, container: HTMLElement) {
  try {
    render(view, container);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("insertBefore")) {
      throw error;
    }
  }

  resetLitContainer(container);
  render(view, container);
}

// ── Theme ──────────────────────────────────────────────────────

export function getPreferredTheme(): "light" | "dark" {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  localStorage.setItem("limerence-theme", theme);
}

// ── Chat view ──────────────────────────────────────────────────

export function renderChatView() {
  if (!state.chatHost || !state.introHost || !state.chatPanel) return;
  unmountLegacyIntro();
  state.introHost.style.display = "none";
  state.chatHost.style.display = "block";

  const headerState: HeaderState = {
    currentTitle: state.currentTitle,
    characterName: state.character?.data.name ?? "",
    isEditingTitle: state.isEditingTitle,
    focusMode: state.focusMode,
    proxyModeEnabled: state.proxyModeEnabled,
    workspacePanelOpen: state.workspacePanelOpen,
    estimatedTokens: state.estimatedTokens,
    contextWindow: state.contextWindow,
    activeToolCalls: state.activeToolCalls,
    currentSessionId: state.currentSessionId,
    preferredTheme: getPreferredTheme(),
  };

  const headerActions: HeaderActions = {
    onShowIntro: () => showIntro(true),
    onLoadSession: async (sessionId) => { await loadSession(sessionId); },
    onDeleteSession: (deletedSessionId) => {
      if (deletedSessionId === state.currentSessionId) {
        void newSession();
      }
    },
    onNewSession: () => { void newSession(); },
    onTitleChange: async (title) => {
      state.currentTitle = title;
      if (state.currentSessionId) {
        await storage.sessions.updateTitle(state.currentSessionId, title);
      }
      state.isEditingTitle = false;
    },
    onStartEditTitle: () => { state.isEditingTitle = true; },
    onToggleProxy: async () => {
      state.proxyModeEnabled = !state.proxyModeEnabled;
      await setProxyModeEnabled(state.proxyModeEnabled);
      if (state.proxyModeEnabled) {
        await storage.providerKeys.set("limerence-proxy", "__PROXY__");
      }
      state.agent!.setModel(await getDefaultModel());
    },
    onToggleWorkspace: () => { void toggleWorkspacePanel(); },
    onToggleTheme: (e) => {
      startThemeTransition(e, () => {
        const next = getPreferredTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        doRenderCurrentView();
      });
    },
    onToggleFocus: () => { state.focusMode = !state.focusMode; },
    onOpenSettings: () => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
    onOpenCharacterSelector: () => { state.characterSelectorOpen = true; },
    onOpenLimerenceSettings: () => { state.limerenceSettingsOpen = true; },
    onExportSession: () => { void exportCurrentSession(); },
    onImportSession: (file) => { void handleSessionImport(file); },
  };

  const appHtml = html`
    <div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden ${state.focusMode ? "limerence-focus-mode" : ""}">
      ${renderHeader(headerState, headerActions)}
      ${state.focusMode ? html`
        <button
          class="limerence-focus-exit"
          @click=${() => { state.focusMode = false; }}
          title="${t("app.exitFocus")}"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        </button>
      ` : null}
      <div class="limerence-chat-shell">
        <div class="limerence-chat-main">
          ${state.chatPanel}
          ${renderMessageActionsBar()}
        </div>
        ${state.workspacePanelOpen ? renderWorkspacePanel() : null}
      </div>
    </div>
    ${renderCharacterSelectorDialog()}
    ${renderLimerenceSettingsDialog()}
  `;

  renderWithRecovery(appHtml, state.chatHost);
}

// ── Message actions bar ───────────────────────────────────────

function renderMessageActionsBar() {
  const agent = state.agent;
  if (!agent) return null;

  const messages = agent.state.messages;
  const hasMessages = countDisplayableMessages(messages) > 1; // more than just greeting

  const actionsState: MessageActionsState = {
    hasMessages,
    isStreaming: agent.state.isStreaming || agent.state.pendingToolCalls.size > 0,
    swipeState: getLastSwipeState(),
    editMode: state.editMode,
    editingIndex: state.editingIndex,
    editText: state.editText,
    editRole: state.editRole,
  };

  const actionsCallbacks: MessageActionsCallbacks = {
    onRegenerate: () => { void regenerateLastResponse(); },
    onSwipePrev: () => { swipePrev(); },
    onSwipeNext: () => { swipeNext(); },
    onEditLast: () => { startEditLastUserMessage(); },
    onDeleteLast: () => { deleteLastResponseGroup(); },
    onEditSave: () => { saveEdit(); },
    onEditCancel: () => { cancelEdit(); },
    onEditTextChange: (text) => { state.editText = text; },
    onRegenerateFromEdit: () => { void saveEditAndRegenerate(); },
  };

  return renderMessageActions(actionsState, actionsCallbacks);
}

// ── Character selector dialog ─────────────────────────────────

function renderCharacterSelectorDialog() {
  const selectorState: CharacterSelectorState = {
    characters: state.characterList,
    defaultCharacterName: state.character?.data.name ?? t("char.defaultName"),
    isOpen: state.characterSelectorOpen,
    importError: state.characterImportError,
  };

  const selectorActions: CharacterSelectorActions = {
    onSelect: (entry) => { void handleCharacterSelect(entry); },
    onImport: (file) => { void handleCharacterImport(file); },
    onDelete: (id) => { void handleCharacterDelete(id); },
    onClose: () => { state.characterSelectorOpen = false; state.characterImportError = ""; },
  };

  return renderCharacterSelector(selectorState, selectorActions);
}

async function handleCharacterSelect(entry: import("./controllers/character").CharacterEntry | null) {
  state.characterSelectorOpen = false;
  state.characterImportError = "";

  if (entry === null) {
    // Select default character
    state.character = await loadDefaultCharacter();
  } else {
    state.character = entry.card;
  }

  // Start a new session with the selected character
  await newSession();
}

async function handleCharacterImport(file: File) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const result = validateCharacterCard(json);
    if (!result.card) {
      state.characterImportError = result.error;
      return;
    }
    const entry = createCharacterEntry(result.card);
    await limerenceStorage.addCharacter(entry);
    state.characterList = await limerenceStorage.loadCharacters();
    state.characterImportError = "";
  } catch {
    state.characterImportError = t("app.importFailed");
  }
}

async function handleCharacterDelete(id: string) {
  await limerenceStorage.removeCharacter(id);
  state.characterList = await limerenceStorage.loadCharacters();
}

async function handleSessionImport(file: File) {
  try {
    const json = await readFileAsJson(file);
    const result = validateImportData(json);
    if (result.error) {
      console.error("Session import error:", result.error);
      return;
    }

    const session = result.session!;

    // Create a new session, then replace messages with imported ones
    await newSession();
    if (state.agent && session.messages.length > 0) {
      state.agent.replaceMessages(session.messages);
      state.currentTitle = session.title || t("app.importedSession");
    }
  } catch (e) {
    console.error("Session import failed:", e);
  }
}

// ── Limerence settings dialog ─────────────────────────────────

function renderLimerenceSettingsDialog() {
  const settingsState: LimerenceSettingsState = {
    isOpen: state.limerenceSettingsOpen,
    activeTab: state.limerenceSettingsTab,
    persona: state.persona,
    lorebookEntries: state.lorebookEntries,
    lorebookDraftKeywords: state.lorebookDraftKeywords,
    lorebookDraftContent: state.lorebookDraftContent,
    activePreset: state.activePreset,
    customPresets: state.customPresets,
    regexRules: state.regexRules,
    regexDraftName: state.regexDraftName,
    regexDraftPattern: state.regexDraftPattern,
    regexDraftReplacement: state.regexDraftReplacement,
    regexDraftScope: state.regexDraftScope,
    regexError: state.regexError,
    groupChat: state.groupChat,
    characterList: state.characterList,
  };

  const settingsActions: LimerenceSettingsActions = {
    onClose: () => { state.limerenceSettingsOpen = false; },
    onTabChange: (tab) => { state.limerenceSettingsTab = tab; },

    // Persona
    onPersonaSave: (persona) => { void handlePersonaSave(persona); },
    onPersonaClear: () => { void handlePersonaClear(); },

    // Lorebook
    onLorebookAdd: (keywords, content) => { void handleLorebookAdd(keywords, content); },
    onLorebookDelete: (id) => { void handleLorebookDelete(id); },
    onLorebookToggle: (id) => { void handleLorebookToggle(id); },
    onLorebookDraftChange: (field, value) => {
      if (field === "keywords") state.lorebookDraftKeywords = value;
      else state.lorebookDraftContent = value;
    },

    // Presets
    onPresetSelect: (preset) => { void handlePresetSelect(preset); },

    // Regex
    onRegexAdd: (name, pattern, replacement, scope) => { void handleRegexAdd(name, pattern, replacement, scope); },
    onRegexDelete: (id) => { void handleRegexDelete(id); },
    onRegexToggle: (id) => { void handleRegexToggle(id); },
    onRegexDraftChange: (field, value) => {
      if (field === "name") state.regexDraftName = value;
      else if (field === "pattern") state.regexDraftPattern = value;
      else if (field === "replacement") state.regexDraftReplacement = value;
      else if (field === "scope") state.regexDraftScope = value as any;
    },

    // Group chat
    onGroupToggle: () => { void handleGroupToggle(); },
    onGroupAddMember: (characterId) => { void handleGroupAddMember(characterId); },
    onGroupRemoveMember: (memberId) => { void handleGroupRemoveMember(memberId); },
    onGroupToggleMember: (memberId) => { void handleGroupToggleMember(memberId); },
    onGroupStrategyChange: (strategy) => { void handleGroupStrategyChange(strategy); },
    onGroupResponsesChange: (count) => { void handleGroupResponsesChange(count); },
  };

  return renderLimerenceSettings(settingsState, settingsActions);
}

// ── Settings action handlers ──────────────────────────────────

async function handlePersonaSave(persona: Persona) {
  state.persona = persona;
  await storage.settings.set(PERSONA_SETTINGS_KEY, persona);
}

async function handlePersonaClear() {
  state.persona = undefined;
  await storage.settings.set(PERSONA_SETTINGS_KEY, null);
}

async function handleLorebookAdd(keywords: string[], content: string) {
  const entry = createLorebookEntry(keywords, content);
  state.lorebookEntries = [...state.lorebookEntries, entry];
  await limerenceStorage.saveLorebookEntries(state.lorebookEntries);
  state.lorebookDraftKeywords = "";
  state.lorebookDraftContent = "";
}

async function handleLorebookDelete(id: string) {
  state.lorebookEntries = state.lorebookEntries.filter((e) => e.id !== id);
  await limerenceStorage.saveLorebookEntries(state.lorebookEntries);
}

async function handleLorebookToggle(id: string) {
  state.lorebookEntries = state.lorebookEntries.map((e) =>
    e.id === id ? { ...e, enabled: !e.enabled } : e,
  );
  await limerenceStorage.saveLorebookEntries(state.lorebookEntries);
}

async function handlePresetSelect(preset: import("./controllers/presets").GenerationPreset) {
  state.activePreset = preset;
  await storage.settings.set(ACTIVE_PRESET_KEY, preset);
}

async function handleRegexAdd(name: string, pattern: string, replacement: string, scope: import("./controllers/regex-rules").RegexRule["scope"]) {
  const error = validateRegex(pattern, "g");
  if (error) {
    state.regexError = error;
    return;
  }
  const rule = createRegexRule(name, pattern, replacement, "g", scope);
  state.regexRules = [...state.regexRules, rule];
  await storage.settings.set(REGEX_RULES_KEY, state.regexRules);
  state.regexDraftName = "";
  state.regexDraftPattern = "";
  state.regexDraftReplacement = "";
  state.regexError = "";
}

async function handleRegexDelete(id: string) {
  state.regexRules = state.regexRules.filter((r) => r.id !== id);
  await storage.settings.set(REGEX_RULES_KEY, state.regexRules);
}

async function handleRegexToggle(id: string) {
  state.regexRules = state.regexRules.map((r) =>
    r.id === id ? { ...r, enabled: !r.enabled } : r,
  );
  await storage.settings.set(REGEX_RULES_KEY, state.regexRules);
}

// ── Group chat action handlers ───────────────────────────────

async function handleGroupToggle() {
  state.groupChat = { ...state.groupChat, enabled: !state.groupChat.enabled };
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

async function handleGroupAddMember(characterId: string) {
  const entry = state.characterList.find((c) => c.id === characterId);
  if (!entry) return;
  state.groupChat = addMember(state.groupChat, entry.card);
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

async function handleGroupRemoveMember(memberId: string) {
  state.groupChat = removeMember(state.groupChat, memberId);
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

async function handleGroupToggleMember(memberId: string) {
  state.groupChat = toggleMember(state.groupChat, memberId);
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

async function handleGroupStrategyChange(strategy: TurnStrategy) {
  state.groupChat = { ...state.groupChat, strategy };
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

async function handleGroupResponsesChange(count: number) {
  state.groupChat = { ...state.groupChat, responsesPerTurn: count };
  await storage.settings.set(GROUP_CHAT_KEY, serializeGroupConfig(state.groupChat));
}

// ── View dispatcher ────────────────────────────────────────────

export function doRenderCurrentView() {
  if (!state.chatHost || !state.introHost) return;

  if (state.appView === "intro") {
    resetLitContainer(state.chatHost);
    state.chatHost.style.display = "none";
    state.introHost.style.display = "block";
    mountLegacyIntro(state.introHost, () => {
      void _showChatCallback(true);
    });
    return;
  }

  renderChatView();
}

// showIntro is used by renderChatView's Intro button
export function showIntro(pushHistory: boolean) {
  state.appView = "intro";
  if (pushHistory) {
    setRoute(ROOT_PATH);
  }
  doRenderCurrentView();
}

// Callback for showChat — set by main.ts to avoid circular import
let _showChatCallback: (pushHistory: boolean) => Promise<void> = async () => {};
export function setShowChatCallback(fn: (pushHistory: boolean) => Promise<void>) {
  _showChatCallback = fn;
}
