/**
 * Lightweight EventEmitter for iframe-runner.
 * Tracks listeners by ownerWindow so they can be bulk-cleaned when an iframe unloads.
 *
 * Replaces SillyTavern's eventSource for the subset of events we support.
 */

type Listener = (...args: any[]) => void | Promise<void>;

interface TrackedListener {
  fn: Listener;
  once: boolean;
  owner: Window | null;
}

export class EventBus {
  private _listeners = new Map<string, TrackedListener[]>();

  /**
   * Register a listener. Returns a handle with a `stop()` method.
   */
  on(event: string, fn: Listener, ownerWindow?: Window): { stop: () => void } {
    const entry: TrackedListener = { fn, once: false, owner: ownerWindow ?? null };
    this._getOrCreate(event).push(entry);
    return { stop: () => this._remove(event, fn, ownerWindow ?? null) };
  }

  /**
   * Register a one-shot listener.
   */
  once(event: string, fn: Listener, ownerWindow?: Window): { stop: () => void } {
    const entry: TrackedListener = { fn, once: true, owner: ownerWindow ?? null };
    this._getOrCreate(event).push(entry);
    return { stop: () => this._remove(event, fn, ownerWindow ?? null) };
  }

  /**
   * Emit an event. Listeners are called asynchronously.
   */
  async emit(event: string, ...data: any[]): Promise<void> {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return;

    const toRemove: TrackedListener[] = [];

    for (const entry of list) {
      try {
        await entry.fn(...data);
      } catch (err) {
        console.warn(`[EventBus] Error in listener for "${event}":`, err);
      }
      if (entry.once) toRemove.push(entry);
    }

    if (toRemove.length > 0) {
      const remaining = list.filter((e) => !toRemove.includes(e));
      if (remaining.length > 0) {
        this._listeners.set(event, remaining);
      } else {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Remove a specific listener.
   */
  removeListener(event: string, fn: Listener, ownerWindow?: Window): void {
    this._remove(event, fn, ownerWindow ?? null);
  }

  /**
   * Remove all listeners registered by a specific window (iframe cleanup).
   */
  clearAllForWindow(ownerWindow: Window): void {
    for (const [event, list] of this._listeners) {
      const remaining = list.filter((e) => e.owner !== ownerWindow);
      if (remaining.length > 0) {
        this._listeners.set(event, remaining);
      } else {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for all events.
   */
  clearAll(): void {
    this._listeners.clear();
  }

  private _getOrCreate(event: string): TrackedListener[] {
    let list = this._listeners.get(event);
    if (!list) {
      list = [];
      this._listeners.set(event, list);
    }
    return list;
  }

  private _remove(event: string, fn: Listener, owner: Window | null): void {
    const list = this._listeners.get(event);
    if (!list) return;
    const remaining = list.filter((e) => !(e.fn === fn && e.owner === owner));
    if (remaining.length > 0) {
      this._listeners.set(event, remaining);
    } else {
      this._listeners.delete(event);
    }
  }
}

// ── Event name constants (matching JS-Slash-Runner/src/function/event.ts) ──

/** Events emitted by the tavern bridge (SillyTavern-compatible names). */
export const tavern_events = {
  MESSAGE_SENT: "message_sent",
  MESSAGE_RECEIVED: "message_received",
  USER_MESSAGE_RENDERED: "user_message_rendered",
  CHARACTER_MESSAGE_RENDERED: "character_message_rendered",
  GENERATION_STARTED: "generation_started",
  GENERATION_ENDED: "generation_ended",
  CHAT_CHANGED: "chat_changed",
  CHAT_COMPLETION_SETTINGS_READY: "chat_completion_settings_ready",
} as const;

/** Events for iframe communication. */
export const iframe_events = {
  IFRAME_READY: "iframe_ready",
  IFRAME_DESTROYED: "iframe_destroyed",
} as const;

/** Singleton event bus instance. */
export const eventBus = new EventBus();
