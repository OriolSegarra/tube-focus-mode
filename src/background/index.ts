import { getSecrets, getSettings, setSettings } from "@/lib/storage";
import { isWithinSchedule } from "@/lib/schedule";
import { classifyVideoOnTopic } from "@/lib/typesafe";
import { fuzzyContains } from "@/lib/text";
import { getScore } from "@/lib/scoreCache";
import type { BackgroundRequest, EvaluateVideoResponse } from "@/lib/messages";
import type { VideoDecision } from "@/lib/types";

const SCHEDULE_ALARM = "focus-schedule-tick";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SCHEDULE_ALARM, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SCHEDULE_ALARM) return;
  const settings = await getSettings();
  if (isWithinSchedule(settings.schedule) && !settings.manualEnabled) {
    await setSettings({ ...settings, manualEnabled: true });
  }
});

async function decideVideo(video: { videoId: string; title: string; channel: string; description: string }): Promise<VideoDecision> {
  const settings = await getSettings();
  console.log("[focus-mode] evaluating", video, { allowedChannels: settings.allowedChannels, pinned: settings.pinned });

  const pinnedMatch = settings.pinned.some((p) => p.id === video.videoId);
  if (pinnedMatch) {
    console.log("[focus-mode] decision: pinned match");
    return { allowed: true, reason: "pinned" };
  }

  // Substring match, not equality: collab credits render as "Fred again . .and LATIN MAFIA",
  // not a clean single channel name, and punctuation/spacing varies by video.
  const channelMatch = settings.allowedChannels.some((c) => fuzzyContains(video.channel, c.name));
  if (channelMatch) {
    console.log("[focus-mode] decision: channel match");
    return { allowed: true, reason: "channel" };
  }
  console.log("[focus-mode] no pinned/channel match, extracted channel text:", JSON.stringify(video.channel));

  const { typesafeApiKey } = await getSecrets();
  if (!typesafeApiKey) {
    console.log("[focus-mode] decision: no API key configured");
    return { allowed: false, reason: "no-api-key" };
  }

  const state = `Title: ${video.title}\nChannel: ${video.channel}\nDescription: ${video.description}`;
  try {
    const noul = await getScore(video.videoId, settings.topicDescription, () =>
      classifyVideoOnTopic(typesafeApiKey, state, settings.topicDescription),
    );
    const allowed = noul >= settings.allowThreshold;
    console.log("[focus-mode] decision: topic ->", { noul, threshold: settings.allowThreshold, allowed });
    return { allowed, reason: "topic", confidence: noul };
  } catch (err) {
    // Fail closed, but surface the real cause instead of masking it as a missing key -
    // a bad key, a down endpoint, and "no key set" look identical to the user otherwise.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[focus-mode] TypeSafe call failed", err);
    return { allowed: false, reason: "error", message };
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  if (message.type !== "EVALUATE_VIDEO") return;
  decideVideo(message.video)
    .then((decision) => sendResponse({ decision } satisfies EvaluateVideoResponse))
    .catch((err) => {
      const text = err instanceof Error ? err.message : String(err);
      console.error("[focus-mode] evaluation failed", err);
      sendResponse({ decision: { allowed: false, reason: "error", message: text } } satisfies EvaluateVideoResponse);
    });
  return true;
});
