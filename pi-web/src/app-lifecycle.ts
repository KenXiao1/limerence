/**
 * App lifecycle — centralized initialization, cleanup, and resource tracking.
 * All disposable resources (listeners, timers, observers) are tracked here.
 */

import { state } from "./app-state";

// ── Resource tracking ──────────────────────────────────────────

const _cleanupFns: Array<() => void> = [];

/**
 * Register a window event listener that will be automatically cleaned up.
 */
export function addGlobalListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
) {
  window.addEventListener(type, handler);
  _cleanupFns.push(() => window.removeEventListener(type, handler));
}

/**
 * Register a document event listener that will be automatically cleaned up.
 */
export function addDocumentListener<K extends keyof DocumentEventMap>(
  type: K,
  handler: (ev: DocumentEventMap[K]) => void,
) {
  document.addEventListener(type, handler);
  _cleanupFns.push(() => document.removeEventListener(type, handler));
}

/**
 * Register a timer (setInterval) that will be automatically cleaned up.
 */
export function addInterval(callback: () => void, ms: number): number {
  const id = window.setInterval(callback, ms);
  _cleanupFns.push(() => clearInterval(id));
  return id;
}

/**
 * Register an arbitrary cleanup function.
 */
export function onCleanup(fn: () => void) {
  _cleanupFns.push(fn);
}

// ── Cleanup ────────────────────────────────────────────────────

/**
 * Run all registered cleanup functions and clear the list.
 * Also cleans up agent subscription if active.
 */
export function cleanupApp() {
  for (const fn of _cleanupFns) {
    try { fn(); } catch { /* ignore cleanup errors */ }
  }
  _cleanupFns.length = 0;

  if (state.agentUnsubscribe) {
    state.agentUnsubscribe();
    state.agentUnsubscribe = undefined;
  }
}

// ── DOM setup ──────────────────────────────────────────────────

/**
 * Create the app's DOM containers (chatHost + introHost) inside #app.
 */
export function createAppContainers(): { chatHost: HTMLElement; introHost: HTMLElement } {
  const appRoot = document.getElementById("app");
  if (!appRoot) throw new Error("App container not found");
  appRoot.innerHTML = "";

  const chatHost = document.createElement("div");
  const introHost = document.createElement("div");
  chatHost.style.width = "100%";
  chatHost.style.height = "100%";
  introHost.style.width = "100%";
  introHost.style.height = "100%";
  appRoot.append(chatHost, introHost);

  state.appRoot = appRoot;
  state.chatHost = chatHost;
  state.introHost = introHost;

  return { chatHost, introHost };
}
