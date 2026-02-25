import { describe, expect, it } from "vitest";
import en from "./i18n/en";
import zh from "./i18n/zh";

const CHAT_UI_KEYS = [
  "chat.currentCharacter",
  "chat.provider",
  "chat.providerDefault",
  "chat.modelPlaceholder",
  "chat.thinkingLevel",
  "chat.thinking.off",
  "chat.thinking.low",
  "chat.thinking.medium",
  "chat.thinking.high",
  "chat.newChat",
  "chat.archive",
  "chat.delete",
  "chat.emptyTitle",
  "chat.emptyDesc",
  "chat.generateFailed",
  "chat.inputPlaceholder",
] as const;

describe("chat UI i18n keys", () => {
  it("exists in zh dictionary", () => {
    for (const key of CHAT_UI_KEYS) {
      expect(zh).toHaveProperty(key);
    }
  });

  it("exists in en dictionary", () => {
    for (const key of CHAT_UI_KEYS) {
      expect(en).toHaveProperty(key);
    }
  });
});
