/**
 * iframe-runner public API.
 *
 * Provides init/destroy/onCharacterChanged/getEventBus for integration
 * with the pi-web app layer.
 */

export type { RegexScriptData, ScriptConfig } from "./types";
export { extractRegexScripts, extractAllRegexScripts, extractPersistentScripts } from "./regex-scripts";
export { eventBus, tavern_events, iframe_events } from "./event-bus";

import { eventBus } from "./event-bus";
import { installTavernBridge, uninstallTavernBridge, setTavernBridgeState } from "./tavern-bridge";
import { installResizeListener, uninstallResizeListener } from "./iframe-factory";
import {
  setRegexScripts,
  startMessageObserver,
  stopMessageObserver,
  processRenderedMessage,
  reprocessAllMessages,
  destroyMessageIframe,
} from "./message-iframes";
import {
  startPersistentScripts,
  destroyAllScriptIframes,
} from "./script-iframes";
import { setCurrentSessionId } from "./variables";
import { extractRegexScripts, extractPersistentScripts } from "./regex-scripts";
import type { CharacterCard } from "../lib/character";
import type { AppState } from "../app-state";

let _initialized = false;
let _pendingPersistentScripts: import("./types").ScriptConfig[] = [];

/**
 * Initialize the iframe-runner system.
 * Call once when entering chat view.
 */
export function initIframeRunner(state: AppState): void {
  if (_initialized) return;
  _initialized = true;

  setTavernBridgeState(state);
  installTavernBridge();
  installResizeListener();
  startMessageObserver();

  if (_pendingPersistentScripts.length > 0) {
    startPersistentScripts(_pendingPersistentScripts);
  }

  if (state.currentSessionId) {
    setCurrentSessionId(state.currentSessionId);
  }
}

/**
 * Destroy the iframe-runner system.
 * Call when leaving chat view.
 */
export function destroyIframeRunner(): void {
  if (!_initialized) return;
  _initialized = false;

  stopMessageObserver();
  destroyAllScriptIframes();
  uninstallTavernBridge();
  uninstallResizeListener();
  eventBus.clearAll();
}

/**
 * Called when a character is selected/changed.
 * Extracts regex_scripts and persistent scripts, starts persistent scripts.
 */
export function onCharacterChanged(card: CharacterCard): {
  regexScripts: import("./types").RegexScriptData[];
  persistentScripts: import("./types").ScriptConfig[];
} {
  // Destroy existing script iframes
  destroyAllScriptIframes();

  // Extract scripts from the new character
  const regexScripts = extractRegexScripts(card);
  const persistentScripts = extractPersistentScripts(card);

  // Update message iframe processor
  setRegexScripts(regexScripts);

  // Start persistent scripts immediately if runner is active,
  // otherwise queue them and start when initIframeRunner() runs.
  _pendingPersistentScripts = persistentScripts;
  if (_initialized && persistentScripts.length > 0) {
    startPersistentScripts(persistentScripts);
  }

  return { regexScripts, persistentScripts };
}

/**
 * Called when session ID changes.
 */
export function onSessionChanged(sessionId: string): void {
  setCurrentSessionId(sessionId);
}

/**
 * Get the event bus for emitting events from the agent layer.
 */
export function getEventBus() {
  return eventBus;
}

/**
 * Process a rendered message (called from agent event bridge).
 */
export { processRenderedMessage } from "./message-iframes";

/**
 * Re-process all messages (called after loading a session).
 */
export { reprocessAllMessages } from "./message-iframes";

/**
 * Destroy a specific message iframe (called on delete/swipe).
 */
export { destroyMessageIframe } from "./message-iframes";

/**
 * Update regex scripts enabled/disabled state.
 */
export { setRegexScripts } from "./message-iframes";
