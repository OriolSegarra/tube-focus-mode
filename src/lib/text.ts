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

/** "/@Some.Handle/videos" -> "@some.handle", "/channel/UCxyz" -> "ucxyz"; null for other links. */
export function channelIdFromHref(href: string | null): string | null {
  const match = href?.match(/^\/(@[^/?#]+|channel\/(UC[\w-]+))/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[2] ?? match[1]!).toLowerCase();
  } catch {
    return null;
  }
}

/** Allowlist entries starting with "@" or "UC" are exact channel ids; anything else is a name. */
export function isChannelIdEntry(entry: string): boolean {
  return /^(@\S+|UC[\w-]{20,})$/.test(entry.trim());
}
