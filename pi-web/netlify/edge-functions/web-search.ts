import type { Context } from "https://edge.netlify.com";

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) {
    return jsonResponse({ error: "Missing query parameter 'q'" }, 400);
  }

  try {
    const encoded = encodeURIComponent(query).replace(/%20/g, "+");
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

    const resp = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!resp.ok) {
      return jsonResponse({ error: `DuckDuckGo returned ${resp.status}` }, 502);
    }

    const html = await resp.text();
    const results = parseDdgHtml(html);

    return jsonResponse({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
}

function parseDdgHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  let pos = 0;

  while (results.length < 5) {
    const marker = 'class="result__a"';
    const idx = html.indexOf(marker, pos);
    if (idx === -1) break;

    const hrefStart = html.lastIndexOf('href="', idx);
    let href = "";
    if (hrefStart !== -1) {
      const hs = hrefStart + 6;
      const he = html.indexOf('"', hs);
      if (he !== -1) {
        const raw = html.slice(hs, he);
        const uddg = raw.indexOf("uddg=");
        if (uddg !== -1) {
          const encoded = raw.slice(uddg + 5);
          const end = encoded.indexOf("&");
          href = decodeURIComponent((end !== -1 ? encoded.slice(0, end) : encoded).replace(/\+/g, " "));
        } else {
          href = raw;
        }
      }
    }

    let title = "";
    const tagEnd = html.indexOf(">", idx);
    if (tagEnd !== -1) {
      const textStart = tagEnd + 1;
      const textEnd = html.indexOf("</a>", textStart);
      if (textEnd !== -1) {
        title = stripHtmlTags(html.slice(textStart, textEnd)).trim();
      }
    }

    let snippet = "";
    const snippetMarker = 'class="result__snippet"';
    const ss = html.indexOf(snippetMarker, idx);
    if (ss !== -1) {
      const sTagEnd = html.indexOf(">", ss);
      if (sTagEnd !== -1) {
        const sTextStart = sTagEnd + 1;
        const sTextEnd = html.indexOf("</", sTextStart);
        if (sTextEnd !== -1) {
          snippet = stripHtmlTags(html.slice(sTextStart, sTextEnd)).trim();
        }
      }
    }

    if (title) {
      results.push({ title, url: href, snippet });
    }

    pos = idx + 1;
  }

  return results;
}

function stripHtmlTags(s: string): string {
  let result = "";
  let inTag = false;

  for (const ch of s) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) result += ch;
  }

  return result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

export const config = { path: "/api/web-search" };
