/**
 * Settings dialog — tabbed settings for persona, lorebook, presets, regex, prompt, group chat.
 * Ported from views/settings-panels.ts (Lit) to React.
 */

import { useState, useRef, useCallback } from "react";
import { X, Plus, Trash2, Upload, Download } from "lucide-react";
import { t } from "../lib/i18n";
import { useSettings } from "../hooks/use-settings";
import type { LorebookEntry } from "../lib/storage";
import type { RegexRule } from "../controllers/regex-rules";
import { createRegexRule } from "../controllers/regex-rules";
import { BUILTIN_PRESETS, type GenerationPreset } from "../controllers/presets";
import { importSTPreset, type PromptPresetConfig } from "../controllers/prompt-presets";
import type { TurnStrategy } from "../controllers/group-chat";
import { addMember } from "../controllers/group-chat";
import { downloadJson } from "../controllers/session-io";

type SettingsTab = "persona" | "lorebook" | "presets" | "regex" | "prompt" | "group";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Settings({ open, onClose }: Props) {
  const settings = useSettings();
  const [tab, setTab] = useState<SettingsTab>("persona");

  if (!open) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "persona", label: t("settings.persona") },
    { id: "lorebook", label: t("settings.lorebook") },
    { id: "presets", label: t("settings.presets") },
    { id: "regex", label: t("settings.regex") },
    { id: "prompt", label: t("settings.prompt") },
    { id: "group", label: t("settings.group") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab bar + close */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded ml-2 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "persona" && <PersonaTab />}
          {tab === "lorebook" && <LorebookTab />}
          {tab === "presets" && <PresetsTab />}
          {tab === "regex" && <RegexTab />}
          {tab === "prompt" && <PromptTab />}
          {tab === "group" && <GroupTab />}
        </div>
      </div>
    </div>
  );
}

// ── Persona tab ─────────────────────────────────────────────────

function PersonaTab() {
  const { persona, setPersona } = useSettings();
  const [name, setName] = useState(persona?.name ?? "");
  const [desc, setDesc] = useState(persona?.description ?? "");

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("persona.hint")}</p>
      <div>
        <label className="text-xs font-medium mb-1 block">{t("persona.nameLabel")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("persona.namePlaceholder")}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">{t("persona.descLabel")}</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t("persona.descPlaceholder")}
          rows={4}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          onClick={() => setPersona({ name: name.trim(), description: desc.trim() })}
        >
          {t("persona.save")}
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
          onClick={() => { setPersona(undefined); setName(""); setDesc(""); }}
        >
          {t("persona.clear")}
        </button>
      </div>
    </div>
  );
}

// ── Lorebook tab ────────────────────────────────────────────────

function LorebookTab() {
  const { lorebookEntries, setLorebookEntries } = useSettings();
  const [draftKw, setDraftKw] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const handleAdd = useCallback(() => {
    const kws = draftKw.split(",").map((k) => k.trim()).filter(Boolean);
    if (kws.length === 0 || !draftContent.trim()) return;
    const entry: LorebookEntry = {
      id: crypto.randomUUID(),
      keywords: kws,
      content: draftContent.trim(),
      enabled: true,
      characterId: null,
    };
    setLorebookEntries([...lorebookEntries, entry]);
    setDraftKw("");
    setDraftContent("");
  }, [draftKw, draftContent, lorebookEntries, setLorebookEntries]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("lorebook.hint")}</p>

      {/* Add form */}
      <div className="space-y-2">
        <input
          type="text"
          value={draftKw}
          onChange={(e) => setDraftKw(e.target.value)}
          placeholder={t("lorebook.keywordsPlaceholder")}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder={t("lorebook.contentPlaceholder")}
          rows={3}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          onClick={handleAdd}
        >
          {t("lorebook.add")}
        </button>
      </div>

      {/* Entries */}
      {lorebookEntries.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("lorebook.empty")}</p>
      )}
      {lorebookEntries.map((entry) => (
        <div
          key={entry.id}
          className={`border border-border rounded-lg p-2.5 ${entry.enabled ? "" : "opacity-50"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{entry.keywords.join(", ")}</span>
            <div className="flex gap-1">
              <button
                className="p-1 hover:bg-secondary rounded text-xs"
                onClick={() => {
                  setLorebookEntries(
                    lorebookEntries.map((e) =>
                      e.id === entry.id ? { ...e, enabled: !e.enabled } : e,
                    ),
                  );
                }}
              >
                {entry.enabled ? "●" : "○"}
              </button>
              <button
                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                onClick={() => setLorebookEntries(lorebookEntries.filter((e) => e.id !== entry.id))}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.content.length > 120 ? entry.content.slice(0, 120) + "..." : entry.content}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Presets tab ──────────────────────────────────────────────────

function PresetsTab() {
  const { activePreset, setActivePreset } = useSettings();
  const activeId = activePreset?.id ?? "default";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("presets.hint")}</p>
      {BUILTIN_PRESETS.map((preset) => (
        <button
          key={preset.id}
          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
            activeId === preset.id
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-secondary"
          }`}
          onClick={() => setActivePreset(preset)}
        >
          <div className="text-sm font-medium">{preset.name}</div>
          <div className="text-xs text-muted-foreground">
            T={preset.temperature} · TopP={preset.topP} · Max={preset.maxTokens}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Regex tab ───────────────────────────────────────────────────

function RegexTab() {
  const { regexRules, setRegexRules } = useSettings();
  const [draftName, setDraftName] = useState("");
  const [draftPattern, setDraftPattern] = useState("");
  const [draftReplacement, setDraftReplacement] = useState("");
  const [draftScope, setDraftScope] = useState<RegexRule["scope"]>("output");
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    if (!draftName.trim() || !draftPattern.trim()) return;
    try {
      new RegExp(draftPattern);
    } catch {
      setError("无效的正则表达式");
      return;
    }
    const rule = createRegexRule(draftName.trim(), draftPattern, draftReplacement, draftScope);
    setRegexRules([...regexRules, rule]);
    setDraftName("");
    setDraftPattern("");
    setDraftReplacement("");
    setError("");
  }, [draftName, draftPattern, draftReplacement, draftScope, regexRules, setRegexRules]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setRegexRules([...regexRules, ...data]);
      }
    } catch {
      setError("导入失败");
    }
  }, [regexRules, setRegexRules]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("regex.hint")}</p>

      {/* Import / Export */}
      <div className="flex gap-2 items-center">
        <button
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
          onClick={() => importRef.current?.click()}
        >
          <Upload className="w-3 h-3 inline mr-1" />{t("regex.import")}
        </button>
        <button
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-30"
          disabled={regexRules.length === 0}
          onClick={() => downloadJson(regexRules, "regex-rules.json")}
        >
          <Download className="w-3 h-3 inline mr-1" />{t("regex.export")}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Add form */}
      <div className="space-y-2">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={t("regex.namePlaceholder")}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          value={draftPattern}
          onChange={(e) => setDraftPattern(e.target.value)}
          placeholder={t("regex.patternPlaceholder")}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
        <input
          type="text"
          value={draftReplacement}
          onChange={(e) => setDraftReplacement(e.target.value)}
          placeholder={t("regex.replacementPlaceholder")}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
        <select
          value={draftScope}
          onChange={(e) => setDraftScope(e.target.value as RegexRule["scope"])}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="output">{t("regex.scopeOutput")}</option>
          <option value="input">{t("regex.scopeInput")}</option>
          <option value="both">{t("regex.scopeBoth")}</option>
        </select>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          onClick={handleAdd}
        >
          {t("regex.add")}
        </button>
      </div>

      {/* Rules */}
      {regexRules.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("regex.empty")}</p>
      )}
      {regexRules.map((rule) => (
        <div
          key={rule.id}
          className={`border border-border rounded-lg p-2.5 ${rule.enabled ? "" : "opacity-50"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{rule.name}</span>
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">
                {rule.scope}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                className="p-1 hover:bg-secondary rounded text-xs"
                onClick={() => {
                  setRegexRules(
                    regexRules.map((r) =>
                      r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
                    ),
                  );
                }}
              >
                {rule.enabled ? "●" : "○"}
              </button>
              <button
                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                onClick={() => setRegexRules(regexRules.filter((r) => r.id !== rule.id))}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            /{rule.pattern}/{rule.flags} → {rule.replacement || "(空)"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Prompt presets tab ────────────────────────────────────────

function PromptTab() {
  const {
    promptPresets,
    setPromptPresets,
    activePromptPreset,
    setActivePromptPreset,
  } = useSettings();
  const [importError, setImportError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const { preset, error } = importSTPreset(data);
      if (error || !preset) {
        setImportError(error ?? "导入失败");
        return;
      }
      setPromptPresets([...promptPresets, preset]);
      setActivePromptPreset(preset);
      setImportError("");
    } catch {
      setImportError("文件读取失败");
    }
  }, [promptPresets, setPromptPresets, setActivePromptPreset]);

  const roleLabel = (role: string) => {
    if (role === "user") return t("prompt.roleUser");
    if (role === "assistant") return t("prompt.roleAssistant");
    return t("prompt.roleSystem");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("prompt.hint")}</p>

      {/* Import / Export / Clear */}
      <div className="flex gap-2 items-center">
        <button
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          onClick={() => importRef.current?.click()}
        >
          {t("prompt.import")}
        </button>
        <button
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-30"
          disabled={!activePromptPreset}
          onClick={() => {
            if (activePromptPreset) downloadJson(activePromptPreset, `${activePromptPreset.name}.json`);
          }}
        >
          {t("prompt.export")}
        </button>
        <button
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-30"
          disabled={!activePromptPreset}
          onClick={() => setActivePromptPreset(undefined)}
        >
          {t("prompt.clear")}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = "";
          }}
        />
      </div>

      {importError && <p className="text-xs text-destructive">{importError}</p>}

      {/* Active preset */}
      <div className="text-xs">
        <span className="font-medium">{t("prompt.active")}：</span>
        <span>{activePromptPreset ? activePromptPreset.name : t("prompt.none")}</span>
      </div>

      {/* Segments */}
      {activePromptPreset?.segments.map((seg) => (
        <div
          key={seg.identifier}
          className={`border border-border rounded-lg p-2.5 ${seg.enabled ? "" : "opacity-50"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{seg.name || seg.identifier}</span>
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">
                {seg.marker ? t("prompt.marker") : roleLabel(seg.role)}
              </span>
            </div>
            <button
              className="p-1 hover:bg-secondary rounded text-xs"
              onClick={() => {
                if (!activePromptPreset) return;
                const updated: PromptPresetConfig = {
                  ...activePromptPreset,
                  segments: activePromptPreset.segments.map((s) =>
                    s.identifier === seg.identifier ? { ...s, enabled: !s.enabled } : s,
                  ),
                };
                setActivePromptPreset(updated);
              }}
            >
              {seg.enabled ? "●" : "○"}
            </button>
          </div>
          {!seg.marker && seg.content.trim() && (
            <p className="text-xs text-muted-foreground">
              {seg.content.length > 100 ? seg.content.slice(0, 100) + "..." : seg.content}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Group chat tab ───────────────────────────────────────────────

function GroupTab() {
  const { groupChat, setGroupChat, characterList } = useSettings();
  const memberNames = new Set(groupChat.members.map((m) => m.card.data.name));
  const available = characterList.filter((c) => !memberNames.has(c.card.data.name));

  const strategyLabels: Record<TurnStrategy, string> = {
    "round-robin": t("group.roundRobin"),
    random: t("group.random"),
    natural: t("group.natural"),
    manual: t("group.manual"),
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("group.hint")}</p>

      {/* Enable toggle */}
      <button
        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
          groupChat.enabled
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
        onClick={() => setGroupChat({ ...groupChat, enabled: !groupChat.enabled })}
      >
        {groupChat.enabled ? t("group.enabled") : t("group.enable")}
      </button>

      {/* Strategy */}
      <div>
        <label className="text-xs font-medium mb-1 block">{t("group.strategyLabel")}</label>
        <select
          value={groupChat.strategy}
          onChange={(e) => setGroupChat({ ...groupChat, strategy: e.target.value as TurnStrategy })}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {(Object.keys(strategyLabels) as TurnStrategy[]).map((k) => (
            <option key={k} value={k}>{strategyLabels[k]}</option>
          ))}
        </select>
      </div>

      {/* Responses per turn */}
      <div>
        <label className="text-xs font-medium mb-1 block">{t("group.responsesLabel")}</label>
        <select
          value={String(groupChat.responsesPerTurn)}
          onChange={(e) => setGroupChat({ ...groupChat, responsesPerTurn: Number(e.target.value) })}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={String(n)}>{n}</option>
          ))}
        </select>
      </div>

      {/* Add member */}
      {available.length > 0 && (
        <div>
          <label className="text-xs font-medium mb-1 block">{t("group.addLabel")}</label>
          <div className="flex flex-wrap gap-1">
            {available.map((c) => (
              <button
                key={c.id}
                className="px-2.5 py-1 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
                onClick={() => setGroupChat(addMember(groupChat, c.card))}
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {characterList.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("group.importFirst")}</p>
      )}

      {/* Members */}
      <div>
        <label className="text-xs font-medium mb-1 block">{t("group.membersLabel")}</label>
        {groupChat.members.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("group.noMembers")}</p>
        )}
        {groupChat.members.map((m) => (
          <div
            key={m.id}
            className={`border border-border rounded-lg p-2.5 mb-1 ${m.enabled ? "" : "opacity-50"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{m.card.data.name}</span>
              <div className="flex gap-1">
                <button
                  className="p-1 hover:bg-secondary rounded text-xs"
                  onClick={() => {
                    setGroupChat({
                      ...groupChat,
                      members: groupChat.members.map((mem) =>
                        mem.id === m.id ? { ...mem, enabled: !mem.enabled } : mem,
                      ),
                    });
                  }}
                >
                  {m.enabled ? "●" : "○"}
                </button>
                <button
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                  onClick={() => {
                    setGroupChat({
                      ...groupChat,
                      members: groupChat.members.filter((mem) => mem.id !== m.id),
                    });
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {(m.card.data.description || m.card.data.personality || "").slice(0, 80) || t("group.noDesc")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
