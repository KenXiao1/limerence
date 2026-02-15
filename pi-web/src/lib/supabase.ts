/**
 * Supabase client singleton.
 * Priority: localStorage (custom) > Vite env vars (default).
 * Normal users use the default project; power users can configure their own.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_KEY = "limerence-supabase-url";
const ANON_KEY = "limerence-supabase-anon-key";

// Default Supabase config from environment variables (set at build time)
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const DEFAULT_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

let _client: SupabaseClient | null = null;

/** Resolve effective URL: localStorage override > env default */
function resolveUrl(): string {
  return localStorage.getItem(URL_KEY) || DEFAULT_URL;
}

/** Resolve effective anon key: localStorage override > env default */
function resolveKey(): string {
  return localStorage.getItem(ANON_KEY) || DEFAULT_ANON_KEY;
}

/** Whether Supabase is usable (either default or custom config exists) */
export function isConfigured(): boolean {
  return Boolean(resolveUrl() && resolveKey());
}

/** Whether the built-in default config is available */
export function hasDefaultConfig(): boolean {
  return Boolean(DEFAULT_URL && DEFAULT_ANON_KEY);
}

/** Whether the user has set a custom (non-default) config */
export function isUsingCustomConfig(): boolean {
  return Boolean(localStorage.getItem(URL_KEY) && localStorage.getItem(ANON_KEY));
}

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = resolveUrl();
  const key = resolveKey();
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export function configure(url: string, anonKey: string) {
  localStorage.setItem(URL_KEY, url.replace(/\/+$/, ""));
  localStorage.setItem(ANON_KEY, anonKey.trim());
  _client = null; // force re-create on next getSupabase()
}

export function clearConfig() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(ANON_KEY);
  _client = null;
}

export function getConfiguredUrl(): string {
  return localStorage.getItem(URL_KEY) ?? "";
}
