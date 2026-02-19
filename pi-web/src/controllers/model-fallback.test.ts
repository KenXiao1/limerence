import { describe, it, expect, vi } from "vitest";
import {
  runWithModelFallback,
  buildFallbackCandidates,
  type FallbackCandidate,
} from "./model-fallback";

describe("runWithModelFallback", () => {
  const primary: FallbackCandidate = { providerId: "openai", modelId: "gpt-4o" };
  const fallback1: FallbackCandidate = { providerId: "anthropic", modelId: "claude-sonnet-4-5" };

  it("succeeds on first try", async () => {
    const fn = vi.fn().mockResolvedValueOnce("ok");
    const result = await runWithModelFallback([primary], fn);
    expect(result.value).toBe("ok");
    expect(result.candidate).toBe(primary);
    expect(result.attempts).toHaveLength(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls back on first failure", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce("ok from fallback");

    const result = await runWithModelFallback([primary, fallback1], fn);
    expect(result.value).toBe("ok from fallback");
    expect(result.candidate).toBe(fallback1);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].provider).toBe("openai");
    expect(result.attempts[0].error).toBe("rate limited");
  });

  it("throws aggregated error when all fail", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("err1"))
      .mockRejectedValueOnce(new Error("err2"));

    await expect(
      runWithModelFallback([primary, fallback1], fn),
    ).rejects.toThrow("All models failed (2)");
  });

  it("re-throws AbortError without fallback", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    await expect(
      runWithModelFallback([primary, fallback1], fn),
    ).rejects.toThrow("Aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runWithModelFallback([primary], vi.fn(), controller.signal),
    ).rejects.toThrow("Aborted");
  });

  it("throws on empty candidates", async () => {
    await expect(
      runWithModelFallback([], vi.fn()),
    ).rejects.toThrow("No model candidates");
  });
});

describe("buildFallbackCandidates", () => {
  it("returns primary alone when no fallbacks", () => {
    const primary: FallbackCandidate = { providerId: "openai", modelId: "gpt-4o" };
    expect(buildFallbackCandidates(primary)).toEqual([primary]);
  });

  it("concatenates primary + fallbacks", () => {
    const primary: FallbackCandidate = { providerId: "openai", modelId: "gpt-4o" };
    const fb: FallbackCandidate = { providerId: "anthropic", modelId: "claude-sonnet-4-5" };
    expect(buildFallbackCandidates(primary, [fb])).toEqual([primary, fb]);
  });
});
