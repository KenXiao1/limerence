/**
 * PNG tEXt chunk codec for SillyTavern character cards.
 * Pure functions, zero dependencies — browser native APIs only.
 */

// ── CRC32 (PNG standard polynomial) ────────────────────────────

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Uint8Array, start = 0, end = buf.length): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG signature ──────────────────────────────────────────────

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const utf8Decoder = new TextDecoder("utf-8");

function isPng(buf: Uint8Array): boolean {
  if (buf.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) return false;
  }
  return true;
}

// ── Chunk helpers ──────────────────────────────────────────────

interface PngChunk {
  type: string;
  data: Uint8Array;
}

function readChunks(buf: Uint8Array): PngChunk[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const chunks: PngChunk[] = [];
  let offset = 8; // skip PNG signature
  while (offset + 12 <= buf.length) {
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buf.length) break;
    const typeBytes = buf.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset = chunkEnd; // 4 length + 4 type + data + 4 crc
    if (type === "IEND") break;
  }
  return chunks;
}

function buildChunkBytes(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const buf = new Uint8Array(12 + len);
  const view = new DataView(buf.buffer);
  view.setUint32(0, len);
  // type bytes
  for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
  buf.set(data, 8);
  // CRC covers type + data
  const crc = crc32(buf, 4, 8 + len);
  view.setUint32(8 + len, crc);
  return buf;
}

// ── Public API ─────────────────────────────────────────────────

function decodeLatin1(bytes: Uint8Array): string {
  let out = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

function decodeBase64Json(base64Text: string): unknown | null {
  const normalized = base64Text
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (!normalized) return null;
  const padLength = normalized.length % 4;
  const padded = padLength === 0 ? normalized : `${normalized}${"=".repeat(4 - padLength)}`;
  try {
    const decoded = atob(padded);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    const json = utf8Decoder.decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseTextChunkKeyword(data: Uint8Array): string | null {
  const nullIdx = data.indexOf(0);
  if (nullIdx <= 0) return null;
  return decodeLatin1(data.subarray(0, nullIdx));
}

async function inflateDeflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate"));
    const inflated = await new Response(stream).arrayBuffer();
    return new Uint8Array(inflated);
  } catch {
    return null;
  }
}

async function parseTextChunk(chunk: PngChunk): Promise<{ keyword: string; text: string } | null> {
  if (chunk.type === "tEXt") {
    const keyword = parseTextChunkKeyword(chunk.data);
    if (!keyword) return null;
    return {
      keyword,
      text: decodeLatin1(chunk.data.subarray(keyword.length + 1)),
    };
  }

  if (chunk.type === "zTXt") {
    const keyword = parseTextChunkKeyword(chunk.data);
    if (!keyword) return null;
    const separator = keyword.length;
    const compressionMethod = chunk.data[separator + 1];
    if (compressionMethod !== 0) return null;
    const compressed = chunk.data.subarray(separator + 2);
    const inflated = await inflateDeflate(compressed);
    if (!inflated) return null;
    return {
      keyword,
      text: decodeLatin1(inflated),
    };
  }

  if (chunk.type === "iTXt") {
    const keyword = parseTextChunkKeyword(chunk.data);
    if (!keyword) return null;
    let offset = keyword.length + 1;
    if (offset + 2 > chunk.data.length) return null;
    const compressionFlag = chunk.data[offset];
    const compressionMethod = chunk.data[offset + 1];
    offset += 2;

    const languageEnd = chunk.data.indexOf(0, offset);
    if (languageEnd < 0) return null;
    offset = languageEnd + 1;

    const translatedEnd = chunk.data.indexOf(0, offset);
    if (translatedEnd < 0) return null;
    offset = translatedEnd + 1;

    const textBytes = chunk.data.subarray(offset);
    if (compressionFlag === 1) {
      if (compressionMethod !== 0) return null;
      const inflated = await inflateDeflate(textBytes);
      if (!inflated) return null;
      return { keyword, text: utf8Decoder.decode(inflated) };
    }

    return { keyword, text: utf8Decoder.decode(textBytes) };
  }

  return null;
}

/**
 * Extract character card JSON from a PNG file's text chunks.
 * Supports both V2 (`chara`) and V3 (`ccv3`) keywords; V3 takes precedence.
 */
export async function readCharaFromPng(file: File): Promise<unknown | null> {
  const arrayBuf = await file.arrayBuffer();
  const buf = new Uint8Array(arrayBuf);
  if (!isPng(buf)) return null;

  const chunks = readChunks(buf);
  let v2Card: unknown | null = null;
  let v3Card: unknown | null = null;

  for (const chunk of chunks) {
    if (chunk.type !== "tEXt" && chunk.type !== "zTXt" && chunk.type !== "iTXt") continue;
    const parsed = await parseTextChunk(chunk);
    if (!parsed) continue;
    const keyword = parsed.keyword.toLowerCase();
    if (keyword !== "chara" && keyword !== "ccv3") continue;
    const parsedCard = decodeBase64Json(parsed.text);
    if (parsedCard == null) continue;
    if (keyword === "ccv3") v3Card = parsedCard;
    else if (v2Card == null) v2Card = parsedCard;
  }

  return v3Card ?? v2Card;
}

/**
 * Embed character card JSON into a PNG image as a `tEXt` chunk (keyword "chara").
 * Removes any existing chara/ccv3 text chunks first.
 */
export async function writeCharaToPng(card: unknown, imageSource: Blob): Promise<Blob> {
  const arrayBuf = await imageSource.arrayBuffer();
  const buf = new Uint8Array(arrayBuf);
  if (!isPng(buf)) throw new Error("Not a valid PNG");

  const chunks = readChunks(buf);

  // Filter out existing chara/ccv3 text chunks
  const filtered = chunks.filter((c) => {
    if (c.type !== "tEXt" && c.type !== "zTXt" && c.type !== "iTXt") return true;
    const keyword = parseTextChunkKeyword(c.data);
    if (!keyword) return true;
    const normalizedKeyword = keyword.toLowerCase();
    return normalizedKeyword !== "chara" && normalizedKeyword !== "ccv3";
  });

  // Build new tEXt chunk: "chara\0<base64>"
  const jsonStr = JSON.stringify(card);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  // btoa needs a binary string
  let binaryStr = "";
  for (let i = 0; i < jsonBytes.length; i++) binaryStr += String.fromCharCode(jsonBytes[i]);
  const base64 = btoa(binaryStr);

  const keyword = "chara";
  const textData = new Uint8Array(keyword.length + 1 + base64.length);
  for (let i = 0; i < keyword.length; i++) textData[i] = keyword.charCodeAt(i);
  textData[keyword.length] = 0; // null separator
  for (let i = 0; i < base64.length; i++) textData[keyword.length + 1 + i] = base64.charCodeAt(i);

  const newChunkBytes = buildChunkBytes("tEXt", textData);

  // Reassemble: PNG sig + all chunks except IEND + new tEXt + IEND
  const iend = filtered.find((c) => c.type === "IEND");
  const nonIend = filtered.filter((c) => c.type !== "IEND");

  const parts: Uint8Array[] = [PNG_SIG];
  for (const c of nonIend) parts.push(buildChunkBytes(c.type, c.data));
  parts.push(newChunkBytes);
  if (iend) parts.push(buildChunkBytes(iend.type, iend.data));

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }

  return new Blob([result], { type: "image/png" });
}

/**
 * Generate a 256×256 placeholder PNG with a color derived from the character name.
 */
export async function generatePlaceholderPng(name: string): Promise<Blob> {
  // Simple hash → hue
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = `hsl(${hue}, 45%, 55%)`;
  ctx.fillRect(0, 0, 256, 256);

  // Initial letter
  const initial = name.charAt(0).toUpperCase();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, 128, 138);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}
