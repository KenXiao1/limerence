/**
 * Persistent script iframe management.
 *
 * Creates hidden iframes for scripts that run for the lifetime of the chat session.
 */

import type { ScriptConfig } from "./types";
import { createScriptIframe } from "./iframe-factory";

/** Container element for hidden script iframes. */
let _container: HTMLDivElement | null = null;

/** Map of script ID → iframe element. */
const _scriptIframes = new Map<string, HTMLIFrameElement>();

/**
 * Start all enabled persistent scripts by creating hidden iframes.
 */
export function startPersistentScripts(scripts: ScriptConfig[]): void {
  ensureContainer();

  for (const script of scripts) {
    if (!script.enabled) continue;
    if (_scriptIframes.has(script.id)) continue;

    const { iframe, id } = createScriptIframe(script.content);
    iframe.setAttribute("data-script-id", script.id);
    iframe.setAttribute("data-script-name", script.name);

    _container!.appendChild(iframe);
    _scriptIframes.set(script.id, iframe);
  }
}

/**
 * Destroy all persistent script iframes.
 */
export function destroyAllScriptIframes(): void {
  for (const [id, iframe] of _scriptIframes) {
    iframe.remove();
  }
  _scriptIframes.clear();

  if (_container) {
    _container.remove();
    _container = null;
  }
}

/**
 * Reload a single persistent script by destroying and recreating its iframe.
 */
export function reloadScript(scriptId: string, scripts: ScriptConfig[]): void {
  const existing = _scriptIframes.get(scriptId);
  if (existing) {
    existing.remove();
    _scriptIframes.delete(scriptId);
  }

  const script = scripts.find((s) => s.id === scriptId);
  if (!script || !script.enabled) return;

  ensureContainer();

  const { iframe } = createScriptIframe(script.content);
  iframe.setAttribute("data-script-id", script.id);
  iframe.setAttribute("data-script-name", script.name);

  _container!.appendChild(iframe);
  _scriptIframes.set(script.id, iframe);
}

/**
 * Get the number of active script iframes.
 */
export function getActiveScriptCount(): number {
  return _scriptIframes.size;
}

// ── Internal ──

function ensureContainer(): void {
  if (_container && _container.isConnected) return;

  _container = document.createElement("div");
  _container.id = "limerence-script-iframes";
  _container.style.cssText = "display:none;position:absolute;width:0;height:0;overflow:hidden;";
  document.body.appendChild(_container);
}
