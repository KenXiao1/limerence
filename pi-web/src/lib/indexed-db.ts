/**
 * Independent IndexedDB storage backend.
 * Replaces @mariozechner/pi-web-ui's IndexedDBStorageBackend.
 * Maintains backward compatibility with existing DB name, version, and store names.
 */

export interface StorageBackend {
  get<T>(store: string, key: string): Promise<T | null>;
  set(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  keys(store: string, prefix?: string): Promise<string[]>;
}

export interface StoreConfig {
  name: string;
}

export interface IndexedDBStorageBackendOptions {
  dbName: string;
  version: number;
  stores: StoreConfig[];
}

export class IndexedDBStorageBackend implements StorageBackend {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly version: number;
  private readonly storeNames: string[];
  private initPromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDBStorageBackendOptions) {
    this.dbName = options.dbName;
    this.version = options.version;
    this.storeNames = options.stores.map((s) => s.name);
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of this.storeNames) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        // Handle connection closing unexpectedly
        this.db.onclose = () => {
          this.db = null;
          this.initPromise = null;
        };

        resolve(this.db);
      };

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        this.initPromise = null;
        reject(new Error(`IndexedDB "${this.dbName}" is blocked by another connection`));
      };
    });

    return this.initPromise;
  }

  async get<T>(store: string, key: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async set(store: string, key: string, value: unknown): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async delete(store: string, key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async keys(store: string, prefix?: string): Promise<string[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAllKeys();
        req.onsuccess = () => {
          let keys = (req.result as IDBValidKey[])
            .filter((k): k is string => typeof k === "string");
          if (prefix) {
            keys = keys.filter((k) => k.startsWith(prefix));
          }
          resolve(keys);
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }
}
