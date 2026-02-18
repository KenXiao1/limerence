import initSqlJs, { type Database } from "sql.js";

// ── Types ───────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number;
}

// ── Constants ───────────────────────────────────────────────────

const CHUNK_TARGET_CHARS = 1600; // ~400 tokens
const CHUNK_OVERLAP_CHARS = 320; // ~80 tokens
const IDB_STORE = "limerence-memory-db";
const IDB_KEY = "sqlite";

// ── Schema ──────────────────────────────────────────────────────

const BASE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  hash TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);

CREATE TABLE IF NOT EXISTS embedding_cache (
  text_hash TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const FTS5_SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  id UNINDEXED,
  path UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED
);
`;

// ── Helpers ─────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Split markdown into chunks by lines, with overlap.
 * Ported from OpenClaw `chunkMarkdown()`.
 */
function chunkMarkdown(
  text: string,
  path: string,
): Array<{ id: string; path: string; startLine: number; endLine: number; text: string; hash: string }> {
  const lines = text.split("\n");
  if (lines.length === 0) return [];

  const chunks: Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
    hash: string;
  }> = [];

  let startLine = 0;

  while (startLine < lines.length) {
    let charCount = 0;
    let endLine = startLine;

    // Accumulate lines until we hit the target size
    while (endLine < lines.length && charCount < CHUNK_TARGET_CHARS) {
      charCount += lines[endLine].length + 1; // +1 for newline
      endLine++;
    }

    const chunkText = lines.slice(startLine, endLine).join("\n");
    // Use a simple sync hash for chunk ID (crypto.subtle is async, we'll set hash later)
    const simpleHash = simpleStringHash(chunkText);
    const id = `${path}:${startLine}:${endLine}:${simpleHash}`;

    chunks.push({
      id,
      path,
      startLine: startLine + 1, // 1-based
      endLine,
      text: chunkText,
      hash: simpleHash,
    });

    // Advance with overlap
    const overlapLines = findOverlapStart(lines, endLine, CHUNK_OVERLAP_CHARS);
    startLine = Math.max(endLine - overlapLines, endLine);
    if (startLine <= chunks[chunks.length - 1].startLine - 1 && startLine < lines.length) {
      // Prevent infinite loop
      startLine = endLine;
    }
    if (endLine >= lines.length) break;
  }

  return chunks;
}

function findOverlapStart(lines: string[], endLine: number, overlapChars: number): number {
  let chars = 0;
  let count = 0;
  for (let i = endLine - 1; i >= 0 && chars < overlapChars; i--) {
    chars += lines[i].length + 1;
    count++;
  }
  return count;
}

function simpleStringHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Build FTS5 query from natural language.
 * Ported from OpenClaw `buildFtsQuery()`.
 */
function buildFtsQuery(query: string): string {
  const tokens = tokenizeForFts(query);
  if (tokens.length === 0) return '""';

  // Use OR between tokens for broader matching, with prefix matching
  return tokens.map((t) => `"${escapeFts(t)}"*`).join(" OR ");
}

function tokenizeForFts(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  let current = "";

  for (const ch of lower) {
    if (isCjk(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(ch);
    } else if (/[\p{L}\p{N}]/u.test(ch)) {
      current += ch;
    } else if (current) {
      tokens.push(current);
      current = "";
    }
  }
  if (current) tokens.push(current);
  return tokens;
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

function escapeFts(text: string): string {
  return text.replace(/"/g, '""');
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

const HALF_LIFE_DAYS = 7;
const DECAY_RATE = 0.693 / HALF_LIFE_DAYS;

function recencyBoostMs(updatedAt: number, nowMs: number): number {
  const ageDays = (nowMs - updatedAt) / 86_400_000;
  return Math.exp(-DECAY_RATE * Math.max(ageDays, 0));
}

function applyRecency(results: SearchResult[], getTime: (r: SearchResult) => number): SearchResult[] {
  const now = Date.now();
  return results
    .map((r) => ({ ...r, score: 0.85 * r.score + 0.15 * recencyBoostMs(getTime(r), now) }))
    .sort((a, b) => b.score - a.score);
}

function isMissingFtsModuleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("no such module: fts5");
}

/**
 * Convert FTS5 bm25 rank (negative) to a 0-1 score.
 * Ported from OpenClaw `bm25RankToScore()`.
 */
function bm25RankToScore(rank: number): number {
  // FTS5 bm25() returns negative values; more negative = better match
  return 1 / (1 + Math.exp(rank));
}

/**
 * Cosine similarity between two vectors.
 * Ported from OpenClaw `cosineSimilarity()`.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Merge keyword and vector search results with RRF (Reciprocal Rank Fusion).
 * Ported from OpenClaw `mergeHybridResults()`.
 */
function mergeHybridResults(
  keywordResults: SearchResult[],
  vectorResults: SearchResult[],
  limit: number,
  keywordWeight = 0.7,
  vectorWeight = 0.3,
): SearchResult[] {
  const k = 60; // RRF constant
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();

  for (let i = 0; i < keywordResults.length; i++) {
    const r = keywordResults[i];
    const rrfScore = keywordWeight / (k + i + 1);
    scoreMap.set(r.id, { result: r, score: rrfScore });
  }

  for (let i = 0; i < vectorResults.length; i++) {
    const r = vectorResults[i];
    const rrfScore = vectorWeight / (k + i + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(r.id, { result: r, score: rrfScore });
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => ({ ...e.result, score: e.score }));
}

// ── IndexedDB persistence helpers ───────────────────────────────

function idbGet(storeName: string, key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("limerence-memory-sqlite", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result ?? null);
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => db.close();
    };
    req.onerror = () => reject(req.error);
  });
}

function idbSet(storeName: string, key: string, value: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("limerence-memory-sqlite", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

// ── MemoryDB class ──────────────────────────────────────────────

export class MemoryDB {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;
  private ftsAvailable = false;
  private _ready = false;

  get ready(): boolean {
    return this._ready;
  }

  async init(): Promise<void> {
    if (this.db && this._ready) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initInternal();
    try {
      await this.initPromise;
    } catch (error) {
      this.close();
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  private async initInternal(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => "/sql-wasm.wasm",
    });

    // Try to restore from IndexedDB
    const saved = await idbGet(IDB_STORE, IDB_KEY);
    let restored = false;
    let recreatedFromUnsupportedSchema = false;
    if (saved !== null) {
      try {
        this.db = new SQL.Database(saved);
        restored = true;
      } catch {
        this.db = null;
      }
    }
    if (!this.db) this.db = new SQL.Database();

    try {
      // Ensure base schema exists
      this.db.run(BASE_SCHEMA_SQL);
    } catch (error) {
      // Persisted DB can contain FTS tables created by a different SQLite build.
      // Recreate a clean DB if current wasm doesn't support FTS5.
      if (!(restored && isMissingFtsModuleError(error))) {
        throw error;
      }
      this.db.close();
      this.db = new SQL.Database();
      this.db.run(BASE_SCHEMA_SQL);
      recreatedFromUnsupportedSchema = true;
    }

    this.ftsAvailable = this.tryEnableFts();
    if (!this.ftsAvailable) {
      console.warn("[MemoryDB] FTS5 unavailable; using LIKE keyword fallback.");
    }
    if (recreatedFromUnsupportedSchema) {
      await this.persist();
    }
    this._ready = true;
  }

  private tryEnableFts(): boolean {
    if (!this.db) return false;
    try {
      this.db.run(FTS5_SCHEMA_SQL);
      return true;
    } catch (error) {
      if (!isMissingFtsModuleError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[MemoryDB] Failed to enable FTS5: ${message}`);
      }
      return false;
    }
  }

  /**
   * Index a memory file: chunk it and insert into SQLite + FTS5.
   */
  async indexFile(path: string, content: string, options?: { persist?: boolean }): Promise<void> {
    if (!this.db) return;

    const hash = await sha256(content);

    // Check if file already indexed with same hash
    const existing = this.db.exec("SELECT hash FROM files WHERE path = ?", [path]);
    if (existing.length > 0 && existing[0].values.length > 0 && existing[0].values[0][0] === hash) {
      return; // No change
    }

    // Remove old chunks for this file
    this.removeFileSync(path);

    const now = Date.now();

    // Insert file record
    this.db.run("INSERT OR REPLACE INTO files (path, hash, mtime, size) VALUES (?, ?, ?, ?)", [
      path,
      hash,
      now,
      content.length,
    ]);

    // Chunk and insert
    const chunks = chunkMarkdown(content, path);
    const insertChunk = this.db.prepare(
      "INSERT OR REPLACE INTO chunks (id, path, start_line, end_line, hash, text, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertFts = this.ftsAvailable
      ? this.db.prepare("INSERT INTO chunks_fts (text, id, path, start_line, end_line) VALUES (?, ?, ?, ?, ?)")
      : null;

    for (const chunk of chunks) {
      insertChunk.run([chunk.id, chunk.path, chunk.startLine, chunk.endLine, chunk.hash, chunk.text, now]);
      insertFts?.run([chunk.text, chunk.id, chunk.path, chunk.startLine, chunk.endLine]);
    }

    insertChunk.free();
    insertFts?.free();

    if (options?.persist !== false) {
      await this.persist();
    }
  }

  /**
   * Remove a file and its chunks from the index.
   */
  async removeFile(path: string): Promise<void> {
    if (!this.db) return;
    this.removeFileSync(path);
    await this.persist();
  }

  private removeFileSync(path: string): void {
    if (!this.db) return;
    if (this.ftsAvailable) {
      // Get chunk IDs for FTS cleanup
      const rows = this.db.exec("SELECT id FROM chunks WHERE path = ?", [path]);
      if (rows.length > 0) {
        for (const row of rows[0].values) {
          const id = row[0] as string;
          this.db.run("DELETE FROM chunks_fts WHERE id = ?", [id]);
        }
      }
    }
    this.db.run("DELETE FROM chunks WHERE path = ?", [path]);
    this.db.run("DELETE FROM files WHERE path = ?", [path]);
  }

  /**
   * FTS5 BM25 keyword search.
   */
  searchKeyword(query: string, limit = 10, sourcePath?: string): SearchResult[] {
    if (!this.db) return [];
    if (this.ftsAvailable) return this.searchKeywordWithFts(query, limit, sourcePath);
    return this.searchKeywordWithLike(query, limit, sourcePath);
  }

  private searchKeywordWithFts(query: string, limit: number, sourcePath?: string): SearchResult[] {
    if (!this.db) return [];

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery || ftsQuery === '""') return [];

    const candidateLimit = limit * 3;
    let sql: string;
    let params: any[];

    if (sourcePath) {
      sql = `SELECT f.id, f.path, f.start_line, f.end_line, f.text, bm25(chunks_fts) as rank, c.updated_at
             FROM chunks_fts f JOIN chunks c ON f.id = c.id
             WHERE chunks_fts MATCH ? AND f.path = ?
             ORDER BY rank LIMIT ?`;
      params = [ftsQuery, sourcePath, candidateLimit];
    } else {
      sql = `SELECT f.id, f.path, f.start_line, f.end_line, f.text, bm25(chunks_fts) as rank, c.updated_at
             FROM chunks_fts f JOIN chunks c ON f.id = c.id
             WHERE chunks_fts MATCH ?
             ORDER BY rank LIMIT ?`;
      params = [ftsQuery, candidateLimit];
    }

    try {
      const rows = this.db.exec(sql, params);
      if (rows.length === 0) return [];

      const results = rows[0].values.map((row: any[]) => ({
        id: row[0] as string,
        path: row[1] as string,
        startLine: row[2] as number,
        endLine: row[3] as number,
        text: row[4] as string,
        score: bm25RankToScore(row[5] as number),
        _updatedAt: row[6] as number,
      }));

      return applyRecency(results, (r) => (r as any)._updatedAt ?? 0).slice(0, limit);
    } catch {
      return [];
    }
  }

  private searchKeywordWithLike(query: string, limit: number, sourcePath?: string): SearchResult[] {
    if (!this.db) return [];
    if (limit <= 0) return [];

    const tokens = [...new Set(tokenizeForFts(query).filter(Boolean))].slice(0, 12);
    if (tokens.length === 0) return [];

    const likeClauses = tokens.map(() => "LOWER(text) LIKE ? ESCAPE '\\\\'");
    const params: any[] = tokens.map((token) => `%${escapeLike(token)}%`);
    let sql = `SELECT id, path, start_line, end_line, text, updated_at
               FROM chunks
               WHERE (${likeClauses.join(" OR ")})`;

    if (sourcePath) {
      sql += " AND path = ?";
      params.push(sourcePath);
    }

    const candidateLimit = Math.max(limit * 8, 40);
    sql += " LIMIT ?";
    params.push(candidateLimit);

    try {
      const rows = this.db.exec(sql, params);
      if (rows.length === 0) return [];

      const loweredQuery = query.toLowerCase();
      const ranked = rows[0].values.map((row: any[]) => {
        const text = row[4] as string;
        const updatedAt = row[5] as number;
        const lowered = text.toLowerCase();
        let hits = 0;
        for (const token of tokens) {
          if (lowered.includes(token)) hits++;
        }
        const hasExactQuery = loweredQuery.length > 0 && lowered.includes(loweredQuery) ? 1 : 0;
        const score = (hits + hasExactQuery) / (tokens.length + 1);
        return {
          id: row[0] as string,
          path: row[1] as string,
          startLine: row[2] as number,
          endLine: row[3] as number,
          text,
          score,
          _updatedAt: updatedAt,
        };
      });

      return applyRecency(ranked, (r) => (r as any)._updatedAt ?? 0).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Vector similarity search (requires embeddings to be populated).
   */
  searchVector(queryEmbedding: number[], limit = 10): SearchResult[] {
    if (!this.db) return [];

    const rows = this.db.exec("SELECT id, path, start_line, end_line, text, embedding FROM chunks WHERE embedding IS NOT NULL");
    if (rows.length === 0) return [];

    const scored: SearchResult[] = [];
    for (const row of rows[0].values) {
      const embeddingJson = row[5] as string;
      if (!embeddingJson) continue;

      try {
        const embedding = JSON.parse(embeddingJson) as number[];
        const score = cosineSimilarity(queryEmbedding, embedding);
        scored.push({
          id: row[0] as string,
          path: row[1] as string,
          startLine: row[2] as number,
          endLine: row[3] as number,
          text: row[4] as string,
          score,
        });
      } catch {
        // Skip invalid embeddings
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Hybrid search: FTS5 + optional vector, merged with RRF.
   */
  searchHybrid(query: string, queryEmbedding?: number[], limit = 10): SearchResult[] {
    const keywordResults = this.searchKeyword(query, limit * 2);

    if (!queryEmbedding) {
      return keywordResults.slice(0, limit);
    }

    const vectorResults = this.searchVector(queryEmbedding, limit * 2);
    return mergeHybridResults(keywordResults, vectorResults, limit);
  }

  /**
   * Update embedding for a chunk.
   */
  setChunkEmbedding(chunkId: string, embedding: number[]): void {
    if (!this.db) return;
    this.db.run("UPDATE chunks SET embedding = ? WHERE id = ?", [JSON.stringify(embedding), chunkId]);
  }

  /**
   * Cache an embedding result.
   */
  async cacheEmbedding(text: string, embedding: number[], model: string): Promise<void> {
    if (!this.db) return;
    const hash = await sha256(text);
    this.db.run(
      "INSERT OR REPLACE INTO embedding_cache (text_hash, embedding, model, created_at) VALUES (?, ?, ?, ?)",
      [hash, JSON.stringify(embedding), model, Date.now()],
    );
  }

  /**
   * Get cached embedding.
   */
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    if (!this.db) return null;
    const hash = await sha256(text);
    const rows = this.db.exec("SELECT embedding FROM embedding_cache WHERE text_hash = ?", [hash]);
    if (rows.length === 0 || rows[0].values.length === 0) return null;
    try {
      return JSON.parse(rows[0].values[0][0] as string);
    } catch {
      return null;
    }
  }

  /**
   * Check if a file is indexed.
   */
  hasFile(path: string): boolean {
    if (!this.db) return false;
    const rows = this.db.exec("SELECT 1 FROM files WHERE path = ?", [path]);
    return rows.length > 0 && rows[0].values.length > 0;
  }

  /**
   * Get all indexed file paths.
   */
  listFiles(): string[] {
    if (!this.db) return [];
    const rows = this.db.exec("SELECT path FROM files ORDER BY path");
    if (rows.length === 0) return [];
    return rows[0].values.map((r: any[]) => r[0] as string);
  }

  /**
   * Persist SQLite database to IndexedDB.
   */
  async persist(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    await idbSet(IDB_STORE, IDB_KEY, data);
  }

  /**
   * Check if a persisted database exists in IndexedDB.
   */
  async hasPersisted(): Promise<boolean> {
    const data = await idbGet(IDB_STORE, IDB_KEY);
    return data !== null;
  }

  /**
   * Close the database.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      this.ftsAvailable = false;
      this._ready = false;
    }
  }
}
