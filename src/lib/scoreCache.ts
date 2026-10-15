import type { MetaSource } from "./types";

const CACHE_KEY = "jevScoreCache.v2";
const LEGACY_CACHE_KEY = "jevScoreCache";
const MAX_ENTRIES = 5000;
const PERSIST_DEBOUNCE_MS = 300;

interface CachedScore {
  score: number;
  /** What the score was computed from. A homepage card has no description, so a /watch
   * request recomputes over a card-only score instead of inheriting the weaker guess. */
  source: MetaSource;
}

/** Raw Jev scores per videoId, valid only for the model + topic text they were computed against.
 * Storing the score (not the allowed/blocked verdict) means threshold changes are free:
 * the comparison is redone locally, only a topic change needs Jev again. */
interface ScoreCache {
  topic: string;
  scores: Record<string, CachedScore>;
}

// The MV3 service worker gets killed after ~30s idle, so memory alone would forget
// everything between scroll sessions - mirror to storage.local and load lazily.
let cachePromise: Promise<ScoreCache> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const inFlight = new Map<string, Promise<number>>();

function loadCache(): Promise<ScoreCache> {
  cachePromise ??= chrome.storage.local.get(CACHE_KEY).then((stored) => {
    void chrome.storage.local.remove(LEGACY_CACHE_KEY); // pre-v2 entries had no source tier
    return (stored[CACHE_KEY] as ScoreCache | undefined) ?? { topic: "", scores: {} };
  });
  return cachePromise;
}

function schedulePersist(cache: ScoreCache): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void chrome.storage.local.set({ [CACHE_KEY]: cache }), PERSIST_DEBOUNCE_MS);
}

function pruneOldest(scores: Record<string, CachedScore>): void {
  const keys = Object.keys(scores); // insertion order, oldest first
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) delete scores[keys[i]!];
}

/** Returns the cached score for this video under this topic, or calls `compute` once
 * (concurrent requests for the same video share the one call) and caches the result.
 * Failures aren't cached, so a transient API error gets retried next time. */
export async function getScore(
  videoId: string,
  topic: string,
  source: MetaSource,
  compute: () => Promise<number>,
): Promise<number> {
  const cache = await loadCache();
  if (cache.topic !== topic) {
    cache.topic = topic;
    cache.scores = {};
    schedulePersist(cache);
  }

  const cached = cache.scores[videoId];
  if (cached && (cached.source === "watch" || source === "card")) return cached.score;

  const key = `${topic}\n${source}\n${videoId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = compute()
    .then((score) => {
      if (cache.topic === topic) {
        delete cache.scores[videoId]; // re-insert so an upgraded entry counts as newest
        cache.scores[videoId] = { score, source };
        pruneOldest(cache.scores);
        schedulePersist(cache);
      }
      return score;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
