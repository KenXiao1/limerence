/**
 * Token usage display — pure view function.
 */

import { html } from "lit";
import { t } from "../lib/i18n";
import { formatTokenCount, tokenUsagePercent } from "../controllers/compaction";

export function renderTokenUsage(estimatedTokens: number, contextWindow: number) {
  if (estimatedTokens <= 0) return null;

  const percent = tokenUsagePercent(estimatedTokens, contextWindow);
  const colorClass = percent > 80 ? "text-red-500" : percent > 60 ? "text-yellow-500" : "text-muted-foreground";

  return html`
    <span class="text-xs px-2 py-1 rounded ${colorClass}" title="${t("token.tooltip")}">
      ${formatTokenCount(estimatedTokens)}/${formatTokenCount(contextWindow)} (${percent}%)
    </span>
  `;
}
