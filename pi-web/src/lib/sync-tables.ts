/**
 * Per-table sync logic: IndexedDB ↔ Supabase bidirectional merge.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageBackend } from "@mariozechner/pi-web-ui";
import type { MemoryEntry } from "./memory";
import type { CharacterEntry } from "../controllers/character";
import type { LorebookEntry } from "./storage";

const SYNC_META_STORE = "limerence-sync-meta";

// ── Helpers ─────────────────────────────────────────────────────

async function getLocalUpdatedAt(backend: StorageBackend, table: string, key: string): Promise<string | null> {
  return backend.get<string>(SYNC_META_STORE, `${table}:${key}`);
}

async function setLocalUpdatedAt(backend: StorageBackend, table: string, key: string, ts: string): Promise<void> {
  await backend.set(SYNC_META_STORE, `${table}:${key}`, ts);
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Sessions ────────────────────────────────────────────────────

export async function pushSession(
  sb: SupabaseClient,
  userId: string,
  sessionId: string,
  sessionData: unknown,
  metadata: { title: string; createdAt: string; model: string; messageCount: number },
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  await sb.from("sync_sessions").upsert({
    user_id: userId,
    id: sessionId,
    data: sessionData,
    updated_at: now,
    deleted: false,
  });
  await sb.from("sync_sessions_metadata").upsert({
    user_id: userId,
    id: sessionId,
    title: metadata.title,
    created_at: metadata.createdAt,
    model: metadata.model,
    message_count: metadata.messageCount,
    updated_at: now,
    deleted: false,
  });
  await setLocalUpdatedAt(backend, "sync_sessions", sessionId, now);
}

export async function pullSessions(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  sessionsStore: string,
  metadataStore: string,
): Promise<void> {
  const { data: remoteSessions } = await sb
    .from("sync_sessions")
    .select("id, data, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteSessions) return;

  for (const remote of remoteSessions) {
    const localTs = await getLocalUpdatedAt(backend, "sync_sessions", remote.id);

    if (remote.deleted) {
      // Remote deleted — remove local
      await backend.delete(sessionsStore, remote.id);
      await backend.delete(metadataStore, remote.id);
      await setLocalUpdatedAt(backend, "sync_sessions", remote.id, remote.updated_at);
      continue;
    }

    if (!localTs || remote.updated_at > localTs) {
      // Remote is newer — pull
      await backend.set(sessionsStore, remote.id, remote.data);
      await setLocalUpdatedAt(backend, "sync_sessions", remote.id, remote.updated_at);
    }
  }

  // Pull metadata separately
  const { data: remoteMeta } = await sb
    .from("sync_sessions_metadata")
    .select("id, title, created_at, model, message_count, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteMeta) return;

  for (const meta of remoteMeta) {
    if (meta.deleted) continue;
    const existing = await backend.get(metadataStore, meta.id);
    if (!existing) {
      await backend.set(metadataStore, meta.id, {
        id: meta.id,
        title: meta.title,
        createdAt: meta.created_at,
        model: meta.model,
        messageCount: meta.message_count,
      });
    }
  }
}

export async function pushAllLocalSessions(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  sessionsStore: string,
  metadataStore: string,
): Promise<void> {
  const sessionKeys = await backend.keys(sessionsStore);
  const now = nowISO();

  for (const key of sessionKeys) {
    const localTs = await getLocalUpdatedAt(backend, "sync_sessions", key);
    if (localTs) continue; // already synced

    const data = await backend.get(sessionsStore, key);
    if (!data) continue;

    const meta = await backend.get<{ title?: string; createdAt?: string; model?: string; messageCount?: number }>(metadataStore, key);

    await sb.from("sync_sessions").upsert({
      user_id: userId,
      id: key,
      data,
      updated_at: now,
      deleted: false,
    });

    if (meta) {
      await sb.from("sync_sessions_metadata").upsert({
        user_id: userId,
        id: key,
        title: meta.title ?? "",
        created_at: meta.createdAt ?? now,
        model: meta.model ?? "",
        message_count: meta.messageCount ?? 0,
        updated_at: now,
        deleted: false,
      });
    }

    await setLocalUpdatedAt(backend, "sync_sessions", key, now);
  }
}

// ── Memory ──────────────────────────────────────────────────────

export async function pushMemoryEntry(
  sb: SupabaseClient,
  userId: string,
  entry: MemoryEntry,
  backend: StorageBackend,
): Promise<void> {
  const id = crypto.randomUUID();
  const now = nowISO();
  await sb.from("sync_memory").upsert({
    user_id: userId,
    id,
    session_id: entry.session_id,
    role: entry.role,
    content: entry.content,
    timestamp: entry.timestamp,
    updated_at: now,
    deleted: false,
  });
  await setLocalUpdatedAt(backend, "sync_memory", id, now);
}

export async function syncMemory(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  memoryStore: string,
  memoryKey: string,
): Promise<void> {
  const localEntries: MemoryEntry[] = (await backend.get<MemoryEntry[]>(memoryStore, memoryKey)) ?? [];
  const { data: remoteEntries } = await sb
    .from("sync_memory")
    .select("id, session_id, role, content, timestamp, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteEntries) return;

  // Build set of local content hashes for dedup
  const localSet = new Set(localEntries.map((e) => `${e.session_id}:${e.timestamp}:${e.content.slice(0, 50)}`));

  let changed = false;
  for (const remote of remoteEntries) {
    if (remote.deleted) continue;
    const hash = `${remote.session_id}:${remote.timestamp}:${remote.content.slice(0, 50)}`;
    if (!localSet.has(hash)) {
      localEntries.push({
        session_id: remote.session_id,
        role: remote.role as MemoryEntry["role"],
        content: remote.content,
        timestamp: remote.timestamp,
      });
      changed = true;
    }
  }

  if (changed) {
    await backend.set(memoryStore, memoryKey, localEntries);
  }

  // Push local entries that aren't in remote
  const remoteSet = new Set(remoteEntries.map((e) => `${e.session_id}:${e.timestamp}:${e.content.slice(0, 50)}`));
  for (const local of localEntries) {
    const hash = `${local.session_id}:${local.timestamp}:${local.content.slice(0, 50)}`;
    if (!remoteSet.has(hash)) {
      await pushMemoryEntry(sb, userId, local, backend);
    }
  }
}

// ── Notes ───────────────────────────────────────────────────────

export async function pushNote(
  sb: SupabaseClient,
  userId: string,
  key: string,
  content: string,
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  await sb.from("sync_notes").upsert({
    user_id: userId,
    key,
    content,
    updated_at: now,
    deleted: false,
  });
  await setLocalUpdatedAt(backend, "sync_notes", key, now);
}

export async function syncNotes(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  notesStore: string,
): Promise<void> {
  const { data: remoteNotes } = await sb
    .from("sync_notes")
    .select("key, content, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteNotes) return;

  for (const remote of remoteNotes) {
    const localTs = await getLocalUpdatedAt(backend, "sync_notes", remote.key);

    if (remote.deleted) {
      await backend.delete(notesStore, remote.key);
      await setLocalUpdatedAt(backend, "sync_notes", remote.key, remote.updated_at);
      continue;
    }

    if (!localTs || remote.updated_at > localTs) {
      await backend.set(notesStore, remote.key, remote.content);
      await setLocalUpdatedAt(backend, "sync_notes", remote.key, remote.updated_at);
    }
  }

  // Push local notes not yet synced
  const localKeys = await backend.keys(notesStore);
  for (const key of localKeys) {
    const localTs = await getLocalUpdatedAt(backend, "sync_notes", key);
    if (localTs) continue;
    const content = await backend.get<string>(notesStore, key);
    if (content !== null) {
      await pushNote(sb, userId, key, content, backend);
    }
  }
}

// ── Files ───────────────────────────────────────────────────────

export async function pushFile(
  sb: SupabaseClient,
  userId: string,
  path: string,
  content: string,
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  await sb.from("sync_files").upsert({
    user_id: userId,
    path,
    content,
    updated_at: now,
    deleted: false,
  });
  await setLocalUpdatedAt(backend, "sync_files", path, now);
}

export async function syncFiles(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  filesStore: string,
): Promise<void> {
  const { data: remoteFiles } = await sb
    .from("sync_files")
    .select("path, content, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteFiles) return;

  for (const remote of remoteFiles) {
    const localTs = await getLocalUpdatedAt(backend, "sync_files", remote.path);

    if (remote.deleted) {
      await backend.delete(filesStore, remote.path);
      await setLocalUpdatedAt(backend, "sync_files", remote.path, remote.updated_at);
      continue;
    }

    if (!localTs || remote.updated_at > localTs) {
      await backend.set(filesStore, remote.path, remote.content);
      await setLocalUpdatedAt(backend, "sync_files", remote.path, remote.updated_at);
    }
  }

  const localKeys = await backend.keys(filesStore);
  for (const key of localKeys) {
    const localTs = await getLocalUpdatedAt(backend, "sync_files", key);
    if (localTs) continue;
    const content = await backend.get<string>(filesStore, key);
    if (content !== null) {
      await pushFile(sb, userId, key, content, backend);
    }
  }
}

// ── Characters ──────────────────────────────────────────────────

export async function pushCharacters(
  sb: SupabaseClient,
  userId: string,
  characters: CharacterEntry[],
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  for (const char of characters) {
    await sb.from("sync_characters").upsert({
      user_id: userId,
      id: char.id,
      data: char,
      updated_at: now,
      deleted: false,
    });
    await setLocalUpdatedAt(backend, "sync_characters", char.id, now);
  }
}

export async function syncCharacters(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  charactersStore: string,
  charactersKey: string,
): Promise<void> {
  const localChars: CharacterEntry[] = (await backend.get<CharacterEntry[]>(charactersStore, charactersKey)) ?? [];
  const { data: remoteChars } = await sb
    .from("sync_characters")
    .select("id, data, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteChars) return;

  const localMap = new Map(localChars.map((c) => [c.id, c]));
  let changed = false;

  for (const remote of remoteChars) {
    const localTs = await getLocalUpdatedAt(backend, "sync_characters", remote.id);

    if (remote.deleted) {
      if (localMap.has(remote.id)) {
        localMap.delete(remote.id);
        changed = true;
      }
      await setLocalUpdatedAt(backend, "sync_characters", remote.id, remote.updated_at);
      continue;
    }

    if (!localTs || remote.updated_at > localTs) {
      localMap.set(remote.id, remote.data as CharacterEntry);
      await setLocalUpdatedAt(backend, "sync_characters", remote.id, remote.updated_at);
      changed = true;
    }
  }

  if (changed) {
    await backend.set(charactersStore, charactersKey, [...localMap.values()]);
  }

  // Push local chars not yet synced
  for (const char of localChars) {
    const localTs = await getLocalUpdatedAt(backend, "sync_characters", char.id);
    if (localTs) continue;
    const now = nowISO();
    await sb.from("sync_characters").upsert({
      user_id: userId,
      id: char.id,
      data: char,
      updated_at: now,
      deleted: false,
    });
    await setLocalUpdatedAt(backend, "sync_characters", char.id, now);
  }
}

export async function pushCharacterDelete(
  sb: SupabaseClient,
  userId: string,
  charId: string,
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  await sb.from("sync_characters").upsert({
    user_id: userId,
    id: charId,
    data: {},
    updated_at: now,
    deleted: true,
  });
  await setLocalUpdatedAt(backend, "sync_characters", charId, now);
}

// ── Lorebook ────────────────────────────────────────────────────

export async function pushLorebook(
  sb: SupabaseClient,
  userId: string,
  entries: LorebookEntry[],
  backend: StorageBackend,
): Promise<void> {
  const now = nowISO();
  for (const entry of entries) {
    await sb.from("sync_lorebook").upsert({
      user_id: userId,
      id: entry.id,
      data: entry,
      updated_at: now,
      deleted: false,
    });
    await setLocalUpdatedAt(backend, "sync_lorebook", entry.id, now);
  }
}

export async function syncLorebook(
  sb: SupabaseClient,
  userId: string,
  backend: StorageBackend,
  lorebookStore: string,
  lorebookKey: string,
): Promise<void> {
  const localEntries: LorebookEntry[] = (await backend.get<LorebookEntry[]>(lorebookStore, lorebookKey)) ?? [];
  const { data: remoteEntries } = await sb
    .from("sync_lorebook")
    .select("id, data, updated_at, deleted")
    .eq("user_id", userId);

  if (!remoteEntries) return;

  const localMap = new Map(localEntries.map((e) => [e.id, e]));
  let changed = false;

  for (const remote of remoteEntries) {
    const localTs = await getLocalUpdatedAt(backend, "sync_lorebook", remote.id);

    if (remote.deleted) {
      if (localMap.has(remote.id)) {
        localMap.delete(remote.id);
        changed = true;
      }
      await setLocalUpdatedAt(backend, "sync_lorebook", remote.id, remote.updated_at);
      continue;
    }

    if (!localTs || remote.updated_at > localTs) {
      localMap.set(remote.id, remote.data as LorebookEntry);
      await setLocalUpdatedAt(backend, "sync_lorebook", remote.id, remote.updated_at);
      changed = true;
    }
  }

  if (changed) {
    await backend.set(lorebookStore, lorebookKey, [...localMap.values()]);
  }

  for (const entry of localEntries) {
    const localTs = await getLocalUpdatedAt(backend, "sync_lorebook", entry.id);
    if (localTs) continue;
    const now = nowISO();
    await sb.from("sync_lorebook").upsert({
      user_id: userId,
      id: entry.id,
      data: entry,
      updated_at: now,
      deleted: false,
    });
    await setLocalUpdatedAt(backend, "sync_lorebook", entry.id, now);
  }
}
