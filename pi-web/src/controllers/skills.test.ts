import { describe, expect, it } from "vitest";
import { BUILTIN_SKILLS, createPromptSkill, findSkillByCommand, type Skill } from "./skills";

describe("findSkillByCommand", () => {
  it("finds built-in skills", () => {
    const skill = findSkillByCommand("/help", []);
    expect(skill?.id).toBe("builtin:help");
  });

  it("matches commands case-insensitively", () => {
    const skill = findSkillByCommand("  /HELP  ", []);
    expect(skill?.id).toBe("builtin:help");
  });

  it("prefers custom skills over built-ins", () => {
    const custom: Skill = {
      id: "custom:help",
      command: "/help",
      name: "自定义帮助",
      description: "覆盖内置命令",
      type: "prompt",
      promptTemplate: "请总结本会话",
      enabled: true,
    };
    const skill = findSkillByCommand("/help", [custom]);
    expect(skill?.id).toBe("custom:help");
  });

  it("ignores disabled skills", () => {
    const custom: Skill = {
      id: "custom:help",
      command: "/help",
      name: "自定义帮助",
      description: "覆盖内置命令",
      type: "prompt",
      promptTemplate: "请总结本会话",
      enabled: false,
    };
    const skill = findSkillByCommand("/help", [custom]);
    expect(skill?.id).toBe("builtin:help");
  });
});

describe("createPromptSkill", () => {
  it("normalizes command to slash-prefixed lowercase", () => {
    const skill = createPromptSkill("  SUMMARIZE  ", "总结", "总结会话", "请总结会话");
    expect(skill.command).toBe("/summarize");
    expect(skill.type).toBe("prompt");
    expect(skill.enabled).toBe(true);
  });

  it("keeps slash commands and trims whitespace", () => {
    const skill = createPromptSkill("  /translate  ", "翻译", "翻译文本", "请翻译以下文本");
    expect(skill.command).toBe("/translate");
  });

  it("keeps built-in list stable", () => {
    expect(BUILTIN_SKILLS.some((skill) => skill.command === "/help")).toBe(true);
  });
});
