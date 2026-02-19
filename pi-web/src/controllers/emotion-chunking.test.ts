import { describe, it, expect } from "vitest";
import {
  extractEmotionTag,
  inferEmotion,
  getEmotionChunkerConfig,
  getEmotionBubbleDelay,
  getEmotionLabel,
} from "./emotion-chunking";

describe("extractEmotionTag", () => {
  it("extracts [emotion:excited] tag", () => {
    const result = extractEmotionTag("[emotion:excited] 太棒了！");
    expect(result).not.toBeNull();
    expect(result!.emotion).toBe("excited");
    expect(result!.text).toBe("太棒了！");
  });

  it("extracts [mood:calm] tag", () => {
    const result = extractEmotionTag("[mood:calm] 让我想想。");
    expect(result).not.toBeNull();
    expect(result!.emotion).toBe("calm");
    expect(result!.text).toBe("让我想想。");
  });

  it("is case-insensitive", () => {
    const result = extractEmotionTag("[Emotion:EXCITED] Wow!");
    expect(result).not.toBeNull();
    expect(result!.emotion).toBe("excited");
  });

  it("normalizes synonym tags", () => {
    const result = extractEmotionTag("[emotion:enthusiastic] Yay!");
    expect(result).not.toBeNull();
    expect(result!.emotion).toBe("excited");
  });

  it("returns null when no tag present", () => {
    expect(extractEmotionTag("Hello world")).toBeNull();
  });

  it("returns neutral for unknown tags", () => {
    const result = extractEmotionTag("[emotion:unknowntag] text");
    expect(result).not.toBeNull();
    expect(result!.emotion).toBe("neutral");
  });
});

describe("inferEmotion", () => {
  it("detects excited from exclamation marks", () => {
    expect(inferEmotion("太棒了！真的吗！太好了！")).toBe("excited");
  });

  it("detects hesitant from question marks", () => {
    expect(inferEmotion("真的吗？你确定？这样好吗？")).toBe("hesitant");
  });

  it("returns neutral for empty text", () => {
    expect(inferEmotion("")).toBe("neutral");
  });

  it("returns neutral for balanced text", () => {
    expect(inferEmotion("今天天气不错，我们去散步吧。")).toBe("neutral");
  });
});

describe("getEmotionChunkerConfig", () => {
  it("excited has small minChars", () => {
    const config = getEmotionChunkerConfig("excited");
    expect(config.minChars).toBeLessThan(50);
    expect(config.flushOnParagraph).toBe(true);
  });

  it("calm has large minChars", () => {
    const config = getEmotionChunkerConfig("calm");
    expect(config.minChars).toBeGreaterThan(100);
    expect(config.flushOnParagraph).toBe(false);
  });
});

describe("getEmotionBubbleDelay", () => {
  it("excited has short delay", () => {
    expect(getEmotionBubbleDelay("excited")).toBeLessThan(200);
  });

  it("hesitant has long delay", () => {
    expect(getEmotionBubbleDelay("hesitant")).toBeGreaterThan(500);
  });
});

describe("getEmotionLabel", () => {
  it("returns Chinese label", () => {
    expect(getEmotionLabel("excited")).toBe("兴奋");
    expect(getEmotionLabel("calm")).toBe("平静");
  });
});
