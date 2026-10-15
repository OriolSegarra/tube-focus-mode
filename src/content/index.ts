import { getSettings, onSettingsChanged } from "@/lib/storage";
import { evaluateVideo } from "@/lib/messages";
import type { FocusSettings, VideoMeta } from "@/lib/types";

let currentSettings: FocusSettings | null = null;
let currentVideoId: string | null = null;
let overlayEl: HTMLElement | null = null;

function applyHidingClasses(settings: FocusSettings): void {
  const html = document.documentElement;
  const active = settings.manualEnabled;
  html.classList.toggle("focus-hide-home", active && settings.hideHomepage);
  html.classList.toggle("focus-hide-shorts", active && settings.hideShorts);
}

function ensureOverlay(): HTMLElement {
  if (overlayEl) return overlayEl;
  const el = document.createElement("div");
  el.id = "focus-mode-overlay";
  el.innerHTML = `
    <div class="focus-card">
      <span class="focus-stamp">DENIED</span>
      <span class="focus-tag">Focus Mode</span>
      <h1>nah bestie, not today 💀</h1>
      <p>This video didn't make the cut. Add the channel or pin it from the extension popup if it's actually main-character content.</p>
      <div class="focus-actions">
        <button data-action="back">&lt; Back</button>
        <button data-action="home">Go home</button>
      </div>
    </div>
  `;
  el.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.closest("button")?.getAttribute("data-action");
    if (action === "back") history.back();
    if (action === "home") (window.location.href = "https://www.youtube.com/");
  });
  document.documentElement.appendChild(el);
  overlayEl = el;
  return el;
}

function pauseVideo(): void {
  document.querySelector("video")?.pause();
}

const CHECKING_LINES = [
  "asking jev if this slaps fr fr",
  "consulting the ai overlords...",
  "checking if this is lowkey a distraction",
  "running it past the vibe check",
  "jev is thinking (be patient bestie)",
];

function showOverlay(): void {
  console.log("[focus-mode][overlay] showOverlay (blocked)");
  const el = ensureOverlay();
  el.classList.remove("is-checking");
  el.classList.add("is-visible");
  pauseVideo();
}

function hideOverlay(): void {
  console.log("[focus-mode][overlay] hideOverlay");
  overlayEl?.classList.remove("is-visible");
}

/** "Checking" state reuses the same centered card as the blocked state - just with
 * different content and a neutral/pulsing look - so the transition between the two is a
 * content swap in place, not two different elements jumping around the screen. Doesn't
 * pause playback: Jev resolves in well under a second, and a scripted .play() to resume
 * after the async round trip is unreliable (the browser's autoplay gesture often expires
 * by then), so we only touch the video if it actually ends up blocked. */
function showCheckingOverlay(): void {
  console.log("[focus-mode][overlay] showCheckingOverlay");
  const el = ensureOverlay();
  el.classList.add("is-checking");
  const line = CHECKING_LINES[Math.floor(Math.random() * CHECKING_LINES.length)] ?? "checking...";
  setOverlayCopy(line, "hold tight, almost done");
  el.classList.add("is-visible");
}

function showShortsBlockedOverlay(): void {
  const el = ensureOverlay();
  const heading = el.querySelector("h1");
  const body = el.querySelector("p");
  if (heading) heading.textContent = "shorts = brainrot, not on my watch";
  if (body) body.textContent = "Shorts are a hard no during focus mode, no exceptions. Go pin an actual video if you need one.";
  showOverlay();
}

function setOverlayCopy(heading: string, body: string): void {
  const el = ensureOverlay();
  const headingEl = el.querySelector("h1");
  const bodyEl = el.querySelector("p");
  if (headingEl) headingEl.textContent = heading;
  if (bodyEl) bodyEl.textContent = body;
}

function resetOverlayCopy(): void {
  setOverlayCopy(
    "nah bestie, not today 💀",
    "This video didn't make the cut. Add the channel or pin it from the extension popup if it's actually main-character content.",
  );
}

function getVideoIdFromUrl(): string | null {
  return new URL(location.href).searchParams.get("v");
}

function getShortsIdFromUrl(): string | null {
  const match = location.pathname.match(/^\/shorts\/([^/?]+)/);
  return match?.[1] ?? null;
}

async function waitForSelector(selector: string, timeoutMs = 4000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) return el;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function extractVideoMeta(videoId: string): Promise<VideoMeta> {
  const titleEl = await waitForSelector("ytd-watch-metadata yt-formatted-string.ytd-watch-metadata-renderer, h1.ytd-watch-metadata-renderer");
  // Single-artist videos expose the channel as an <a>; multi-artist/collab credits
  // render it as a <button> that opens a dropdown of all credited channels instead.
  // Grab the whole owner block's text so either shape - and multi-artist collabs - come through.
  const channelEl = await waitForSelector("ytd-video-owner-renderer, ytd-channel-name#channel-name, #owner");
  const descriptionEl = document.querySelector("#description-inline-expander");

  return {
    videoId,
    title: titleEl?.textContent?.trim() ?? document.title.replace(/ - YouTube$/, ""),
    channel: channelEl?.textContent?.trim() ?? "",
    description: descriptionEl?.textContent?.trim().slice(0, 500) ?? "",
  };
}

async function handleWatchPage(): Promise<void> {
  const videoId = getVideoIdFromUrl();
  console.log("[focus-mode][nav] handleWatchPage called, videoId=" + videoId + " currentVideoId=" + currentVideoId);
  if (!videoId || !currentSettings?.manualEnabled) {
    hideOverlay();
    return;
  }
  if (videoId === currentVideoId) {
    console.log("[focus-mode][nav] same videoId, skipping re-check");
    return;
  }
  currentVideoId = videoId;
  showCheckingOverlay();

  const meta = await extractVideoMeta(videoId);
  if (getVideoIdFromUrl() !== videoId) return; // navigated away while we were checking
  console.log("[focus-mode] extracted meta " + JSON.stringify(meta));

  const { decision } = await evaluateVideo(meta);
  if (getVideoIdFromUrl() !== videoId) return;
  console.log("[focus-mode] decision " + JSON.stringify(decision));

  if (decision.allowed) {
    hideOverlay();
    return;
  }

  if (decision.reason === "no-api-key") {
    setOverlayCopy(
      "No TypeSafe API key set",
      "Add one in the extension popup so the topic check can run, or add this channel/video to your allowlist.",
    );
  } else if (decision.reason === "error") {
    setOverlayCopy("Topic check failed", decision.message);
  } else {
    resetOverlayCopy();
  }
  showOverlay();
}

function handleShortsPage(): void {
  const shortsId = getShortsIdFromUrl();
  if (!shortsId || !currentSettings?.manualEnabled || !currentSettings.hideShorts) {
    hideOverlay();
    currentVideoId = null;
    return;
  }
  // Shorts aren't gated by the allowlist — they're fully blocked while focus mode is on,
  // same as the "block Shorts" scope we agreed on. No API call needed here.
  currentVideoId = shortsId;
  showShortsBlockedOverlay();
}

let homeGridObserver: MutationObserver | null = null;

function isHomePage(): boolean {
  return location.pathname === "/";
}

function getVideoIdFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, location.origin).searchParams.get("v");
  } catch {
    return null;
  }
}

/** Filters the home grid per-video via the same pinned/channel/topic check used on /watch
 * pages, instead of blanket-hiding the whole feed. Cards are hidden immediately (so nothing
 * disallowed flashes), then shown once Jev (or an allowlist match) clears them.
 *
 * YouTube's current grid card ("lockup") markup doesn't put ids on its title/channel
 * elements the way /watch pages do - selectors here are class-based and include the old
 * id-based ones as a fallback in case YouTube reverts or A/B-tests the markup. */
function processHomeCard(card: Element): void {
  // Never touch sponsored cards - not our job to filter ads, and no point spending an API call on one.
  if (card.querySelector('ytd-ad-slot-renderer, [class*="FeedAd"]') || card.textContent?.includes("Sponsored")) return;

  const linkEl = card.querySelector<HTMLAnchorElement>(
    'a[class*="ytLockupMetadataViewModelTitle"], a#video-title-link, a#video-title, #thumbnail a',
  );
  const videoId = getVideoIdFromHref(linkEl?.getAttribute("href") ?? null);
  if (!videoId) return; // not a normal single-video card (mix, shorts, channel promo) - leave it alone

  // Marked with the videoId, not just "checked": YouTube recycles card elements while
  // scrolling and swaps a different video into them, which needs its own verdict.
  if (card.getAttribute("data-focus-checked") === videoId) return;
  card.setAttribute("data-focus-checked", videoId);

  const title = linkEl?.textContent?.trim() ?? "";
  const channelEl = card.querySelector(
    '[class*="ytContentMetadataViewModelMetadataRow"] span[class*="ytContentMetadataViewModelMetadataText"], ytd-channel-name a, #channel-name',
  );
  const channel = channelEl?.textContent?.trim() ?? "";

  card.classList.add("focus-grid-hidden");

  void evaluateVideo({ videoId, title, channel, description: "" }).then(({ decision }) => {
    console.log("[focus-mode][home] " + videoId + " \"" + title + "\" -> " + JSON.stringify(decision));
    if (card.getAttribute("data-focus-checked") !== videoId) return; // card was recycled for another video meanwhile
    if (decision.allowed) card.classList.remove("focus-grid-hidden");
  });
}

function scanHomeGrid(): void {
  if (!isHomePage() || !currentSettings?.manualEnabled || !currentSettings.hideHomepage) return;
  document.querySelectorAll("ytd-rich-item-renderer").forEach(processHomeCard);
}

function ensureHomeGridObserver(): void {
  if (homeGridObserver) return;
  homeGridObserver = new MutationObserver(() => scanHomeGrid());
  homeGridObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function onNavigate(): void {
  console.log("[focus-mode][nav] onNavigate fired, path=" + location.pathname + " href=" + location.href);
  if (!currentSettings) return;
  applyHidingClasses(currentSettings);
  if (location.pathname === "/watch") {
    void handleWatchPage();
  } else if (location.pathname.startsWith("/shorts/")) {
    handleShortsPage();
  } else {
    currentVideoId = null;
    hideOverlay();
  }
  if (isHomePage()) {
    ensureHomeGridObserver();
    scanHomeGrid();
  }
}

async function init(): Promise<void> {
  currentSettings = await getSettings();
  onNavigate();

  onSettingsChanged((settings) => {
    currentSettings = settings;
    applyHidingClasses(settings);
    currentVideoId = null; // force re-evaluation under new settings
    if (isHomePage()) {
      // Settings changed (e.g. a new allowed channel) - every card needs a fresh verdict.
      document.querySelectorAll("[data-focus-checked]").forEach((el) => el.removeAttribute("data-focus-checked"));
      document.querySelectorAll(".focus-grid-hidden").forEach((el) => el.classList.remove("focus-grid-hidden"));
      scanHomeGrid();
    }
    if (location.pathname === "/watch") {
      void handleWatchPage();
    } else if (location.pathname.startsWith("/shorts/")) {
      handleShortsPage();
    }
  });

  document.addEventListener("yt-navigate-finish", onNavigate);
}

void init();
