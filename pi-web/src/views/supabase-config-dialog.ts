/**
 * Supabase project configuration dialog.
 * Redesigned to match the auth dialog's visual style.
 */

import { html } from "lit";
import { t } from "../lib/i18n";
import { configure, getConfiguredUrl } from "../lib/supabase";

export interface SupabaseConfigDialogState {
  open: boolean;
}

export interface SupabaseConfigDialogActions {
  onClose: () => void;
  onSave: (url: string, anonKey: string) => void;
}

export function renderSupabaseConfigDialog(
  s: SupabaseConfigDialogState,
  actions: SupabaseConfigDialogActions,
) {
  if (!s.open) return null;

  const urlValue = getConfiguredUrl();

  const handleSave = () => {
    const urlInput = document.getElementById("sb-config-url") as HTMLInputElement | null;
    const keyInput = document.getElementById("sb-config-key") as HTMLInputElement | null;
    const url = urlInput?.value.trim() ?? "";
    const key = keyInput?.value.trim() ?? "";
    if (!url || !key) return;
    configure(url, key);
    actions.onSave(url, key);
  };

  return html`
    <div class="limerence-dialog-overlay" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("limerence-dialog-overlay")) actions.onClose();
    }}>
      <div class="limerence-auth-dialog" style="max-width: 420px;">
        <button class="limerence-auth-close" @click=${actions.onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="limerence-auth-header">
          <div class="limerence-auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          </div>
          <h2 class="limerence-auth-title">${t("supabase.configTitle")}</h2>
        </div>

        <div class="limerence-auth-body">
          <p class="limerence-auth-hint" style="margin: 0 0 4px;">${t("supabase.configHint")}</p>

          <form class="limerence-auth-form" @submit=${(e: Event) => { e.preventDefault(); handleSave(); }}>
            <div class="limerence-auth-field">
              <label for="sb-config-url">${t("supabase.urlLabel")}</label>
              <input
                id="sb-config-url"
                type="url"
                placeholder="https://xxxxx.supabase.co"
                .value=${urlValue}
              />
            </div>

            <div class="limerence-auth-field">
              <label for="sb-config-key">${t("supabase.anonKeyLabel")}</label>
              <input
                id="sb-config-key"
                type="text"
                placeholder="sb_publishable_... 或 eyJhbGciOiJIUzI1NiIs..."
              />
            </div>

            <a
              href="/supabase-schema.sql"
              download="supabase-schema.sql"
              style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: hsl(var(--muted-foreground)); text-decoration: none;"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              ${t("supabase.downloadSchema")}
            </a>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button type="button" class="limerence-btn limerence-btn-ghost" @click=${actions.onClose}>
                ${t("msg.cancel")}
              </button>
              <button type="submit" class="limerence-auth-submit" style="width: auto; padding: 10px 24px;">
                ${t("persona.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
