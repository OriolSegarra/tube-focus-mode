import { getSettings, onSettingsChanged } from "@/lib/storage";
import { evaluateVideo } from "@/lib/messages";
import { isFocusActive } from "@/lib/schedule";
import type { FocusSettings, VideoDecision, VideoMeta } from "@/lib/types";

let currentSettings: FocusSettings | null = null;
let currentVideoId: string | null = null;
let overlayEl: HTMLElement | null = null;
/** Bumped when the open page changes; a /watch check whose token is stale drops its result. */
let checkSeq = 0;
/** Bumped when settings change; home-card verdicts from an older epoch are dropped. Separate
 * from checkSeq so plain navigation doesn't throw away still-valid card verdicts. */
let homeEpoch = 0;

function isActive(): boolean {
  return !!currentSettings && isFocusActive(currentSettings);
}

function applyHidingClasses(): void {
  const html = document.documentElement;
  const active = isActive();
  html.classList.toggle("focus-hide-home", active && !!currentSettings?.hideHomepage);
  html.classList.toggle("focus-hide-shorts", active && !!currentSettings?.hideShorts);
}

// ---------------------------------------------------------------------------------------
// Overlay

const COPY = {
  blocked: [
    "nah bestie, not today 💀",
    "This video didn't make the cut. Add the channel or pin it from the extension popup if it's actually main-character content.",
  ],
  shorts: [
    "shorts = brainrot, not on my watch",
    "Shorts are a hard no during focus mode, no exceptions. Go pin an actual video if you need one.",
  ],
  "no-api-key": [
    "No TypeSafe API key set",
    "Add one in the extension popup so the topic check can run, or add this channel/video to your allowlist.",
  ],
  "no-consent": [
    "Topic checks are off",
    "Open the extension popup and allow topic checks, or add this channel/video to your allowlist.",
  ],
  "no-topic": [
    "No focus topics set",
    "Describe what you're allowed to watch in the extension popup, or add this channel/video to your allowlist.",
  ],
  limit: [
    "Jev check limit reached",
    "You've hit the safety cap on topic checks. Allowlisted channels and pinned videos still work.",
  ],
  error: ["Topic check failed", "Something went wrong checking this video. Try reloading the tab."],
} as const;

type CopyKey = keyof typeof COPY;

const CHECKING_LINES = [
  "asking jev if this slaps fr fr",
  "consulting the ai overlords...",
  "checking if this is lowkey a distraction",
  "running it past the vibe check",
  "jev is thinking (be patient bestie)",
];

function ensureOverlay(): HTMLElement {
  if (overlayEl) return overlayEl;
  const el = document.createElement("div");
  el.id = "focus-mode-overlay";
  // Static markup only - every dynamic string goes in via textContent in setOverlayCopy.
  el.innerHTML = `
    <div class="focus-card">
      <span class="focus-stamp">DENIED</span>
      <span class="focus-tag">Focus Mode</span>
      <h1></h1>
      <p></p>
      <div class="focus-actions">
        <button data-action="back">&lt; Back</button>
        <button data-action="home">Go home</button>
      </div>
    </div>
  `;
  el.addEventListener("click", (e) => {
    const action = (e.target as HTMLElement).closest("button")?.getAttribute("data-action");
    if (action === "back") history.back();
    if (action === "home") window.location.href = "https://www.youtube.com/";
  });
  document.documentElement.appendChild(el);
  overlayEl = el;
  return el;
}

function setOverlayCopy(heading: string, body: string): void {
  const el = ensureOverlay();
  el.querySelector("h1")!.textContent = heading;
  el.querySelector("p")!.textContent = body;
}

/** While blocked, any attempt to play (k/space, clicking through, the miniplayer) is undone. */
function blockPlayback(e: Event): void {
  if (e.target instanceof HTMLMediaElement) e.target.pause();
}

function showBlocked(key: CopyKey): void {
  const el = ensureOverlay();
  const [heading, body] = COPY[key];
  setOverlayCopy(heading, body);
  el.classList.remove("is-checking");
  el.classList.add("is-visible");
  document.querySelector("video")?.pause();
  document.addEventListener("play", blockPlayback, true);
}

/** "Checking" reuses the blocked card with different copy, so checking -> blocked is a
 * content swap in place. Doesn't pause: Jev usually answers well under a second, and a
 * scripted .play() after the round trip is unreliable (autoplay gesture expires). */
function showChecking(): void {
  const el = ensureOverlay();
  el.classList.add("is-checking");
  const line = CHECKING_LINES[Math.floor(Math.random() * CHECKING_LINES.length)] ?? "checking...";
  setOverlayCopy(line, "hold tight, almost done");
  el.classList.add("is-visible");
}

function hideOverlay(): void {
  overlayEl?.classList.remove("is-visible");
  document.removeEventListener("play", blockPlayback, true);
}

function copyKeyFor(decision: VideoDecision): CopyKey {
  if (decision.allowed || decision.reason === "topic") return "blocked";
  return decision.reason;
}

// ---------------------------------------------------------------------------------------
// /watch and /shorts

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor<T>(read: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return null;
}

const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() ?? "";
const TITLE_SELECTOR = "ytd-watch-metadata h1 yt-formatted-string, ytd-watch-metadata #title h1";
// Single-artist videos expose the channel as an <a>; collab credits render a <button> that
// opens a list of all credited channels. Take the whole owner block so both shapes work.
const CHANNEL_SELECTOR = "ytd-video-owner-renderer, ytd-channel-name#channel-name, #owner";

/** On in-app navigation, yt-navigate-finish fires while the DOM still shows the previous
 * video's title and channel (measured: ~0.6-0.9s). ytd-watch-flexy's video-id flips in the
 * same render as the new title/channel, so wait for that before reading anything - reading
 * early would judge the new video by the old one's metadata and cache the wrong score. */
async function extractVideoMeta(videoId: string): Promise<VideoMeta> {
  await waitFor(() => document.querySelector(`ytd-watch-flexy[video-id="${CSS.escape(videoId)}"]`), 5000);
  await waitFor(() => text(TITLE_SELECTOR) || null, 1500);
  await waitFor(() => text(CHANNEL_SELECTOR) || null, 1500);

  return {
    videoId,
    title: text(TITLE_SELECTOR) || document.title.replace(/ - YouTube$/, ""),
    channel: text(CHANNEL_SELECTOR),
    description: text("#description-inline-expander").slice(0, 500),
    playlistId: new URL(location.href).searchParams.get("list") ?? undefined,
    source: "watch",
  };
}

async function handleWatchPage(): Promise<void> {
  const videoId = new URL(location.href).searchParams.get("v");
  if (!videoId || !isActive()) {
    currentVideoId = null;
    hideOverlay();
    return;
  }
  if (videoId === currentVideoId) return;

  const seq = ++checkSeq;
  currentVideoId = videoId;
  showChecking();

  try {
    const meta = await extractVideoMeta(videoId);
    if (seq !== checkSeq) return;
    const { decision } = await evaluateVideo(meta);
    if (seq !== checkSeq) return;
    if (decision.allowed) hideOverlay();
    else showBlocked(copyKeyFor(decision));
  } catch (err) {
    // Typically "Extension context invalidated" after the extension reloads/updates.
    // Forget the video so a revisit re-checks instead of skipping as "already done".
    if (seq !== checkSeq) return;
    console.error("[focus-mode] watch check failed", err);
    currentVideoId = null;
    showBlocked("error");
  }
}

function handleShortsPage(): void {
  const shortsId = location.pathname.match(/^\/shorts\/([^/?]+)/)?.[1];
  if (!shortsId || !isActive() || !currentSettings?.hideShorts) {
    currentVideoId = null;
    hideOverlay();
    return;
  }
  // Shorts aren't gated by the allowlist: fully blocked while focus mode is on. No API call.
  currentVideoId = shortsId;
  showBlocked("shorts");
}

// ---------------------------------------------------------------------------------------
// Home grid
//
// Cards are blurred by CSS unless marked data-focus-verdict="allowed"|"skip" (fail closed:
// nothing unchecked ever flashes). YouTube's lockup markup has no ids on title/channel, so
// selectors are class-based with the old id-based ones as a fallback.

const RETRY_AFTER_MS = 30_000;
let homeGridObserver: MutationObserver | null = null;
let scanQueued = false;

function getVideoIdFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, location.origin).searchParams.get("v");
  } catch {
    return null;
  }
}

function setVerdict(card: Element, verdict: "allowed" | "blocked" | "skip", reason = ""): void {
  card.setAttribute("data-focus-verdict", verdict);
  // Shipped builds have no logs; this lets you see *why* a card is blurred in devtools.
  if (reason) card.setAttribute("data-focus-reason", reason);
  else card.removeAttribute("data-focus-reason");
}

function processHomeCard(card: Element): void {
  const linkEl = card.querySelector<HTMLAnchorElement>(
    'a[class*="ytLockupMetadataViewModelTitle"], a#video-title-link, a#video-title, #thumbnail a',
  );
  const href = linkEl?.getAttribute("href") ?? null;
  const videoId = getVideoIdFromHref(href);
  // Cheapest test first: this runs for every card on every scan.
  // Marked with the videoId, not just "checked": YouTube recycles card elements while
  // scrolling and swaps a different video into them, which needs its own verdict.
  if (videoId && card.getAttribute("data-focus-checked") === videoId) return;

  // Ads: structural markers only. Matching the word "Sponsored" in the text let any video
  // with it in the title skip the filter, and only worked in English.
  if (card.querySelector("ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, [class*='FeedAd']")) {
    setVerdict(card, "skip");
    return;
  }
  if (!videoId) {
    if (href?.startsWith("/shorts/")) setVerdict(card, currentSettings?.hideShorts ? "blocked" : "skip");
    // A link that isn't a video (channel promo, etc.) - leave it alone. No link yet means the
    // card is still rendering: stay blurred and look again on the next scan.
    else if (href) setVerdict(card, "skip");
    return;
  }

  const title = linkEl?.textContent?.trim() ?? "";
  if (!title) return; // text not rendered yet; scoring "Title: " would be a coin flip that gets cached

  const retryAt = Number(card.getAttribute("data-focus-retry-at") ?? 0);
  if (retryAt > Date.now() && card.getAttribute("data-focus-retry-id") === videoId) return;

  const channel =
    card
      .querySelector(
        '[class*="ytContentMetadataViewModelMetadataRow"] span[class*="ytContentMetadataViewModelMetadataText"], ytd-channel-name a, #channel-name',
      )
      ?.textContent?.trim() ?? "";

  card.setAttribute("data-focus-checked", videoId);
  card.removeAttribute("data-focus-verdict");
  const epoch = homeEpoch;

  evaluateVideo({ videoId, title, channel, description: "", source: "card" })
    .then(({ decision }) => {
      if (card.getAttribute("data-focus-checked") !== videoId) return; // recycled for another video
      if (epoch !== homeEpoch) return; // settings changed; resetHomeVerdicts already queued a re-check
      if (decision.allowed) setVerdict(card, "allowed", decision.reason);
      else if (decision.reason === "error") {
        // Transient failure: retry on a later scan, but not on every animation frame.
        card.removeAttribute("data-focus-checked");
        card.setAttribute("data-focus-retry-id", videoId);
        card.setAttribute("data-focus-retry-at", String(Date.now() + RETRY_AFTER_MS));
      } else setVerdict(card, "blocked", decision.reason);
    })
    .catch(() => {
      // Extension reloaded under us: leave the card blurred; a page reload re-attaches.
    });
}

function scanHomeGrid(): void {
  if (location.pathname !== "/" || !isActive() || !currentSettings?.hideHomepage) return;
  document.querySelectorAll('ytd-browse[page-subtype="home"] ytd-rich-item-renderer').forEach(processHomeCard);
}

/** YouTube mutates the DOM constantly (hover previews, timestamps); batch all of that into
 * at most one scan per frame instead of one per mutation record. */
function setHomeObserver(on: boolean): void {
  if (!on) {
    homeGridObserver?.disconnect();
    homeGridObserver = null;
    return;
  }
  if (homeGridObserver) return;
  homeGridObserver = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scanHomeGrid();
    });
  });
  homeGridObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function resetHomeVerdicts(): void {
  homeEpoch++;
  document
    .querySelectorAll("[data-focus-checked], [data-focus-verdict], [data-focus-retry-at]")
    .forEach((el) => {
      el.removeAttribute("data-focus-checked");
      el.removeAttribute("data-focus-verdict");
      el.removeAttribute("data-focus-retry-at");
      el.removeAttribute("data-focus-retry-id");
    });
}

// ---------------------------------------------------------------------------------------
// Routing

/** After the extension reloads or updates, the copy already running in open tabs is cut off
 * from the background (chrome.runtime.id goes away) but keeps reacting to navigation. Left
 * alone it shows overlays it can never resolve and blurs cards next to the new copy. */
function isOrphaned(): boolean {
  return !chrome.runtime?.id;
}

let refreshTimer: ReturnType<typeof setInterval> | undefined;

function teardown(): void {
  setHomeObserver(false);
  if (refreshTimer) clearInterval(refreshTimer);
  document.removeEventListener("yt-navigate-finish", route);
  overlayEl?.remove();
  overlayEl = null;
  document.removeEventListener("play", blockPlayback, true);
}

function route(): void {
  if (isOrphaned()) return teardown();
  if (!currentSettings) return;
  // yt-navigate-finish can fire twice for one video; don't orphan the check already running.
  const sameVideo = location.pathname === "/watch" && new URL(location.href).searchParams.get("v") === currentVideoId;
  if (!sameVideo) checkSeq++;
  applyHidingClasses();
  if (location.pathname === "/watch") {
    void handleWatchPage();
  } else if (location.pathname.startsWith("/shorts/")) {
    handleShortsPage();
  } else {
    currentVideoId = null;
    hideOverlay();
  }
  const onHome = location.pathname === "/" && isActive() && currentSettings.hideHomepage;
  setHomeObserver(onHome);
  if (onHome) scanHomeGrid();
}

/** Only the fields that change a verdict. Edits elsewhere (e.g. the schedule list while
 * outside a locked window) don't re-check the open video or re-blur the grid. */
function decisionKey(s: FocusSettings): string {
  return JSON.stringify([
    isFocusActive(s),
    s.allowedChannels,
    s.pinned,
    s.topicDescription.trim(),
    s.allowThreshold,
    s.dataConsent,
    s.hideHomepage,
    s.hideShorts,
  ]);
}

async function init(): Promise<void> {
  // An orphaned copy from before an update may have left its overlay behind.
  document.querySelectorAll("#focus-mode-overlay").forEach((el) => el.remove());
  currentSettings = await getSettings();
  let lastKey = decisionKey(currentSettings);
  route();

  const refresh = () => {
    if (!currentSettings) return;
    const key = decisionKey(currentSettings);
    if (key === lastKey) return;
    lastKey = key;
    currentVideoId = null; // force a fresh verdict under the new settings
    resetHomeVerdicts();
    route();
  };

  onSettingsChanged((settings) => {
    currentSettings = settings;
    refresh();
  });
  // Locked windows start and end on the clock, not on a storage write.
  refreshTimer = setInterval(() => (isOrphaned() ? teardown() : refresh()), 30_000);
  document.addEventListener("yt-navigate-finish", route);
}

void init();
