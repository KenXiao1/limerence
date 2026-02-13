import { useState } from "react";
import type { Message } from "../lib/types";

interface Props {
  message: Message;
  isStreaming?: boolean;
  streamingText?: string;
}

export default function MessageBubble({
  message,
  isStreaming,
  streamingText,
}: Props) {
  const [toolExpanded, setToolExpanded] = useState(false);

  if (message.role === "system") return null;

  if (message.role === "tool") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-1">
        <button
          onClick={() => setToolExpanded(!toolExpanded)}
          className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-3 w-3 transition-transform ${toolExpanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          工具结果
        </button>
        {toolExpanded && (
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-500">
            {message.content}
          </pre>
        )}
      </div>
    );
  }

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const content = isStreaming && streamingText !== undefined ? streamingText : message.content;
  const hasToolCalls =
    isAssistant && "tool_calls" in message && message.tool_calls?.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-2">
      <div
        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-cyan-900/30 text-cyan-100"
              : "bg-zinc-800/80 text-zinc-200"
          }`}
        >
          {/* Render content with basic line breaks */}
          {content.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-magenta" />
          )}

          {/* Tool calls indicator */}
          {hasToolCalls && (
            <div className="mt-2 border-t border-zinc-700/50 pt-2">
              {message.tool_calls!.map((tc, i) => (
                <div key={i} className="text-xs text-zinc-500">
                  <span className="text-magenta/70">⚡</span>{" "}
                  {tc.function.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
