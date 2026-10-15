import { getSecrets, getSettings } from "@/lib/storage";
import { classifyVideoOnTopic } from "@/lib/typesafe";
import { fuzzyContains } from "@/lib/text";
import { getScore } from "@/lib/scoreCache";
import { UsageLimitError, withUsageLimit } from "@/lib/usage";
import type { EvaluateVideoResponse } from "@/lib/messages";
import type { FocusSettings, SecretSettings, VideoDecision, VideoMeta } from "@/lib/types";

// Older versions created a once-a-minute alarm to flip the toggle on during locked hours.
// Focus state is now derived on read, so clear any alarm left over from an update.
chrome.runtime.onInstalled.addListener(() => void chrome.alarms?.clearAll());

// Settings and key read once per worker lifetime instead of on every card, refreshed on change.
let settingsPromise: Promise<FocusSettings> | null = null;
let secretsPromise: Promise<SecretSettings> | null = null;
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") settingsPromise = null;
  if (area === "local") secretsPromise = null;
});

const LIMITS = { title: 200, channel: 100, description: 500 } as const;
const YT_ID = /^[\w-]{6,64}$/;

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

  // Substring match, not equality: collab credits render as "Fred again . .and LATIN MAFIA",
  // not a clean single channel name, and punctuation/spacing varies by video.
  const channelMatch = settings.allowedChannels.some((c) => fuzzyContains(video.channel, c.name));
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
      withUsageLimit(() => classifyVideoOnTopic(typesafeApiKey, state, topic)),
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
