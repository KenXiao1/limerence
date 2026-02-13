import { useState } from "react";
import type { Settings, CharacterCard, ModelInfo } from "../lib/types";
import { testConnection, fetchModels } from "../lib/llm";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  onUploadCharacter: (card: CharacterCard) => void;
  onResetCharacter: () => void;
  characterName: string;
}

type ConnStatus = "idle" | "testing" | "ok" | "error";

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
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [connMessage, setConnMessage] = useState("");
  const [connLatency, setConnLatency] = useState(0);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [showModels, setShowModels] = useState(false);

  if (!open) return null;

  const handleTestConnection = async () => {
    setConnStatus("testing");
    setConnMessage("");
    const result = await testConnection(settings);
    setConnStatus(result.ok ? "ok" : "error");
    setConnMessage(result.message);
    setConnLatency(result.latencyMs);
  };

  const handleFetchModels = async () => {
    setModelsLoading(true);
    setModelsError("");
    setShowModels(true);
    try {
      const list = await fetchModels(settings);
      setModels(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setModelsError(msg);
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSelectModel = (id: string) => {
    onUpdateSettings({ modelId: id });
    setShowModels(false);
  };

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
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-6"
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

            {/* Reverse Proxy */}
            <Field label="反向代理">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={settings.reverseProxyEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ reverseProxyEnabled: e.target.checked })
                  }
                  className="accent-magenta"
                />
                使用反向代理 URL 转发所有 API 请求
              </label>
              {settings.reverseProxyEnabled && (
                <input
                  type="text"
                  value={settings.reverseProxyUrl}
                  onChange={(e) =>
                    onUpdateSettings({ reverseProxyUrl: e.target.value })
                  }
                  placeholder="https://your-proxy.example.com/v1"
                  className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none"
                />
              )}
            </Field>

            {/* Model ID + fetch models */}
            <Field label="模型 ID">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.modelId}
                  onChange={(e) =>
                    onUpdateSettings({ modelId: e.target.value })
                  }
                  placeholder="deepseek-chat"
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-magenta focus:outline-none"
                />
                <button
                  onClick={handleFetchModels}
                  disabled={modelsLoading}
                  className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  title="获取可用模型列表"
                >
                  {modelsLoading ? "..." : "获取模型"}
                </button>
              </div>

              {/* Models dropdown */}
              {showModels && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-700 bg-zinc-800">
                  {modelsError && (
                    <p className="px-3 py-2 text-sm text-red-400">
                      {modelsError}
                    </p>
                  )}
                  {!modelsError && models.length === 0 && !modelsLoading && (
                    <p className="px-3 py-2 text-sm text-zinc-500">
                      无可用模型
                    </p>
                  )}
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-700 ${
                        m.id === settings.modelId
                          ? "text-magenta"
                          : "text-zinc-300"
                      }`}
                    >
                      {m.id}
                      {m.owned_by && (
                        <span className="ml-2 text-xs text-zinc-600">
                          {m.owned_by}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
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

            {/* Test Connection */}
            <div className="border-t border-zinc-800 pt-4">
              <button
                onClick={handleTestConnection}
                disabled={connStatus === "testing"}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
              >
                {connStatus === "testing" ? "测试中..." : "测试 API 连接"}
              </button>

              {connStatus === "ok" && (
                <p className="mt-2 text-sm text-green-400">
                  {connMessage}（{connLatency}ms）
                </p>
              )}
              {connStatus === "error" && (
                <p className="mt-2 text-sm text-red-400">{connMessage}</p>
              )}
            </div>
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
