/**
 * Zero-dependency i18n module.
 * Provides t() / tf() translation, locale switching, and localStorage persistence.
 */

export type Locale = "zh" | "en";

type Listener = (locale: Locale) => void;

const STORAGE_KEY = "limerence-locale";
const listeners = new Set<Listener>();

import zhDict from "./i18n/zh";
import enDict from "./i18n/en";

const dicts: Record<Locale, Record<string, string>> = { zh: zhDict, en: enDict };

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch { /* SSR / blocked storage */ }
  const lang = navigator.language ?? "";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

let current: Locale = detectLocale();

/** Get current locale. */
export function getLocale(): Locale {
  return current;
}

/** Switch locale, persist to localStorage, notify listeners. */
export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
    // Sync mini-lit i18n system (reads from "language" key)
    localStorage.setItem("language", locale);
  } catch { /* ignore */ }
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  for (const fn of listeners) fn(locale);
}

/** Subscribe to locale changes. Returns unsubscribe function. */
export function onLocaleChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Translate a key. Falls back to zh, then returns the key itself. */
export function t(key: string): string {
  const dict = dicts[current];
  if (key in dict) return dict[key];
  // Fallback to zh
  if (current !== "zh" && key in dicts.zh) return dicts.zh[key];
  return key;
}

/** Translate with positional placeholders: {0}, {1}, ... */
export function tf(key: string, ...args: (string | number)[]): string {
  let text = t(key);
  for (let i = 0; i < args.length; i++) {
    text = text.replaceAll(`{${i}}`, String(args[i]));
  }
  return text;
}
