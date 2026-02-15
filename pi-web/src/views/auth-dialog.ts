/**
 * Auth dialog — login / signup with email + password.
 * Reuses existing limerence-dialog CSS pattern.
 */

import { html } from "lit";
import { t } from "../lib/i18n";

export type AuthTab = "login" | "signup";

export interface AuthDialogState {
  open: boolean;
  tab: AuthTab;
  loading: boolean;
  error: string;
  signupSuccess: boolean;
}

export interface AuthDialogActions {
  onClose: () => void;
  onTabChange: (tab: AuthTab) => void;
  onSubmit: (email: string, password: string) => void;
}

export function renderAuthDialog(s: AuthDialogState, actions: AuthDialogActions) {
  if (!s.open) return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.querySelector("#auth-email") as HTMLInputElement)?.value.trim() ?? "";
    const password = (form.querySelector("#auth-password") as HTMLInputElement)?.value ?? "";
    if (!email || !password) return;
    actions.onSubmit(email, password);
  };

  return html`
    <div class="limerence-dialog-overlay" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("limerence-dialog-overlay")) actions.onClose();
    }}>
      <div class="limerence-dialog" style="max-width: 400px;">
        <div class="limerence-dialog-header">
          <h2 class="limerence-dialog-title">${s.tab === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}</h2>
          <button class="limerence-dialog-close" @click=${actions.onClose}>&times;</button>
        </div>
        <div class="limerence-dialog-body" style="display:flex;flex-direction:column;gap:12px;">
          <!-- Tabs -->
          <div class="flex gap-2 border-b border-border pb-2">
            <button
              class="px-3 py-1 text-sm rounded transition-colors ${s.tab === "login" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}"
              @click=${() => actions.onTabChange("login")}
            >${t("auth.login")}</button>
            <button
              class="px-3 py-1 text-sm rounded transition-colors ${s.tab === "signup" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}"
              @click=${() => actions.onTabChange("signup")}
            >${t("auth.signup")}</button>
          </div>

          ${s.signupSuccess
            ? html`<div class="text-sm text-green-500 p-3 bg-green-500/10 rounded">${t("auth.checkEmail")}</div>`
            : html`
              <form @submit=${handleSubmit} style="display:flex;flex-direction:column;gap:12px;">
                <label class="text-sm font-medium">${t("auth.email")}</label>
                <input
                  id="auth-email"
                  type="email"
                  class="limerence-input"
                  placeholder="you@example.com"
                  required
                  ?disabled=${s.loading}
                />

                <label class="text-sm font-medium">${t("auth.password")}</label>
                <input
                  id="auth-password"
                  type="password"
                  class="limerence-input"
                  placeholder="••••••••"
                  minlength="6"
                  required
                  ?disabled=${s.loading}
                />

                ${s.error ? html`<div class="text-sm text-red-500">${s.error}</div>` : null}

                <button
                  type="submit"
                  class="limerence-btn limerence-btn-primary w-full"
                  ?disabled=${s.loading}
                >
                  ${s.loading
                    ? t("auth.loading")
                    : s.tab === "login"
                      ? t("auth.login")
                      : t("auth.signup")}
                </button>
              </form>
            `
          }

          ${s.tab === "signup" && !s.signupSuccess
            ? html`<p class="text-xs text-muted-foreground">${t("auth.signupHint")}</p>`
            : null
          }
        </div>
      </div>
    </div>
  `;
}
