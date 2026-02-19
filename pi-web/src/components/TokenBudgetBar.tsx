/**
 * TokenBudgetBar — horizontal stacked bar showing token budget breakdown.
 */

import { useState } from "react";
import type { TokenBudget } from "../controllers/context-budget";
import { formatBudget } from "../controllers/context-budget";

const SEGMENTS: { key: keyof TokenBudget; label: string; color: string }[] = [
  { key: "systemPrompt", label: "系统", color: "bg-blue-500" },
  { key: "lorebook", label: "世界书", color: "bg-purple-500" },
  { key: "history", label: "历史", color: "bg-amber-500" },
  { key: "outputReserve", label: "预留", color: "bg-rose-500" },
  { key: "available", label: "可用", color: "bg-emerald-500" },
];

export function TokenBudgetBar({ budget }: { budget: TokenBudget }) {
  const [hovered, setHovered] = useState(false);
  const total = budget.contextWindow || 1;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {SEGMENTS.map(({ key, label, color }) => {
          const value = budget[key] as number;
          if (value <= 0) return null;
          const pct = (value / total) * 100;
          return (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${label}: ${value}`}
            />
          );
        })}
      </div>
      {hovered && (
        <div className="absolute left-0 top-full z-50 mt-1 whitespace-nowrap rounded border border-border bg-background px-2 py-1 text-xs shadow-md">
          {formatBudget(budget)}
        </div>
      )}
    </div>
  );
}
