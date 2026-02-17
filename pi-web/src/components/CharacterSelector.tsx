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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t("char.title")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Default character */}
          <button
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => { onSelect(null); onClose(); }}
          >
            <div className="text-sm font-medium">{defaultCharacterName}</div>
            <div className="text-xs text-muted-foreground">{t("char.default")}</div>
          </button>

          {/* Custom characters */}
          {characters.map((entry) => (
            <div key={entry.id} className="flex items-center gap-1 group">
              <button
                className="flex-1 text-left px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors min-w-0"
                onClick={() => { onSelect(entry); onClose(); }}
              >
                <div className="text-sm font-medium truncate">{entry.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {characterPreview(entry.card)}
                </div>
              </button>
              <button
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-secondary rounded transition-all"
                onClick={() => onExportJson(entry)}
                title={t("char.exportJson")}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                onClick={() => onDelete(entry.id)}
                title={t("char.delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {importError && (
            <p className="text-sm text-destructive px-3 py-1">{importError}</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border">
          <button
            className="w-full py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
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
