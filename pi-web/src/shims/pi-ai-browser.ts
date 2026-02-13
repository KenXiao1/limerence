import { Type } from "@sinclair/typebox";
import { EventStream } from "@mariozechner/pi-ai/dist/utils/event-stream.js";
import { parseStreamingJson } from "@mariozechner/pi-ai/dist/utils/json-parse.js";
import { validateToolArguments } from "@mariozechner/pi-ai/dist/utils/validation.js";
import { StringEnum } from "@mariozechner/pi-ai/dist/utils/typebox-helpers.js";
import {
  getModel as baseGetModel,
  getModels as baseGetModels,
  getProviders as baseGetProviders,
  modelsAreEqual,
  calculateCost,
  supportsXhigh,
} from "@mariozechner/pi-ai/dist/models.js";
import {
  streamOpenAICompletions,
  streamSimpleOpenAICompletions,
} from "@mariozechner/pi-ai/dist/providers/openai-completions.js";
import {
  streamOpenAIResponses,
  streamSimpleOpenAIResponses,
} from "@mariozechner/pi-ai/dist/providers/openai-responses.js";

export { EventStream, Type, parseStreamingJson, validateToolArguments, StringEnum, modelsAreEqual, calculateCost, supportsXhigh };

const PROXY_PROVIDER = "limerence-proxy";
const PROXY_MODEL = {
  id: "deepseek-chat",
  name: "deepseek-chat (Netlify Proxy)",
  api: "openai-completions",
  provider: PROXY_PROVIDER,
  baseUrl: "/api/llm/v1",
  reasoning: false,
  input: ["text"],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 128000,
  maxTokens: 8192,
} as any;

export function getProviders(): string[] {
  const providers = baseGetProviders();
  const filtered = providers.filter((p) => p === "openai");
  return [PROXY_PROVIDER, ...filtered];
}

export function getModels(provider: string): any[] {
  if (provider === PROXY_PROVIDER) return [PROXY_MODEL];
  return baseGetModels(provider as any).filter(
    (m) => m.api === "openai-completions" || m.api === "openai-responses",
  );
}

export function getModel(provider: string, modelId: string): any {
  if (provider === PROXY_PROVIDER) {
    return modelId === PROXY_MODEL.id ? PROXY_MODEL : undefined;
  }
  const m = baseGetModel(provider as any, modelId);
  if (!m) return undefined;
  if (m.api !== "openai-completions" && m.api !== "openai-responses") return undefined;
  return m;
}

function resolveStreamProvider(model: any) {
  if (model.api === "openai-completions") {
    return {
      stream: streamOpenAICompletions,
      streamSimple: streamSimpleOpenAICompletions,
    };
  }
  if (model.api === "openai-responses") {
    return {
      stream: streamOpenAIResponses,
      streamSimple: streamSimpleOpenAIResponses,
    };
  }
  throw new Error(`Unsupported api in browser build: ${model.api}`);
}

export function stream(model: any, context: any, options?: any) {
  return resolveStreamProvider(model).stream(model, context, options);
}

export function streamSimple(model: any, context: any, options?: any) {
  return resolveStreamProvider(model).streamSimple(model, context, options);
}

export async function complete(model: any, context: any, options?: any) {
  const s = stream(model, context, options);
  return s.result();
}

export async function completeSimple(model: any, context: any, options?: any) {
  const s = streamSimple(model, context, options);
  return s.result();
}
