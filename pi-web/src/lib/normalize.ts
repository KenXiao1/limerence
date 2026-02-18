/**
 * Centralized string normalization functions.
 * Replaces scattered inline .trim().toLowerCase() patterns.
 */

/** Normalize user input for command matching (trim + lowercase). */
export function normalizeCommand(text: string): string {
  return text.trim().toLowerCase();
}

/** Normalize text for case-insensitive search/matching. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase();
}

/** Extract displayable text from a possibly-nullish value. */
export function toDisplayText(value: string | null | undefined): string {
  return (value ?? "").trim();
}
