/**
 * Realtime subscription manager.
 * Subscribes to postgres_changes on all sync_* tables, dispatches to IndexedDB + app state.
 */

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeHandler = (table: string, eventType: string, record: Record<string, unknown>) => void;

const SYNC_TABLES = [
  "sync_sessions",
  "sync_sessions_metadata",
  "sync_memory",
  "sync_notes",
  "sync_files",
  "sync_characters",
  "sync_lorebook",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

let _channel: RealtimeChannel | null = null;

export function subscribeRealtime(
  sb: SupabaseClient,
  userId: string,
  handler: RealtimeHandler,
): () => void {
  if (_channel) {
    sb.removeChannel(_channel);
    _channel = null;
  }

  const channel = sb.channel("limerence-sync");

  for (const table of SYNC_TABLES) {
    channel.on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const eventType = payload.eventType as string; // INSERT | UPDATE | DELETE
        const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
        handler(table, eventType, record);
      },
    );
  }

  channel.subscribe();
  _channel = channel;

  return () => {
    sb.removeChannel(channel);
    _channel = null;
  };
}

export function unsubscribeRealtime(sb: SupabaseClient) {
  if (_channel) {
    sb.removeChannel(_channel);
    _channel = null;
  }
}
