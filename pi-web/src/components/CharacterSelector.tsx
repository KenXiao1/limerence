/**
 * CharacterSelector — modal for browsing, importing, and selecting characters.
 * Ported from views/character-selector.ts (Lit) to React.
 */

import { useRef, useCallback } from "react";
import { X, Trash2, Download } from "lucide-react";
import { t } from "../lib/i18n";
import type { CharacterEntry } from "../controllers/character";
import { characterPreview } from "../controllers/character";

interface Props {
  open: boolean;
  characters: CharacterEntry[];
  defaultCharacterName: string;
  importError: string;
  onSelect: (entry: CharacterEntry | null) => void;
  onImport: (file: File) => void;
  onDelete: (id: string) => void;
  onExportJson: (entry: CharacterEntry) => void;
  onClose: () => void;
}

export function CharacterSelector({
  open,
  characters,
  defaultCharacterName,
  importError,
  onSelect,
  onImport,
  onDelete,
  onExportJson,
  onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImport(file);
      e.target.value = "";
    },
    [onImport],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[74vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-background/95 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t("char.title")}</h2>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-gradient-to-b from-background to-background/80 p-3">
          {/* Default character */}
          <button
            className="w-full rounded-lg border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:border-primary/20 hover:bg-secondary/70"
            onClick={() => { onSelect(null); onClose(); }}
          >
            <div className="text-sm font-medium text-foreground">{defaultCharacterName}</div>
            <div className="text-xs text-muted-foreground">{t("char.default")}</div>
          </button>

          {/* Custom characters */}
          {characters.map((entry) => (
            <div key={entry.id} className="group flex items-center gap-1.5">
              <button
                className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:border-primary/20 hover:bg-secondary/70"
                onClick={() => { onSelect(entry); onClose(); }}
              >
                <div className="truncate text-sm font-medium text-foreground">{entry.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {characterPreview(entry.card)}
                </div>
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground opacity-60 transition-all hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onExportJson(entry)}
                title={t("char.exportJson")}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground opacity-60 transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onDelete(entry.id)}
                title={t("char.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {importError && (
            <p className="text-sm text-destructive px-3 py-1">{importError}</p>
          )}
        </div>

        <div className="border-t border-border bg-background/95 px-4 py-3">
          <button
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => fileRef.current?.click()}
          >
            {t("char.import")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.png"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </div>
    </div>
  );
}
