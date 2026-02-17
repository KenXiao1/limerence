/**
 * Theme utilities — extracted from app-render.ts.
 * Framework-agnostic, no React or Lit dependency.
 */

export type Theme = "light" | "dark";

export function getPreferredTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  localStorage.setItem("limerence-theme", theme);
}

export function toggleTheme(): Theme {
  const next = getPreferredTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
