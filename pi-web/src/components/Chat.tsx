import { useState, useCallback, useEffect, useMemo, type FC, type FormEvent } from "react";
import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  useThread,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
  ArchiveIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FolderOpenIcon,
  HomeIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  Settings2Icon,
  SquareIcon,
  TrashIcon,
  UserCircle2Icon,
} from "lucide-react";
import { CharacterSelector } from "./CharacterSelector";
import { Settings } from "./Settings";
import { ToolRenderers } from "./ToolRenderers";
import { TokenBudgetBar } from "./TokenBudgetBar";
import { Workspace } from "./Workspace";
import { useSettings } from "../hooks/use-settings";
import { useThreadOverrides } from "../chat/runtime/RuntimeProvider";
import { loadCharacterFromFile } from "../controllers/character";
import { resolveCharacterName, resolveUserName } from "../controllers/resolve-settings";
import { calculateBudget, DEFAULT_BUDGET_CONFIG } from "../controllers/context-budget";
import type { ThinkingLevel, ThreadOverrides } from "../controllers/thread-overrides";
import { parseSlashCommand } from "../controllers/slash-commands";
import { applyTemplate, buildTemplateContext } from "../controllers/template-engine";

const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: "off", label: "关闭" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export function Chat({ onShowIntro }: { onShowIntro: () => void }) {
  const settings = useSettings();
  const threadId = useThread((s) => s.threadId);
  const { overrides, setOverrides, loadOverrides, saveOverrides } = useThreadOverrides();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [charSelectorOpen, setCharSelectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [providerOptions, setProviderOptions] = useState<string[]>(["limerence-proxy"]);

  const handleCharImport = useCallback(
    async (file: File) => {
      const entry = await loadCharacterFromFile(file);
      if (!entry) return;
      settings.setCharacterList([...settings.characterList, entry]);
    },
    [settings],
  );

  const charName = resolveCharacterName(settings.character);
  const currentThinking = overrides.thinkingLevel ?? "off";
  const currentModelId = overrides.modelId ?? "";
  const currentProviderId = overrides.providerId ?? "";

  useEffect(() => {
    let cancelled = false;
    void settings.listProviderKeys().then((keys) => {
      if (cancelled) return;
      const options = Array.from(new Set(["limerence-proxy", ...keys])).sort((a, b) => a.localeCompare(b));
      setProviderOptions(options);
    }).catch((error) => {
      console.error("[Chat] Failed to load provider keys:", error);
      if (!cancelled) setProviderOptions(["limerence-proxy"]);
    });
    return () => { cancelled = true; };
  }, [settings.listProviderKeys]);

  useEffect(() => {
    if (!threadId) return;
    void loadOverrides(threadId).catch((error) => {
      console.error("[Chat] Failed to load thread overrides:", error);
      setOverrides({});
    });
  }, [loadOverrides, setOverrides, threadId]);

  const persistOverrides = useCallback((next: ThreadOverrides) => {
    if (!threadId) {
      setOverrides(next);
      return;
    }
    void saveOverrides(threadId, next);
  }, [saveOverrides, setOverrides, threadId]);

  const handleProviderChange = useCallback((providerId: string) => {
    persistOverrides({ ...overrides, providerId: providerId || undefined });
  }, [overrides, persistOverrides]);

  const handleModelChange = useCallback((modelId: string) => {
    persistOverrides({ ...overrides, modelId: modelId || undefined });
  }, [overrides, persistOverrides]);

  const handleThinkingChange = useCallback((level: ThinkingLevel) => {
    persistOverrides({ ...overrides, thinkingLevel: level });
  }, [overrides, persistOverrides]);

  return (
    <div className="limerence-chat-shell h-screen w-full bg-background text-foreground">
      <ToolRenderers />
      <div className="flex h-full w-full min-w-0">
        <aside
          className={`border-r border-border transition-all duration-200 ${
            sidebarOpen ? "w-72" : "w-0"
          } overflow-hidden`}
        >
          <div className="flex h-full flex-col bg-muted/30 p-3">
            <ThreadList />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-sm hover:bg-muted"
                onClick={onShowIntro}
              >
                <HomeIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-sm hover:bg-muted"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                {sidebarOpen ? (
                  <PanelLeftCloseIcon className="h-4 w-4" />
                ) : (
                  <PanelLeftOpenIcon className="h-4 w-4" />
                )}
              </button>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/55 px-2.5 py-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">当前角色</span>
                <span className="text-sm font-semibold text-foreground">{charName}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Provider override selector */}
              <select
                value={currentProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                title="Provider"
              >
                <option value="">默认 Provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
              {/* Model override input */}
              <input
                type="text"
                value={currentModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="模型 ID（留空用默认）"
                className="h-8 w-36 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {/* Thinking level selector */}
              <select
                value={currentThinking}
                onChange={(e) => handleThinkingChange(e.target.value as ThinkingLevel)}
                className="h-8 rounded-md border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                title="思考深度"
              >
                {THINKING_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {currentThinking !== "off" && l.value === currentThinking ? `🧠 ${l.label}` : l.label}
                  </option>
                ))}
              </select>
              {/* Workspace toggle */}
              <button
                type="button"
                className={`inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-sm hover:bg-muted ${workspaceOpen ? "bg-muted" : ""}`}
                onClick={() => setWorkspaceOpen((v) => !v)}
                title="工作区"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-sm hover:bg-muted"
                onClick={() => setCharSelectorOpen(true)}
              >
                <UserCircle2Icon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-sm hover:bg-muted"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2Icon className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <Thread />
            </div>
            {workspaceOpen && (
              <Workspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
            )}
          </div>
        </main>
      </div>

      <CharacterSelector
        open={charSelectorOpen}
        characters={settings.characterList}
        defaultCharacterName={settings.character?.data?.name ?? "Default"}
        importError=""
        onSelect={(entry) => {
          if (entry) settings.setCharacter(entry.card);
        }}
        onImport={handleCharImport}
        onDelete={(id) => {
          settings.setCharacterList(settings.characterList.filter((c) => c.id !== id));
        }}
        onExportJson={(entry) => {
          const blob = new Blob([JSON.stringify(entry.card, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${entry.name}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        }}
        onClose={() => setCharSelectorOpen(false)}
      />

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="flex h-full flex-col gap-2">
      <ThreadListPrimitive.New asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-start rounded-md border border-border px-3 text-left text-sm hover:bg-muted"
        >
          新会话
        </button>
      </ThreadListPrimitive.New>

      <AuiIf condition={(s) => s.threads.isLoading}>
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </AuiIf>

      <AuiIf condition={(s) => !s.threads.isLoading}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ThreadListPrimitive.Items components={{ ThreadListItem }} />
        </div>
      </AuiIf>
    </ThreadListPrimitive.Root>
  );
};

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="group flex h-9 items-center gap-1 rounded-md px-1 transition-colors hover:bg-muted focus-within:bg-muted data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm">
        <ThreadListItemPrimitive.Title fallback="New Chat" />
      </ThreadListItemPrimitive.Trigger>

      <ThreadListItemMorePrimitive.Root>
        <ThreadListItemMorePrimitive.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </button>
        </ThreadListItemMorePrimitive.Trigger>

        <ThreadListItemMorePrimitive.Content className="z-50 min-w-28 rounded-md border border-border bg-background p-1 shadow-md">
          <ThreadListItemPrimitive.Archive asChild>
            <ThreadListItemMorePrimitive.Item className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <ArchiveIcon className="h-4 w-4" />
              Archive
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Archive>
          <ThreadListItemPrimitive.Delete asChild>
            <ThreadListItemMorePrimitive.Item className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
              <TrashIcon className="h-4 w-4" />
              Delete
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Delete>
        </ThreadListItemMorePrimitive.Content>
      </ThreadListItemMorePrimitive.Root>
    </ThreadListItemPrimitive.Root>
  );
};

const Thread: FC = () => {
  const messages = useThread((s) => s.messages);
  const budget = useMemo(
    () => calculateBudget(128_000, "", "", messages as any[], DEFAULT_BUDGET_CONFIG),
    [messages],
  );

  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <div className="mx-auto my-auto w-full max-w-3xl px-4">
            <h1 className="font-semibold text-2xl">Hello there</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Start a new conversation. Thread history is now persisted per chat.
            </p>
          </div>
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
            EditComposer,
          }}
        />

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mx-auto mt-auto w-full max-w-3xl bg-background pb-4 pt-2">
          <ThreadPrimitive.ScrollToBottom asChild>
            <button
              type="button"
              className="absolute -top-10 left-1/2 inline-flex -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background p-2 shadow-sm disabled:invisible"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </ThreadPrimitive.ScrollToBottom>
          {messages.length > 0 && (
            <div className="mb-1.5">
              <TokenBudgetBar budget={budget} />
            </div>
          )}
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mx-auto grid w-full max-w-3xl grid-cols-[1fr_auto] py-2">
      <div className="col-start-2 max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-sm">
        <MessagePrimitive.Parts />
      </div>
      <div className="col-span-full col-start-1 flex justify-end pr-1">
        <MessageActions />
      </div>
    </MessagePrimitive.Root>
  );
};

const MarkdownTextPart: FC = () => <MarkdownTextPrimitive />;

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mx-auto w-full max-w-3xl py-2">
      <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownTextPart,
          }}
        />
        <MessagePrimitive.Error>
          <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-500 text-xs">
            生成失败，请重试
          </div>
        </MessagePrimitive.Error>
      </div>
      <div className="mt-1 flex items-center gap-1 text-muted-foreground">
        <MessageActions />
      </div>
    </MessagePrimitive.Root>
  );
};

const MessageActions: FC = () => {
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="flex items-center gap-1">
      <ActionBarPrimitive.Copy asChild>
        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon className="h-4 w-4" />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon className="h-4 w-4" />
          </AuiIf>
        </button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted">
          <RefreshCwIcon className="h-4 w-4" />
        </button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="mx-auto w-full max-w-3xl py-2">
      <ComposerPrimitive.Root className="ml-auto flex w-full max-w-[85%] flex-col rounded-2xl border border-border bg-muted/30">
        <ComposerPrimitive.Input
          className="min-h-14 w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
          autoFocus
        />
        <div className="mb-3 mr-3 flex items-center justify-end gap-2">
          <ComposerPrimitive.Cancel asChild>
            <button type="button" className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
              Cancel
            </button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button type="button" className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
              Update
            </button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const Composer: FC = () => {
  const composerText = useComposer((s) => s.text);
  const composerRuntime = useComposerRuntime();
  const settings = useSettings();
  const { overrides } = useThreadOverrides();

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    const cmd = parseSlashCommand(composerText, settings.customSkills);
    if (cmd?.type !== "prompt") return;

    e.preventDefault();
    const args = composerText.trim().split(/\s+/).slice(1).join(" ").trim();

    // Apply template variables to the prompt
    const templateCtx = buildTemplateContext({
      characterName: resolveCharacterName(settings.character),
      persona: settings.persona?.description,
      userName: resolveUserName(settings.persona),
      modelId: overrides.modelId,
      providerId: overrides.providerId,
    });
    const injectedPrompt = applyTemplate(cmd.promptTemplate.trim(), templateCtx);

    const finalPrompt = args ? `${injectedPrompt}\n\n${args}` : injectedPrompt;
    if (!finalPrompt) return;

    composerRuntime.setText(finalPrompt);
    composerRuntime.send();
  }, [composerRuntime, composerText, settings, overrides]);

  return (
    <ComposerPrimitive.Root
      className="flex w-full items-end gap-2 rounded-2xl border border-border bg-background p-2"
      onSubmit={handleSubmit}
    >
      <ComposerPrimitive.Input
        placeholder="输入消息..."
        className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
      />

      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <button
            type="submit"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </ComposerPrimitive.Send>
      </AuiIf>

      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <SquareIcon className="h-3 w-3 fill-current" />
          </button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
  );
};
