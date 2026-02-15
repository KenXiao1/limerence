/**
 * SyncEngine — orchestrates bidirectional sync between IndexedDB and Supabase.
 *
 * Lifecycle:
 *   start(userId) → initial sync + subscribe realtime
 *   stop()        → unsubscribe realtime
 *   onLocalChange(table, key, value) → push to Supabase
 */

import type { StorageBackend } from "@mariozechner/pi-web-ui";
import { getSupabase } from "./supabase";
import { subscribeRealtime, unsubscribeRealtime, type RealtimeHandler } from "./sync-realtime";
import {
  pushSession,
  pullSessions,
  pushAllLocalSessions,
  pushMemoryEntry,
  syncMemory,
  pushNote,
  syncNotes,
  pushFile,
  syncFiles,
  pushCharacters,
  syncCharacters,
  pushCharacterDelete,
  pushLorebook,
  syncLorebook,
} from "./sync-tables";
import type { MemoryEntry } from "./memory";
import type { CharacterEntry } from "../controllers/character";
import type { LorebookEntry } from "./storage";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

const SESSIONS_STORE = "pi-web-ui:sessions";
const METADATA_STORE = "pi-web-ui:sessions-metadata";
const MEMORY_STORE = "limerence-memory";
const MEMORY_KEY = "entries";
const NOTES_STORE = "limerence-notes";
const FILES_STORE = "limerence-files";
const CHARACTERS_STORE = "limerence-characters";
const CHARACTERS_KEY = "list";
const LOREBOOK_STORE = "limerence-lorebook";
const LOREBOOK_KEY = "entries";

export class SyncEngine {
  private userId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private _status: SyncStatus = "idle";
  private onStatusChange: ((status: SyncStatus) => void) | null = null;
  private onRemoteChange: (() => void) | null = null;

  constructor(private readonly backend: StorageBackend) {}

  get status(): SyncStatus {
    return this._status;
  }

  setStatusCallback(cb: (status: SyncStatus) => void) {
    this.onStatusChange = cb;
  }

  setRemoteChangeCallback(cb: () => void) {
    this.onRemoteChange = cb;
  }

  private setStatus(s: SyncStatus) {
    this._status = s;
    this.onStatusChange?.(s);
  }

  async start(userId: string): Promise<void> {
    this.userId = userId;
    const sb = getSupabase();
    if (!sb) return;

    this.setStatus("syncing");

    try {
      // Initial bidirectional sync
      await pullSessions(sb, userId, this.backend, SESSIONS_STORE, METADATA_STORE);
      await pushAllLocalSessions(sb, userId, this.backend, SESSIONS_STORE, METADATA_STORE);
      await syncMemory(sb, userId, this.backend, MEMORY_STORE, MEMORY_KEY);
      await syncNotes(sb, userId, this.backend, NOTES_STORE);
      await syncFiles(sb, userId, this.backend, FILES_STORE);
      await syncCharacters(sb, userId, this.backend, CHARACTERS_STORE, CHARACTERS_KEY);
      await syncLorebook(sb, userId, this.backend, LOREBOOK_STORE, LOREBOOK_KEY);

      // Subscribe to realtime changes
      const handler: RealtimeHandler = (table, eventType, record) => {
        void this.handleRemoteChange(table, eventType, record);
      };
      this.unsubscribe = subscribeRealtime(sb, userId, handler);

      this.setStatus("synced");
    } catch (err) {
      console.error("[SyncEngine] initial sync failed:", err);
      this.setStatus("error");
    }
  }

  stop(): void {
    const sb = getSupabase();
    if (sb) {
      unsubscribeRealtime(sb);
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.userId = null;
    this.setStatus("idle");
  }

  // ── Push methods (called after local writes) ──────────────────

  async pushSessionData(
    sessionId: string,
    sessionData: unknown,
    metadata: { title: string; createdAt: string; model: string; messageCount: number },
  ): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushSession(sb, this.userId, sessionId, sessionData, metadata, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushSession failed:", err);
    }
  }

  async pushMemory(entry: MemoryEntry): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushMemoryEntry(sb, this.userId, entry, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushMemory failed:", err);
    }
  }

  async pushNoteData(key: string, content: string): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushNote(sb, this.userId, key, content, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushNote failed:", err);
    }
  }

  async pushFileData(path: string, content: string): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushFile(sb, this.userId, path, content, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushFile failed:", err);
    }
  }

  async pushCharacterData(characters: CharacterEntry[]): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushCharacters(sb, this.userId, characters, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushCharacters failed:", err);
    }
  }

  async pushCharacterRemove(charId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushCharacterDelete(sb, this.userId, charId, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushCharacterDelete failed:", err);
    }
  }

  async pushLorebookData(entries: LorebookEntry[]): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.userId) return;
    try {
      await pushLorebook(sb, this.userId, entries, this.backend);
    } catch (err) {
      console.error("[SyncEngine] pushLorebook failed:", err);
    }
  }

  // ── Handle remote changes from Realtime ───────────────────────

  private async handleRemoteChange(
    table: string,
    _eventType: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    try {
      const deleted = record.deleted === true;

      switch (table) {
        case "sync_sessions": {
          const id = record.id as string;
          if (deleted) {
            await this.backend.delete(SESSIONS_STORE, id);
          } else {
            await this.backend.set(SESSIONS_STORE, id, record.data);
          }
          break;
        }
        case "sync_sessions_metadata": {
          const id = record.id as string;
          if (deleted) {
            await this.backend.delete(METADATA_STORE, id);
          } else {
            await this.backend.set(METADATA_STORE, id, {
              id,
              title: record.title,
              createdAt: record.created_at,
              model: record.model,
              messageCount: record.message_count,
            });
          }
          break;
        }
        case "sync_memory": {
          if (!deleted) {
            const entries: MemoryEntry[] =
              (await this.backend.get<MemoryEntry[]>(MEMORY_STORE, MEMORY_KEY)) ?? [];
            entries.push({
              session_id: record.session_id as string,
              role: record.role as MemoryEntry["role"],
              content: record.content as string,
              timestamp: record.timestamp as string,
            });
            await this.backend.set(MEMORY_STORE, MEMORY_KEY, entries);
          }
          break;
        }
        case "sync_notes": {
          const key = record.key as string;
          if (deleted) {
            await this.backend.delete(NOTES_STORE, key);
          } else {
            await this.backend.set(NOTES_STORE, key, record.content);
          }
          break;
        }
        case "sync_files": {
          const path = record.path as string;
          if (deleted) {
            await this.backend.delete(FILES_STORE, path);
          } else {
            await this.backend.set(FILES_STORE, path, record.content);
          }
          break;
        }
        case "sync_characters": {
          const chars: CharacterEntry[] =
            (await this.backend.get<CharacterEntry[]>(CHARACTERS_STORE, CHARACTERS_KEY)) ?? [];
          const id = record.id as string;
          if (deleted) {
            await this.backend.set(
              CHARACTERS_STORE,
              CHARACTERS_KEY,
              chars.filter((c) => c.id !== id),
            );
          } else {
            const idx = chars.findIndex((c) => c.id === id);
            const entry = record.data as CharacterEntry;
            if (idx >= 0) {
              chars[idx] = entry;
            } else {
              chars.push(entry);
            }
            await this.backend.set(CHARACTERS_STORE, CHARACTERS_KEY, chars);
          }
          break;
        }
        case "sync_lorebook": {
          const entries: LorebookEntry[] =
            (await this.backend.get<LorebookEntry[]>(LOREBOOK_STORE, LOREBOOK_KEY)) ?? [];
          const id = record.id as string;
          if (deleted) {
            await this.backend.set(
              LOREBOOK_STORE,
              LOREBOOK_KEY,
              entries.filter((e) => e.id !== id),
            );
          } else {
            const idx = entries.findIndex((e) => e.id === id);
            const entry = record.data as LorebookEntry;
            if (idx >= 0) {
              entries[idx] = entry;
            } else {
              entries.push(entry);
            }
            await this.backend.set(LOREBOOK_STORE, LOREBOOK_KEY, entries);
          }
          break;
        }
      }

      this.onRemoteChange?.();
    } catch (err) {
      console.error("[SyncEngine] handleRemoteChange failed:", err);
    }
  }
}
