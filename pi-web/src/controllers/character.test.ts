import { describe, it, expect } from "vitest";
import { validateCharacterCard } from "./character";

describe("validateCharacterCard", () => {
  it("normalizes SillyTavern v3 cards into v2 shape", () => {
    const input = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Alice",
        description: "desc",
        first_mes: "hello",
        extensions: { source: "st" },
      },
    };

    const result = validateCharacterCard(input);
    expect(result.card).not.toBeNull();
    expect(result.card!.spec).toBe("chara_card_v2");
    expect(result.card!.data.name).toBe("Alice");
    expect(result.card!.data.description).toBe("desc");
    expect(result.card!.data.first_mes).toBe("hello");
    expect(result.card!.data.extensions.source).toBe("st");
  });

  it("uses top-level fields as fallback for v3 cards", () => {
    const input = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      name: "Top Name",
      description: "top description",
      data: {
        name: "",
        description: "",
      },
    };

    const result = validateCharacterCard(input);
    expect(result.card).not.toBeNull();
    expect(result.card!.data.name).toBe("Top Name");
    expect(result.card!.data.description).toBe("top description");
  });

  it("accepts simple top-level card objects", () => {
    const result = validateCharacterCard({
      name: "Simple Card",
      scenario: "test scenario",
    });

    expect(result.card).not.toBeNull();
    expect(result.card!.data.name).toBe("Simple Card");
    expect(result.card!.data.scenario).toBe("test scenario");
  });

  it("returns an error when name is missing", () => {
    const result = validateCharacterCard({
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { description: "no name" },
    });

    expect(result.card).toBeNull();
    expect(result.error).toContain("缺少名字");
  });
});
