/**
 * Think tag streaming tracker — parses <think>/<thinking> tags from
 * DeepSeek, QWen, and other models that use XML-style reasoning markers.
 * Pure functions + stateful tracker class.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ThinkingParseResult {
  /** Visible content (outside think tags) */
  content: string;
  /** Thinking content (inside think tags) */
  thinking: string;
  /** Whether we're currently inside a think block */
  isThinking: boolean;
}

// ── Tag detection regex ────────────────────────────────────────

/**
 * Matches opening and closing think-family tags.
 * Covers: <think>, <thinking>, <thought>, <antthinking>
 * Case-insensitive, allows whitespace around tag name.
 */
const THINKING_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\s*>/gi;

/**
 * Matches the <final> tag that marks the start of the actual response.
 */
const FINAL_TAG_RE = /<\s*(\/?)\s*final\s*>/gi;

// ── Stateful streaming tracker ─────────────────────────────────

/**
 * Tracks think tag open/close state across streaming chunks.
 * Accumulates thinking and content separately.
 */
export class ThinkingTracker {
  private isInThinkBlock = false;
  private thinkingBuffer = "";
  private contentBuffer = "";
  private partialTag = "";

  /**
   * Process a new streaming delta.
   * Returns the new visible content and thinking content from this delta.
   */
  push(delta: string): { content: string; thinking: string } {
    // Prepend any partial tag from previous chunk
    const text = this.partialTag + delta;
    this.partialTag = "";

    // Check for incomplete tag at end (potential tag being split across chunks)
    const trailingAngle = text.lastIndexOf("<");
    let processText: string;
    if (trailingAngle !== -1 && trailingAngle > text.length - 30) {
      const afterAngle = text.slice(trailingAngle);
      // If it looks like a partial tag (no closing >)
      if (!afterAngle.includes(">")) {
        this.partialTag = afterAngle;
        processText = text.slice(0, trailingAngle);
      } else {
        processText = text;
      }
    } else {
      processText = text;
    }

    let content = "";
    let thinking = "";
    let lastIndex = 0;

    // Process all tags in the text
    THINKING_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = THINKING_TAG_RE.exec(processText)) !== null) {
      const before = processText.slice(lastIndex, match.index);
      const isClosing = match[1] === "/";

      // Route text before the tag to the appropriate buffer
      if (this.isInThinkBlock) {
        thinking += before;
        this.thinkingBuffer += before;
      } else {
        content += before;
        this.contentBuffer += before;
      }

      if (isClosing) {
        this.isInThinkBlock = false;
      } else {
        this.isInThinkBlock = true;
      }

      lastIndex = match.index + match[0].length;
    }

    // Also strip <final> tags — they mark the end of thinking
    let remaining = processText.slice(lastIndex);
    FINAL_TAG_RE.lastIndex = 0;
    remaining = remaining.replace(FINAL_TAG_RE, (fullMatch, slash) => {
      if (!slash) {
        // Opening <final> — ensure we're out of think mode
        this.isInThinkBlock = false;
      }
      return "";
    });

    // Route remaining text
    if (this.isInThinkBlock) {
      thinking += remaining;
      this.thinkingBuffer += remaining;
    } else {
      content += remaining;
      this.contentBuffer += remaining;
    }

    return { content, thinking };
  }

  /**
   * Flush any remaining partial tag buffer.
   */
  flush(): { content: string; thinking: string } {
    if (!this.partialTag) return { content: "", thinking: "" };

    const text = this.partialTag;
    this.partialTag = "";

    // Treat remaining partial tag as content (not a real tag)
    if (this.isInThinkBlock) {
      this.thinkingBuffer += text;
      return { content: "", thinking: text };
    }
    this.contentBuffer += text;
    return { content: text, thinking: "" };
  }

  /**
   * Get the full accumulated thinking content.
   */
  getThinking(): string {
    return this.thinkingBuffer;
  }

  /**
   * Get the full accumulated visible content.
   */
  getContent(): string {
    return this.contentBuffer;
  }

  /**
   * Whether we're currently inside a think block.
   */
  get isThinking(): boolean {
    return this.isInThinkBlock;
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.isInThinkBlock = false;
    this.thinkingBuffer = "";
    this.contentBuffer = "";
    this.partialTag = "";
  }
}

// ── One-shot parsing ───────────────────────────────────────────

/**
 * Parse a complete message to extract thinking and content.
 * For non-streaming use cases.
 */
export function parseThinkingTags(text: string): ThinkingParseResult {
  const tracker = new ThinkingTracker();
  tracker.push(text);
  const flushed = tracker.flush();

  return {
    content: (tracker.getContent() + flushed.content).trim(),
    thinking: (tracker.getThinking() + flushed.thinking).trim(),
    isThinking: false,
  };
}

/**
 * Check if a message likely contains think tags.
 * Quick check without full parsing.
 */
export function hasThinkingTags(text: string): boolean {
  return /<\s*(?:think(?:ing)?|thought|antthinking)\s*>/i.test(text);
}
