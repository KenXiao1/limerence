import type { Locale } from "../lib/i18n";
import type { Theme } from "../lib/theme";

export function getLocaleAfterToggle(locale: Locale): Locale {
  return locale === "zh" ? "en" : "zh";
}

export function getThemeAriaKey(theme: Theme): "landing.themeLight" | "landing.themeDark" {
  return theme === "dark" ? "landing.themeLight" : "landing.themeDark";
}
