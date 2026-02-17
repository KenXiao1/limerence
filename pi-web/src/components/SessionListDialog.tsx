/**
 * SessionListDialog — modal for browsing and managing saved sessions.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Trash2 } from "lucide-react";
import type { SessionMetadata } from "../hooks/use-session";
import { t } from "../lib/i18n";

interface Props {
  onClose: () => void;
  onLoadSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  listSessions: () => Promise<SessionMetadata[]>;
}

export function SessionListDialog({ onClose, onLoadSession, onDeleteSession, listSessions }: Props) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [listSessions]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await onDeleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [onDeleteSession],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t("header.sessions")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("tool.loading")}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sessions</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center justify-between group"
                onClick={() => onLoadSession(s.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.title || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.messageCount ?? 0} messages &middot;{" "}
                    {formatRelativeTime(s.lastModified ?? s.createdAt)}
                  </div>
                </div>
                <button
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                  onClick={(e) => handleDelete(e, s.id)}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
