import { describe, expect, it } from "vitest";
import { parseSlashCommand } from "./slash-commands";
import type { Skill } from "./skills";

describe("parseSlashCommand", () => {
  it("returns null for non-commands", () => {
    expect(parseSlashCommand("hello", [])).toBeNull();
  });

  it("supports built-in alias commands", () => {
    expect(parseSlashCommand("/abort", [])).toEqual({ type: "stop" });
    expect(parseSlashCommand("/reset", [])).toEqual({ type: "new" });
    expect(parseSlashCommand("/regen", [])).toEqual({ type: "retry" });
    expect(parseSlashCommand("/?", [])?.type).toBe("help");
  });

  it("returns prompt command for custom prompt skills", () => {
    const custom: Skill = {
      id: "custom:summarize",
      command: "/summarize",
      name: "总结",
      description: "总结当前会话",
      type: "prompt",
      promptTemplate: "请总结上文要点。",
      enabled: true,
    };
    expect(parseSlashCommand("/summarize", [custom])).toEqual({
      type: "prompt",
      command: "/summarize",
      promptTemplate: "请总结上文要点。",
    });
  });

  it("prefers custom skills for built-in command names", () => {
    const custom: Skill = {
      id: "custom:help",
      command: "/help",
      name: "帮助改写",
      description: "覆盖内置 /help",
      type: "prompt",
      promptTemplate: "列出团队自定义命令",
      enabled: true,
    };
    expect(parseSlashCommand("/help", [custom])).toEqual({
      type: "prompt",
      command: "/help",
      promptTemplate: "列出团队自定义命令",
    });
  });
});
