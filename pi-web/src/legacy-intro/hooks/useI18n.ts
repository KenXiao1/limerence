import { useState, useEffect, useCallback } from "react";
import { t, tf, getLocale, setLocale, onLocaleChange, type Locale } from "../../lib/i18n";

export function useI18n() {
  const [locale, _setLocale] = useState<Locale>(getLocale);

  useEffect(() => {
    return onLocaleChange((next) => _setLocale(next));
  }, []);

  const toggle = useCallback(() => {
    setLocale(getLocale() === "zh" ? "en" : "zh");
  }, []);

  return { t, tf, locale, setLocale, toggle } as const;
}
