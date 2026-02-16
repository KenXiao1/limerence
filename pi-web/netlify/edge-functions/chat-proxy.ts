import type { Context } from "https://edge.netlify.com";
import {
  computeQuotaDecision,
  resolveDailyLimit,
  resolveFreeModelId,
  type DailyQuotaRecord,
} from "../../src/controllers/free-model-quota.ts";

const DEFAULT_QUOTA_COOKIE_NAME = "limerence_free_quota";

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

    const defaultModelId = resolveFreeModelId(
      Deno.env.get("LLM_MODEL_ID") ?? Deno.env.get("FREE_MODEL_ID"),
    );
    const requestedModel =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : defaultModelId;
    const freeModelId = resolveFreeModelId(Deno.env.get("FREE_MODEL_ID") ?? defaultModelId);

    const usingHostedKey = Boolean(envApiKey) && upstreamKey === envApiKey;
    const usingFreeModel = requestedModel === freeModelId;
    const dailyLimit = resolveDailyLimit(Deno.env.get("FREE_MODEL_DAILY_LIMIT"));

    const quotaCookieName = resolveQuotaCookieName(Deno.env.get("FREE_MODEL_QUOTA_COOKIE_NAME"));
    const quotaSecret = Deno.env.get("FREE_MODEL_QUOTA_SECRET")?.trim() || envApiKey || "";
    let setCookieHeader: string | undefined;

    if (usingHostedKey && usingFreeModel && dailyLimit > 0) {
      const cookieHeader = req.headers.get("cookie");
      const previous = await readQuotaCookie(cookieHeader, quotaCookieName, quotaSecret);
      const quota = computeQuotaDecision(previous, new Date(), dailyLimit);

      if (!quota.allowed) {
        return jsonResponse(
          {
            error: `Free model daily limit reached (${dailyLimit}/day). Please configure your own API key to continue.`,
            code: "FREE_MODEL_DAILY_LIMIT_REACHED",
            model: freeModelId,
            limit: dailyLimit,
            remaining: 0,
            day: quota.next.day,
          },
          429,
        );
      }

      setCookieHeader = await buildQuotaSetCookieHeader(
        quotaCookieName,
        quota.next,
        quotaSecret,
      );
    }

    const baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;

    const payload = {
      ...body,
      model: requestedModel,
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
      return jsonResponse({ error: `${resp.status}: ${text}` }, resp.status, {
        "Set-Cookie": setCookieHeader,
      });
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
          ...(setCookieHeader ? { "Set-Cookie": setCookieHeader } : {}),
        },
      });
    }

    const json = await resp.json();
    return jsonResponse(json, 200, { "Set-Cookie": setCookieHeader });
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

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string | undefined>,
): Response {
  const extra = sanitizeHeaders(extraHeaders);
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      ...extra,
    },
  });
}

function sanitizeHeaders(headers?: Record<string, string | undefined>): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

function resolveQuotaCookieName(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_QUOTA_COOKIE_NAME;
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key !== name) continue;
    return pair.slice(idx + 1).trim();
  }
  return null;
}

function toBase64Url(input: Uint8Array): string {
  let binary = "";
  for (const b of input) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array | null {
  if (!input) return null;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function signQuotaPayload(payloadB64: string, secret: string): Promise<string> {
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return toBase64Url(new Uint8Array(signature));
}

async function buildQuotaCookieValue(record: DailyQuotaRecord, secret: string): Promise<string> {
  const payloadJson = JSON.stringify(record);
  const payloadB64 = toBase64Url(new TextEncoder().encode(payloadJson));
  if (!secret) return payloadB64;
  const signature = await signQuotaPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

async function parseQuotaCookieValue(
  rawValue: string | null,
  secret: string,
): Promise<DailyQuotaRecord | null> {
  if (!rawValue) return null;

  let payloadB64 = rawValue;
  if (secret) {
    const dot = rawValue.indexOf(".");
    if (dot === -1) return null;
    payloadB64 = rawValue.slice(0, dot);
    const actualSignature = rawValue.slice(dot + 1);
    const expectedSignature = await signQuotaPayload(payloadB64, secret);
    if (!expectedSignature || actualSignature !== expectedSignature) return null;
  }

  const decoded = fromBase64Url(payloadB64);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded));
    if (
      typeof parsed?.day === "string" &&
      typeof parsed?.count === "number" &&
      Number.isFinite(parsed.count)
    ) {
      return {
        day: parsed.day,
        count: Math.max(0, Math.floor(parsed.count)),
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function readQuotaCookie(
  cookieHeader: string | null,
  cookieName: string,
  secret: string,
): Promise<DailyQuotaRecord | null> {
  const raw = getCookie(cookieHeader, cookieName);
  return parseQuotaCookieValue(raw, secret);
}

async function buildQuotaSetCookieHeader(
  cookieName: string,
  record: DailyQuotaRecord,
  secret: string,
): Promise<string> {
  const value = await buildQuotaCookieValue(record, secret);
  return `${cookieName}=${value}; Path=/api/llm/v1/chat/completions; Max-Age=172800; HttpOnly; SameSite=Lax; Secure`;
}

export const config = { path: "/api/llm/v1/chat/completions" };
