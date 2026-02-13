import type { Context } from "https://edge.netlify.com";

/**
 * Models proxy Edge Function.
 * Forwards /models requests to the configured LLM API.
 * Accepts POST with { base_url } in body, or uses env defaults.
 */
export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const apiKey = Deno.env.get("LLM_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "LLM_API_KEY not configured on server" }, 500);
    }

    let baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/+$/, "");

    // POST mode: client sends { base_url } to override
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.base_url) {
        baseUrl = body.base_url.replace(/\/+$/, "");
      }
    }

    const url = `${baseUrl}/models`;

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return jsonResponse({ error: `${resp.status}: ${text}` }, resp.status);
    }

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export const config = { path: "/api/models" };
