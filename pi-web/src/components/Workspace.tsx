/**
 * Workspace panel — file browser + markdown editor with diff preview.
 * Simplified port from app-workspace.ts.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Save, RefreshCw } from "lucide-react";
import { useStorageContext } from "../hooks/use-storage";
import { t } from "../lib/i18n";
import { isMarkdownPath, createDiffPreview } from "../controllers/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Workspace({ open, onClose }: Props) {
  const { storage } = useStorageContext();

  const [files, setFiles] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [baseContent, setBaseContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftPath, setDraftPath] = useState("notes/daily.md");

  // Load file list
  const refreshFiles = useCallback(async () => {
    const list = await storage.listWorkspaceFiles();
    setFiles(list);
  }, [storage]);

  useEffect(() => {
    if (open) refreshFiles();
  }, [open, refreshFiles]);

  // Load file content
  const loadFile = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const content = (await storage.readWorkspaceFile(path)) ?? "";
        setSelectedPath(path);
        setEditorContent(content);
        setBaseContent(content);
        setDirty(false);
      } finally {
        setLoading(false);
      }
    },
    [storage],
  );

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath) return;
    await storage.fileWrite(selectedPath, editorContent);
    setBaseContent(editorContent);
    setDirty(false);
    await refreshFiles();
  }, [storage, selectedPath, editorContent, refreshFiles]);

  // Create new file
  const createFile = useCallback(async () => {
    const path = draftPath.trim();
    if (!path) return;
    await storage.fileWrite(path, "");
    await refreshFiles();
    await loadFile(path);
    setDraftPath("");
  }, [storage, draftPath, refreshFiles, loadFile]);

  // Diff preview
  const diff = dirty ? createDiffPreview(baseContent, editorContent, 160000, 100) : null;

  if (!open) return null;

  return (
    <div className="h-full border-l border-border flex flex-col bg-background" style={{ width: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-sm font-semibold">{t("header.workspace")}</span>
        <button onClick={onClose} className="p-1 hover:bg-secondary rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* File list */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1 mb-2">
          <input
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            placeholder="path/to/file.md"
            className="flex-1 text-xs px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => { if (e.key === "Enter") createFile(); }}
          />
          <button
            onClick={createFile}
            className="p-1 hover:bg-secondary rounded"
            title="Create file"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={refreshFiles}
            className="p-1 hover:bg-secondary rounded"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-32 overflow-y-auto space-y-0.5">
          {files.map((f) => (
            <button
              key={f}
              className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                f === selectedPath ? "bg-primary/10 text-primary" : "hover:bg-secondary"
              }`}
              onClick={() => loadFile(f)}
            >
              {f}
            </button>
          ))}
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No files</p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPath ? (
          <>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
              <span className="text-xs text-muted-foreground truncate">{selectedPath}</span>
              <button
                onClick={saveFile}
                disabled={!dirty}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-secondary disabled:opacity-30 transition-colors"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : isMarkdownPath(selectedPath) ? (
              <textarea
                value={editorContent}
                onChange={(e) => {
                  setEditorContent(e.target.value);
                  setDirty(e.target.value !== baseContent);
                }}
                className="flex-1 p-3 text-sm font-mono bg-background resize-none focus:outline-none"
                spellCheck={false}
              />
            ) : (
              <pre className="flex-1 p-3 text-xs font-mono overflow-auto whitespace-pre-wrap">
                {editorContent}
              </pre>
            )}

            {/* Diff preview */}
            {diff && diff.lines.length > 0 && (
              <div className="border-t border-border px-3 py-2 max-h-32 overflow-y-auto shrink-0">
                <div className="text-xs text-muted-foreground mb-1">
                  +{diff.added} -{diff.removed} {diff.truncated ? "(truncated)" : ""}
                </div>
                {diff.lines.map((line, i) => (
                  <div
                    key={i}
                    className={`text-xs font-mono ${
                      line.type === "added" ? "text-green-600 bg-green-500/5" : "text-red-600 bg-red-500/5"
                    }`}
                  >
                    {line.type === "added" ? "+" : "-"} {line.text}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}
