import type {
  Message,
  ToolCall,
  AgentEvent,
  Settings,
  CharacterCard,
} from "./types";
import { streamChat } from "./llm";
import { allToolDefs, executeTool } from "./tools";
import { MemoryIndex } from "./memory";
import { buildSystemPrompt } from "./character";
import * as storage from "./storage";

/**
 * Agent loop, ported from Rust agent.rs.
 *
 * Streams LLM → processes tool calls → loops until no tool calls remain.
 * Sends AgentEvents via callback for the UI to render.
 */
export async function runAgent(
  userInput: string,
  sessionMessages: Message[],
  character: CharacterCard,
  memory: MemoryIndex,
  settings: Settings,
  sessionId: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<Message[]> {
  const systemPrompt = buildSystemPrompt(character);
  const tools = allToolDefs();
  const newMessages: Message[] = [];

  // Add user message
  const userMsg: Message = { role: "user", content: userInput };
  newMessages.push(userMsg);

  // Index user message in memory
  const userMemEntry = {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    role: "user",
    content: userInput,
  };
  memory.add(userMemEntry);
  await storage.addMemoryEntry(userMemEntry);

  // Agent loop
  while (true) {
    if (signal?.aborted) break;

    // Build full message list
    const allMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...sessionMessages,
      ...newMessages,
    ];

    // Stream LLM response
    let fullText = "";
    const toolCalls: ToolCall[] = [];
    const tcArgs: Map<number, string> = new Map();

    for await (const event of streamChat(allMessages, tools, settings, signal)) {
      if (signal?.aborted) break;

      switch (event.type) {
        case "text_delta":
          fullText += event.text;
          onEvent({ type: "text_delta", text: event.text });
          break;

        case "tool_call_start":
          while (toolCalls.length <= event.index) {
            toolCalls.push({
              id: "",
              function: { name: "", arguments: "" },
            });
          }
          toolCalls[event.index].id = event.id;
          toolCalls[event.index].function.name = event.name;
          break;

        case "tool_call_delta":
          tcArgs.set(
            event.index,
            (tcArgs.get(event.index) ?? "") + event.arguments,
          );
          break;

        case "error":
          onEvent({ type: "error", message: event.message });
          return newMessages;

        case "done":
          break;
      }
    }

    if (signal?.aborted) break;

    // Finalize tool call arguments
    for (const [i, args] of tcArgs) {
      if (i < toolCalls.length) {
        toolCalls[i].function.arguments = args;
      }
    }

    // Build assistant message
    const assistantMsg: Message =
      toolCalls.length > 0
        ? {
            role: "assistant",
            content: fullText,
            tool_calls: toolCalls,
          }
        : { role: "assistant", content: fullText };

    newMessages.push(assistantMsg);

    // Index assistant message in memory
    if (fullText) {
      const assistantMemEntry = {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        role: "assistant",
        content: fullText,
      };
      memory.add(assistantMemEntry);
      await storage.addMemoryEntry(assistantMemEntry);
    }

    // No tool calls → done
    if (toolCalls.length === 0) {
      onEvent({ type: "done" });
      break;
    }

    // Execute tool calls
    for (const tc of toolCalls) {
      if (signal?.aborted) break;

      const name = tc.function.name;
      onEvent({ type: "tool_call_start", name });

      const result = await executeTool(name, tc.function.arguments, memory);

      onEvent({ type: "tool_call_result", name, result });

      newMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Continue loop — LLM will see tool results
  }

  return newMessages;
}
