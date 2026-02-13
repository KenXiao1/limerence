import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Message,
  AgentEvent,
  Settings,
  CharacterCard,
  SessionData,
  SessionHeader,
} from "../lib/types";
import { MemoryIndex } from "../lib/memory";
import { runAgent } from "../lib/agent";
import * as storage from "../lib/storage";

export function useAgent(settings: Settings, character: CharacterCard | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionHeader[]>([]);
  const [toolStatus, setToolStatus] = useState<{
    name: string;
    result?: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const memoryRef = useRef(new MemoryIndex());

  // Load sessions list and memory on mount
  useEffect(() => {
    storage.listSessions().then(setSessions);
    storage.loadMemoryEntries().then((entries) => {
      memoryRef.current.load(entries);
    });
  }, []);

  // Create new session
  const newSession = useCallback(() => {
    const id = crypto.randomUUID();
    const header: SessionHeader = {
      id,
      timestamp: new Date().toISOString(),
      character: character?.data.name ?? "苏晚",
      model: settings.modelId,
    };
    setCurrentSessionId(id);
    setMessages([]);
    setStreamingText("");
    setToolStatus(null);

    // Add first message if character has one
    if (character?.data.first_mes) {
      const firstMsg: Message = {
        role: "assistant",
        content: character.data.first_mes,
      };
      setMessages([firstMsg]);
      storage.saveSession({ header, messages: [firstMsg] });
    } else {
      storage.saveSession({ header, messages: [] });
    }

    storage.listSessions().then(setSessions);
    return id;
  }, [character, settings.modelId]);

  // Load existing session
  const loadSession = useCallback(async (id: string) => {
    const data = await storage.loadSession(id);
    if (data) {
      setCurrentSessionId(id);
      setMessages(data.messages);
      setStreamingText("");
      setToolStatus(null);
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(
    async (id: string) => {
      await storage.deleteSession(id);
      if (id === currentSessionId) {
        setCurrentSessionId("");
        setMessages([]);
      }
      const updated = await storage.listSessions();
      setSessions(updated);
    },
    [currentSessionId],
  );

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!character || isStreaming || !text.trim()) return;

      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = newSession();
      }

      setIsStreaming(true);
      setStreamingText("");
      setToolStatus(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const currentMessages = [...messages];

      const onEvent = (event: AgentEvent) => {
        switch (event.type) {
          case "text_delta":
            setStreamingText((prev) => prev + event.text);
            break;
          case "tool_call_start":
            setToolStatus({ name: event.name });
            break;
          case "tool_call_result":
            setToolStatus({ name: event.name, result: event.result });
            // Reset streaming text for next LLM turn
            setStreamingText("");
            break;
          case "error":
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `错误：${event.message}` },
            ]);
            break;
          case "done":
            break;
        }
      };

      try {
        const newMsgs = await runAgent(
          text,
          currentMessages,
          character,
          memoryRef.current,
          settings,
          sessionId,
          onEvent,
          controller.signal,
        );

        // Update messages with all new messages from agent
        const updatedMessages = [...currentMessages, ...newMsgs];
        setMessages(updatedMessages);
        setStreamingText("");
        setToolStatus(null);

        // Persist session
        const header: SessionHeader = {
          id: sessionId,
          timestamp: new Date().toISOString(),
          character: character.data.name,
          model: settings.modelId,
        };
        await storage.saveSession({ header, messages: updatedMessages });
        const updated = await storage.listSessions();
        setSessions(updated);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "user", content: text },
            { role: "assistant", content: `错误：${e.message}` },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [character, isStreaming, currentSessionId, messages, settings, newSession],
  );

  // Abort generation
  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText("");
    setToolStatus(null);
  }, []);

  return {
    messages,
    isStreaming,
    streamingText,
    currentSessionId,
    sessions,
    toolStatus,
    sendMessage,
    abort,
    newSession,
    loadSession,
    deleteSession,
  };
}
