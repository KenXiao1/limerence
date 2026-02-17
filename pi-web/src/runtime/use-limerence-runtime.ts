/**
 * useLimerenceRuntime — ExternalStoreRuntime adapter.
 *
 * Core integration point connecting the agent loop, session management,
 * and assistant-ui rendering.
 */

import { useMemo, useCallback, useRef, useState } from "react";
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useSession } from "../hooks/use-session";
import { useSettings } from "../hooks/use-settings";
import { useStorageContext } from "../hooks/use-storage";
import { convertMessages, createUserAgentMessage, type AgentMessage } from "./message-converter";
import { runAgentLoop } from "./agent-loop";
import { createLimerenceTools } from "../lib/tools";
import { createThreadListAdapter } from "./thread-list-adapter";
import {
  buildSystemPrompt,
  buildSystemPromptFromPreset,
  buildMemoryInjection,
} from "../lib/character";
import { applyRegexRules } from "../controllers/regex-rules";
import { smartCompact } from "../controllers/context-budget";
import { scanLorebook, buildLorebookInjection, extractRecentText } from "../controllers/lorebook";
import { parseChatCommand } from "../controllers/agent";
import { parseSlashCommand } from "../controllers/slash-commands";
import { DEFAULT_FREE_MODEL_ID } from "../controllers/free-model-quota";

// ── Model helpers ───────────────────────────────────────────────

function createProxyModel() {
  return {
    id: DEFAULT_FREE_MODEL_ID,
    name: `${DEFAULT_FREE_MODEL_ID} (Netlify Proxy)`,
    api: "openai-completions",
    provider: "limerence-proxy",
    baseUrl: new URL("/api/llm/v1", window.location.origin).toString().replace(/\/+$/, ""),
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

// ── Hook ────────────────────────────────────────────────────────

export function useLimerenceRuntime() {
  const session = useSession();
  const settings = useSettings();
  const { storage: limerenceStorage, memoryIndex, memoryDB } = useStorageContext();

  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Convert stored messages to assistant-ui format
  const threadMessages = useMemo(
    () => convertMessages(session.messages),
    [session.messages],
  );

  // If streaming, append a partial assistant message
  const displayMessages = useMemo(() => {
    if (!isRunning || !streamingText) return threadMessages;

    const partial: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: streamingText }],
      status: { type: "running" },
    };
    return [...threadMessages, partial];
  }, [threadMessages, isRunning, streamingText]);

  // ── Build system prompt ─────────────────────────────────────

  const buildCurrentSystemPrompt = useCallback(async () => {
    if (!settings.character) return "";

    // Memory injection
    const userName = settings.persona?.name || "用户";
    const profileContent = await limerenceStorage.readWorkspaceFile("memory/PROFILE.md");
    const memoryContent = await limerenceStorage.readWorkspaceFile("memory/MEMORY.md");
    const memInjection = buildMemoryInjection(profileContent, memoryContent, userName);

    // Lorebook injection
    let lorebookInjection: string | undefined;
    if (settings.lorebookEntries.length > 0) {
      const recentText = extractRecentText(session.messages as any, 10);
      const charId = settings.character?.data?.name ?? null;
      const matched = scanLorebook(settings.lorebookEntries, recentText, charId);
      lorebookInjection = buildLorebookInjection(matched) ?? undefined;
    }

    // Build prompt
    if (settings.activePromptPreset) {
      return buildSystemPromptFromPreset(
        settings.activePromptPreset,
        settings.character,
        settings.persona,
        lorebookInjection,
        undefined,
        memInjection ?? undefined,
      );
    }

    let prompt = buildSystemPrompt(settings.character, settings.persona, memInjection ?? undefined);
    if (lorebookInjection) {
      prompt = `${prompt}\n\n${lorebookInjection}`;
    }
    return prompt;
  }, [settings, limerenceStorage, session.messages]);

  // ── Get model and API key ───────────────────────────────────

  const getModelAndKey = useCallback(async () => {
    const providers = await settings.listProviderKeys();
    const hasDirectKey = providers.some((p) => p !== "limerence-proxy");

    let model: any;
    if (!hasDirectKey || settings.proxyModeEnabled) {
      model = createProxyModel();
    } else {
      // Use first available direct provider
      const { getModel } = await import("@mariozechner/pi-ai");
      try {
        model = getModel("openai", "gpt-4o-mini");
      } catch {
        model = getModel("openai", "gpt-4.1-mini");
      }
    }

    // Normalize baseUrl
    if (model.provider === "limerence-proxy") {
      model.baseUrl = new URL("/api/llm/v1", window.location.origin).toString().replace(/\/+$/, "");
    }

    const apiKey = await settings.getProviderKey(model.provider) ?? "";
    return { model, apiKey };
  }, [settings]);

  // ── Create tools ────────────────────────────────────────────

  const createTools = useCallback(() => {
    return createLimerenceTools(memoryIndex, memoryDB, limerenceStorage, {
      onFileOperation: () => { /* workspace events handled separately */ },
      onMemoryFileWrite: async (path, content) => {
        await memoryDB.indexFile(path, content);
      },
      onMemoryOperation: () => { /* memory ops tracked separately */ },
    });
  }, [memoryIndex, memoryDB, limerenceStorage]);

  // ── onNew: handle new user message ──────────────────────────

  const onNew = useCallback(async (message: any) => {
    const textPart = message.content?.find((c: any) => c.type === "text");
    const text = textPart?.text ?? "";
    if (!text.trim()) return;

    // Check for chat commands
    const slash = parseSlashCommand(text);
    if (slash) {
      if (slash.type === "new") { session.newSession(); return; }
      if (slash.type === "stop") { abortRef.current?.abort(); return; }
      if (slash.type === "clear") { session.setMessages([]); return; }
      if (slash.type === "handled" || slash.type === "retry") return;
    }
    const cmd = parseChatCommand(text);
    if (cmd === "new") { session.newSession(); return; }
    if (cmd === "stop") { abortRef.current?.abort(); return; }

    // Apply regex rules to input
    let processedText = text;
    if (settings.regexRules.length > 0) {
      processedText = applyRegexRules(processedText, settings.regexRules, "input");
    }

    // Create user message
    const userMsg = createUserAgentMessage(processedText);
    let currentMessages = [...session.messages, userMsg];

    // Smart compaction
    const contextWindow = 128000; // TODO: get from model
    const smartResult = smartCompact(currentMessages as any, contextWindow, 0);
    if (smartResult) {
      currentMessages = smartResult as any;
    }

    session.setMessages(currentMessages);

    setIsRunning(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { model, apiKey } = await getModelAndKey();
      const systemPrompt = await buildCurrentSystemPrompt();
      const tools = createTools();

      const result = await runAgentLoop({
        model,
        apiKey,
        systemPrompt,
        messages: currentMessages,
        tools,
        signal: controller.signal,
        onTextDelta: (_delta, fullText) => {
          setStreamingText(fullText);
        },
        onToolCallStart: (id, name) => {
          setActiveToolCalls((prev) => [...prev, { id, name }]);
        },
        onToolCallEnd: (id) => {
          setActiveToolCalls((prev) => prev.filter((t) => t.id !== id));
        },
        onMessageComplete: (msg) => {
          // Apply regex rules to output
          if (msg.role === "assistant" && settings.regexRules.length > 0) {
            if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (block.type === "text") {
                  block.text = applyRegexRules(block.text, settings.regexRules, "output");
                }
              }
            }
          }
          void session.indexMessageIntoMemory(msg);
        },
        onError: (err) => {
          console.error("[AgentLoop] Error:", err);
        },
      });

      session.setMessages(result.messages);

      // Generate title if needed
      if (!session.currentTitle) {
        const title = session.generateTitle(result.messages);
        if (title) session.setCurrentTitle(title);
      }

      // Save session
      const { model: m } = await getModelAndKey();
      void session.saveSession(m, "off");
    } catch (err) {
      console.error("[useLimerenceRuntime] Error:", err);
    } finally {
      setIsRunning(false);
      setStreamingText("");
      setActiveToolCalls([]);
      abortRef.current = null;
    }
  }, [session, settings, getModelAndKey, buildCurrentSystemPrompt, createTools]);

  // ── onCancel ────────────────────────────────────────────────

  const onCancel = useCallback(async () => {
    abortRef.current?.abort();
  }, []);

  // ── onReload: regenerate from last user message ─────────────

  const onReload = useCallback(async (parentId: string | null) => {
    // Find the last user message and truncate after it
    const msgs = [...session.messages];
    let truncateIdx = msgs.length;

    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user" || msgs[i].role === "user-with-attachments") {
        truncateIdx = i + 1;
        break;
      }
    }

    const truncated = msgs.slice(0, truncateIdx);
    session.setMessages(truncated);

    // Re-run agent from the last user message
    const lastUser = truncated[truncated.length - 1];
    if (!lastUser) return;

    setIsRunning(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { model, apiKey } = await getModelAndKey();
      const systemPrompt = await buildCurrentSystemPrompt();
      const tools = createTools();

      const result = await runAgentLoop({
        model,
        apiKey,
        systemPrompt,
        messages: truncated,
        tools,
        signal: controller.signal,
        onTextDelta: (_delta, fullText) => {
          setStreamingText(fullText);
        },
        onMessageComplete: (msg) => {
          void session.indexMessageIntoMemory(msg);
        },
      });

      session.setMessages(result.messages);
      const { model: m } = await getModelAndKey();
      void session.saveSession(m, "off");
    } catch (err) {
      console.error("[useLimerenceRuntime] Reload error:", err);
    } finally {
      setIsRunning(false);
      setStreamingText("");
      setActiveToolCalls([]);
      abortRef.current = null;
    }
  }, [session, getModelAndKey, buildCurrentSystemPrompt, createTools]);

  // ── Thread list adapter ─────────────────────────────────────

  const threadListAdapter = useMemo(
    () =>
      createThreadListAdapter({
        listSessions: session.listSessions,
        loadSession: session.loadSession,
        deleteSession: session.deleteSession,
        newSession: session.newSession,
        currentSessionId: session.currentSessionId,
      }),
    [session],
  );

  // ── Build runtime ───────────────────────────────────────────

  const runtime = useExternalStoreRuntime({
    messages: displayMessages,
    setMessages: undefined,
    isRunning,
    onNew,
    onReload,
    onCancel,
    convertMessage: (msg: ThreadMessageLike) => msg,
    adapters: {
      threadList: threadListAdapter,
    },
  });

  return runtime;
}
