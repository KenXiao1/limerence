/**
 * Storage provider — React context for IndexedDB backend and LimerenceStorage.
 * Replaces the global singletons from app-state.ts with React-managed instances.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { IndexedDBStorageBackend } from "../lib/indexed-db";
import { getLimerenceStoreConfigs, LimerenceStorage } from "../lib/storage";
import { MemoryIndex } from "../lib/memory";
import { MemoryDB } from "../lib/memory-db";
import { SyncEngine } from "../lib/sync-engine";

// ── Constants (backward-compatible with app-state.ts) ───────────

export const DB_NAME = "limerence-pi-web";
export const DB_VERSION = 4;
export const SYNC_META_STORE = "limerence-sync-meta";

// ── Store names for pi-web-ui compatibility ─────────────────────

const PI_WEB_UI_STORES = [
  { name: "pi-web-ui:settings" },
  { name: "pi-web-ui:session-metadata" },
  { name: "pi-web-ui:provider-keys" },
  { name: "pi-web-ui:custom-providers" },
  { name: "pi-web-ui:sessions" },
];

// ── Context ─────────────────────────────────────────────────────

export interface StorageContextValue {
  backend: IndexedDBStorageBackend;
  storage: LimerenceStorage;
  memoryIndex: MemoryIndex;
  memoryDB: MemoryDB;
  syncEngine: SyncEngine;
  ready: boolean;
}

const StorageContext = createContext<StorageContextValue | null>(null);

// ── Singleton instances (created once, shared via context) ──────

let _backend: IndexedDBStorageBackend | null = null;
let _storage: LimerenceStorage | null = null;
let _memoryIndex: MemoryIndex | null = null;
let _memoryDB: MemoryDB | null = null;
let _syncEngine: SyncEngine | null = null;

function getOrCreateInstances() {
  if (!_backend) {
    _backend = new IndexedDBStorageBackend({
      dbName: DB_NAME,
      version: DB_VERSION,
      stores: [
        ...PI_WEB_UI_STORES,
        ...getLimerenceStoreConfigs(),
        { name: SYNC_META_STORE },
      ],
    });
  }
  if (!_storage) {
    _storage = new LimerenceStorage(_backend);
  }
  if (!_memoryIndex) {
    _memoryIndex = new MemoryIndex();
  }
  if (!_memoryDB) {
    _memoryDB = new MemoryDB();
  }
  if (!_syncEngine) {
    _syncEngine = new SyncEngine(_backend);
  }
  return {
    backend: _backend,
    storage: _storage,
    memoryIndex: _memoryIndex,
    memoryDB: _memoryDB,
    syncEngine: _syncEngine,
  };
}

// ── Provider ────────────────────────────────────────────────────

export function StorageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const instances = getOrCreateInstances();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load memory entries from IndexedDB into BM25 index
      const entries = await instances.storage.loadMemoryEntries();
      instances.memoryIndex.load(entries);

      // Initialize SQLite WASM memory database
      await instances.memoryDB.init();
      if (instances.memoryDB.listFiles().length === 0) {
        const memoryFiles = await instances.storage.readAllMemoryFiles();
        for (const { path, content } of memoryFiles) {
          await instances.memoryDB.indexFile(path, content, { persist: false });
        }
        if (memoryFiles.length > 0) {
          await instances.memoryDB.persist();
        }
      }

      if (!cancelled) setReady(true);
    }

    init().catch((err) => {
      console.error("[StorageProvider] Init failed:", err);
      if (!cancelled) setReady(true); // still render, just without memory DB
    });

    return () => { cancelled = true; };
  }, [instances]);

  const value: StorageContextValue = { ...instances, ready };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────

export function useStorageContext(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorageContext must be used within StorageProvider");
  return ctx;
}
