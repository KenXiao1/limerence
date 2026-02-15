/**
 * Supabase project configuration dialog.
 * User inputs their Supabase URL + anon key (one-time setup).
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

  let urlValue = getConfiguredUrl();
  let keyValue = "";

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
      <div class="limerence-dialog" style="max-width: 480px;">
        <div class="limerence-dialog-header">
          <h2 class="limerence-dialog-title">${t("supabase.configTitle")}</h2>
          <button class="limerence-dialog-close" @click=${actions.onClose}>&times;</button>
        </div>
        <div class="limerence-dialog-body" style="display:flex;flex-direction:column;gap:12px;">
          <p class="text-sm text-muted-foreground">${t("supabase.configHint")}</p>

          <label class="text-sm font-medium">${t("supabase.urlLabel")}</label>
          <input
            id="sb-config-url"
            type="url"
            class="limerence-input"
            placeholder="https://xxxxx.supabase.co"
            .value=${urlValue}
          />

          <label class="text-sm font-medium">${t("supabase.anonKeyLabel")}</label>
          <input
            id="sb-config-key"
            type="text"
            class="limerence-input"
            placeholder="sb_publishable_... 或 eyJhbGciOiJIUzI1NiIs..."
            .value=${keyValue}
          />

          <a
            href="/supabase-schema.sql"
            download="supabase-schema.sql"
            class="text-sm text-primary hover:underline"
          >${t("supabase.downloadSchema")}</a>

          <div class="flex justify-end gap-2 mt-2">
            <button class="limerence-btn limerence-btn-ghost" @click=${actions.onClose}>
              ${t("msg.cancel")}
            </button>
            <button class="limerence-btn limerence-btn-primary" @click=${handleSave}>
              ${t("persona.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
