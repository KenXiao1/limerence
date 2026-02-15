/**
 * Supabase client singleton.
 * Reads user-configured URL + anon key from localStorage, lazily initializes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_KEY = "limerence-supabase-url";
const ANON_KEY = "limerence-supabase-anon-key";

let _client: SupabaseClient | null = null;

export function isConfigured(): boolean {
  return Boolean(localStorage.getItem(URL_KEY) && localStorage.getItem(ANON_KEY));
}

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = localStorage.getItem(URL_KEY);
  const key = localStorage.getItem(ANON_KEY);
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
