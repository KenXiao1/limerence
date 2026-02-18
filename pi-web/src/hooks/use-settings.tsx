/**
 * Settings hook — React state + IndexedDB persistence.
 * Replaces pi-web-ui's SettingsStore, ProviderKeysStore, CustomProvidersStore.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useStorageContext } from "./use-storage";
import type { CharacterCard, Persona } from "../lib/character";
import { loadDefaultCharacter, PERSONA_SETTINGS_KEY } from "../lib/character";
import type { LorebookEntry } from "../lib/storage";
import type { RegexRule } from "../controllers/regex-rules";
import { REGEX_RULES_KEY } from "../controllers/regex-rules";
import type { GenerationPreset } from "../controllers/presets";
import { ACTIVE_PRESET_KEY } from "../controllers/presets";
import type { PromptPresetConfig } from "../controllers/prompt-presets";
import { ACTIVE_PROMPT_PRESET_KEY, PROMPT_PRESETS_KEY } from "../controllers/prompt-presets";
import type { GroupChatConfig } from "../controllers/group-chat";
import { DEFAULT_GROUP_CONFIG, deserializeGroupConfig, GROUP_CHAT_KEY } from "../controllers/group-chat";
import type { CharacterEntry } from "../controllers/character";

// ── Store names (backward-compatible with pi-web-ui) ────────────

const SETTINGS_STORE = "pi-web-ui:settings";
const PROVIDER_KEYS_STORE = "pi-web-ui:provider-keys";

export const PROXY_MODE_KEY = "limerence.proxy_mode";

// ── Settings context value ──────────────────────────────────────

export interface SettingsContextValue {
  // Character
  character: CharacterCard | undefined;
  setCharacter: (card: CharacterCard | undefined) => void;
  characterList: CharacterEntry[];
  setCharacterList: (list: CharacterEntry[]) => void;

  // Persona
  persona: Persona | undefined;
  setPersona: (p: Persona | undefined) => Promise<void>;

  // Proxy mode
  proxyModeEnabled: boolean;
  setProxyModeEnabled: (enabled: boolean) => Promise<void>;

  // Provider keys
  getProviderKey: (provider: string) => Promise<string | null>;
  setProviderKey: (provider: string, key: string) => Promise<void>;
  listProviderKeys: () => Promise<string[]>;

  // Lorebook
  lorebookEntries: LorebookEntry[];
  setLorebookEntries: (entries: LorebookEntry[]) => void;

  // Regex rules
  regexRules: RegexRule[];
  setRegexRules: (rules: RegexRule[]) => void;

  // Generation presets
  activePreset: GenerationPreset | undefined;
  setActivePreset: (preset: GenerationPreset | undefined) => Promise<void>;

  // Prompt presets
  promptPresets: PromptPresetConfig[];
  setPromptPresets: (presets: PromptPresetConfig[]) => void;
  activePromptPreset: PromptPresetConfig | undefined;
  setActivePromptPreset: (preset: PromptPresetConfig | undefined) => Promise<void>;

  // Group chat
  groupChat: GroupChatConfig;
  setGroupChat: (config: GroupChatConfig) => void;

  // Generic settings access
  getSetting: <T>(key: string) => Promise<T | null>;
  setSetting: (key: string, value: unknown) => Promise<void>;

  // Loading state
  ready: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Swallow errors from IndexedDB reads — returns undefined on failure. */
async function tryLoad<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try { return await fn(); } catch { return undefined; }
}

// ── Provider ────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { backend, storage: limerenceStorage } = useStorageContext();

  const [ready, setReady] = useState(false);
  const [character, setCharacter] = useState<CharacterCard | undefined>();
  const [characterList, setCharacterList] = useState<CharacterEntry[]>([]);
  const [persona, _setPersona] = useState<Persona | undefined>();
  const [proxyModeEnabled, _setProxyModeEnabled] = useState(true);
  const [lorebookEntries, _setLorebookEntries] = useState<LorebookEntry[]>([]);
  const [regexRules, _setRegexRules] = useState<RegexRule[]>([]);
  const [activePreset, _setActivePreset] = useState<GenerationPreset | undefined>();
  const [promptPresets, _setPromptPresets] = useState<PromptPresetConfig[]>([]);
  const [activePromptPreset, _setActivePromptPreset] = useState<PromptPresetConfig | undefined>();
  const [groupChat, _setGroupChat] = useState<GroupChatConfig>({ ...DEFAULT_GROUP_CONFIG });

  // Load all settings from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Character
      const card = await loadDefaultCharacter();
      if (!cancelled) setCharacter(card);

      // Character list
      const chars = await limerenceStorage.loadCharacters();
      if (!cancelled) setCharacterList(chars);

      const [persona, proxyRaw, lorebook, rules, preset, presets, promptPreset, gcRaw] =
        await Promise.all([
          tryLoad(() => backend.get<Persona>(SETTINGS_STORE, PERSONA_SETTINGS_KEY)),
          tryLoad(() => backend.get<unknown>(SETTINGS_STORE, PROXY_MODE_KEY)),
          tryLoad(() => limerenceStorage.loadLorebookEntries()),
          tryLoad(() => backend.get<RegexRule[]>(SETTINGS_STORE, REGEX_RULES_KEY)),
          tryLoad(() => backend.get<GenerationPreset>(SETTINGS_STORE, ACTIVE_PRESET_KEY)),
          tryLoad(() => backend.get<PromptPresetConfig[]>(SETTINGS_STORE, PROMPT_PRESETS_KEY)),
          tryLoad(() => backend.get<PromptPresetConfig>(SETTINGS_STORE, ACTIVE_PROMPT_PRESET_KEY)),
          tryLoad(() => backend.get<unknown>(SETTINGS_STORE, GROUP_CHAT_KEY)),
        ]);

      if (cancelled) return;
      if (persona?.name) _setPersona(persona);
      _setProxyModeEnabled(typeof proxyRaw === "boolean" ? proxyRaw : true);
      if (lorebook) _setLorebookEntries(lorebook);
      if (Array.isArray(rules)) _setRegexRules(rules);
      if (preset) _setActivePreset(preset);
      if (Array.isArray(presets)) _setPromptPresets(presets);
      if (promptPreset?.id) _setActivePromptPreset(promptPreset);
      const gc = deserializeGroupConfig(gcRaw);
      if (gc) _setGroupChat(gc);

      if (!cancelled) setReady(true);
    }

    load().catch((err) => {
      console.error("[SettingsProvider] Load failed:", err);
      if (!cancelled) setReady(true);
    });

    return () => { cancelled = true; };
  }, [backend, limerenceStorage]);

  // ── Setters that persist to IndexedDB ─────────────────────────

  const setPersona = useCallback(async (p: Persona | undefined) => {
    _setPersona(p);
    await backend.set(SETTINGS_STORE, PERSONA_SETTINGS_KEY, p ?? null);
  }, [backend]);

  const setProxyModeEnabled = useCallback(async (enabled: boolean) => {
    _setProxyModeEnabled(enabled);
    await backend.set(SETTINGS_STORE, PROXY_MODE_KEY, enabled);
  }, [backend]);

  const setLorebookEntries = useCallback((entries: LorebookEntry[]) => {
    _setLorebookEntries(entries);
    void limerenceStorage.saveLorebookEntries(entries);
  }, [limerenceStorage]);

  const setRegexRules = useCallback((rules: RegexRule[]) => {
    _setRegexRules(rules);
    void backend.set(SETTINGS_STORE, REGEX_RULES_KEY, rules);
  }, [backend]);

  const setActivePreset = useCallback(async (preset: GenerationPreset | undefined) => {
    _setActivePreset(preset);
    await backend.set(SETTINGS_STORE, ACTIVE_PRESET_KEY, preset ?? null);
  }, [backend]);

  const setPromptPresets = useCallback((presets: PromptPresetConfig[]) => {
    _setPromptPresets(presets);
    void backend.set(SETTINGS_STORE, PROMPT_PRESETS_KEY, presets);
  }, [backend]);

  const setActivePromptPreset = useCallback(async (preset: PromptPresetConfig | undefined) => {
    _setActivePromptPreset(preset);
    await backend.set(SETTINGS_STORE, ACTIVE_PROMPT_PRESET_KEY, preset ?? null);
  }, [backend]);

  const setGroupChat = useCallback((config: GroupChatConfig) => {
    _setGroupChat(config);
    void backend.set(SETTINGS_STORE, GROUP_CHAT_KEY, config);
  }, [backend]);

  // ── Provider key helpers ──────────────────────────────────────

  const getProviderKey = useCallback(async (provider: string): Promise<string | null> => {
    return backend.get<string>(PROVIDER_KEYS_STORE, provider);
  }, [backend]);

  const setProviderKey = useCallback(async (provider: string, key: string) => {
    await backend.set(PROVIDER_KEYS_STORE, provider, key);
  }, [backend]);

  const listProviderKeys = useCallback(async (): Promise<string[]> => {
    return backend.keys(PROVIDER_KEYS_STORE);
  }, [backend]);

  // ── Generic settings access ───────────────────────────────────

  const getSetting = useCallback(async <T,>(key: string): Promise<T | null> => {
    return backend.get<T>(SETTINGS_STORE, key);
  }, [backend]);

  const setSetting = useCallback(async (key: string, value: unknown) => {
    await backend.set(SETTINGS_STORE, key, value);
  }, [backend]);

  const value: SettingsContextValue = {
    character, setCharacter,
    characterList, setCharacterList,
    persona, setPersona,
    proxyModeEnabled, setProxyModeEnabled,
    getProviderKey, setProviderKey, listProviderKeys,
    lorebookEntries, setLorebookEntries,
    regexRules, setRegexRules,
    activePreset, setActivePreset,
    promptPresets, setPromptPresets,
    activePromptPreset, setActivePromptPreset,
    groupChat, setGroupChat,
    getSetting, setSetting,
    ready,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
