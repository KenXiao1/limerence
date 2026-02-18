import type { Context } from "https://edge.netlify.com";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "npm:ai@6";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { frontendTools } from "npm:@assistant-ui/react-ai-sdk";
import { resolveFreeModelId } from "../../src/controllers/free-model-quota.ts";

const DEFAULT_MODEL_ID = resolveFreeModelId(
  Deno.env.get("LLM_MODEL_ID") ?? Deno.env.get("FREE_MODEL_ID"),
);

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const messages: UIMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return jsonResponse({ error: "Missing messages" }, 400);
    }

    const system = typeof body?.system === "string" ? body.system : undefined;
    const tools = body?.tools && typeof body.tools === "object" ? body.tools : {};
    const modelId =
      typeof body?.model === "string" && body.model.trim()
        ? body.model.trim()
        : DEFAULT_MODEL_ID;

    const baseURL = new URL("/api/llm/v1", req.url).toString().replace(/\/+$/, "");
    const provider = createOpenAICompatible({
      name: "limerence-proxy",
      baseURL,
      apiKey: "__PROXY__",
    });

    const result = streamText({
      model: provider(modelId),
      system,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(10),
      tools: {
        ...frontendTools(tools),
      },
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
}

export const config = { path: "/api/chat" };

