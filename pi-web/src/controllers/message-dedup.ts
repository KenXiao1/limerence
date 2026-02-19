/**
 * Message deduplication controller — detects when LLM repeats tool output in its reply.
 * Pure functions, no React imports.
 */

// ── Normalization ──────────────────────────────────────────────

/**
 * Normalize text for duplicate comparison.
 * Strips whitespace, punctuation, and case differences.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。，！？、：；\u201c\u201d\u2018\u2019（）【】…—·\-,.!?:;"'()[\]/\\_.]/g, "")
    .trim();
}

// ── Dedup tracker ──────────────────────────────────────────────

/**
 * Tracks tool output texts to detect when the LLM repeats them.
 */
export class MessageDeduplicator {
  private sentTexts: string[] = [];
  private sentTextsNormalized: string[] = [];

  /**
   * Record a tool output text for future duplicate checking.
   */
  recordToolOutput(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.sentTexts.push(trimmed);
    this.sentTextsNormalized.push(normalizeForComparison(trimmed));
  }

  /**
   * Check if a text segment is a duplicate of a previously recorded tool output.
   * Returns the match ratio (0-1). Above 0.8 is considered a duplicate.
   */
  isDuplicate(text: string): boolean {
    if (this.sentTextsNormalized.length === 0) return false;
    const normalized = normalizeForComparison(text);
    if (!normalized) return false;

    for (const recorded of this.sentTextsNormalized) {
      if (normalized === recorded) return true;
      // Check if the text contains a large portion of any recorded text
      if (recorded.length > 8 && normalized.includes(recorded)) return true;
      if (normalized.length > 8 && recorded.includes(normalized)) return true;
      // Similarity check for near-duplicates
      if (computeSimilarity(normalized, recorded) > 0.85) return true;
    }

    return false;
  }

  /**
   * Filter paragraphs from an assistant reply, removing duplicates of tool outputs.
   * Returns the cleaned text.
   */
  filterReply(text: string): string {
    if (this.sentTextsNormalized.length === 0) return text;

    const paragraphs = text.split(/\n\n+/);
    const filtered = paragraphs.filter((para) => {
      const trimmed = para.trim();
      if (!trimmed) return true; // keep blank separators
      return !this.isDuplicate(trimmed);
    });

    // If we filtered everything, return original (safety)
    if (filtered.every((p) => !p.trim())) return text;

    return filtered.join("\n\n");
  }

  /**
   * Reset recorded texts (e.g., at start of new turn).
   */
  reset(): void {
    this.sentTexts = [];
    this.sentTextsNormalized = [];
  }

  /**
   * Get count of recorded tool outputs.
   */
  get recordedCount(): number {
    return this.sentTexts.length;
  }
}

// ── Similarity ─────────────────────────────────────────────────

/**
 * Simple character-level Jaccard similarity between two normalized strings.
 * Fast and sufficient for detecting near-duplicates.
 */
function computeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Use character trigram sets for comparison
  const trigramsA = buildTrigrams(a);
  const trigramsB = buildTrigrams(b);

  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }

  const union = trigramsA.size + trigramsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function buildTrigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= text.length - 3; i++) {
    set.add(text.slice(i, i + 3));
  }
  return set;
}
