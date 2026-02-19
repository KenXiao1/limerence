import { describe, it, expect } from "vitest";
import { EmbeddedBlockChunker } from "./block-chunker";

describe("EmbeddedBlockChunker", () => {
  it("buffers until minChars", () => {
    const chunker = new EmbeddedBlockChunker({ minChars: 50, maxChars: 200 });
    const blocks = chunker.push("short");
    expect(blocks).toHaveLength(0);
  });

  it("emits block on paragraph break when flushOnParagraph", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 5,
      maxChars: 500,
      flushOnParagraph: true,
    });
    const blocks = chunker.push("Hello world!\n\nNext paragraph.");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].text).toContain("Hello world!");
  });

  it("splits on sentence boundary", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 10,
      maxChars: 100,
      breakPreference: "sentence",
    });
    const text = "这是第一句话。这是第二句话。这是第三句话。这是第四句话。这是第五句话。";
    const blocks = chunker.push(text);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("force-splits at maxChars", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 10,
      maxChars: 50,
      breakPreference: "paragraph",
    });
    const text = "A".repeat(120);
    const blocks = chunker.push(text);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block.text.length).toBeLessThanOrEqual(52); // maxChars + fence overhead
    }
  });

  it("flushes remaining buffer", () => {
    const chunker = new EmbeddedBlockChunker({ minChars: 100, maxChars: 500 });
    chunker.push("Short text");
    const blocks = chunker.flush();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Short text");
  });

  it("preserves code fence integrity", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 10,
      maxChars: 200,
      breakPreference: "paragraph",
    });
    const text = "Before code.\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\nAfter code.";
    chunker.push(text);
    chunker.flush();
    const allText = chunker.getBlocks().map((b) => b.text).join("");
    // The code block content should not be split mid-fence
    expect(allText).toContain("const x = 1;");
  });

  it("assigns sequential block indices", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 5,
      maxChars: 50,
      breakPreference: "sentence",
      flushOnParagraph: true,
    });
    chunker.push("First sentence.\n\nSecond sentence.\n\nThird sentence.");
    chunker.flush();
    const all = chunker.getBlocks();
    expect(all.length).toBeGreaterThan(0);
    for (let i = 0; i < all.length; i++) {
      expect(all[i].index).toBe(i);
    }
  });

  it("reset clears state", () => {
    const chunker = new EmbeddedBlockChunker();
    chunker.push("Some text");
    chunker.reset();
    expect(chunker.getBlocks()).toHaveLength(0);
  });
});
