import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime,
  useAssistantInstructions,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useSettings } from "../../hooks/use-settings";
import { useStorageContext } from "../../hooks/use-storage";
import {
  buildMemoryInjection,
  buildSystemPrompt,
  buildSystemPromptFromPreset,
} from "../../lib/character";
import { createThreadListAdapter } from "./thread-list-adapter";

function SystemInstructionRegistrar({ instruction }: { instruction: string }) {
  useAssistantInstructions({
    instruction,
    disabled: instruction.trim().length === 0,
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

  const userName = persona?.name ?? "用户";
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

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const { backend, storage } = useStorageContext();
  const [systemInstruction, setSystemInstruction] = useState("");

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
        }),
      }),
    adapter: threadListAdapter,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SystemInstructionRegistrar instruction={systemInstruction} />
      {children}
    </AssistantRuntimeProvider>
  );
}

