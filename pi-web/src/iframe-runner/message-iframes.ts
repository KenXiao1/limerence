/**
 * Message-level iframe lifecycle management.
 *
 * Watches the ChatPanel DOM for new assistant messages, applies regex_scripts,
 * and injects iframes when the replacement content is detected as HTML frontend.
 */

import type { RegexScriptData } from "./types";
import { PLACEMENT } from "./types";
import { isFrontend, stripCodeFence } from "./frontend-detect";
import { createMessageIframe, installResizeListener } from "./iframe-factory";

/** Map of message index → iframe element (for cleanup). */
const _activeIframes = new Map<number, HTMLIFrameElement>();

/** MutationObserver watching the ChatPanel message container. */
let _observer: MutationObserver | null = null;

/** Current regex scripts to apply. */
let _regexScripts: RegexScriptData[] = [];

/** Last known full message list (for raw index -> rendered index mapping). */
let _latestMessages: any[] = [];

/** Selector for the ChatPanel's message list container. */
const CHAT_CONTAINER_SELECTOR = "pi-chat-panel";

// ── Public API ──

/**
 * Set the active regex scripts for message processing.
 */
export function setRegexScripts(scripts: RegexScriptData[]): void {
  _regexScripts = scripts;
}

/**
 * Start observing the ChatPanel DOM for new messages.
 */
export function startMessageObserver(): void {
  if (_observer) return;
  installResizeListener();

  // Use a short delay to ensure ChatPanel is mounted
  requestAnimationFrame(() => {
    tryAttachObserver();
  });
}

/**
 * Stop observing and destroy all message iframes.
 */
export function stopMessageObserver(): void {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  destroyAllMessageIframes();
}

/**
 * Process a single message after it's rendered.
 * Called from the agent event bridge when a message_end event fires.
 */
export function processRenderedMessage(
  messageIndex: number,
  role: string,
  originalText: string,
  messages?: any[],
): void {
  if (role !== "assistant") return;
  if (_regexScripts.length === 0) return;

  if (Array.isArray(messages)) {
    _latestMessages = messages;
  }

  const depth = computeDepth(messageIndex, _latestMessages);
  const htmlContent = applyRegexScriptsToText(originalText, depth);
  if (!htmlContent) return;

  // Wait for DOM to update, then inject iframe
  requestAnimationFrame(() => {
    setTimeout(() => injectIframeForMessage(messageIndex, htmlContent), 50);
  });
}

/**
 * Destroy iframe for a specific message (e.g., on delete/swipe).
 */
export function destroyMessageIframe(messageIndex: number): void {
  const iframe = _activeIframes.get(messageIndex);
  if (iframe) {
    iframe.remove();
    _activeIframes.delete(messageIndex);
  }
}

/**
 * Re-process all visible messages (e.g., after loading a session).
 */
export function reprocessAllMessages(messages: any[]): void {
  if (_regexScripts.length === 0) return;

  _latestMessages = messages;
  destroyAllMessageIframes();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const textBlock = Array.isArray(msg.content)
      ? msg.content.find((b: any) => b?.type === "text")
      : null;
    const text = textBlock?.text ?? "";
    if (!text) continue;

    const depth = Math.max(0, messages.length - 1 - i);
    const htmlContent = applyRegexScriptsToText(text, depth);
    if (htmlContent) {
      // Delay to allow DOM rendering
      setTimeout(() => injectIframeForMessage(i, htmlContent), 100 + i * 20);
    }
  }
}

// ── Internal ──

function applyRegexScriptsToText(text: string, depth?: number): string | null {
  let result = text;
  let matched = false;

  for (const script of _regexScripts) {
    // Only apply scripts targeting AI output
    if (!script.placement.includes(PLACEMENT.AI_OUTPUT)) continue;
    // Display-side rendering should not apply prompt-only scripts.
    if (script.promptOnly) continue;
    if (!isDepthAllowed(script, depth)) continue;

    const regex = regexFromString(script.findRegex);
    if (!regex) {
      console.warn(`[iframe-runner] Invalid regex in script "${script.scriptName}"`);
      continue;
    }

    if (regex.global || regex.sticky) {
      regex.lastIndex = 0;
    }
    if (!regex.test(result)) {
      continue;
    }
    if (regex.global || regex.sticky) {
      regex.lastIndex = 0;
    }

    result = runRegexScriptLikeSillyTavern(script, result, regex);
    matched = true;
  }

  if (!matched) return null;

  // Strip code fence wrappers if present
  result = stripCodeFence(result.trim());

  // Check if the result is HTML frontend content
  if (!isFrontend(result)) return null;

  return result;
}

function runRegexScriptLikeSillyTavern(script: RegexScriptData, text: string, regex: RegExp): string {
  const replaceString = String(script.replaceString ?? "").replace(/\{\{match\}\}/gi, "$0");
  return text.replace(regex, (...args: any[]) => {
    const rawMatch = String(args[0] ?? "");
    const namedGroups = (
      args.length > 0 && typeof args[args.length - 1] === "object"
        ? args[args.length - 1]
        : undefined
    ) as Record<string, string> | undefined;

    const replacedGroups = replaceString.replace(/\$(\d+)|\$<([^>]+)>/g, (_whole, num, groupName) => {
      const captured = num ? args[Number(num)] : namedGroups?.[groupName];
      if (typeof captured !== "string") return "";
      return applyTrimStrings(captured, script.trimStrings);
    });

    return replacedGroups.replace(/\$0/g, applyTrimStrings(rawMatch, script.trimStrings));
  });
}

function applyTrimStrings(value: string, trimStrings?: string[]): string {
  if (!Array.isArray(trimStrings) || trimStrings.length === 0) return value;
  let result = value;
  for (const trim of trimStrings) {
    if (!trim) continue;
    result = result.split(trim).join("");
  }
  return result;
}

function regexFromString(input: string): RegExp | null {
  try {
    // Compatible with SillyTavern's regexFromString utility.
    const m = input.match(/(\/?)(.+)\1([a-z]*)/i);
    if (!m) return null;

    const flags = m[3] ?? "";
    if (flags && !/^(?!.*?(.).*?\1)[dgimsuvy]+$/.test(flags)) {
      return new RegExp(input);
    }

    return new RegExp(m[2], flags);
  } catch {
    return null;
  }
}

function isDepthAllowed(script: RegexScriptData, depth?: number): boolean {
  if (typeof depth !== "number") return true;
  const min = typeof script.minDepth === "number" && Number.isFinite(script.minDepth) ? script.minDepth : null;
  const max = typeof script.maxDepth === "number" && Number.isFinite(script.maxDepth) ? script.maxDepth : null;

  if (min !== null && min >= -1 && depth < min) return false;
  if (max !== null && max >= 0 && depth > max) return false;
  return true;
}

function computeDepth(messageIndex: number, messages: any[]): number | undefined {
  if (!Array.isArray(messages) || messages.length === 0) return undefined;
  if (!Number.isInteger(messageIndex) || messageIndex < 0 || messageIndex >= messages.length) return undefined;
  return Math.max(0, messages.length - 1 - messageIndex);
}

function injectIframeForMessage(messageIndex: number, htmlContent: string): void {
  // Find the message element in the DOM
  const msgEl = findMessageElement(messageIndex);
  if (!msgEl) return;

  // Don't inject twice
  if (_activeIframes.has(messageIndex)) return;

  // Find the text content container within the message
  const contentEl = findContentElement(msgEl);
  if (!contentEl) return;

  // Create iframe
  const { iframe } = createMessageIframe(htmlContent);

  // Create a wrapper div
  const wrapper = document.createElement("div");
  wrapper.className = "limerence-iframe-wrapper";
  wrapper.setAttribute("data-iframe-message", String(messageIndex));
  wrapper.appendChild(iframe);

  // Hide original text content and insert iframe
  const originalDisplay = contentEl.style.display;
  contentEl.style.display = "none";
  contentEl.setAttribute("data-original-display", originalDisplay || "");
  contentEl.parentElement?.insertBefore(wrapper, contentEl.nextSibling);

  _activeIframes.set(messageIndex, iframe);
}

function findMessageElement(index: number): Element | null {
  // Try data-message-index attribute first
  const byAttr = document.querySelector(`[data-message-index="${index}"]`);
  if (byAttr) return byAttr;

  // Fallback: find all message elements and index into them
  const chatPanel = document.querySelector(CHAT_CONTAINER_SELECTOR);
  if (!chatPanel) return null;

  // Look inside shadow DOM if needed
  const root = chatPanel.shadowRoot ?? chatPanel;
  const renderIndex = toRenderedMessageIndex(index, _latestMessages) ?? index;

  const messageListRoot = root.querySelector("message-list") ?? root;
  const visibleMessages = messageListRoot.querySelectorAll("assistant-message, user-message, [data-message-index]");
  if (visibleMessages.length > renderIndex) return visibleMessages[renderIndex];

  // Fallback for unknown host layouts
  const fallback = root.querySelectorAll(".message, [class*='message']");
  if (fallback.length > renderIndex) return fallback[renderIndex];

  return null;
}

function toRenderedMessageIndex(rawIndex: number, messages: any[]): number | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const clamped = Math.min(Math.max(rawIndex, 0), messages.length - 1);

  let rendered = -1;
  for (let i = 0; i <= clamped; i++) {
    const role = messages[i]?.role;
    if (role === "assistant" || role === "user" || role === "user-with-attachments") {
      rendered++;
    }
  }

  return rendered >= 0 ? rendered : null;
}

function findContentElement(msgEl: Element): HTMLElement | null {
  // Look for common content containers
  const selectors = [
    ".message-content",
    ".markdown-content",
    "[class*='content']",
    ".text",
    "p",
  ];

  for (const sel of selectors) {
    const el = msgEl.querySelector(sel) as HTMLElement;
    if (el) return el;
  }

  // Fallback: use the message element itself if it has text content
  if (msgEl instanceof HTMLElement && msgEl.textContent?.trim()) {
    return msgEl;
  }

  return null;
}

function destroyAllMessageIframes(): void {
  for (const [index, iframe] of _activeIframes) {
    // Restore original content visibility
    const wrapper = iframe.parentElement;
    if (wrapper) {
      const prev = wrapper.previousElementSibling as HTMLElement;
      if (prev?.hasAttribute("data-original-display")) {
        prev.style.display = prev.getAttribute("data-original-display") || "";
        prev.removeAttribute("data-original-display");
      }
      wrapper.remove();
    }
    _activeIframes.delete(index);
  }
}

function tryAttachObserver(): void {
  // Find the chat panel's message container
  const chatPanel = document.querySelector(CHAT_CONTAINER_SELECTOR);
  if (!chatPanel) {
    // Retry after a short delay
    setTimeout(tryAttachObserver, 500);
    return;
  }

  const root = chatPanel.shadowRoot ?? chatPanel;

  _observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        // Check if this is a new message element
        handleNewMessageNode(node);
      }
    }
  });

  _observer.observe(root, { childList: true, subtree: true });
}

function handleNewMessageNode(node: HTMLElement): void {
  // This is a fallback mechanism — primary injection happens via processRenderedMessage.
  // The observer catches cases where messages are rendered asynchronously.
  const indexAttr = node.getAttribute?.("data-message-index");
  if (indexAttr != null) {
    const index = parseInt(indexAttr, 10);
    if (!isNaN(index) && !_activeIframes.has(index)) {
      // Check if this message needs iframe injection
      // (already processed messages will have been handled by processRenderedMessage)
    }
  }
}
