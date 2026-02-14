import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Usage } from "@mariozechner/pi-ai";
import { state, storage, limerenceStorage, memoryIndex, defaultUsage } from "./app-state";
import { createAgent, updateUrl } from "./app-agent";
import type { MemoryEntry } from "./lib/memory";
import { repairTranscript } from "./app-repair";

// ── Title generation ───────────────────────────────────────────────

export function generateTitle(messages: AgentMessage[]): string {
  const firstUser = messages.find((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  if (!firstUser) return "";

  const content = (firstUser as any).content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join(" ");
  }

  text = text.trim();
  if (!text) return "";

  const sentenceEnd = text.search(/[.!?。！？]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return text.slice(0, sentenceEnd + 1);
  }

  return text.length <= 50 ? text : `${text.slice(0, 47)}...`;
}

// ── Message inspection ─────────────────────────────────────────────

function hasRealAssistantText(message: AgentMessage): boolean {
  if ((message as any).role !== "assistant") return false;
  const content = (message as any).content;
  if (!Array.isArray(content)) return false;
  return content.some((c: any) => c?.type === "text" && String(c.text ?? "").trim().length > 0);
}

export function shouldSaveSession(messages: AgentMessage[]): boolean {
  const hasUser = messages.some((m) => {
    const role = (m as any).role;
    return role === "user" || role === "user-with-attachments";
  });

  const hasAssistant = messages.some((m) => hasRealAssistantText(m));
  return hasUser && hasAssistant;
}

export function extractPlainText(message: AgentMessage): string {
  const role = (message as any).role;
  const content = (message as any).content;

  if (role === "user" || role === "user-with-attachments") {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => String(c.text ?? ""))
        .join("\n")
        .trim();
    }
    return "";
  }

  if (role === "assistant") {
    if (!Array.isArray(content)) return "";
    return content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => String(c.text ?? ""))
      .join("\n")
      .trim();
  }

  return "";
}

export function summarizeUsage(messages: AgentMessage[]): Usage {
  const usage = defaultUsage();

  for (const msg of messages) {
    if ((msg as any).role !== "assistant") continue;
    const u = (msg as any).usage as Usage | undefined;
    if (!u) continue;

    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.totalTokens += u.totalTokens;
    usage.cost.input += u.cost.input;
    usage.cost.output += u.cost.output;
    usage.cost.cacheRead += u.cost.cacheRead;
    usage.cost.cacheWrite += u.cost.cacheWrite;
    usage.cost.total += u.cost.total;
  }

  return usage;
}

// ── Memory indexing ────────────────────────────────────────────────

export async function indexMessageIntoMemory(message: AgentMessage) {
  const role = (message as any).role;
  if (role !== "user" && role !== "assistant") return;

  const text = extractPlainText(message);
  if (!text) return;

  const entry: MemoryEntry = {
    session_id: state.currentSessionId ?? "",
    timestamp: new Date().toISOString(),
    role,
    content: text,
  };

  memoryIndex.add(entry);
  await limerenceStorage.addMemoryEntry(entry);
}

// ── Session persistence ────────────────────────────────────────────

export async function saveSession() {
  if (!state.currentSessionId || !state.agent) return;

  const agentState = state.agent.state;
  if (!shouldSaveSession(agentState.messages)) return;

  if (!state.currentTitle) {
    state.currentTitle = generateTitle(agentState.messages) || "未命名会话";
  }

  const now = new Date().toISOString();
  const usage = summarizeUsage(agentState.messages);

  const sessionData = {
    id: state.currentSessionId,
    title: state.currentTitle,
    model: agentState.model,
    thinkingLevel: agentState.thinkingLevel,
    messages: agentState.messages,
    createdAt: state.currentSessionCreatedAt,
    lastModified: now,
  };

  const metadata = {
    id: state.currentSessionId,
    title: state.currentTitle,
    createdAt: state.currentSessionCreatedAt,
    lastModified: now,
    messageCount: agentState.messages.length,
    usage,
    modelId: agentState.model?.id ?? null,
    thinkingLevel: agentState.thinkingLevel,
    preview: generateTitle(agentState.messages),
  };

  await storage.sessions.save(sessionData, metadata);
}

// ── Session CRUD ───────────────────────────────────────────────────

export async function loadSession(sessionId: string): Promise<boolean> {
  const data = await storage.sessions.get(sessionId);
  if (!data) return false;

  state.appView = "chat";
  state.currentSessionId = sessionId;
  state.currentTitle = data.title ?? "";
  state.currentSessionCreatedAt = data.createdAt;

  await createAgent({
    model: data.model,
    thinkingLevel: data.thinkingLevel,
    messages: repairTranscript(data.messages ?? []),
    tools: [],
  });

  updateUrl(sessionId);
  return true;
}

export async function newSession() {
  state.appView = "chat";
  state.currentSessionId = crypto.randomUUID();
  state.currentSessionCreatedAt = new Date().toISOString();
  state.currentTitle = "";
  state.isEditingTitle = false;

  updateUrl(state.currentSessionId);
  await createAgent();
}
