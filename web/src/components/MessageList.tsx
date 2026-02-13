import { useRef, useEffect } from "react";
import type { Message } from "../lib/types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  toolStatus: { name: string; result?: string } | null;
}

export default function MessageList({
  messages,
  isStreaming,
  streamingText,
  toolStatus,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, toolStatus]);

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-zinc-600">发送消息开始对话</p>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {/* Streaming assistant message */}
      {isStreaming && streamingText && (
        <MessageBubble
          message={{ role: "assistant", content: "" }}
          isStreaming
          streamingText={streamingText}
        />
      )}

      {/* Tool status indicator */}
      {isStreaming && toolStatus && (
        <div className="mx-auto max-w-3xl px-4 py-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-magenta/60" />
            {toolStatus.result
              ? `${toolStatus.name} 完成`
              : `正在调用 ${toolStatus.name}...`}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
