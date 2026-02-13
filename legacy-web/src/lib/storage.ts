import { get, set, del, keys } from "idb-keyval";
import type { SessionData, SessionHeader, MemoryEntry } from "./types";

// --- Sessions ---

const SESSION_PREFIX = "session:";

export async function saveSession(data: SessionData): Promise<void> {
  await set(SESSION_PREFIX + data.header.id, data);
}

export async function loadSession(id: string): Promise<SessionData | undefined> {
  return get<SessionData>(SESSION_PREFIX + id);
}

export async function deleteSession(id: string): Promise<void> {
  await del(SESSION_PREFIX + id);
}

export async function listSessions(): Promise<SessionHeader[]> {
  const allKeys = await keys();
  const sessionKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(SESSION_PREFIX),
  );
  const headers: SessionHeader[] = [];
  for (const key of sessionKeys) {
    const data = await get<SessionData>(key as string);
    if (data) headers.push(data.header);
  }
  headers.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return headers;
}

// --- Memory ---

const MEMORY_KEY = "memory:entries";

export async function loadMemoryEntries(): Promise<MemoryEntry[]> {
  return (await get<MemoryEntry[]>(MEMORY_KEY)) ?? [];
}

export async function saveMemoryEntries(entries: MemoryEntry[]): Promise<void> {
  await set(MEMORY_KEY, entries);
}

export async function addMemoryEntry(entry: MemoryEntry): Promise<void> {
  const entries = await loadMemoryEntries();
  entries.push(entry);
  await saveMemoryEntries(entries);
}

// --- Notes ---

const NOTE_PREFIX = "note:";

export async function writeNote(
  title: string,
  content: string,
  append: boolean,
): Promise<string> {
  const key = NOTE_PREFIX + sanitizeTitle(title);
  if (append) {
    const existing = (await get<string>(key)) ?? "";
    await set(key, existing + "\n" + content);
    return `已追加内容到笔记「${title}」`;
  }
  await set(key, content);
  return `已写入笔记「${title}」`;
}

export async function readNote(title: string): Promise<string> {
  if (!title) {
    return listNotes();
  }
  const key = NOTE_PREFIX + sanitizeTitle(title);
  const content = await get<string>(key);
  if (content === undefined) return `笔记「${title}」不存在`;
  return content;
}

async function listNotes(): Promise<string> {
  const allKeys = await keys();
  const noteKeys = allKeys
    .filter((k) => typeof k === "string" && k.startsWith(NOTE_PREFIX))
    .map((k) => (k as string).slice(NOTE_PREFIX.length));
  if (noteKeys.length === 0) return "暂无笔记。";
  noteKeys.sort();
  return "笔记列表：\n" + noteKeys.join("\n");
}

// --- Files (virtual filesystem) ---

const FILE_PREFIX = "file:";

export async function fileRead(path: string): Promise<string> {
  if (!path || path === ".") {
    return listFiles();
  }
  const key = FILE_PREFIX + normalizePath(path);
  const content = await get<string>(key);
  if (content === undefined) return `文件不存在：${path}`;
  return content;
}

export async function fileWrite(path: string, content: string): Promise<string> {
  if (!path) return "请提供文件路径。";
  const key = FILE_PREFIX + normalizePath(path);
  await set(key, content);
  return `已写入文件：${path}`;
}

async function listFiles(): Promise<string> {
  const allKeys = await keys();
  const fileKeys = allKeys
    .filter((k) => typeof k === "string" && k.startsWith(FILE_PREFIX))
    .map((k) => (k as string).slice(FILE_PREFIX.length));
  if (fileKeys.length === 0) return "目录为空。";
  fileKeys.sort();
  return fileKeys.join("\n");
}

function sanitizeTitle(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, "_");
}

function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p && p !== ".") resolved.push(p);
  }
  return resolved.join("/");
}
