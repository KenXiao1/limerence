import { useState, useEffect, useCallback } from "react";
import type { Settings, CharacterCard } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/types";
import { loadDefaultCharacter } from "../lib/character";

const SETTINGS_KEY = "limerence:settings";
const CHARACTER_KEY = "limerence:character";

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [character, setCharacterState] = useState<CharacterCard | null>(null);

  // Load character on mount
  useEffect(() => {
    const stored = localStorage.getItem(CHARACTER_KEY);
    if (stored) {
      try {
        setCharacterState(JSON.parse(stored));
        return;
      } catch { /* fall through */ }
    }
    loadDefaultCharacter().then(setCharacterState).catch(console.error);
  }, []);

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      setSettings({ ...settings, ...partial });
    },
    [settings, setSettings],
  );

  const setCharacter = useCallback((card: CharacterCard) => {
    setCharacterState(card);
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(card));
  }, []);

  const resetCharacter = useCallback(() => {
    localStorage.removeItem(CHARACTER_KEY);
    loadDefaultCharacter().then(setCharacterState).catch(console.error);
  }, []);

  return {
    settings,
    setSettings,
    updateSettings,
    character,
    setCharacter,
    resetCharacter,
    isReady: character !== null,
  };
}
