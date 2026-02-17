import type { StoreConfig, StorageBackend } from "./indexed-db";
import type { MemoryEntry } from "./memory";
import type { CharacterEntry } from "../controllers/character";

const MEMORY_STORE = "limerence-memory";
const NOTES_STORE = "limerence-notes";
const FILES_STORE = "limerence-files";
const CHARACTERS_STORE = "limerence-characters";
const LOREBOOK_STORE = "limerence-lorebook";

const MEMORY_KEY = "entries";
const CHARACTERS_KEY = "list";
const LOREBOOK_KEY = "entries";

export type SyncHook = {
  onMemoryAdd?: (entry: MemoryEntry) => void;
  onNoteWrite?: (key: string, content: string) => void;
  onFileWrite?: (path: string, content: string) => void;
  onCharactersSave?: (characters: CharacterEntry[]) => void;
  onCharacterRemove?: (id: string) => void;
  onLorebookSave?: (entries: LorebookEntry[]) => void;
};

export function getLimerenceStoreConfigs(): StoreConfig[] {
  return [
    { name: MEMORY_STORE },
    { name: NOTES_STORE },
    { name: FILES_STORE },
    { name: CHARACTERS_STORE },
    { name: LOREBOOK_STORE },
  ];
}

export class LimerenceStorage {
  private syncHook: SyncHook = {};

  constructor(private readonly backend: StorageBackend) {}

  setSyncHook(hook: SyncHook) {
    this.syncHook = hook;
  }

  async loadMemoryEntries(): Promise<MemoryEntry[]> {
    return (await this.backend.get<MemoryEntry[]>(MEMORY_STORE, MEMORY_KEY)) ?? [];
  }

  async addMemoryEntry(entry: MemoryEntry): Promise<void> {
    const entries = await this.loadMemoryEntries();
    entries.push(entry);
    await this.backend.set(MEMORY_STORE, MEMORY_KEY, entries);
    this.syncHook.onMemoryAdd?.(entry);
  }

  async writeNote(title: string, content: string, append: boolean): Promise<string> {
    const key = this.noteKey(title);
    if (append) {
      const existing = (await this.backend.get<string>(NOTES_STORE, key)) ?? "";
      const merged = `${existing}${existing ? "\n" : ""}${content}`;
      await this.backend.set(NOTES_STORE, key, merged);
      this.syncHook.onNoteWrite?.(key, merged);
      return `已追加内容到笔记「${title}」`;
    }
    await this.backend.set(NOTES_STORE, key, content);
    this.syncHook.onNoteWrite?.(key, content);
    return `已写入笔记「${title}」`;
  }

  async readNote(title: string): Promise<string> {
    if (!title) {
      return this.listNotes();
    }
    const key = this.noteKey(title);
    const content = await this.backend.get<string>(NOTES_STORE, key);
    if (content === null) return `笔记「${title}」不存在`;
    return content;
  }

  async fileRead(path: string): Promise<string> {
    if (!path || path === ".") {
      return this.listFilesAt("");
    }

    const normalized = normalizePath(path);
    if (!normalized) {
      return this.listFilesAt("");
    }

    const content = await this.backend.get<string>(FILES_STORE, normalized);
    if (content !== null) {
      return content;
    }

    const dirListing = await this.listFilesAt(normalized);
    if (dirListing !== "目录为空。") {
      return dirListing;
    }

    return `文件不存在：${path}`;
  }

  async fileWrite(path: string, content: string): Promise<string> {
    if (!path) return "请提供文件路径。";

    const normalized = normalizePath(path);
    if (!normalized) return "请提供文件路径。";

    await this.backend.set(FILES_STORE, normalized, content);
    this.syncHook.onFileWrite?.(normalized, content);
    return `已写入文件：${path}`;
  }

  async listWorkspaceFiles(): Promise<string[]> {
    const keys = await this.backend.keys(FILES_STORE);
    return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
  }

  async readWorkspaceFile(path: string): Promise<string | null> {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    return this.backend.get<string>(FILES_STORE, normalized);
  }

  private async listNotes(): Promise<string> {
    const keys = await this.backend.keys(NOTES_STORE, "note:");
    const notes = keys
      .map((k) => k.slice("note:".length))
      .filter((k) => k.length > 0)
      .sort((a, b) => a.localeCompare(b));

    if (notes.length === 0) return "暂无笔记。";
    return `笔记列表：\n${notes.join("\n")}`;
  }

  private async listFilesAt(path: string): Promise<string> {
    const keys = await this.backend.keys(FILES_STORE);
    const prefix = path ? `${path.replace(/\/+$/, "")}/` : "";

    const names = new Set<string>();
    for (const key of keys) {
      if (prefix && !key.startsWith(prefix)) continue;
      const rest = prefix ? key.slice(prefix.length) : key;
      if (!rest) continue;

      const slash = rest.indexOf("/");
      if (slash === -1) {
        names.add(rest);
      } else {
        names.add(`${rest.slice(0, slash)}/`);
      }
    }

    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    if (sorted.length === 0) return "目录为空。";
    return sorted.join("\n");
  }

  // ── Character management ────────────────────────────────────

  async loadCharacters(): Promise<CharacterEntry[]> {
    return (await this.backend.get<CharacterEntry[]>(CHARACTERS_STORE, CHARACTERS_KEY)) ?? [];
  }

  async saveCharacters(characters: CharacterEntry[]): Promise<void> {
    await this.backend.set(CHARACTERS_STORE, CHARACTERS_KEY, characters);
    this.syncHook.onCharactersSave?.(characters);
  }

  async addCharacter(entry: CharacterEntry): Promise<void> {
    const list = await this.loadCharacters();
    list.push(entry);
    await this.backend.set(CHARACTERS_STORE, CHARACTERS_KEY, list);
  }

  async removeCharacter(id: string): Promise<void> {
    const list = await this.loadCharacters();
    await this.backend.set(
      CHARACTERS_STORE,
      CHARACTERS_KEY,
      list.filter((c) => c.id !== id),
    );
    this.syncHook.onCharacterRemove?.(id);
  }

  // ── Lorebook ───────────────────────────────────────────────

  async loadLorebookEntries(): Promise<LorebookEntry[]> {
    return (await this.backend.get<LorebookEntry[]>(LOREBOOK_STORE, LOREBOOK_KEY)) ?? [];
  }

  async saveLorebookEntries(entries: LorebookEntry[]): Promise<void> {
    await this.backend.set(LOREBOOK_STORE, LOREBOOK_KEY, entries);
    this.syncHook.onLorebookSave?.(entries);
  }

  // ── Session export/import ──────────────────────────────────

  async exportSession(sessionId: string): Promise<string | null> {
    const data = await this.backend.get<unknown>("pi-web-ui:sessions", sessionId);
    if (!data) return null;
    return JSON.stringify(data, null, 2);
  }

  // ── Memory files ──────────────────────────────────────────────

  static isMemoryPath(path: string): boolean {
    const n = normalizePath(path);
    return n === "memory" || n.startsWith("memory/");
  }

  async listMemoryFiles(): Promise<string[]> {
    const keys = await this.backend.keys(FILES_STORE);
    return keys.filter((k) => k.startsWith("memory/")).sort();
  }

  async readAllMemoryFiles(): Promise<Array<{ path: string; content: string }>> {
    const paths = await this.listMemoryFiles();
    const results: Array<{ path: string; content: string }> = [];
    for (const p of paths) {
      const content = await this.backend.get<string>(FILES_STORE, p);
      if (content !== null) {
        results.push({ path: p, content });
      }
    }
    return results;
  }

  private noteKey(title: string): string {
    return `note:${sanitizeTitle(title)}`;
  }
}

// ── Lorebook types ─────────────────────────────────────────────

export interface LorebookEntry {
  id: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  /** Optional: bind to a specific character ID, or null for global */
  characterId: string | null;
}

function sanitizeTitle(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, "_");
}

export function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") {
      resolved.pop();
    } else if (p && p !== ".") {
      resolved.push(p);
    }
  }
  return resolved.join("/");
}
