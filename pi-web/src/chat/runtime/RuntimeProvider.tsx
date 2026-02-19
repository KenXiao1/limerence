import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime,
  useAssistantInstructions,
  useThread,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useSettings } from "../../hooks/use-settings";
import { useStorageContext } from "../../hooks/use-storage";
import {
  buildMemoryInjection,
  buildSystemPrompt,
  buildSystemPromptFromPreset,
} from "../../lib/character";
import { shouldFlushMemory, FLUSH_PROMPT } from "../../controllers/compaction";
import { resolveUserName } from "../../controllers/resolve-settings";
import { createThreadListAdapter } from "./thread-list-adapter";
import { THREAD_OVERRIDES_STORE, type ThreadOverrides } from "../../controllers/thread-overrides";
import { getEffectiveContextWindow, evaluateContextWindowGuard } from "../../controllers/context-window-guard";

function SystemInstructionRegistrar({ instruction }: { instruction: string }) {
  useAssistantInstructions({
    instruction,
    disabled: instruction.trim().length === 0,
  });
  return null;
}

/**
 * Monitors thread token usage and injects a flush instruction
 * when approaching the compaction threshold.
 */
function MemoryFlushRegistrar({ contextWindow }: { contextWindow: number }) {
  const lastFlushAtRef = useRef(0);
  const messages = useThread((s) => s.messages);

  const needed = shouldFlushMemory(messages as any[], contextWindow, lastFlushAtRef.current);
  if (needed) lastFlushAtRef.current = Date.now();

  useAssistantInstructions({
    instruction: FLUSH_PROMPT,
    disabled: !needed,
  });

  return null;
}

/**
 * Displays a context window warning when the model has a small context.
 */
function ContextWindowWarningRegistrar({ modelId, contextTokens }: { modelId: string; contextTokens?: number }) {
  const guard = evaluateContextWindowGuard(modelId, contextTokens);

  useAssistantInstructions({
    instruction: guard.warningMessage ?? "",
    disabled: !guard.shouldWarn && !guard.shouldBlock,
  });

  return null;
}

async function buildCurrentSystemInstruction(
  deps: {
    character: ReturnType<typeof useSettings>["character"];
    persona: ReturnType<typeof useSettings>["persona"];
    activePromptPreset: ReturnType<typeof useSettings>["activePromptPreset"];
    storage: ReturnType<typeof useStorageContext>["storage"];
  },
): Promise<string> {
  const { character, persona, activePromptPreset, storage } = deps;
  if (!character) return "";

  const userName = resolveUserName(persona);
  const [profileContent, memoryContent] = await Promise.all([
    storage.readWorkspaceFile("memory/PROFILE.md"),
    storage.readWorkspaceFile("memory/MEMORY.md"),
  ]);

  const memoryInjection = buildMemoryInjection(profileContent, memoryContent, userName);

  if (activePromptPreset) {
    return buildSystemPromptFromPreset(
      activePromptPreset,
      character,
      persona,
      undefined,
      undefined,
      memoryInjection ?? undefined,
    );
  }

  return buildSystemPrompt(character, persona, memoryInjection ?? undefined);
}

// ── Thread overrides context ──────────────────────────────────

interface ThreadOverridesContextValue {
  overrides: ThreadOverrides;
  setOverrides: (o: ThreadOverrides) => void;
  loadOverrides: (threadId: string) => Promise<ThreadOverrides>;
  saveOverrides: (threadId: string, o: ThreadOverrides) => Promise<void>;
}

const ThreadOverridesContext = createContext<ThreadOverridesContextValue | null>(null);

export function useThreadOverrides(): ThreadOverridesContextValue {
  const ctx = useContext(ThreadOverridesContext);
  if (!ctx) throw new Error("useThreadOverrides must be used within ChatRuntimeProvider");
  return ctx;
}

// Module-level mutable ref so the transport always reads latest overrides
const _bodyRef: Record<string, unknown> = {};

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const { backend, storage } = useStorageContext();
  const [systemInstruction, setSystemInstruction] = useState("");
  const [overrides, _setOverrides] = useState<ThreadOverrides>({});

  const setOverrides = useCallback((o: ThreadOverrides) => {
    _setOverrides(o);
    _bodyRef.threadOverrides = o;
  }, []);

  const loadOverrides = useCallback(async (threadId: string): Promise<ThreadOverrides> => {
    const saved = await backend.get<ThreadOverrides>(THREAD_OVERRIDES_STORE, threadId);
    const o = saved ?? {};
    setOverrides(o);
    return o;
  }, [backend, setOverrides]);

  const saveOverrides = useCallback(async (threadId: string, o: ThreadOverrides) => {
    setOverrides(o);
    await backend.set(THREAD_OVERRIDES_STORE, threadId, o);
  }, [backend, setOverrides]);

  const overridesCtx = useMemo<ThreadOverridesContextValue>(
    () => ({ overrides, setOverrides, loadOverrides, saveOverrides }),
    [overrides, setOverrides, loadOverrides, saveOverrides],
  );

  const threadListAdapter = useMemo(
    () => createThreadListAdapter(backend),
    [backend],
  );

  useEffect(() => {
    let cancelled = false;
    void buildCurrentSystemInstruction({
      character: settings.character,
      persona: settings.persona,
      activePromptPreset: settings.activePromptPreset,
      storage,
    }).then((instruction) => {
      if (!cancelled) setSystemInstruction(instruction);
    }).catch((error) => {
      console.error("[ChatRuntimeProvider] Failed to build system instruction:", error);
      if (!cancelled) setSystemInstruction("");
    });
    return () => {
      cancelled = true;
    };
  }, [
    settings.character,
    settings.persona,
    settings.activePromptPreset,
    storage,
  ]);

  const runtime = unstable_useRemoteThreadListRuntime({
    runtimeHook: () =>
      useChatRuntime({
        transport: new AssistantChatTransport({
          api: "/api/chat",
          body: _bodyRef,
        }),
      }),
    adapter: threadListAdapter,
  });

  const effectiveContextWindow = getEffectiveContextWindow(
    overrides.modelId ?? "",
    overrides.contextTokens,
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadOverridesContext.Provider value={overridesCtx}>
        <SystemInstructionRegistrar instruction={systemInstruction} />
        <MemoryFlushRegistrar contextWindow={effectiveContextWindow} />
        <ContextWindowWarningRegistrar
          modelId={overrides.modelId ?? ""}
          contextTokens={overrides.contextTokens}
        />
        {children}
      </ThreadOverridesContext.Provider>
    </AssistantRuntimeProvider>
  );
}

