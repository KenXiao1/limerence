import type { Context } from "https://edge.netlify.com";

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }

  try {
    const body = await req.json();

    const envApiKey = Deno.env.get("LLM_API_KEY")?.trim();
    const authHeader = req.headers.get("authorization") ?? "";
    const userApiKey = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    const upstreamKey = envApiKey || (userApiKey && userApiKey !== "__PROXY__" ? userApiKey : "");
    if (!upstreamKey) {
      return jsonResponse({ error: "Missing upstream API key (LLM_API_KEY not set)" }, 500);
    }

    const baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;

    const payload = {
      ...body,
      model: body.model || Deno.env.get("LLM_MODEL_ID") || "deepseek-chat",
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return jsonResponse({ error: `${resp.status}: ${text}` }, resp.status);
    }

    const stream = body.stream !== false;
    if (stream) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const json = await resp.json();
    return jsonResponse(json, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export const config = { path: "/api/llm/v1/chat/completions" };
