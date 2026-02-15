/**
 * TavernHelper API bridge — parent-side implementation.
 *
 * Exposes `window.TavernHelper` with an API surface compatible with
 * JS-Slash-Runner's predefine.js expectations. Functions prefixed with `_`
 * are "bind" functions that get `.bind(iframeWindow)` in the predefine script.
 */

import { eventBus, tavern_events, iframe_events } from "./event-bus";
import { getVariables, replaceVariables, insertVariable, deleteVariable } from "./variables";
import { applyTemplateVars } from "../lib/character";
import type { AppState } from "../app-state";

/** Lazy reference to app state — set once during init. */
let _state: AppState | null = null;

export function setTavernBridgeState(s: AppState): void {
  _state = s;
}

// ── Helpers ──

function getMessages(): any[] {
  if (!_state?.agent) return [];
  return _state.agent.state.messages;
}

function toSTMessage(msg: any, index: number): any {
  const role = msg.role ?? "unknown";
  const textBlock = Array.isArray(msg.content)
    ? msg.content.find((b: any) => b?.type === "text")
    : null;
  const text = textBlock?.text ?? (typeof msg.content === "string" ? msg.content : "");

  return {
    message_id: index,
    name: role === "assistant"
      ? (_state?.character?.data.name ?? "Assistant")
      : (_state?.persona?.name ?? "User"),
    role: role === "assistant" ? "assistant" : "user",
    message: text,
    is_user: role === "user",
    is_system: role === "system",
  };
}

// ── TavernHelper object ──

function buildTavernHelper() {
  return {
    // ── Tier 1: Must-have ──

    getChatMessages(range?: { start?: number; end?: number }): any[] {
      const msgs = getMessages();
      const start = range?.start ?? 0;
      const end = range?.end ?? msgs.length;
      return msgs.slice(start, end).map((m, i) => toSTMessage(m, start + i));
    },

    getLastMessageId(): number {
      return Math.max(0, getMessages().length - 1);
    },

    getCurrentCharacterName(): string {
      return _state?.character?.data.name ?? "Assistant";
    },

    getCharacter(type?: string): any {
      if (!_state?.character) return null;
      if (type === "current" || !type) {
        return { ..._state.character.data };
      }
      return null;
    },

    getCharacterNames(): string[] {
      return _state?.characterList?.map((c) => c.name) ?? [];
    },

    // Event constants
    tavern_events,
    iframe_events,

    // ── Bind functions (prefixed with _) ──
    // These get bound to the iframe's window in predefine.ts

    _eventOn(this: Window, event: string, listener: (...args: any[]) => void) {
      return eventBus.on(event, listener, this);
    },

    _eventOnce(this: Window, event: string, listener: (...args: any[]) => void) {
      return eventBus.once(event, listener, this);
    },

    _eventEmit(this: Window, event: string, ...data: any[]) {
      return eventBus.emit(event, ...data);
    },

    _eventRemoveListener(this: Window, event: string, listener: (...args: any[]) => void) {
      eventBus.removeListener(event, listener, this);
    },

    _eventClearAll(this: Window) {
      eventBus.clearAllForWindow(this);
    },

    // Variables
    getVariables,
    replaceVariables,
    insertVariable,
    deleteVariable,

    // Macro substitution
    substitudeMacros(text: string): string {
      const charName = _state?.character?.data.name ?? "Assistant";
      const userName = _state?.persona?.name ?? "用户";
      return applyTemplateVars(text, charName, userName);
    },

    // ── Tier 2: Important ──

    async generate(prompt: string): Promise<void> {
      if (_state?.agent) {
        await _state.agent.prompt(prompt);
      }
    },

    stopAllGeneration(): void {
      _state?.agent?.abort();
    },

    async triggerSlash(command: string): Promise<void> {
      if (!command) return;
      // If it starts with /, strip it and treat as prompt
      const text = command.startsWith("/") ? command : `/${command}`;
      if (_state?.agent) {
        await _state.agent.prompt(text);
      }
    },

    setChatMessage(index: number, messageText: string): void {
      if (!_state?.agent) return;
      const msgs = _state.agent.state.messages;
      if (index < 0 || index >= msgs.length) return;
      const msg = msgs[index];
      if (Array.isArray(msg.content)) {
        const textBlock = msg.content.find((b: any) => b?.type === "text") as { type: "text"; text: string } | undefined;
        if (textBlock) textBlock.text = messageText;
      }
    },

    sendToChatBox(text: string): void {
      if (_state?.chatPanel?.agentInterface) {
        _state.chatPanel.agentInterface.setInput(text);
      }
    },

    formatAsDisplayedMessage(text: string): string {
      // Pi-web's ChatPanel handles markdown rendering internally
      return text;
    },

    getLorebookEntries(): any[] {
      return _state?.lorebookEntries ?? [];
    },

    getTavernRegexes(): any[] {
      return _state?.regexRules ?? [];
    },

    // ── Tier 3: Stubs ──

    audioPlay: () => {},
    audioPause: () => {},
    audioStop: () => {},
    getPreset: () => null,
    loadPreset: () => {},
    injectPrompts: () => {},
    installExtension: () => Promise.resolve(),
    isAdmin: () => false,
    createCharacter: () => Promise.resolve(),
    getWorldbookNames: () => [],
    getWorldbookEntries: () => [],
    setWorldbookEntries: () => {},
    getTokenCount: (text: string) => Math.ceil((text?.length ?? 0) / 4),
  };
}

// ── SillyTavern.getContext() compatibility ──

function buildSTContext() {
  const msgs = getMessages();
  return {
    chat: msgs.map((m, i) => toSTMessage(m, i)),
    name1: _state?.persona?.name ?? "User",
    name2: _state?.character?.data.name ?? "Assistant",
    characterId: _state?.character?.data.name ?? "default",
    chatId: _state?.currentSessionId ?? "",
    eventSource: eventBus,
    eventTypes: tavern_events,
    maxContext: _state?.contextWindow ?? 128000,
    chatMetadata: {},
  };
}

// ── Install / Uninstall ──

let _installed = false;

export function installTavernBridge(): void {
  if (_installed) return;
  _installed = true;

  (window as any).TavernHelper = buildTavernHelper();
  (window as any).__LimerenceSillyTavernContext = buildSTContext;

  // Also provide SillyTavern.getContext() on parent window
  if (!(window as any).SillyTavern) {
    Object.defineProperty(window, "SillyTavern", {
      configurable: true,
      get() {
        return { getContext: buildSTContext };
      },
    });
  }
}

export function uninstallTavernBridge(): void {
  if (!_installed) return;
  _installed = false;

  delete (window as any).TavernHelper;
  delete (window as any).__LimerenceSillyTavernContext;
  delete (window as any).SillyTavern;
}
