/**
 * Types for the iframe-runner module — SillyTavern JS-Slash-Runner compatibility layer.
 */

/** A single regex_scripts entry from a SillyTavern character card. */
export interface RegexScriptData {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  /** 1 = user_input, 2 = ai_output */
  placement: number[];
  disabled: boolean;
  trimStrings: string[];
  /** True = only apply on display-side markdown rendering. */
  markdownOnly?: boolean;
  /** True = only apply when building prompts. */
  promptOnly?: boolean;
  /** Whether the script can run on edited messages. */
  runOnEdit?: boolean;
  /** SillyTavern substituteRegex mode (kept for compatibility). */
  substituteRegex?: number | boolean;
  /** Minimum message depth to apply this script. */
  minDepth?: number | null;
  /** Maximum message depth to apply this script. */
  maxDepth?: number | null;
}

/** A persistent script extracted from character card extensions. */
export interface ScriptConfig {
  id: string;
  name: string;
  /** JS source code to execute in a hidden iframe. */
  content: string;
  enabled: boolean;
  source: "character" | "global";
}

/** Placement constants matching SillyTavern's regex_placement enum. */
export const PLACEMENT = {
  USER_INPUT: 1,
  AI_OUTPUT: 2,
} as const;
