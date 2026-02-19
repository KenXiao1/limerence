/**
 * Block-based streaming chunker — Markdown-aware text splitting.
 * Ported from OpenClaw's EmbeddedBlockChunker pattern.
 * Splits streamed text into discrete "bubbles" for multi-bubble UI.
 */

// ── Types ──────────────────────────────────────────────────────

export interface BlockChunkerConfig {
  /** Minimum characters before emitting a block (default: 80) */
  minChars: number;
  /** Maximum characters in a single block (default: 600) */
  maxChars: number;
  /** Break preference order: paragraph > newline > sentence */
  breakPreference: "paragraph" | "newline" | "sentence";
  /** If true, flush immediately on paragraph break even if below minChars */
  flushOnParagraph: boolean;
}

export const DEFAULT_CHUNKER_CONFIG: BlockChunkerConfig = {
  minChars: 80,
  maxChars: 600,
  breakPreference: "paragraph",
  flushOnParagraph: false,
};

export interface TextBlock {
  text: string;
  index: number;
}

// ── Fence detection ────────────────────────────────────────────

interface FenceSpan {
  start: number;
  end: number; // -1 means unclosed
}

const FENCE_RE = /^(`{3,}|~{3,}).*$/gm;

/**
 * Find all code fence spans in text.
 * Returns ranges of characters that are inside fenced code blocks.
 */
function parseFenceSpans(text: string): FenceSpan[] {
  const spans: FenceSpan[] = [];
  const matches = [...text.matchAll(FENCE_RE)];
  let openIdx = -1;
  let openFence = "";

  for (const m of matches) {
    const fence = m[1]; // the backtick or tilde sequence
    if (openIdx === -1) {
      // Opening fence
      openIdx = m.index!;
      openFence = fence;
    } else if (fence[0] === openFence[0] && fence.length >= openFence.length) {
      // Closing fence
      spans.push({ start: openIdx, end: m.index! + m[0].length });
      openIdx = -1;
      openFence = "";
    }
  }

  // Unclosed fence
  if (openIdx !== -1) {
    spans.push({ start: openIdx, end: -1 });
  }

  return spans;
}

/**
 * Check if a position is inside a code fence.
 */
function isInsideFence(pos: number, spans: FenceSpan[]): boolean {
  for (const span of spans) {
    if (pos >= span.start && (span.end === -1 || pos < span.end)) {
      return true;
    }
  }
  return false;
}

// ── Break point finding ────────────────────────────────────────

const PARAGRAPH_RE = /\n\n/g;
const NEWLINE_RE = /\n/g;
const SENTENCE_RE = /[。！？.!?]\s*/g;

/**
 * Find the best break point in text, respecting code fence boundaries.
 */
function findBreakPoint(
  text: string,
  minPos: number,
  maxPos: number,
  preference: "paragraph" | "newline" | "sentence",
  fenceSpans: FenceSpan[],
): number {
  const candidates: number[] = [];

  // Try each level of break
  const levels: [RegExp, string][] = [
    [PARAGRAPH_RE, "paragraph"],
    [NEWLINE_RE, "newline"],
    [SENTENCE_RE, "sentence"],
  ];

  // Start from the preferred level
  const startIdx = levels.findIndex(([, name]) => name === preference);

  for (let i = startIdx; i < levels.length; i++) {
    const re = new RegExp(levels[i][0].source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const breakPos = match.index + match[0].length;
      if (breakPos >= minPos && breakPos <= maxPos && !isInsideFence(match.index, fenceSpans)) {
        candidates.push(breakPos);
      }
    }
    // If we found candidates at this level, use the last one
    if (candidates.length > 0) {
      return candidates[candidates.length - 1];
    }
  }

  return -1; // No suitable break point found
}

// ── EmbeddedBlockChunker ───────────────────────────────────────

export class EmbeddedBlockChunker {
  private buffer = "";
  private blocks: TextBlock[] = [];
  private blockIndex = 0;
  private config: BlockChunkerConfig;

  constructor(config: Partial<BlockChunkerConfig> = {}) {
    this.config = { ...DEFAULT_CHUNKER_CONFIG, ...config };
  }

  /**
   * Feed new text (e.g., from a streaming delta).
   * Returns newly completed blocks.
   */
  push(delta: string): TextBlock[] {
    this.buffer += delta;
    return this.drain();
  }

  /**
   * Flush remaining buffer as a final block.
   */
  flush(): TextBlock[] {
    const result: TextBlock[] = [];
    if (this.buffer.trim()) {
      const block: TextBlock = { text: this.buffer, index: this.blockIndex++ };
      this.blocks.push(block);
      result.push(block);
      this.buffer = "";
    }
    return result;
  }

  /**
   * Get all blocks emitted so far.
   */
  getBlocks(): TextBlock[] {
    return [...this.blocks];
  }

  /**
   * Reset the chunker state.
   */
  reset(): void {
    this.buffer = "";
    this.blocks = [];
    this.blockIndex = 0;
  }

  private drain(): TextBlock[] {
    const result: TextBlock[] = [];
    const { minChars, maxChars, flushOnParagraph, breakPreference } = this.config;

    while (this.buffer.length >= minChars) {
      // Check for paragraph break if flushOnParagraph
      if (flushOnParagraph) {
        const paraIdx = this.buffer.indexOf("\n\n");
        if (paraIdx !== -1 && paraIdx > 0) {
          const fenceSpans = parseFenceSpans(this.buffer);
          if (!isInsideFence(paraIdx, fenceSpans)) {
            const breakPos = paraIdx + 2; // include the \n\n
            const chunk = this.buffer.slice(0, breakPos);
            this.buffer = this.buffer.slice(breakPos);
            const block: TextBlock = { text: chunk, index: this.blockIndex++ };
            this.blocks.push(block);
            result.push(block);
            continue;
          }
        }
      }

      if (this.buffer.length < minChars) break;

      const fenceSpans = parseFenceSpans(this.buffer);
      const searchEnd = Math.min(this.buffer.length, maxChars);

      // Find a natural break point
      const breakPos = findBreakPoint(this.buffer, minChars, searchEnd, breakPreference, fenceSpans);

      if (breakPos > 0) {
        const chunk = this.buffer.slice(0, breakPos);
        this.buffer = this.buffer.slice(breakPos);
        const block: TextBlock = { text: chunk, index: this.blockIndex++ };
        this.blocks.push(block);
        result.push(block);
      } else if (this.buffer.length >= maxChars) {
        // Force split at maxChars — handle code fence continuation
        let splitPos = maxChars;
        const activeFence = fenceSpans.find(
          (s) => s.start < maxChars && (s.end === -1 || s.end > maxChars),
        );

        if (activeFence) {
          // Find the fence marker to close and reopen
          const fenceMatch = this.buffer.slice(activeFence.start).match(/^(`{3,}|~{3,})/m);
          const fenceMarker = fenceMatch ? fenceMatch[1] : "```";
          const chunk = this.buffer.slice(0, splitPos) + "\n" + fenceMarker;
          this.buffer = fenceMarker + "\n" + this.buffer.slice(splitPos);
          const block: TextBlock = { text: chunk, index: this.blockIndex++ };
          this.blocks.push(block);
          result.push(block);
        } else {
          const chunk = this.buffer.slice(0, splitPos);
          this.buffer = this.buffer.slice(splitPos);
          const block: TextBlock = { text: chunk, index: this.blockIndex++ };
          this.blocks.push(block);
          result.push(block);
        }
      } else {
        // Buffer is between minChars and maxChars but no break found — wait for more
        break;
      }
    }

    return result;
  }
}
