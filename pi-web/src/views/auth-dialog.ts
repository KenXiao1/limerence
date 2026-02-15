/**
 * Auth dialog — login / signup with email + password.
 * Redesigned with refined visual hierarchy and brand-consistent styling.
 */

import { html, nothing } from "lit";
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
  onCustomConfig: () => void;
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
      <div class="limerence-auth-dialog">
        <!-- Close button -->
        <button class="limerence-auth-close" @click=${actions.onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Header -->
        <div class="limerence-auth-header">
          <div class="limerence-auth-logo">L</div>
          <h2 class="limerence-auth-title">${s.tab === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}</h2>
        </div>

        <!-- Tabs -->
        <div class="limerence-auth-tabs">
          <button
            class="limerence-auth-tab ${s.tab === "login" ? "active" : ""}"
            @click=${() => actions.onTabChange("login")}
          >${t("auth.login")}</button>
          <button
            class="limerence-auth-tab ${s.tab === "signup" ? "active" : ""}"
            @click=${() => actions.onTabChange("signup")}
          >${t("auth.signup")}</button>
        </div>

        <!-- Body -->
        <div class="limerence-auth-body">
          ${s.signupSuccess
            ? html`
              <div class="limerence-auth-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>${t("auth.checkEmail")}</span>
              </div>
            `
            : html`
              <form @submit=${handleSubmit} class="limerence-auth-form">
                <div class="limerence-auth-field">
                  <label for="auth-email">${t("auth.email")}</label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                    ?disabled=${s.loading}
                  />
                </div>

                <div class="limerence-auth-field">
                  <label for="auth-password">${t("auth.password")}</label>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    minlength="6"
                    required
                    autocomplete="${s.tab === "login" ? "current-password" : "new-password"}"
                    ?disabled=${s.loading}
                  />
                </div>

                ${s.error ? html`<div class="limerence-auth-error">${s.error}</div>` : nothing}

                <button
                  type="submit"
                  class="limerence-auth-submit"
                  ?disabled=${s.loading}
                >
                  ${s.loading
                    ? html`<span class="limerence-auth-spinner"></span> ${t("auth.loading")}`
                    : s.tab === "login"
                      ? t("auth.login")
                      : t("auth.signup")}
                </button>
              </form>
            `
          }

          ${s.tab === "signup" && !s.signupSuccess
            ? html`<p class="limerence-auth-hint">${t("auth.signupHint")}</p>`
            : nothing
          }
        </div>

        <!-- Footer -->
        <div class="limerence-auth-footer">
          <button
            class="limerence-auth-config-link"
            @click=${() => { actions.onClose(); actions.onCustomConfig(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ${t("auth.customSupabase")}
          </button>
        </div>
      </div>
    </div>
  `;
}
