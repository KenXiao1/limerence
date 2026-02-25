import { describe, expect, it } from "vitest";
import { getLocaleAfterToggle, getThemeAriaKey } from "./chat-header-controls";

describe("getLocaleAfterToggle", () => {
  it("switches zh to en", () => {
    expect(getLocaleAfterToggle("zh")).toBe("en");
  });

  it("switches en to zh", () => {
    expect(getLocaleAfterToggle("en")).toBe("zh");
  });
});

describe("getThemeAriaKey", () => {
  it("returns light-mode hint when current theme is dark", () => {
    expect(getThemeAriaKey("dark")).toBe("landing.themeLight");
  });

  it("returns dark-mode hint when current theme is light", () => {
    expect(getThemeAriaKey("light")).toBe("landing.themeDark");
  });
});
