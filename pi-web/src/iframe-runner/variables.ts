/**
 * Three-level variable storage for iframe scripts.
 * Persisted to localStorage with key prefix `limerence-vars-`.
 *
 * Scopes:
 *   - global          — shared across all sessions
 *   - chat:{sessionId} — per-session
 *   - message:{index}  — per-message
 */

const PREFIX = "limerence-vars-";

function storageKey(scope: string): string {
  return `${PREFIX}${scope}`;
}

function loadScope(scope: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveScope(scope: string, vars: Record<string, string>): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(vars));
  } catch { /* ignore */ }
}

// ── Current session ID (set by the integration layer) ──

let _currentSessionId = "";

export function setCurrentSessionId(id: string): void {
  _currentSessionId = id;
}

// ── Public API ──

/**
 * Get all variables for a scope (or merged global + chat if no scope given).
 */
export function getVariables(scope?: string): Record<string, string> {
  if (scope) return loadScope(scope);

  // Merge global + current chat scope
  const global = loadScope("global");
  const chat = _currentSessionId ? loadScope(`chat:${_currentSessionId}`) : {};
  return { ...global, ...chat };
}

/**
 * Replace (overwrite) all variables in a scope.
 */
export function replaceVariables(vars: Record<string, string>, scope?: string): void {
  const target = scope ?? "global";
  saveScope(target, vars);
}

/**
 * Insert or update a single variable.
 * If key starts with "msg:" it goes to message scope, "chat:" to chat scope, else global.
 */
export function insertVariable(key: string, value: string): void {
  let scope = "global";
  let actualKey = key;

  if (key.startsWith("msg:")) {
    const rest = key.slice(4);
    const dotIdx = rest.indexOf(".");
    if (dotIdx > 0) {
      scope = `message:${rest.slice(0, dotIdx)}`;
      actualKey = rest.slice(dotIdx + 1);
    }
  } else if (key.startsWith("chat:")) {
    scope = `chat:${_currentSessionId}`;
    actualKey = key.slice(5);
  }

  const vars = loadScope(scope);
  vars[actualKey] = value;
  saveScope(scope, vars);
}

/**
 * Delete a variable by key.
 */
export function deleteVariable(key: string): void {
  // Try all scopes
  for (const scope of ["global", `chat:${_currentSessionId}`]) {
    const vars = loadScope(scope);
    if (key in vars) {
      delete vars[key];
      saveScope(scope, vars);
      return;
    }
  }
}
