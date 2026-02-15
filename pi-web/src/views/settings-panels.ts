/**
 * Settings panels — Lorebook, Presets, Regex Rules, Persona editors.
 * All rendered as tab content inside a settings dialog.
 */

import { html, type TemplateResult } from "lit";
import { t } from "../lib/i18n";
import type { LorebookEntry } from "../lib/storage";
import type { GenerationPreset } from "../controllers/presets";
import type { RegexRule } from "../controllers/regex-rules";
import type { PromptPresetConfig } from "../controllers/prompt-presets";
import type { GroupChatConfig, TurnStrategy } from "../controllers/group-chat";
import type { CharacterEntry } from "../controllers/character";
import type { Persona } from "../lib/character";
import { BUILTIN_PRESETS } from "../controllers/presets";
import type { RegexScriptData, ScriptConfig } from "../iframe-runner";

export type SettingsTab = "persona" | "lorebook" | "presets" | "regex" | "prompt" | "group" | "scripts";

export interface LimerenceSettingsState {
  isOpen: boolean;
  activeTab: SettingsTab;

  // Persona
  persona: Persona | undefined;

  // Lorebook
  lorebookEntries: LorebookEntry[];
  lorebookDraftKeywords: string;
  lorebookDraftContent: string;

  // Presets
  activePreset: GenerationPreset | undefined;
  customPresets: GenerationPreset[];

  // Regex
  regexRules: RegexRule[];
  regexDraftName: string;
  regexDraftPattern: string;
  regexDraftReplacement: string;
  regexDraftScope: RegexRule["scope"];
  regexError: string;

  // Prompt presets
  promptPresets: PromptPresetConfig[];
  activePromptPreset: PromptPresetConfig | undefined;
  promptPresetImportError: string;

  // Group chat
  groupChat: GroupChatConfig;
  characterList: CharacterEntry[];

  // Scripts (iframe-runner)
  iframeRunnerEnabled: boolean;
  iframeRunnerRegexScripts: RegexScriptData[];
  iframeRunnerPersistentScripts: ScriptConfig[];
}

export interface LimerenceSettingsActions {
  onClose: () => void;
  onTabChange: (tab: SettingsTab) => void;

  // Persona
  onPersonaSave: (persona: Persona) => void;
  onPersonaClear: () => void;

  // Lorebook
  onLorebookAdd: (keywords: string[], content: string) => void;
  onLorebookDelete: (id: string) => void;
  onLorebookToggle: (id: string) => void;
  onLorebookDraftChange: (field: "keywords" | "content", value: string) => void;

  // Presets
  onPresetSelect: (preset: GenerationPreset) => void;

  // Regex
  onRegexAdd: (name: string, pattern: string, replacement: string, scope: RegexRule["scope"]) => void;
  onRegexDelete: (id: string) => void;
  onRegexToggle: (id: string) => void;
  onRegexDraftChange: (field: "name" | "pattern" | "replacement" | "scope", value: string) => void;
  onRegexExport: () => void;
  onRegexImport: (file: File) => void;

  // Prompt presets
  onPromptPresetImport: (file: File) => void;
  onPromptPresetExport: () => void;
  onPromptPresetClear: () => void;
  onPromptPresetToggleSegment: (segmentId: string) => void;

  // Group chat
  onGroupToggle: () => void;
  onGroupAddMember: (characterId: string) => void;
  onGroupRemoveMember: (memberId: string) => void;
  onGroupToggleMember: (memberId: string) => void;
  onGroupStrategyChange: (strategy: TurnStrategy) => void;
  onGroupResponsesChange: (count: number) => void;

  // Scripts (iframe-runner)
  onIframeRunnerToggle: () => void;
  onRegexScriptToggle: (id: string) => void;
  onPersistentScriptToggle: (id: string) => void;
}

export function renderLimerenceSettings(
  s: LimerenceSettingsState,
  a: LimerenceSettingsActions,
): TemplateResult | null {
  if (!s.isOpen) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "persona", label: t("settings.persona") },
    { id: "lorebook", label: t("settings.lorebook") },
    { id: "presets", label: t("settings.presets") },
    { id: "regex", label: t("settings.regex") },
    { id: "prompt", label: t("settings.prompt") },
    { id: "group", label: t("settings.group") },
    { id: "scripts", label: t("settings.scripts") },
  ];

  return html`
    <div class="limerence-dialog-overlay" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("limerence-dialog-overlay")) a.onClose();
    }}>
      <div class="limerence-dialog limerence-settings-dialog">
        <div class="limerence-dialog-header">
          <div class="limerence-settings-tabs">
            ${tabs.map((tab) => html`
              <button
                class="limerence-settings-tab ${s.activeTab === tab.id ? "active" : ""}"
                @click=${() => a.onTabChange(tab.id)}
              >${tab.label}</button>
            `)}
          </div>
          <button class="limerence-dialog-close" @click=${a.onClose}>✕</button>
        </div>
        <div class="limerence-dialog-body">
          ${s.activeTab === "persona" ? renderPersonaTab(s, a) : null}
          ${s.activeTab === "lorebook" ? renderLorebookTab(s, a) : null}
          ${s.activeTab === "presets" ? renderPresetsTab(s, a) : null}
          ${s.activeTab === "regex" ? renderRegexTab(s, a) : null}
          ${s.activeTab === "prompt" ? renderPromptTab(s, a) : null}
          ${s.activeTab === "group" ? renderGroupTab(s, a) : null}
          ${s.activeTab === "scripts" ? renderScriptsTab(s, a) : null}
        </div>
      </div>
    </div>
  `;
}

// ── Persona tab ─────────────────────────────────────────────────

function renderPersonaTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  const name = s.persona?.name ?? "";
  const desc = s.persona?.description ?? "";

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("persona.hint")}</p>
      <label class="limerence-settings-label">${t("persona.nameLabel")}</label>
      <input
        class="limerence-settings-input"
        type="text"
        .value=${name}
        placeholder="${t("persona.namePlaceholder")}"
        id="persona-name"
      />
      <label class="limerence-settings-label">${t("persona.descLabel")}</label>
      <textarea
        class="limerence-settings-textarea"
        .value=${desc}
        placeholder="${t("persona.descPlaceholder")}"
        rows="4"
        id="persona-desc"
      ></textarea>
      <div class="limerence-settings-actions">
        <button class="limerence-btn-primary" @click=${() => {
          const nameEl = document.getElementById("persona-name") as HTMLInputElement;
          const descEl = document.getElementById("persona-desc") as HTMLTextAreaElement;
          a.onPersonaSave({ name: nameEl?.value ?? "", description: descEl?.value ?? "" });
        }}>${t("persona.save")}</button>
        <button class="limerence-btn-ghost" @click=${a.onPersonaClear}>${t("persona.clear")}</button>
      </div>
    </div>
  `;
}

// ── Lorebook tab ────────────────────────────────────────────────

function renderLorebookTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("lorebook.hint")}</p>

      <!-- Add new entry -->
      <div class="limerence-lorebook-form">
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.lorebookDraftKeywords}
          placeholder="${t("lorebook.keywordsPlaceholder")}"
          @input=${(e: Event) => a.onLorebookDraftChange("keywords", (e.target as HTMLInputElement).value)}
        />
        <textarea
          class="limerence-settings-textarea"
          .value=${s.lorebookDraftContent}
          placeholder="${t("lorebook.contentPlaceholder")}"
          rows="3"
          @input=${(e: Event) => a.onLorebookDraftChange("content", (e.target as HTMLTextAreaElement).value)}
        ></textarea>
        <button class="limerence-btn-primary" @click=${() => {
          const kws = s.lorebookDraftKeywords.split(",").map((k) => k.trim()).filter(Boolean);
          if (kws.length > 0 && s.lorebookDraftContent.trim()) {
            a.onLorebookAdd(kws, s.lorebookDraftContent.trim());
          }
        }}>${t("lorebook.add")}</button>
      </div>

      <!-- Existing entries -->
      ${s.lorebookEntries.length === 0 ? html`<p class="limerence-settings-empty">${t("lorebook.empty")}</p>` : null}
      ${s.lorebookEntries.map((entry) => html`
        <div class="limerence-lorebook-entry ${entry.enabled ? "" : "disabled"}">
          <div class="limerence-lorebook-entry-header">
            <span class="limerence-lorebook-keywords">${entry.keywords.join(", ")}</span>
            <div class="limerence-lorebook-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onLorebookToggle(entry.id)} title="${entry.enabled ? t("lorebook.disable") : t("lorebook.enable")}">
                ${entry.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onLorebookDelete(entry.id)} title="${t("lorebook.delete")}">✕</button>
            </div>
          </div>
          <div class="limerence-lorebook-content">${entry.content.length > 120 ? entry.content.slice(0, 120) + "..." : entry.content}</div>
        </div>
      `)}
    </div>
  `;
}

// ── Presets tab ──────────────────────────────────────────────────

function renderPresetsTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  const allPresets = [...BUILTIN_PRESETS, ...s.customPresets];
  const activeId = s.activePreset?.id ?? "default";

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("presets.hint")}</p>
      ${allPresets.map((preset) => html`
        <button
          class="limerence-preset-item ${activeId === preset.id ? "active" : ""}"
          @click=${() => a.onPresetSelect(preset)}
        >
          <div class="limerence-preset-name">${preset.name}</div>
          <div class="limerence-preset-params">
            T=${preset.temperature} · TopP=${preset.topP} · Max=${preset.maxTokens}
          </div>
        </button>
      `)}
    </div>
  `;
}

// ── Regex tab ───────────────────────────────────────────────────

function renderRegexTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("regex.hint")}</p>

      <!-- Import / Export -->
      <div class="limerence-settings-actions" style="margin-bottom:8px">
        <label class="limerence-btn-ghost" style="cursor:pointer">
          ${t("regex.import")}
          <input type="file" accept=".json" style="display:none" @change=${(e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) a.onRegexImport(file);
            (e.target as HTMLInputElement).value = "";
          }} />
        </label>
        <button class="limerence-btn-ghost" @click=${a.onRegexExport} ?disabled=${s.regexRules.length === 0}>${t("regex.export")}</button>
        <span class="limerence-settings-hint" style="font-size:0.75rem;margin:0">${t("regex.importHint")}</span>
      </div>

      <!-- Add new rule -->
      <div class="limerence-regex-form">
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftName}
          placeholder="${t("regex.namePlaceholder")}"
          @input=${(e: Event) => a.onRegexDraftChange("name", (e.target as HTMLInputElement).value)}
        />
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftPattern}
          placeholder="${t("regex.patternPlaceholder")}"
          @input=${(e: Event) => a.onRegexDraftChange("pattern", (e.target as HTMLInputElement).value)}
        />
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftReplacement}
          placeholder="${t("regex.replacementPlaceholder")}"
          @input=${(e: Event) => a.onRegexDraftChange("replacement", (e.target as HTMLInputElement).value)}
        />
        <select
          class="limerence-settings-select"
          .value=${s.regexDraftScope}
          @change=${(e: Event) => a.onRegexDraftChange("scope", (e.target as HTMLSelectElement).value)}
        >
          <option value="output">${t("regex.scopeOutput")}</option>
          <option value="input">${t("regex.scopeInput")}</option>
          <option value="both">${t("regex.scopeBoth")}</option>
        </select>
        ${s.regexError ? html`<div class="limerence-char-error">${s.regexError}</div>` : null}
        <button class="limerence-btn-primary" @click=${() => {
          if (s.regexDraftName.trim() && s.regexDraftPattern.trim()) {
            a.onRegexAdd(s.regexDraftName.trim(), s.regexDraftPattern, s.regexDraftReplacement, s.regexDraftScope);
          }
        }}>${t("regex.add")}</button>
      </div>

      <!-- Existing rules -->
      ${s.regexRules.length === 0 ? html`<p class="limerence-settings-empty">${t("regex.empty")}</p>` : null}
      ${s.regexRules.map((rule) => html`
        <div class="limerence-regex-entry ${rule.enabled ? "" : "disabled"}">
          <div class="limerence-regex-entry-header">
            <span class="limerence-regex-name">${rule.name}</span>
            <span class="limerence-regex-scope">${rule.scope === "output" ? t("regex.scopeOutputShort") : rule.scope === "input" ? t("regex.scopeInputShort") : t("regex.scopeBothShort")}</span>
            <div class="limerence-regex-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onRegexToggle(rule.id)} title="${rule.enabled ? t("regex.disable") : t("regex.enable")}">
                ${rule.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onRegexDelete(rule.id)} title="${t("regex.delete")}">✕</button>
            </div>
          </div>
          <div class="limerence-regex-pattern">/${rule.pattern}/${rule.flags} → ${rule.replacement || t("regex.emptyReplacement")}</div>
        </div>
      `)}
    </div>
  `;
}

// ── Prompt presets tab ────────────────────────────────────────

function renderPromptTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  const preset = s.activePromptPreset;
  const roleLabel = (role: string) => {
    if (role === "user") return t("prompt.roleUser");
    if (role === "assistant") return t("prompt.roleAssistant");
    return t("prompt.roleSystem");
  };

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("prompt.hint")}</p>

      <!-- Import / Export / Clear -->
      <div class="limerence-settings-actions" style="margin-bottom:8px">
        <label class="limerence-btn-primary" style="cursor:pointer">
          ${t("prompt.import")}
          <input type="file" accept=".json" style="display:none" @change=${(e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) a.onPromptPresetImport(file);
            (e.target as HTMLInputElement).value = "";
          }} />
        </label>
        <button class="limerence-btn-ghost" @click=${a.onPromptPresetExport} ?disabled=${!preset}>${t("prompt.export")}</button>
        <button class="limerence-btn-ghost" @click=${a.onPromptPresetClear} ?disabled=${!preset}>${t("prompt.clear")}</button>
      </div>

      ${s.promptPresetImportError ? html`<div class="limerence-char-error">${s.promptPresetImportError}</div>` : null}

      <!-- Active preset info -->
      <div style="margin-bottom:8px">
        <span class="limerence-settings-label">${t("prompt.active")}：</span>
        <span>${preset ? preset.name : t("prompt.none")}</span>
      </div>

      <!-- Segment list -->
      ${preset ? html`
        <label class="limerence-settings-label">${t("prompt.segments")}</label>
        ${preset.segments.map((seg) => html`
          <div class="limerence-regex-entry ${seg.enabled ? "" : "disabled"}">
            <div class="limerence-regex-entry-header">
              <span class="limerence-regex-name">${seg.name || seg.identifier}</span>
              <span class="limerence-regex-scope">${seg.marker ? t("prompt.marker") : roleLabel(seg.role)}</span>
              <div class="limerence-regex-entry-actions">
                <button class="limerence-btn-icon" @click=${() => a.onPromptPresetToggleSegment(seg.identifier)} title="${seg.enabled ? t("regex.disable") : t("regex.enable")}">
                  ${seg.enabled ? "●" : "○"}
                </button>
              </div>
            </div>
            ${!seg.marker && seg.content.trim() ? html`
              <div class="limerence-regex-pattern">${seg.content.length > 100 ? seg.content.slice(0, 100) + "..." : seg.content}</div>
            ` : null}
          </div>
        `)}
      ` : null}
    </div>
  `;
}

// ── Group chat tab ───────────────────────────────────────────────

function renderGroupTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  const gc = s.groupChat;
  const memberIds = new Set(gc.members.map((m) => m.card.data.name));
  // Characters available to add (not already in group)
  const available = s.characterList.filter((c) => !memberIds.has(c.card.data.name));

  const strategyLabels: Record<TurnStrategy, string> = {
    "round-robin": t("group.roundRobin"),
    "random": t("group.random"),
    "natural": t("group.natural"),
    "manual": t("group.manual"),
  };

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("group.hint")}</p>

      <!-- Enable toggle -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <button
          class="limerence-btn-${gc.enabled ? "primary" : "ghost"}"
          @click=${a.onGroupToggle}
        >${gc.enabled ? t("group.enabled") : t("group.enable")}</button>
      </div>

      <!-- Strategy -->
      <label class="limerence-settings-label">${t("group.strategyLabel")}</label>
      <select
        class="limerence-settings-select"
        .value=${gc.strategy}
        @change=${(e: Event) => a.onGroupStrategyChange((e.target as HTMLSelectElement).value as TurnStrategy)}
      >
        ${(Object.keys(strategyLabels) as TurnStrategy[]).map((k) => html`
          <option value=${k} ?selected=${gc.strategy === k}>${strategyLabels[k]}</option>
        `)}
      </select>

      <!-- Responses per turn -->
      <label class="limerence-settings-label">${t("group.responsesLabel")}</label>
      <select
        class="limerence-settings-select"
        .value=${String(gc.responsesPerTurn)}
        @change=${(e: Event) => a.onGroupResponsesChange(Number((e.target as HTMLSelectElement).value))}
      >
        ${[1, 2, 3].map((n) => html`
          <option value=${String(n)} ?selected=${gc.responsesPerTurn === n}>${n}</option>
        `)}
      </select>

      <!-- Add member -->
      ${available.length > 0 ? html`
        <label class="limerence-settings-label">${t("group.addLabel")}</label>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${available.map((c) => html`
            <button
              class="limerence-btn-ghost"
              style="font-size:0.8rem;padding:4px 10px"
              @click=${() => a.onGroupAddMember(c.id)}
            >+ ${c.name}</button>
          `)}
        </div>
      ` : s.characterList.length === 0 ? html`
        <p class="limerence-settings-empty">${t("group.importFirst")}</p>
      ` : null}

      <!-- Current members -->
      <label class="limerence-settings-label">${t("group.membersLabel")}</label>
      ${gc.members.length === 0 ? html`<p class="limerence-settings-empty">${t("group.noMembers")}</p>` : null}
      ${gc.members.map((m) => html`
        <div class="limerence-lorebook-entry ${m.enabled ? "" : "disabled"}">
          <div class="limerence-lorebook-entry-header">
            <span class="limerence-lorebook-keywords">${m.card.data.name}</span>
            <div class="limerence-lorebook-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onGroupToggleMember(m.id)} title="${m.enabled ? t("group.disable") : t("group.enable2")}">
                ${m.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onGroupRemoveMember(m.id)} title="${t("group.remove")}">✕</button>
            </div>
          </div>
          <div class="limerence-lorebook-content">${m.card.data.description?.slice(0, 80) || m.card.data.personality?.slice(0, 80) || t("group.noDesc")}</div>
        </div>
      `)}
    </div>
  `;
}

// ── Scripts tab (iframe-runner) ──────────────────────────────────

function renderScriptsTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  const regexScripts = s.iframeRunnerRegexScripts;
  const persistentScripts = s.iframeRunnerPersistentScripts;
  const hasScripts = regexScripts.length > 0 || persistentScripts.length > 0;

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">${t("scripts.hint")}</p>

      <!-- Global toggle -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <button
          class="limerence-btn-${s.iframeRunnerEnabled ? "primary" : "ghost"}"
          @click=${a.onIframeRunnerToggle}
        >${s.iframeRunnerEnabled ? t("scripts.enabled") : t("scripts.enable")}</button>
      </div>

      ${!hasScripts ? html`<p class="limerence-settings-empty">${t("scripts.noScripts")}</p>` : null}

      <!-- Regex scripts from character card -->
      ${regexScripts.length > 0 ? html`
        <label class="limerence-settings-label">${t("scripts.regexLabel")}</label>
        ${regexScripts.map((script) => html`
          <div class="limerence-regex-entry ${script.disabled ? "disabled" : ""}">
            <div class="limerence-regex-entry-header">
              <span class="limerence-regex-name">${script.scriptName}</span>
              <span class="limerence-regex-scope">${script.placement.includes(2) ? t("scripts.aiOutput") : t("scripts.userInput")}</span>
              <div class="limerence-regex-entry-actions">
                <button class="limerence-btn-icon" @click=${() => a.onRegexScriptToggle(script.id)} title="${script.disabled ? t("scripts.enableScript") : t("scripts.disableScript")}">
                  ${script.disabled ? "○" : "●"}
                </button>
              </div>
            </div>
            <div class="limerence-regex-pattern">/${script.findRegex.length > 60 ? script.findRegex.slice(0, 60) + "..." : script.findRegex}/</div>
          </div>
        `)}
      ` : null}

      <!-- Persistent scripts -->
      ${persistentScripts.length > 0 ? html`
        <label class="limerence-settings-label" style="margin-top:12px">${t("scripts.persistentLabel")}</label>
        ${persistentScripts.map((script) => html`
          <div class="limerence-regex-entry ${script.enabled ? "" : "disabled"}">
            <div class="limerence-regex-entry-header">
              <span class="limerence-regex-name">${script.name}</span>
              <span class="limerence-regex-scope">${script.source}</span>
              <div class="limerence-regex-entry-actions">
                <button class="limerence-btn-icon" @click=${() => a.onPersistentScriptToggle(script.id)} title="${script.enabled ? t("scripts.disableScript") : t("scripts.enableScript")}">
                  ${script.enabled ? "●" : "○"}
                </button>
              </div>
            </div>
          </div>
        `)}
      ` : null}
    </div>
  `;
}
