/**
 * Active tool calls indicator — pure view function.
 */

import { html } from "lit";

export function renderToolCalls(activeToolCalls: Array<{ id: string; name: string; label: string }>) {
  if (activeToolCalls.length === 0) return null;

  return html`
    <span class="text-xs px-2 py-1 rounded text-blue-500 animate-pulse" title="工具执行中">
      ⚙ ${activeToolCalls.map((t) => t.label).join(", ")}
    </span>
  `;
}
