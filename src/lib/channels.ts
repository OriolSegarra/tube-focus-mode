import { normalize } from "./text";

/** What a saved "@handle" / "UC…" entry resolves to. Homepage cards often link a channel by
 * its UC… id rather than its handle, and collab videos show only "A and B" with no links at
 * all - so matching needs the entry's permanent id and display name, not just the handle. */
export interface ChannelInfo {
  /** lowercase "uc…" id */
  id: string;
  /** normalized display name, e.g. "fred again" */
  name: string;
  /** display name as YouTube shows it, for the popup */
  label: string;
}

/** Keyed by the lowercased allowlist entry. null = YouTube says the channel doesn't exist. */
export type ChannelInfoMap = Record<string, ChannelInfo | null>;

export const CHANNEL_INFO_KEY = "channelInfo";

export async function getChannelInfo(): Promise<ChannelInfoMap> {
  const stored = await chrome.storage.local.get(CHANNEL_INFO_KEY);
  return (stored[CHANNEL_INFO_KEY] as ChannelInfoMap | undefined) ?? {};
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Reads the channel page once (content script only: same origin as youtube.com, so no
 * extra permission). Regex instead of DOMParser: YouTube's Trusted Types policy blocks it. */
export async function resolveChannel(entry: string): Promise<ChannelInfo | null | undefined> {
  const path = entry.startsWith("@") ? entry : `channel/${entry}`;
  let res: Response;
  try {
    res = await fetch(`https://www.youtube.com/${encodeURI(path)}`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return undefined; // offline / blocked: try again another time
  }
  if (res.status === 404) return null;
  if (!res.ok) return undefined;
  const html = await res.text();
  const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
  const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/)?.[1];
  if (!title || !id) return undefined;
  const label = decodeEntities(title);
  return { id: id.toLowerCase(), name: normalize(label), label };
}

/** "Fred again . . and LATIN MAFIA" -> ["fred again", "latin mafia"]. Joiners cover the
 * languages YouTube's UI is most likely set to here (and / y / i / et / und / e / x / & / ,). */
export function splitCredits(channelText: string): string[] {
  return channelText
    .split(/\s*(?:,|&|\s(?:and|y|i|et|und|e|x)\s)\s*/i)
    .map(normalize)
    .filter(Boolean);
}
