/**
 * Memory flush hook — monitors token usage and triggers a silent
 * memory-save turn before compaction kicks in.
 */

import { useRef, useCallback } from "react";
import {
  shouldFlushMemory,
  FLUSH_PROMPT,
  estimateMessagesTokens,
} from "../controllers/compaction";
import type { ChatMessage } from "../types/chat-message";

export interface MemoryFlushState {
  lastFlushAt: number;
}

/**
 * Hook that checks whether a memory flush should be triggered
 * and provides the flush prompt to inject.
 *
 * Returns `flushPrompt` — a string to prepend to the user's message
 * when flush is needed, or null if no flush is required.
 */
export function useMemoryFlush(contextWindow: number) {
  const lastFlushAtRef = useRef(0);

  const checkFlush = useCallback(
    (messages: ChatMessage[]): string | null => {
      if (!shouldFlushMemory(messages, contextWindow, lastFlushAtRef.current)) {
        return null;
      }
      lastFlushAtRef.current = Date.now();
      return FLUSH_PROMPT;
    },
    [contextWindow],
  );

  const getTokenUsage = useCallback(
    (messages: ChatMessage[]) => estimateMessagesTokens(messages),
    [],
  );

  return { checkFlush, getTokenUsage };
}
