import { getSecrets, getSettings } from "@/lib/storage";
import { classifyVideoOnTopic } from "@/lib/typesafe";
import { fuzzyContains, isChannelIdEntry } from "@/lib/text";
import { getScore } from "@/lib/scoreCache";
import { CHANNEL_INFO_KEY, getChannelInfo, splitCredits, type ChannelInfoMap } from "@/lib/channels";
import { UsageLimitError, withUsageLimit } from "@/lib/usage";
import type { EvaluateVideoResponse } from "@/lib/messages";
import type { FocusSettings, SecretSettings, VideoDecision, VideoMeta } from "@/lib/types";

// Older versions created a once-a-minute alarm to flip the toggle on during locked hours.
// Focus state is now derived on read, so clear any alarm left over from an update.
chrome.runtime.onInstalled.addListener(() => void chrome.alarms?.clearAll());

// Settings and key read once per worker lifetime instead of on every card, refreshed on change.
let settingsPromise: Promise<FocusSettings> | null = null;
let secretsPromise: Promise<SecretSettings> | null = null;
let channelInfoPromise: Promise<ChannelInfoMap> | null = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") settingsPromise = null;
  // storage.local also holds the score cache and usage counter, which change constantly.
  if (area === "local" && "focusSecrets" in changes) secretsPromise = null;
  if (area === "local" && CHANNEL_INFO_KEY in changes) channelInfoPromise = null;
});

/** Does one allowlist entry cover this video? */
function channelEntryMatches(entry: string, video: VideoMeta, info: ChannelInfoMap): boolean {
  if (!isChannelIdEntry(entry)) {
    // Plain names keep the substring match, since collab credits render as
    // "Fred again . .and LATIN MAFIA" - which also means "Lofi Girl" lets "Lofi Girl Fans" in.
    return fuzzyContains(video.channel, entry);
  }
  const key = entry.trim().toLowerCase();
  const resolved = info[key];
  if (video.channelIds.includes(key) || (resolved && video.channelIds.includes(resolved.id))) return true;
  if (!resolved) return false;
  // No id to compare: collab videos list "A and B" with no channel links on /watch, and their
  // homepage card links only the first channel. Fall back to the exact display name - but only
  // for collabs or link-less videos, so a single-channel copycat with its own (different) id
  // can't borrow the name. A copycat using the identical name on a collab is the remaining gap.
  const credits = splitCredits(video.channel);
  const isCollab = credits.length > 1;
  if (!isCollab && video.channelIds.length > 0) return false;
  return credits.includes(resolved.name);
}

const LIMITS = { title: 200, channel: 100, description: 500 } as const;
const YT_ID = /^[\w-]{6,64}$/;
const CHANNEL_ID = /^(@[\p{L}\p{N}._\-·]{1,100}|uc[\w-]{20,})$/u;

/** Everything here comes from YouTube's DOM, i.e. whatever an uploader typed. Check the
 * shape and clamp lengths so a giant title can't inflate what each Jev call costs. */
function parseVideo(raw: unknown): VideoMeta | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.videoId !== "string" || !YT_ID.test(v.videoId)) return null;
  if (v.source !== "card" && v.source !== "watch") return null;
  const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
  return {
    videoId: v.videoId,
    title: str(v.title, LIMITS.title),
    channel: str(v.channel, LIMITS.channel),
    description: str(v.description, LIMITS.description),
    channelIds: Array.isArray(v.channelIds)
      ? v.channelIds.filter((id): id is string => typeof id === "string" && CHANNEL_ID.test(id)).slice(0, 10)
      : [],
    playlistId: typeof v.playlistId === "string" && YT_ID.test(v.playlistId) ? v.playlistId : undefined,
    source: v.source,
  };
}

async function decideVideo(video: VideoMeta): Promise<VideoDecision> {
  settingsPromise ??= getSettings();
  const settings = await settingsPromise;

  const pinnedMatch = settings.pinned.some((p) =>
    p.type === "playlist" ? p.id === video.playlistId : p.id === video.videoId,
  );
  if (pinnedMatch) return { allowed: true, reason: "pinned" };

  // "@handle"/"UC…" entries match by id: a copycat channel can borrow a display name but not
  // a handle. One saved handle is enough for any collab that channel is credited on.
  channelInfoPromise ??= getChannelInfo();
  const info = await channelInfoPromise;
  const channelMatch = settings.allowedChannels.some((c) => channelEntryMatches(c.name, video, info));
  if (channelMatch) return { allowed: true, reason: "channel" };

  // Cheap refusals before anything leaves the browser.
  if (!settings.dataConsent) return { allowed: false, reason: "no-consent" };
  const topic = settings.topicDescription.trim();
  if (!topic) return { allowed: false, reason: "no-topic" };
  secretsPromise ??= getSecrets();
  const { typesafeApiKey } = await secretsPromise;
  if (!typesafeApiKey) return { allowed: false, reason: "no-api-key" };

  const state = `Title: ${video.title}\nChannel: ${video.channel}\nDescription: ${video.description}`;
  try {
    const noul = await getScore(video.videoId, topic, video.source, () =>
      withUsageLimit(() => classifyVideoOnTopic(typesafeApiKey, state, topic), { urgent: video.source === "watch" }),
    );
    return { allowed: noul >= settings.allowThreshold, reason: "topic", confidence: noul };
  } catch (err) {
    if (err instanceof UsageLimitError) return { allowed: false, reason: "limit" };
    // Fail closed, but surface the real cause instead of masking it as a missing key.
    console.error("[focus-mode] TypeSafe call failed", err);
    return { allowed: false, reason: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Only our own content script and popup. No externally_connectable is declared, so web
  // pages can't reach this anyway - this is the second lock on the same door.
  if (sender.id !== chrome.runtime.id) return false;
  const msg = message as { type?: unknown; video?: unknown };
  if (msg?.type !== "EVALUATE_VIDEO") return false;
  const video = parseVideo(msg.video);
  if (!video) {
    sendResponse({ decision: { allowed: false, reason: "error", message: "Invalid request" } } satisfies EvaluateVideoResponse);
    return false;
  }

  decideVideo(video)
    .then((decision) => sendResponse({ decision } satisfies EvaluateVideoResponse))
    .catch((err) => {
      console.error("[focus-mode] evaluation failed", err);
      sendResponse({ decision: { allowed: false, reason: "error", message: "Evaluation failed" } } satisfies EvaluateVideoResponse);
    });
  return true;
});
