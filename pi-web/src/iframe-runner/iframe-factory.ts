/**
 * Iframe factory — creates message iframes and script iframes.
 */

import { generatePredefineScript, generateAutoResizeScript } from "./predefine";

let _iframeCounter = 0;

function nextIframeId(prefix: string): string {
  return `${prefix}-${++_iframeCounter}-${Date.now().toString(36)}`;
}

/**
 * Create a message iframe for rendering HTML content inside a chat message.
 * Includes predefine script + auto-resize script + the HTML content.
 */
export function createMessageIframe(htmlContent: string): {
  iframe: HTMLIFrameElement;
  id: string;
} {
  const id = nextIframeId("msg-iframe");
  const iframe = document.createElement("iframe");

  iframe.id = id;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
  iframe.style.cssText = "width:100%;border:none;overflow:hidden;display:block;min-height:60px;";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("data-limerence-iframe", "message");

  const srcdoc = buildMessageSrcdoc(id, htmlContent);
  iframe.srcdoc = srcdoc;

  return { iframe, id };
}

/**
 * Create a hidden script iframe for persistent scripts.
 */
export function createScriptIframe(scriptContent: string): {
  iframe: HTMLIFrameElement;
  id: string;
} {
  const id = nextIframeId("script-iframe");
  const iframe = document.createElement("iframe");

  iframe.id = id;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.style.cssText = "display:none;width:0;height:0;border:none;position:absolute;";
  iframe.setAttribute("data-limerence-iframe", "script");

  const srcdoc = buildScriptSrcdoc(id, scriptContent);
  iframe.srcdoc = srcdoc;

  return { iframe, id };
}

function buildMessageSrcdoc(id: string, htmlContent: string): string {
  const predefine = generatePredefineScript(id);
  const autoResize = generateAutoResizeScript(id);

  // If the content is a full HTML document, inject scripts into <head>
  if (htmlContent.toLowerCase().includes("<head>")) {
    return htmlContent.replace(
      /<head>/i,
      `<head><script>${predefine}</script><script>${autoResize}</script>`,
    );
  }

  if (htmlContent.toLowerCase().includes("<head ")) {
    return htmlContent.replace(
      /<head\s/i,
      `<head><script>${predefine}</script><script>${autoResize}</script></head><head `,
    );
  }

  // If it's a full document without explicit <head>, inject after <html>
  if (htmlContent.toLowerCase().includes("<html")) {
    return htmlContent.replace(
      /<html[^>]*>/i,
      `$&<head><script>${predefine}</script><script>${autoResize}</script></head>`,
    );
  }

  // Otherwise wrap in a full document
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>${predefine}</script>
<script>${autoResize}</script>
</head>
<body>${htmlContent}</body>
</html>`;
}

function buildScriptSrcdoc(id: string, scriptContent: string): string {
  const predefine = generatePredefineScript(id);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script>${predefine}</script>
</head>
<body>
<script type="module">${scriptContent}</script>
</body>
</html>`;
}

// ── Parent-side resize listener ──

let _resizeListenerInstalled = false;

export function installResizeListener(): void {
  if (_resizeListenerInstalled) return;
  _resizeListenerInstalled = true;

  window.addEventListener("message", handleResizeMessage);
}

export function uninstallResizeListener(): void {
  if (!_resizeListenerInstalled) return;
  _resizeListenerInstalled = false;

  window.removeEventListener("message", handleResizeMessage);
}

function handleResizeMessage(event: MessageEvent): void {
  if (!event.data || event.data.type !== "limerence-iframe-resize") return;

  const { iframeId, height } = event.data;
  if (!iframeId || typeof height !== "number") return;

  const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
  if (iframe) {
    iframe.style.height = `${height}px`;
  }
}
