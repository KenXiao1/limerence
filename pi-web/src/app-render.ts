import {
  ProvidersModelsTab,
  ProxyTab,
  SettingsDialog,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { state, storage, limerenceStorage, syncEngine } from "./app-state";
import { getDefaultModel, setProxyModeEnabled, setRoute, exportCurrentSession } from "./app-agent";
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
import { loadDefaultCharacter, PERSONA_SETTINGS_KEY, buildSystemPrompt, buildSystemPromptFromPreset } from "./lib/character";
import type { Persona } from "./lib/character";
import {
  importSTPreset,
  exportPreset,
  toggleSegment,
  ACTIVE_PROMPT_PRESET_KEY,
  PROMPT_PRESETS_KEY,
} from "./controllers/prompt-presets";
import { importRegexRules, exportRegexRules } from "./controllers/regex-io";
import { downloadJson } from "./controllers/session-io";
import {
  addMember,
  removeMember,
  toggleMember,
  serializeGroupConfig,
  GROUP_CHAT_KEY,
} from "./controllers/group-chat";
import type { TurnStrategy } from "./controllers/group-chat";
import { t } from "./lib/i18n";
import { renderAuthDialog, type AuthDialogState, type AuthDialogActions, type AuthTab } from "./views/auth-dialog";
import { renderSupabaseConfigDialog, type SupabaseConfigDialogState, type SupabaseConfigDialogActions } from "./views/supabase-config-dialog";
import { isConfigured } from "./lib/supabase";
import { signUp, signIn, signOut } from "./lib/auth";

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
    authEmail: state.authUser?.email ?? null,
    syncStatus: state.syncStatus,
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
    onLoginClick: () => { handleLoginClick(); },
    onLogout: () => { void handleLogout(); },
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
    </div>
    ${renderCharacterSelectorDialog()}
    ${renderLimerenceSettingsDialog()}
    ${renderAuthDialogView()}
    ${renderSupabaseConfigDialogView()}
  `;

  renderWithRecovery(appHtml, state.chatHost);
}

// ── Auth dialog ───────────────────────────────────────────────

function renderAuthDialogView() {
  const s: AuthDialogState = {
    open: state.authDialogOpen,
    tab: state.authDialogTab,
    loading: state.authDialogLoading,
    error: state.authDialogError,
    signupSuccess: state.authSignupSuccess,
  };

  const actions: AuthDialogActions = {
    onClose: () => {
      state.authDialogOpen = false;
      state.authDialogError = "";
      state.authSignupSuccess = false;
    },
    onTabChange: (tab: AuthTab) => {
      state.authDialogTab = tab;
      state.authDialogError = "";
      state.authSignupSuccess = false;
    },
    onSubmit: (email: string, password: string) => {
      void handleAuthSubmit(email, password);
    },
    onCustomConfig: () => {
      state.supabaseConfigDialogOpen = true;
    },
  };

  return renderAuthDialog(s, actions);
}

function renderSupabaseConfigDialogView() {
  const s: SupabaseConfigDialogState = {
    open: state.supabaseConfigDialogOpen,
  };

  const actions: SupabaseConfigDialogActions = {
    onClose: () => { state.supabaseConfigDialogOpen = false; },
    onSave: () => {
      state.supabaseConfigDialogOpen = false;
      // After configuring custom Supabase, open auth dialog
      state.authDialogOpen = true;
    },
  };

  return renderSupabaseConfigDialog(s, actions);
}

function handleLoginClick() {
  if (isConfigured()) {
    // Default env config or custom localStorage config exists — go straight to auth
    state.authDialogOpen = true;
  } else {
    // No default and no custom config — must configure first
    state.supabaseConfigDialogOpen = true;
  }
}

async function handleAuthSubmit(email: string, password: string) {
  state.authDialogLoading = true;
  state.authDialogError = "";

  if (state.authDialogTab === "signup") {
    const result = await signUp(email, password);
    state.authDialogLoading = false;
    if (result.error) {
      state.authDialogError = result.error;
    } else {
      state.authSignupSuccess = true;
    }
  } else {
    const result = await signIn(email, password);
    state.authDialogLoading = false;
    if (result.error) {
      state.authDialogError = result.error;
    } else {
      state.authDialogOpen = false;
      // onAuthStateChange in main.ts will handle starting SyncEngine
    }
  }
}

async function handleLogout() {
  syncEngine.stop();
  state.authUser = null;
  state.syncStatus = "idle";
  await signOut();
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
    onExportJson: (entry) => { handleCharacterExportJson(entry); },
    onExportPng: (entry) => { void handleCharacterExportPng(entry); },
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
    let json: unknown;
    if (file.name.toLowerCase().endsWith(".png")) {
      const { readCharaFromPng } = await import("./controllers/character-png");
      json = await readCharaFromPng(file);
      if (json == null) {
        state.characterImportError = t("char.pngNoData");
        return;
      }
    } else {
      const text = await file.text();
      json = JSON.parse(text);
    }
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

function handleCharacterExportJson(entry: import("./controllers/character").CharacterEntry) {
  downloadJson(entry.card, `${entry.name}.json`);
}

async function handleCharacterExportPng(entry: import("./controllers/character").CharacterEntry) {
  const { writeCharaToPng, generatePlaceholderPng } = await import("./controllers/character-png");
  const placeholder = await generatePlaceholderPng(entry.name);
  const pngBlob = await writeCharaToPng(entry.card, placeholder);
  const url = URL.createObjectURL(pngBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.name}.png`;
  a.click();
  URL.revokeObjectURL(url);
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
    promptPresets: state.promptPresets,
    activePromptPreset: state.activePromptPreset,
    promptPresetImportError: state.promptPresetImportError,
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
    onRegexExport: () => { handleRegexExport(); },
    onRegexImport: (file) => { void handleRegexImport(file); },

    // Prompt presets
    onPromptPresetImport: (file) => { void handlePromptPresetImport(file); },
    onPromptPresetExport: () => { handlePromptPresetExport(); },
    onPromptPresetClear: () => { void handlePromptPresetClear(); },
    onPromptPresetToggleSegment: (segmentId) => { void handlePromptPresetToggleSegment(segmentId); },

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

// ── Regex IO action handlers ────────────────────────────────

function handleRegexExport() {
  const data = exportRegexRules(state.regexRules);
  downloadJson(data, `limerence-regex-${new Date().toISOString().slice(0, 10)}.json`);
}

async function handleRegexImport(file: File) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const result = importRegexRules(json);
    if (result.error || !result.rules) {
      state.regexError = result.error || "导入失败";
      return;
    }
    // Merge: add imported rules, skip duplicates by name+pattern
    const existing = new Set(state.regexRules.map((r) => `${r.name}::${r.pattern}`));
    const newRules = result.rules.filter((r) => !existing.has(`${r.name}::${r.pattern}`));
    state.regexRules = [...state.regexRules, ...newRules];
    await storage.settings.set(REGEX_RULES_KEY, state.regexRules);
    state.regexError = "";
  } catch {
    state.regexError = "导入失败：无法解析 JSON 文件";
  }
}

// ── Prompt preset action handlers ───────────────────────────

async function handlePromptPresetImport(file: File) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const result = importSTPreset(json);
    if (result.error || !result.preset) {
      state.promptPresetImportError = result.error || "导入失败";
      return;
    }
    state.activePromptPreset = result.preset;
    state.promptPresets = [...state.promptPresets, result.preset];
    await storage.settings.set(ACTIVE_PROMPT_PRESET_KEY, result.preset);
    await storage.settings.set(PROMPT_PRESETS_KEY, state.promptPresets);
    state.promptPresetImportError = "";

    // Rebuild system prompt with the new preset
    rebuildSystemPrompt();
  } catch {
    state.promptPresetImportError = "导入失败：无法解析 JSON 文件";
  }
}

function handlePromptPresetExport() {
  if (!state.activePromptPreset) return;
  const data = exportPreset(state.activePromptPreset);
  downloadJson(data, `limerence-prompt-preset-${new Date().toISOString().slice(0, 10)}.json`);
}

async function handlePromptPresetClear() {
  state.activePromptPreset = undefined;
  await storage.settings.set(ACTIVE_PROMPT_PRESET_KEY, null);

  // Restore default system prompt
  rebuildSystemPrompt();
}

async function handlePromptPresetToggleSegment(segmentId: string) {
  if (!state.activePromptPreset) return;
  state.activePromptPreset = toggleSegment(state.activePromptPreset, segmentId);
  await storage.settings.set(ACTIVE_PROMPT_PRESET_KEY, state.activePromptPreset);

  // Update the presets list too
  state.promptPresets = state.promptPresets.map((p) =>
    p.id === state.activePromptPreset!.id ? state.activePromptPreset! : p,
  );
  await storage.settings.set(PROMPT_PRESETS_KEY, state.promptPresets);

  rebuildSystemPrompt();
}

function rebuildSystemPrompt() {
  if (!state.agent || !state.character) return;
  if (state.activePromptPreset) {
    state.agent.state.systemPrompt = buildSystemPromptFromPreset(
      state.activePromptPreset,
      state.character,
      state.persona,
    );
  } else {
    state.agent.state.systemPrompt = buildSystemPrompt(state.character, state.persona);
  }
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
    }, {
      onLogin: () => { handleLoginClick(); },
      authEmail: state.authUser?.email ?? null,
      onLogout: () => { void handleLogout(); },
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
