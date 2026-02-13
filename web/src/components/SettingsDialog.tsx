import { useState } from "react";
import type { Settings, CharacterCard } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  onUploadCharacter: (card: CharacterCard) => void;
  onResetCharacter: () => void;
  characterName: string;
}

export default function SettingsDialog({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onUploadCharacter,
  onResetCharacter,
  characterName,
}: Props) {
  const [tab, setTab] = useState<"api" | "character">("api");

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const card = JSON.parse(reader.result as string);
        if (card.data?.name) {
          onUploadCharacter(card);
        }
      } catch {
        alert("无效的角色卡 JSON 文件");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-100">设置</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b border-zinc-800 pb-2">
          <button
            className={`px-3 py-1 text-sm rounded ${tab === "api" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            onClick={() => setTab("api")}
          >
            API 配置
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${tab === "character" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            onClick={() => setTab("character")}
          >
            角色卡
          </button>
        </div>

        {tab === "api" && (
          <div className="space-y-4">
            <Field label="API Key">
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none"
              />
            </Field>

            <Field label="Base URL">
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => onUpdateSettings({ baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none"
              />
            </Field>

            <Field label="模型 ID">
              <input
                type="text"
                value={settings.modelId}
                onChange={(e) => onUpdateSettings({ modelId: e.target.value })}
                placeholder="deepseek-chat"
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none"
              />
            </Field>

            <Field label="代理模式">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={settings.proxyMode}
                  onChange={(e) =>
                    onUpdateSettings({ proxyMode: e.target.checked })
                  }
                  className="accent-magenta"
                />
                通过服务端代理转发请求（API Key 存储在服务端）
              </label>
            </Field>
          </div>
        )}

        {tab === "character" && (
          <div className="space-y-4">
            <div className="rounded border border-zinc-800 bg-zinc-800/50 p-3">
              <p className="text-sm text-zinc-400">
                当前角色：
                <span className="text-magenta">{characterName}</span>
              </p>
            </div>

            <Field label="上传角色卡">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-300 hover:file:bg-zinc-700"
              />
              <p className="mt-1 text-xs text-zinc-600">
                支持 SillyTavern V2 格式的 JSON 角色卡
              </p>
            </Field>

            <button
              onClick={onResetCharacter}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              恢复默认角色
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
