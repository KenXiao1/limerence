type LMStudioClientOptions = {
  baseUrl?: string;
};

type ModelListResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    context_length?: number;
    max_context_length?: number;
    max_model_len?: number;
    modalities?: string[];
  }>;
};

type DownloadedModel = {
  type: "llm";
  path: string;
  displayName: string;
  maxContextLength: number;
  trainedForToolUse: boolean;
  vision: boolean;
};

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return "http://127.0.0.1:1234";
  if (baseUrl.startsWith("ws://")) return `http://${baseUrl.slice(5)}`;
  if (baseUrl.startsWith("wss://")) return `https://${baseUrl.slice(6)}`;
  return baseUrl;
}

function mapToDownloadedModel(raw: NonNullable<ModelListResponse["data"]>[number]): DownloadedModel | null {
  const id = raw.id ?? raw.name;
  if (!id) return null;

  const contextWindow = raw.max_context_length ?? raw.context_length ?? raw.max_model_len ?? 8192;
  const modalities = Array.isArray(raw.modalities) ? raw.modalities : [];
  const vision = modalities.includes("image") || /vision|vl|multimodal/i.test(id);

  return {
    type: "llm",
    path: id,
    displayName: id,
    maxContextLength: contextWindow,
    trainedForToolUse: false,
    vision,
  };
}

export class LMStudioClient {
  private readonly httpBaseUrl: string;
  readonly system: {
    listDownloadedModels: () => Promise<DownloadedModel[]>;
  };

  constructor(options: LMStudioClientOptions = {}) {
    this.httpBaseUrl = normalizeBaseUrl(options.baseUrl);
    this.system = {
      listDownloadedModels: async () => {
        const endpoint = new URL("/v1/models", this.httpBaseUrl).toString();
        const response = await fetch(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`LM Studio model discovery failed: HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ModelListResponse;
        const models = Array.isArray(payload.data) ? payload.data : [];
        return models.map(mapToDownloadedModel).filter((m): m is DownloadedModel => m !== null);
      },
    };
  }
}
