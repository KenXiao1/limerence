import { useRef, useEffect, useState } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled: boolean;
}

export default function InputBar({
  onSend,
  onAbort,
  isStreaming,
  disabled,
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [isStreaming]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-900/50 text-red-400 hover:bg-red-900/80"
            title="停止生成"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-magenta/20 text-magenta hover:bg-magenta/30 disabled:opacity-30 disabled:hover:bg-magenta/20"
            title="发送"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
