import type { Context } from "https://edge.netlify.com";

/**
 * LLM streaming proxy Edge Function.
 * Forwards chat completion requests to the configured LLM API,
 * using the API key from Netlify environment variables.
 */
export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }

  try {
    const body = await req.json();
    const { messages, tools, model, base_url, stream } = body;

    const apiKey = Deno.env.get("LLM_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "LLM_API_KEY not configured on server" }, 500);
    }

    const baseUrl = (base_url || Deno.env.get("LLM_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: model || Deno.env.get("LLM_MODEL_ID") || "deepseek-chat",
      messages,
      stream: stream !== false,
    };
    if (tools?.length) {
      payload.tools = tools;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return jsonResponse({ error: `${resp.status}: ${text}` }, resp.status);
    }

    // Stream the response through
    if (stream !== false) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming
    const data = await resp.json();
    return jsonResponse(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message }, 500);
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export const config = { path: "/api/chat" };
