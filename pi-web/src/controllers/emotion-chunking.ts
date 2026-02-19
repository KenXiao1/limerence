/**
 * Emotion-driven chunking controller — maps emotional cues to block chunker configs.
 * Pure functions, no React imports.
 */

import type { BlockChunkerConfig } from "../lib/block-chunker";

// ── Emotion types ──────────────────────────────────────────────

export type EmotionTag =
  | "calm"
  | "excited"
  | "hesitant"
  | "anxious"
  | "happy"
  | "sad"
  | "angry"
  | "tender"
  | "playful"
  | "neutral";

// ── Emotion tag parsing ────────────────────────────────────────

/**
 * Regex to detect emotion tags in text: [emotion:tag] or [mood:tag]
 * Placed at the start of a message by the LLM.
 */
const EMOTION_TAG_RE = /^\s*\[(?:emotion|mood):(\w+)\]\s*/i;

/**
 * Extract an emotion tag from the beginning of text.
 * Returns the tag and the remaining text (tag stripped).
 */
export function extractEmotionTag(text: string): { emotion: EmotionTag; text: string } | null {
  const match = text.match(EMOTION_TAG_RE);
  if (!match) return null;

  const raw = match[1].toLowerCase();
  const emotion = normalizeEmotionTag(raw);
  return {
    emotion,
    text: text.slice(match[0].length),
  };
}

function normalizeEmotionTag(raw: string): EmotionTag {
  const MAP: Record<string, EmotionTag> = {
    calm: "calm",
    rational: "calm",
    peaceful: "calm",
    serene: "calm",
    excited: "excited",
    enthusiastic: "excited",
    thrilled: "excited",
    ecstatic: "excited",
    hesitant: "hesitant",
    thinking: "hesitant",
    uncertain: "hesitant",
    pondering: "hesitant",
    anxious: "anxious",
    nervous: "anxious",
    worried: "anxious",
    tense: "anxious",
    happy: "happy",
    joyful: "happy",
    cheerful: "happy",
    delighted: "happy",
    sad: "sad",
    melancholy: "sad",
    sorrowful: "sad",
    angry: "angry",
    frustrated: "angry",
    irritated: "angry",
    tender: "tender",
    loving: "tender",
    affectionate: "tender",
    gentle: "tender",
    playful: "playful",
    teasing: "playful",
    mischievous: "playful",
    flirty: "playful",
    neutral: "neutral",
    default: "neutral",
  };
  return MAP[raw] ?? "neutral";
}

// ── Emotion inference from text features ───────────────────────

/**
 * Heuristic-based emotion inference from text content.
 * Analyzes punctuation patterns, sentence length, etc.
 */
export function inferEmotion(text: string): EmotionTag {
  if (!text.trim()) return "neutral";

  const exclamationDensity = (text.match(/[！!]/g)?.length ?? 0) / Math.max(text.length, 1);
  const questionDensity = (text.match(/[？?]/g)?.length ?? 0) / Math.max(text.length, 1);
  const ellipsisDensity = (text.match(/[…·.]{2,}/g)?.length ?? 0) / Math.max(text.length, 1);

  // Split into sentences for average length calculation
  const sentences = text.split(/[。！？.!?\n]+/).filter(Boolean);
  const avgSentenceLen = sentences.length > 0
    ? sentences.reduce((a, s) => a + s.length, 0) / sentences.length
    : text.length;

  // High exclamation density → excited
  if (exclamationDensity > 0.03) return "excited";
  // High question density → hesitant
  if (questionDensity > 0.03) return "hesitant";
  // Many ellipses → anxious or hesitant
  if (ellipsisDensity > 0.02) return "anxious";
  // Very short sentences → excited or playful
  if (avgSentenceLen < 15 && sentences.length > 2) return "playful";
  // Long, measured sentences → calm
  if (avgSentenceLen > 50) return "calm";

  return "neutral";
}

// ── Emotion → BlockChunkerConfig mapping ───────────────────────

/** Maps emotion to a chunker configuration that produces the desired "feel". */
const EMOTION_CONFIGS: Record<EmotionTag, Partial<BlockChunkerConfig>> = {
  calm: {
    minChars: 200,
    maxChars: 800,
    breakPreference: "paragraph",
    flushOnParagraph: false,
  },
  excited: {
    minChars: 20,
    maxChars: 150,
    breakPreference: "sentence",
    flushOnParagraph: true,
  },
  hesitant: {
    minChars: 60,
    maxChars: 300,
    breakPreference: "newline",
    flushOnParagraph: false,
  },
  anxious: {
    minChars: 10,
    maxChars: 100,
    breakPreference: "sentence",
    flushOnParagraph: true,
  },
  happy: {
    minChars: 40,
    maxChars: 200,
    breakPreference: "sentence",
    flushOnParagraph: true,
  },
  sad: {
    minChars: 100,
    maxChars: 500,
    breakPreference: "paragraph",
    flushOnParagraph: false,
  },
  angry: {
    minChars: 15,
    maxChars: 120,
    breakPreference: "sentence",
    flushOnParagraph: true,
  },
  tender: {
    minChars: 80,
    maxChars: 400,
    breakPreference: "newline",
    flushOnParagraph: false,
  },
  playful: {
    minChars: 25,
    maxChars: 150,
    breakPreference: "sentence",
    flushOnParagraph: true,
  },
  neutral: {
    minChars: 80,
    maxChars: 600,
    breakPreference: "paragraph",
    flushOnParagraph: false,
  },
};

/** Inter-bubble delay in milliseconds per emotion. */
const EMOTION_DELAYS: Record<EmotionTag, number> = {
  calm: 400,
  excited: 100,
  hesitant: 800,
  anxious: 200,
  happy: 200,
  sad: 600,
  angry: 150,
  tender: 500,
  playful: 150,
  neutral: 300,
};

export function getEmotionChunkerConfig(emotion: EmotionTag): Partial<BlockChunkerConfig> {
  return EMOTION_CONFIGS[emotion] ?? EMOTION_CONFIGS.neutral;
}

export function getEmotionBubbleDelay(emotion: EmotionTag): number {
  return EMOTION_DELAYS[emotion] ?? EMOTION_DELAYS.neutral;
}

/**
 * Returns a human-readable label for an emotion tag.
 */
export function getEmotionLabel(emotion: EmotionTag): string {
  const LABELS: Record<EmotionTag, string> = {
    calm: "平静",
    excited: "兴奋",
    hesitant: "犹豫",
    anxious: "紧张",
    happy: "开心",
    sad: "伤感",
    angry: "生气",
    tender: "温柔",
    playful: "俏皮",
    neutral: "平和",
  };
  return LABELS[emotion] ?? "平和";
}
