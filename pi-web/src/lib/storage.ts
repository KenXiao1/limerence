import type { StoreConfig, StorageBackend } from "@mariozechner/pi-web-ui";
import type { MemoryEntry } from "./memory";

const MEMORY_STORE = "limerence-memory";
const NOTES_STORE = "limerence-notes";
const FILES_STORE = "limerence-files";

const MEMORY_KEY = "entries";

export function getLimerenceStoreConfigs(): StoreConfig[] {
  return [
    { name: MEMORY_STORE },
    { name: NOTES_STORE },
    { name: FILES_STORE },
  ];
}

export class LimerenceStorage {
  constructor(private readonly backend: StorageBackend) {}

  async loadMemoryEntries(): Promise<MemoryEntry[]> {
    return (await this.backend.get<MemoryEntry[]>(MEMORY_STORE, MEMORY_KEY)) ?? [];
  }

  async addMemoryEntry(entry: MemoryEntry): Promise<void> {
    const entries = await this.loadMemoryEntries();
    entries.push(entry);
    await this.backend.set(MEMORY_STORE, MEMORY_KEY, entries);
  }

  async writeNote(title: string, content: string, append: boolean): Promise<string> {
    const key = this.noteKey(title);
    if (append) {
      const existing = (await this.backend.get<string>(NOTES_STORE, key)) ?? "";
      await this.backend.set(NOTES_STORE, key, `${existing}${existing ? "\n" : ""}${content}`);
      return `已追加内容到笔记「${title}」`;
    }
    await this.backend.set(NOTES_STORE, key, content);
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
    return `已写入文件：${path}`;
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

  private noteKey(title: string): string {
    return `note:${sanitizeTitle(title)}`;
  }
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
