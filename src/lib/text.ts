/** Lowercase, strip punctuation/dots, collapse whitespace - for fuzzy channel-name matching. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does `haystack` contain `needle` as a normalized substring? Handles collab credits like
 * "Fred again . .and LATIN MAFIA" matching an allowed channel named "Fred again". */
export function fuzzyContains(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalize(needle);
  if (!normalizedNeedle) return false;
  return normalize(haystack).includes(normalizedNeedle);
}
