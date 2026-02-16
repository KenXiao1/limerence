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
