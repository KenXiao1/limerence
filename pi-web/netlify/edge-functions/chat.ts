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
import { parseModelRef, normalizeProviderId } from "../../src/controllers/model-selection.ts";
import type { FallbackCandidate } from "../../src/controllers/model-fallback.ts";

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

/**
 * Resolve model input (may be an alias like "opus") to provider/model/baseUrl.
 */
function resolveCandidate(
  rawModelId: string,
  defaultBaseURL: string,
  overrides?: { providerId?: string; baseUrl?: string },
  customAliases?: Record<string, string>,
): { providerId: string; modelId: string; baseURL: string } {
  const ref = parseModelRef(rawModelId, customAliases);

  const providerId = overrides?.providerId?.trim()
    ? normalizeProviderId(overrides.providerId)
    : ref.provider || "limerence-proxy";

  const modelId = ref.model || DEFAULT_MODEL_ID;
  const baseURL = overrides?.baseUrl?.trim() || defaultBaseURL;

  return { providerId, modelId, baseURL };
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

    // Thread overrides: per-thread model + thinking level + fallback models
    const overrides = body?.threadOverrides as
      | {
          modelId?: string;
          providerId?: string;
          baseUrl?: string;
          thinkingLevel?: string;
          fallbackModels?: string[];
          modelAliases?: Record<string, string>;
        }
      | undefined;

    const defaultBaseURL =
      new URL("/api/llm/v1", req.url).toString().replace(/\/+$/, "");

    const rawModelId =
      overrides?.modelId?.trim() ||
      (typeof body?.model === "string" && body.model.trim()
        ? body.model.trim()
        : DEFAULT_MODEL_ID);

    const customAliases = overrides?.modelAliases ?? {};
    const resolved = resolveCandidate(rawModelId, defaultBaseURL, overrides, customAliases);

    // Thinking level → provider-specific params
    const thinkingLevel = overrides?.thinkingLevel ?? "off";
    const providerOptions: Record<string, unknown> = {};
    if (thinkingLevel !== "off") {
      const budgetMap: Record<string, number> = { low: 1024, medium: 4096, high: 16384 };
      const budget = budgetMap[thinkingLevel] ?? 0;
      if (budget > 0) {
        // Anthropic extended thinking
        providerOptions["anthropic"] = { thinking: { type: "enabled", budgetTokens: budget } };
        // OpenAI reasoning effort
        const effortMap: Record<string, string> = { low: "low", medium: "medium", high: "high" };
        providerOptions["openai"] = { reasoningEffort: effortMap[thinkingLevel] ?? "medium" };
      }
    }

    // Build fallback candidates
    const candidates: FallbackCandidate[] = [
      { providerId: resolved.providerId, modelId: resolved.modelId, baseUrl: resolved.baseURL },
    ];
    if (Array.isArray(overrides?.fallbackModels)) {
      for (const fb of overrides!.fallbackModels) {
        if (typeof fb === "string" && fb.trim()) {
          const fbResolved = resolveCandidate(fb.trim(), defaultBaseURL, undefined, customAliases);
          candidates.push({
            providerId: fbResolved.providerId,
            modelId: fbResolved.modelId,
            baseUrl: fbResolved.baseURL,
          });
        }
      }
    }

    const convertedMessages = await convertToModelMessages(messages);
    const toolsDef = { ...frontendTools(tools) };
    const extraOpts = Object.keys(providerOptions).length > 0 ? { providerOptions } : {};

    // Try primary, then fallbacks
    let lastError: Error | null = null;
    for (const candidate of candidates) {
      try {
        const provider = createOpenAICompatible({
          name: candidate.providerId,
          baseURL: candidate.baseUrl || defaultBaseURL,
          apiKey: "__PROXY__",
        });

        const result = streamText({
          model: provider(candidate.modelId),
          system,
          messages: convertedMessages,
          stopWhen: stepCountIs(10),
          tools: toolsDef,
          ...extraOpts,
        });

        return result.toUIMessageStreamResponse({
          headers: corsHeaders(),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next fallback
      }
    }

    // All candidates failed
    const message = lastError?.message ?? "All models failed";
    return jsonResponse({ error: message }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
}

export const config = { path: "/api/chat" };
