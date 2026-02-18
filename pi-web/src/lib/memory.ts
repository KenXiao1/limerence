export interface MemoryEntry {
  session_id: string;
  timestamp: string;
  role: string;
  content: string;
}

export interface MemorySearchResult {
  timestamp: string;
  role: string;
  content: string;
  score: number;
}

export class MemoryIndex {
  private entries: MemoryEntry[] = [];
  private invertedIndex: Map<string, Array<[number, number]>> = new Map();
  private avgDl = 0;

  load(entries: MemoryEntry[]) {
    this.entries = entries;
    this.rebuildIndex();
  }

  add(entry: MemoryEntry) {
    const idx = this.entries.length;
    const tokens = tokenize(entry.content);
    const dl = tokens.length;

    const n = this.entries.length;
    this.avgDl = (this.avgDl * n + dl) / (n + 1);

    const tfMap = new Map<string, number>();
    for (const t of tokens) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    }

    for (const [term, count] of tfMap) {
      const tf = count / Math.max(dl, 1);
      let postings = this.invertedIndex.get(term);
      if (!postings) {
        postings = [];
        this.invertedIndex.set(term, postings);
      }
      postings.push([idx, tf]);
    }

    this.entries.push(entry);
  }

  search(query: string, limit = 5): MemorySearchResult[] {
    if (this.entries.length === 0) return [];

    const queryTokens = tokenize(query);
    const n = this.entries.length;
    const k1 = 1.2;
    const b = 0.75;

    const scores = new Map<number, number>();

    for (const token of queryTokens) {
      const postings = this.invertedIndex.get(token);
      if (!postings) continue;

      const df = postings.length;
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1.0);

      for (const [docIdx, tf] of postings) {
        const dl = tokenize(this.entries[docIdx].content).length;
        const tfNorm =
          (tf * (k1 + 1.0)) /
          (tf + k1 * (1.0 - b + (b * dl) / Math.max(this.avgDl, 1)));
        scores.set(docIdx, (scores.get(docIdx) ?? 0) + idf * tfNorm);
      }
    }

    const now = Date.now();
    const sorted = [...scores.entries()]
      .map(([idx, relevance]) => {
        const recency = recencyBoost(this.entries[idx].timestamp, now);
        return [idx, 0.85 * relevance + 0.15 * recency] as [number, number];
      })
      .sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, limit).map(([idx, score]) => ({
      timestamp: this.entries[idx].timestamp,
      role: this.entries[idx].role,
      content: this.entries[idx].content,
      score,
    }));
  }

  private rebuildIndex() {
    this.invertedIndex.clear();
    if (this.entries.length === 0) {
      this.avgDl = 0;
      return;
    }

    let totalDl = 0;
    for (let idx = 0; idx < this.entries.length; idx++) {
      const tokens = tokenize(this.entries[idx].content);
      const dl = tokens.length;
      totalDl += dl;

      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
      }

      for (const [term, count] of tfMap) {
        const tf = count / Math.max(dl, 1);
        let postings = this.invertedIndex.get(term);
        if (!postings) {
          postings = [];
          this.invertedIndex.set(term, postings);
        }
        postings.push([idx, tf]);
      }
    }

    this.avgDl = totalDl / this.entries.length;
  }
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  let currentWord = "";

  for (const ch of lower) {
    if (isCjk(ch)) {
      if (currentWord) {
        tokens.push(currentWord);
        currentWord = "";
      }
      tokens.push(ch);
    } else if (/[\p{L}\p{N}]/u.test(ch)) {
      currentWord += ch;
    } else if (currentWord) {
      tokens.push(currentWord);
      currentWord = "";
    }
  }

  if (currentWord) tokens.push(currentWord);
  return tokens;
}

// ── Time decay ──────────────────────────────────────────────────

const HALF_LIFE_DAYS = 7;
const DECAY_RATE = 0.693 / HALF_LIFE_DAYS; // ln(2) / halfLife

function recencyBoost(timestamp: string, nowMs: number): number {
  const ageDays = (nowMs - new Date(timestamp).getTime()) / 86_400_000;
  return Math.exp(-DECAY_RATE * Math.max(ageDays, 0));
}

function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af)
  );
}
