/**
 * Auth dialog — login / signup / forgot password / set new password.
 * Redesigned with refined visual hierarchy and brand-consistent styling.
 */

import { html, nothing } from "lit";
import { t } from "../lib/i18n";

export type AuthTab = "login" | "signup" | "reset" | "newPassword";

export interface AuthDialogState {
  open: boolean;
  tab: AuthTab;
  loading: boolean;
  error: string;
  signupSuccess: boolean;
  resetEmailSent: boolean;
  passwordRecovery: boolean;
  passwordUpdateSuccess: boolean;
}

export interface AuthDialogActions {
  onClose: () => void;
  onTabChange: (tab: AuthTab) => void;
  onSubmit: (email: string, password: string) => void;
  onCustomConfig: () => void;
  onResetPassword: (email: string) => void;
  onUpdatePassword: (newPassword: string) => void;
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

  const handleResetSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.querySelector("#reset-email") as HTMLInputElement)?.value.trim() ?? "";
    if (!email) return;
    actions.onResetPassword(email);
  };

  const handleNewPasswordSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const pw = (form.querySelector("#new-password") as HTMLInputElement)?.value ?? "";
    const confirm = (form.querySelector("#confirm-password") as HTMLInputElement)?.value ?? "";
    if (!pw || !confirm) return;
    if (pw !== confirm) {
      // Show mismatch inline — trigger via a custom event isn't needed,
      // we just call onUpdatePassword with empty to signal error in app-render
      // Actually let's just use the actions pattern: set error from here
      // We'll handle this by dispatching to the parent
      const errEl = form.querySelector(".limerence-auth-error") as HTMLElement;
      if (errEl) errEl.textContent = t("auth.passwordMismatch");
      return;
    }
    actions.onUpdatePassword(pw);
  };

  // Determine title
  let title = "";
  if (s.tab === "login") title = t("auth.loginTitle");
  else if (s.tab === "signup") title = t("auth.signupTitle");
  else if (s.tab === "reset") title = t("auth.resetPassword");
  else if (s.tab === "newPassword") title = t("auth.setNewPassword");

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
          <h2 class="limerence-auth-title">${title}</h2>
        </div>

        <!-- Tabs (only for login/signup) -->
        ${s.tab === "login" || s.tab === "signup"
          ? html`
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
          `
          : nothing
        }

        <!-- Body -->
        <div class="limerence-auth-body">
          ${s.tab === "newPassword"
            ? renderNewPasswordBody(s, handleNewPasswordSubmit)
            : s.tab === "reset"
              ? renderResetBody(s, handleResetSubmit, actions)
              : renderLoginSignupBody(s, handleSubmit, actions)
          }
        </div>

        <!-- Footer (only for login/signup) -->
        ${s.tab === "login" || s.tab === "signup"
          ? html`
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
          `
          : nothing
        }
      </div>
    </div>
  `;
}

// ── Login / Signup body ──────────────────────────────────────

function renderLoginSignupBody(
  s: AuthDialogState,
  handleSubmit: (e: Event) => void,
  actions: AuthDialogActions,
) {
  if (s.signupSuccess) {
    return html`
      <div class="limerence-auth-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${t("auth.checkEmail")}</span>
      </div>
    `;
  }

  if (s.passwordUpdateSuccess) {
    return html`
      <div class="limerence-auth-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${t("auth.passwordUpdateSuccess")}</span>
      </div>
    `;
  }

  return html`
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

    ${s.tab === "login"
      ? html`<button
          class="limerence-auth-forgot-link"
          @click=${() => actions.onTabChange("reset")}
        >${t("auth.forgotPassword")}</button>`
      : nothing
    }

    ${s.tab === "signup"
      ? html`<p class="limerence-auth-hint">${t("auth.signupHint")}</p>`
      : nothing
    }
  `;
}

// ── Reset password (enter email) body ────────────────────────

function renderResetBody(
  s: AuthDialogState,
  handleResetSubmit: (e: Event) => void,
  actions: AuthDialogActions,
) {
  if (s.resetEmailSent) {
    return html`
      <div class="limerence-auth-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <span>${t("auth.resetEmailSent")}</span>
      </div>
      <button
        class="limerence-auth-forgot-link"
        @click=${() => actions.onTabChange("login")}
      >${t("auth.backToLogin")}</button>
    `;
  }

  return html`
    <p class="limerence-auth-hint" style="margin-bottom: 12px;">${t("auth.resetPasswordHint")}</p>
    <form @submit=${handleResetSubmit} class="limerence-auth-form">
      <div class="limerence-auth-field">
        <label for="reset-email">${t("auth.email")}</label>
        <input
          id="reset-email"
          type="email"
          placeholder="you@example.com"
          required
          autocomplete="email"
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
          : t("auth.sendResetLink")}
      </button>
    </form>
    <button
      class="limerence-auth-forgot-link"
      @click=${() => actions.onTabChange("login")}
    >${t("auth.backToLogin")}</button>
  `;
}

// ── Set new password body ────────────────────────────────────

function renderNewPasswordBody(
  s: AuthDialogState,
  handleNewPasswordSubmit: (e: Event) => void,
) {
  return html`
    <form @submit=${handleNewPasswordSubmit} class="limerence-auth-form">
      <div class="limerence-auth-field">
        <label for="new-password">${t("auth.newPassword")}</label>
        <input
          id="new-password"
          type="password"
          placeholder="••••••••"
          minlength="6"
          required
          autocomplete="new-password"
          ?disabled=${s.loading}
        />
      </div>

      <div class="limerence-auth-field">
        <label for="confirm-password">${t("auth.confirmPassword")}</label>
        <input
          id="confirm-password"
          type="password"
          placeholder="••••••••"
          minlength="6"
          required
          autocomplete="new-password"
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
          : t("auth.setNewPassword")}
      </button>
    </form>
  `;
}
