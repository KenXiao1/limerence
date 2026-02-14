/**
 * Settings panels — Lorebook, Presets, Regex Rules, Persona editors.
 * All rendered as tab content inside a settings dialog.
 */

import { html, type TemplateResult } from "lit";
import type { LorebookEntry } from "../lib/storage";
import type { GenerationPreset } from "../controllers/presets";
import type { RegexRule } from "../controllers/regex-rules";
import type { GroupChatConfig, TurnStrategy } from "../controllers/group-chat";
import type { CharacterEntry } from "../controllers/character";
import type { Persona } from "../lib/character";
import { BUILTIN_PRESETS } from "../controllers/presets";

export type SettingsTab = "persona" | "lorebook" | "presets" | "regex" | "group";

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

  // Group chat
  groupChat: GroupChatConfig;
  characterList: CharacterEntry[];
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

  // Group chat
  onGroupToggle: () => void;
  onGroupAddMember: (characterId: string) => void;
  onGroupRemoveMember: (memberId: string) => void;
  onGroupToggleMember: (memberId: string) => void;
  onGroupStrategyChange: (strategy: TurnStrategy) => void;
  onGroupResponsesChange: (count: number) => void;
}

export function renderLimerenceSettings(
  s: LimerenceSettingsState,
  a: LimerenceSettingsActions,
): TemplateResult | null {
  if (!s.isOpen) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "persona", label: "人设" },
    { id: "lorebook", label: "世界书" },
    { id: "presets", label: "预设" },
    { id: "regex", label: "正则" },
    { id: "group", label: "群聊" },
  ];

  return html`
    <div class="limerence-dialog-overlay" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("limerence-dialog-overlay")) a.onClose();
    }}>
      <div class="limerence-dialog limerence-settings-dialog">
        <div class="limerence-dialog-header">
          <div class="limerence-settings-tabs">
            ${tabs.map((t) => html`
              <button
                class="limerence-settings-tab ${s.activeTab === t.id ? "active" : ""}"
                @click=${() => a.onTabChange(t.id)}
              >${t.label}</button>
            `)}
          </div>
          <button class="limerence-dialog-close" @click=${a.onClose}>✕</button>
        </div>
        <div class="limerence-dialog-body">
          ${s.activeTab === "persona" ? renderPersonaTab(s, a) : null}
          ${s.activeTab === "lorebook" ? renderLorebookTab(s, a) : null}
          ${s.activeTab === "presets" ? renderPresetsTab(s, a) : null}
          ${s.activeTab === "regex" ? renderRegexTab(s, a) : null}
          ${s.activeTab === "group" ? renderGroupTab(s, a) : null}
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
      <p class="limerence-settings-hint">设置你的角色名和描述，AI 会在对话中使用这些信息。支持 {{user}} 模板变量。</p>
      <label class="limerence-settings-label">名字</label>
      <input
        class="limerence-settings-input"
        type="text"
        .value=${name}
        placeholder="你的名字"
        id="persona-name"
      />
      <label class="limerence-settings-label">描述</label>
      <textarea
        class="limerence-settings-textarea"
        .value=${desc}
        placeholder="关于你的描述（性格、外貌等）"
        rows="4"
        id="persona-desc"
      ></textarea>
      <div class="limerence-settings-actions">
        <button class="limerence-btn-primary" @click=${() => {
          const nameEl = document.getElementById("persona-name") as HTMLInputElement;
          const descEl = document.getElementById("persona-desc") as HTMLTextAreaElement;
          a.onPersonaSave({ name: nameEl?.value ?? "", description: descEl?.value ?? "" });
        }}>保存</button>
        <button class="limerence-btn-ghost" @click=${a.onPersonaClear}>清除</button>
      </div>
    </div>
  `;
}

// ── Lorebook tab ────────────────────────────────────────────────

function renderLorebookTab(s: LimerenceSettingsState, a: LimerenceSettingsActions): TemplateResult {
  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">当对话中出现关键词时，自动注入对应的世界设定到系统提示中。</p>

      <!-- Add new entry -->
      <div class="limerence-lorebook-form">
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.lorebookDraftKeywords}
          placeholder="关键词（逗号分隔）"
          @input=${(e: Event) => a.onLorebookDraftChange("keywords", (e.target as HTMLInputElement).value)}
        />
        <textarea
          class="limerence-settings-textarea"
          .value=${s.lorebookDraftContent}
          placeholder="触发时注入的内容"
          rows="3"
          @input=${(e: Event) => a.onLorebookDraftChange("content", (e.target as HTMLTextAreaElement).value)}
        ></textarea>
        <button class="limerence-btn-primary" @click=${() => {
          const kws = s.lorebookDraftKeywords.split(",").map((k) => k.trim()).filter(Boolean);
          if (kws.length > 0 && s.lorebookDraftContent.trim()) {
            a.onLorebookAdd(kws, s.lorebookDraftContent.trim());
          }
        }}>添加条目</button>
      </div>

      <!-- Existing entries -->
      ${s.lorebookEntries.length === 0 ? html`<p class="limerence-settings-empty">暂无世界书条目</p>` : null}
      ${s.lorebookEntries.map((entry) => html`
        <div class="limerence-lorebook-entry ${entry.enabled ? "" : "disabled"}">
          <div class="limerence-lorebook-entry-header">
            <span class="limerence-lorebook-keywords">${entry.keywords.join(", ")}</span>
            <div class="limerence-lorebook-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onLorebookToggle(entry.id)} title="${entry.enabled ? "禁用" : "启用"}">
                ${entry.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onLorebookDelete(entry.id)} title="删除">✕</button>
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
      <p class="limerence-settings-hint">选择生成参数预设，影响 AI 回复的风格和长度。</p>
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
      <p class="limerence-settings-hint">正则规则可对 AI 输出或用户输入进行文本替换处理。</p>

      <!-- Add new rule -->
      <div class="limerence-regex-form">
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftName}
          placeholder="规则名称"
          @input=${(e: Event) => a.onRegexDraftChange("name", (e.target as HTMLInputElement).value)}
        />
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftPattern}
          placeholder="正则表达式"
          @input=${(e: Event) => a.onRegexDraftChange("pattern", (e.target as HTMLInputElement).value)}
        />
        <input
          class="limerence-settings-input"
          type="text"
          .value=${s.regexDraftReplacement}
          placeholder="替换文本"
          @input=${(e: Event) => a.onRegexDraftChange("replacement", (e.target as HTMLInputElement).value)}
        />
        <select
          class="limerence-settings-select"
          .value=${s.regexDraftScope}
          @change=${(e: Event) => a.onRegexDraftChange("scope", (e.target as HTMLSelectElement).value)}
        >
          <option value="output">仅 AI 输出</option>
          <option value="input">仅用户输入</option>
          <option value="both">双向</option>
        </select>
        ${s.regexError ? html`<div class="limerence-char-error">${s.regexError}</div>` : null}
        <button class="limerence-btn-primary" @click=${() => {
          if (s.regexDraftName.trim() && s.regexDraftPattern.trim()) {
            a.onRegexAdd(s.regexDraftName.trim(), s.regexDraftPattern, s.regexDraftReplacement, s.regexDraftScope);
          }
        }}>添加规则</button>
      </div>

      <!-- Existing rules -->
      ${s.regexRules.length === 0 ? html`<p class="limerence-settings-empty">暂无正则规则</p>` : null}
      ${s.regexRules.map((rule) => html`
        <div class="limerence-regex-entry ${rule.enabled ? "" : "disabled"}">
          <div class="limerence-regex-entry-header">
            <span class="limerence-regex-name">${rule.name}</span>
            <span class="limerence-regex-scope">${rule.scope === "output" ? "输出" : rule.scope === "input" ? "输入" : "双向"}</span>
            <div class="limerence-regex-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onRegexToggle(rule.id)} title="${rule.enabled ? "禁用" : "启用"}">
                ${rule.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onRegexDelete(rule.id)} title="删除">✕</button>
            </div>
          </div>
          <div class="limerence-regex-pattern">/${rule.pattern}/${rule.flags} → ${rule.replacement || "(删除)"}</div>
        </div>
      `)}
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
    "round-robin": "轮流发言",
    "random": "随机发言",
    "natural": "自然平衡",
    "manual": "手动选择",
  };

  return html`
    <div class="limerence-settings-section">
      <p class="limerence-settings-hint">启用群聊后，多个角色会轮流回复你的消息。需要先在角色管理中导入角色。</p>

      <!-- Enable toggle -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <button
          class="limerence-btn-${gc.enabled ? "primary" : "ghost"}"
          @click=${a.onGroupToggle}
        >${gc.enabled ? "群聊已开启" : "开启群聊"}</button>
      </div>

      <!-- Strategy -->
      <label class="limerence-settings-label">发言策略</label>
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
      <label class="limerence-settings-label">每轮回复数</label>
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
        <label class="limerence-settings-label">添加角色</label>
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
        <p class="limerence-settings-empty">请先在角色管理中导入角色</p>
      ` : null}

      <!-- Current members -->
      <label class="limerence-settings-label">群聊成员</label>
      ${gc.members.length === 0 ? html`<p class="limerence-settings-empty">暂无成员</p>` : null}
      ${gc.members.map((m) => html`
        <div class="limerence-lorebook-entry ${m.enabled ? "" : "disabled"}">
          <div class="limerence-lorebook-entry-header">
            <span class="limerence-lorebook-keywords">${m.card.data.name}</span>
            <div class="limerence-lorebook-entry-actions">
              <button class="limerence-btn-icon" @click=${() => a.onGroupToggleMember(m.id)} title="${m.enabled ? "禁用" : "启用"}">
                ${m.enabled ? "●" : "○"}
              </button>
              <button class="limerence-btn-icon danger" @click=${() => a.onGroupRemoveMember(m.id)} title="移除">✕</button>
            </div>
          </div>
          <div class="limerence-lorebook-content">${m.card.data.description?.slice(0, 80) || m.card.data.personality?.slice(0, 80) || "无描述"}</div>
        </div>
      `)}
    </div>
  `;
}
