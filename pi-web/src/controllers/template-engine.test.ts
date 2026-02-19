import { describe, it, expect } from "vitest";
import {
  applyTemplate,
  extractTemplateVariables,
  buildTemplateContext,
} from "./template-engine";

describe("applyTemplate", () => {
  it("replaces known variables", () => {
    const result = applyTemplate("Hello, {{user}}!", { user: "小明" });
    expect(result).toBe("Hello, 小明!");
  });

  it("replaces multiple variables", () => {
    const result = applyTemplate(
      "{{char}}对{{user}}说：今天是{{date}}",
      { char: "艾莉", user: "小明", date: "2025-01-15" },
    );
    expect(result).toBe("艾莉对小明说：今天是2025-01-15");
  });

  it("leaves unknown variables as-is", () => {
    const result = applyTemplate("Hello, {{unknown}}!", {});
    expect(result).toBe("Hello, {{unknown}}!");
  });

  it("handles null/undefined values by keeping placeholder", () => {
    const result = applyTemplate("{{name}} - {{age}}", { name: null, age: undefined });
    expect(result).toBe("{{name}} - {{age}}");
  });

  it("converts numbers and booleans", () => {
    const result = applyTemplate("Count: {{count}}, Active: {{active}}", { count: 42, active: true });
    expect(result).toBe("Count: 42, Active: true");
  });

  it("returns original if no placeholders", () => {
    expect(applyTemplate("no variables here", {})).toBe("no variables here");
  });

  it("handles empty template", () => {
    expect(applyTemplate("", { user: "test" })).toBe("");
  });
});

describe("extractTemplateVariables", () => {
  it("extracts variable names", () => {
    const vars = extractTemplateVariables("Hello {{user}}, welcome to {{char}}'s world!");
    expect(vars).toContain("user");
    expect(vars).toContain("char");
    expect(vars).toHaveLength(2);
  });

  it("deduplicates", () => {
    const vars = extractTemplateVariables("{{user}} said to {{user}}");
    expect(vars).toEqual(["user"]);
  });

  it("returns empty for no variables", () => {
    expect(extractTemplateVariables("no vars")).toEqual([]);
  });
});

describe("buildTemplateContext", () => {
  it("builds context with character and user info", () => {
    const ctx = buildTemplateContext({
      characterName: "艾莉",
      userName: "小明",
      persona: "一个程序员",
    });
    expect(ctx.characterName).toBe("艾莉");
    expect(ctx.char).toBe("艾莉");
    expect(ctx.user).toBe("小明");
    expect(ctx.persona).toBe("一个程序员");
  });

  it("includes date/time fields", () => {
    const ctx = buildTemplateContext({});
    expect(ctx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ctx.time).toMatch(/^\d{2}:\d{2}$/);
    expect(ctx.year).toMatch(/^\d{4}$/);
  });

  it("uses provided date/time overrides", () => {
    const ctx = buildTemplateContext({ date: "2025-12-25", time: "14:30" });
    expect(ctx.date).toBe("2025-12-25");
    expect(ctx.time).toBe("14:30");
  });
});
