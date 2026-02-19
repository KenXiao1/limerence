import { describe, it, expect } from "vitest";
import { MessageDeduplicator } from "./message-dedup";

describe("MessageDeduplicator", () => {
  it("detects exact duplicate", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("已写入记忆文件：memory/PROFILE.md");
    expect(dedup.isDuplicate("已写入记忆文件：memory/PROFILE.md")).toBe(true);
  });

  it("detects near-duplicate with whitespace differences", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("已写入记忆文件：memory/PROFILE.md");
    expect(dedup.isDuplicate("已写入记忆文件： memory/PROFILE.md ")).toBe(true);
  });

  it("does not false-positive on different text", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("已写入记忆文件：memory/PROFILE.md");
    expect(dedup.isDuplicate("你好，我是AI助手。")).toBe(false);
  });

  it("detects when reply contains tool output as substring", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("搜索结果显示用户喜欢编程和音乐");
    expect(dedup.isDuplicate("根据搜索结果显示用户喜欢编程和音乐，所以我建议")).toBe(true);
  });

  it("filterReply removes duplicate paragraphs", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("已将信息保存到记忆文件中。");

    const reply = "好的，我记住了你的信息。\n\n已将信息保存到记忆文件中。\n\n还有什么需要帮助的吗？";
    const filtered = dedup.filterReply(reply);

    expect(filtered).toContain("好的，我记住了你的信息。");
    expect(filtered).toContain("还有什么需要帮助的吗？");
    expect(filtered).not.toContain("已将信息保存到记忆文件中。");
  });

  it("filterReply returns original if all would be removed", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("已保存");
    const reply = "已保存";
    expect(dedup.filterReply(reply)).toBe("已保存");
  });

  it("reset clears recorded texts", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("test output");
    expect(dedup.recordedCount).toBe(1);
    dedup.reset();
    expect(dedup.recordedCount).toBe(0);
    expect(dedup.isDuplicate("test output")).toBe(false);
  });

  it("handles empty text gracefully", () => {
    const dedup = new MessageDeduplicator();
    dedup.recordToolOutput("");
    expect(dedup.recordedCount).toBe(0);
    expect(dedup.isDuplicate("")).toBe(false);
  });
});
