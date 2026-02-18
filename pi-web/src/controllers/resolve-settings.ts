/**
 * Pure resolve functions — extract "final value from multiple sources" logic
 * out of React components into testable pure functions.
 */

import type { Persona } from "../lib/character";
import type { CharacterCard } from "../lib/character";

/** Resolve display name for the user. */
export function resolveUserName(persona: Persona | undefined): string {
  return persona?.name ?? "用户";
}

/** Resolve display name for the character. */
export function resolveCharacterName(character: CharacterCard | undefined): string {
  return character?.data?.name ?? "Limerence";
}
