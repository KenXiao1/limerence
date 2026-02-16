import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_FREE_MODEL_LIMIT,
  DEFAULT_FREE_MODEL_ID,
  computeQuotaDecision,
  resolveDailyLimit,
  resolveFreeModelId,
  toUtcDayString,
} from "./free-model-quota";

describe("free model quota helpers", () => {
  it("uses expected defaults", () => {
    expect(DEFAULT_FREE_MODEL_ID).toBe("deepseek/deepseek-r1-0528:free");
    expect(DEFAULT_DAILY_FREE_MODEL_LIMIT).toBe(25);
  });

  it("parses daily limit from env", () => {
    expect(resolveDailyLimit("50")).toBe(50);
    expect(resolveDailyLimit("0")).toBe(0);
    expect(resolveDailyLimit("-3")).toBe(DEFAULT_DAILY_FREE_MODEL_LIMIT);
    expect(resolveDailyLimit("abc")).toBe(DEFAULT_DAILY_FREE_MODEL_LIMIT);
    expect(resolveDailyLimit(undefined)).toBe(DEFAULT_DAILY_FREE_MODEL_LIMIT);
  });

  it("resolves free model id from env", () => {
    expect(resolveFreeModelId("custom-model")).toBe("custom-model");
    expect(resolveFreeModelId("   ")).toBe(DEFAULT_FREE_MODEL_ID);
    expect(resolveFreeModelId(undefined)).toBe(DEFAULT_FREE_MODEL_ID);
  });

  it("formats UTC day string", () => {
    const now = new Date("2026-02-16T23:59:59.999Z");
    expect(toUtcDayString(now)).toBe("2026-02-16");
  });

  it("increments quota count when below limit", () => {
    const now = new Date("2026-02-16T10:00:00.000Z");
    const decision = computeQuotaDecision({ day: "2026-02-16", count: 3 }, now, 25);
    expect(decision.allowed).toBe(true);
    expect(decision.next.day).toBe("2026-02-16");
    expect(decision.next.count).toBe(4);
    expect(decision.remaining).toBe(21);
  });

  it("resets quota count on a new day", () => {
    const now = new Date("2026-02-17T00:00:00.000Z");
    const decision = computeQuotaDecision({ day: "2026-02-16", count: 25 }, now, 25);
    expect(decision.allowed).toBe(true);
    expect(decision.next.day).toBe("2026-02-17");
    expect(decision.next.count).toBe(1);
    expect(decision.remaining).toBe(24);
  });

  it("rejects request when daily limit is reached", () => {
    const now = new Date("2026-02-16T11:00:00.000Z");
    const decision = computeQuotaDecision({ day: "2026-02-16", count: 25 }, now, 25);
    expect(decision.allowed).toBe(false);
    expect(decision.next.day).toBe("2026-02-16");
    expect(decision.next.count).toBe(25);
    expect(decision.remaining).toBe(0);
  });
});
