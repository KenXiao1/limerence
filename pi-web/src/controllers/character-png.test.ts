import { describe, it, expect } from "vitest";
import { readCharaFromPng } from "./character-png";

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  return out;
}

function encodeBase64Json(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function makeTextChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);
  return makeChunk("tEXt", data);
}

function makeITextChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const data = new Uint8Array(keywordBytes.length + 5 + textBytes.length);
  let offset = 0;
  data.set(keywordBytes, offset);
  offset += keywordBytes.length;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data.set(textBytes, offset);
  return makeChunk("iTXt", data);
}

function makePngFile(textChunks: Uint8Array[]): File {
  const iend = makeChunk("IEND", new Uint8Array());
  const bytes = concatBytes([PNG_SIG, ...textChunks, iend]);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new File([arrayBuffer], "card.png", { type: "image/png" });
}

describe("readCharaFromPng", () => {
  it("prefers ccv3 over chara when both exist", async () => {
    const chara = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "V2 Card" },
    };
    const ccv3 = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "V3 Card" },
    };

    const file = makePngFile([
      makeTextChunk("chara", encodeBase64Json(chara)),
      makeTextChunk("ccv3", encodeBase64Json(ccv3)),
    ]);

    const parsed = await readCharaFromPng(file) as any;
    expect(parsed?.data?.name).toBe("V3 Card");
  });

  it("falls back to chara when ccv3 is invalid", async () => {
    const chara = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "Fallback Card" },
    };
    const file = makePngFile([
      makeTextChunk("chara", encodeBase64Json(chara)),
      makeTextChunk("ccv3", "***not-base64***"),
    ]);

    const parsed = await readCharaFromPng(file) as any;
    expect(parsed?.data?.name).toBe("Fallback Card");
  });

  it("supports large card payloads without argument spread overflow", async () => {
    const longMessage = "x".repeat(180000);
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "Large Card", first_mes: longMessage },
    };
    const file = makePngFile([
      makeTextChunk("CCV3", encodeBase64Json(card)),
    ]);

    const parsed = await readCharaFromPng(file) as any;
    expect(parsed?.data?.name).toBe("Large Card");
    expect(parsed?.data?.first_mes?.length).toBe(longMessage.length);
  });

  it("parses url-safe base64 payloads", async () => {
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "Url Safe Card" },
    };
    const urlSafe = encodeBase64Json(card)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const file = makePngFile([makeTextChunk("chara", urlSafe)]);

    const parsed = await readCharaFromPng(file) as any;
    expect(parsed?.data?.name).toBe("Url Safe Card");
  });

  it("parses iTXt chunks", async () => {
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "iTXt Card" },
    };
    const file = makePngFile([makeITextChunk("ccv3", encodeBase64Json(card))]);

    const parsed = await readCharaFromPng(file) as any;
    expect(parsed?.data?.name).toBe("iTXt Card");
  });
});
