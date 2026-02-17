/**
 * AuthDialog — login / signup / forgot password.
 * Ported from views/auth-dialog.ts (Lit) to React.
 */

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { t } from "../lib/i18n";

export type AuthTab = "login" | "signup" | "reset" | "newPassword";

interface Props {
  open: boolean;
  initialTab?: AuthTab;
  passwordRecovery?: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
}

export function AuthDialog({
  open,
  initialTab = "login",
  passwordRecovery = false,
  onClose,
  onLogin,
  onSignup,
  onResetPassword,
  onUpdatePassword,
}: Props) {
  const [tab, setTab] = useState<AuthTab>(passwordRecovery ? "newPassword" : initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSuccess("");
      setLoading(true);

      const form = e.currentTarget;
      try {
        if (tab === "login") {
          const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
          const password = (form.elements.namedItem("password") as HTMLInputElement).value;
          await onLogin(email, password);
          onClose();
        } else if (tab === "signup") {
          const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
          const password = (form.elements.namedItem("password") as HTMLInputElement).value;
          await onSignup(email, password);
          setSuccess(t("auth.signupSuccess"));
        } else if (tab === "reset") {
          const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
          await onResetPassword(email);
          setSuccess(t("auth.resetEmailSent"));
        } else if (tab === "newPassword") {
          const pw = (form.elements.namedItem("password") as HTMLInputElement).value;
          const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
          if (pw !== confirm) {
            setError(t("auth.passwordMismatch"));
            return;
          }
          await onUpdatePassword(pw);
          setSuccess(t("auth.passwordUpdated"));
        }
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    },
    [tab, onLogin, onSignup, onResetPassword, onUpdatePassword, onClose],
  );

  if (!open) return null;

  const titles: Record<AuthTab, string> = {
    login: t("auth.loginTitle"),
    signup: t("auth.signupTitle"),
    reset: t("auth.resetPassword"),
    newPassword: t("auth.setNewPassword"),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{titles[tab]}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        {success && <p className="text-sm text-green-600 mb-3">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {(tab === "login" || tab === "signup" || tab === "reset") && (
            <input
              name="email"
              type="email"
              placeholder={t("auth.email")}
              required
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}

          {(tab === "login" || tab === "signup") && (
            <input
              name="password"
              type="password"
              placeholder={t("auth.password")}
              required
              minLength={6}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}

          {tab === "newPassword" && (
            <>
              <input
                name="password"
                type="password"
                placeholder={t("auth.newPassword")}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                name="confirm"
                type="password"
                placeholder={t("auth.confirmPassword")}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : titles[tab]}
          </button>
        </form>

        {/* Tab switchers */}
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          {tab === "login" && (
            <>
              <button className="hover:underline" onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}>
                {t("auth.noAccount")}
              </button>
              <span className="mx-2">|</span>
              <button className="hover:underline" onClick={() => { setTab("reset"); setError(""); setSuccess(""); }}>
                {t("auth.forgotPassword")}
              </button>
            </>
          )}
          {tab === "signup" && (
            <button className="hover:underline" onClick={() => { setTab("login"); setError(""); setSuccess(""); }}>
              {t("auth.hasAccount")}
            </button>
          )}
          {tab === "reset" && (
            <button className="hover:underline" onClick={() => { setTab("login"); setError(""); setSuccess(""); }}>
              {t("auth.backToLogin")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
