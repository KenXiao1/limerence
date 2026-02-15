// ── Embedding provider interface ────────────────────────────────

export interface EmbeddingProvider {
  id: string;
  model: string;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ── OpenAI embedding provider ───────────────────────────────────

export function createOpenAIEmbeddingProvider(
  apiKey: string,
  model = "text-embedding-3-small",
  baseUrl = "https://api.openai.com/v1",
): EmbeddingProvider {
  return {
    id: "openai",
    model,
    async embedQuery(text: string): Promise<number[]> {
      const [result] = await this.embedBatch([text]);
      return result;
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      const resp = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: texts, model }),
      });

      if (!resp.ok) {
        throw new Error(`OpenAI embedding failed: ${resp.status}`);
      }

      const data = (await resp.json()) as {
        data: Array<{ embedding: number[] }>;
      };

      return data.data.map((d) => d.embedding);
    },
  };
}

// ── Gemini embedding provider ───────────────────────────────────

export function createGeminiEmbeddingProvider(
  apiKey: string,
  model = "text-embedding-004",
): EmbeddingProvider {
  return {
    id: "gemini",
    model,
    async embedQuery(text: string): Promise<number[]> {
      const [result] = await this.embedBatch([text]);
      return result;
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      const requests = texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      }));

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        },
      );

      if (!resp.ok) {
        throw new Error(`Gemini embedding failed: ${resp.status}`);
      }

      const data = (await resp.json()) as {
        embeddings: Array<{ values: number[] }>;
      };

      return data.embeddings.map((e) => e.values);
    },
  };
}
