/**
 * Detect whether a string contains HTML frontend content.
 * Ported from JS-Slash-Runner/src/util/is_frontend.ts.
 */

/**
 * Returns true if the content looks like an HTML document/fragment
 * that should be rendered in an iframe rather than displayed as text.
 */
export function isFrontend(content: string): boolean {
  if (!content || typeof content !== "string") return false;

  const lower = content.toLowerCase();

  // Check for common HTML document markers
  if (lower.includes("<!doctype html")) return true;
  if (lower.includes("<html")) return true;
  if (lower.includes("<head>") || lower.includes("<head ")) return true;
  if (lower.includes("<body>") || lower.includes("<body ")) return true;

  // Check for substantial HTML structure (not just inline tags)
  if (lower.includes("<style>") || lower.includes("<style ")) {
    if (lower.includes("<div") || lower.includes("<span") || lower.includes("<script")) {
      return true;
    }
  }

  return false;
}

/**
 * Strip markdown code fence wrappers (```text ... ```) from content.
 * SillyTavern regex_scripts often wrap HTML in code fences.
 */
export function stripCodeFence(content: string): string {
  // Match opening fence: ```text, ```html, ``` etc.
  const fenceStart = /^```\w*\s*\n/;
  // Match closing fence
  const fenceEnd = /\n```\s*$/;

  let result = content;
  if (fenceStart.test(result)) {
    result = result.replace(fenceStart, "");
  }
  if (fenceEnd.test(result)) {
    result = result.replace(fenceEnd, "");
  }
  return result;
}
