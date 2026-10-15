const CACHE_KEY = "jevScoreCache";
const MAX_ENTRIES = 5000;
const PERSIST_DEBOUNCE_MS = 300;

/** Raw Jev scores per videoId, valid only for the topic text they were computed against.
 * Storing the score (not the allowed/blocked verdict) means threshold changes are free:
 * the comparison is redone locally, only a topic change needs Jev again. */
interface ScoreCache {
  topic: string;
  scores: Record<string, number>;
}

// The MV3 service worker gets killed after ~30s idle, so memory alone would forget
// everything between scroll sessions - mirror to storage.local and load lazily.
let cachePromise: Promise<ScoreCache> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const inFlight = new Map<string, Promise<number>>();

function loadCache(): Promise<ScoreCache> {
  cachePromise ??= chrome.storage.local
    .get(CACHE_KEY)
    .then((stored) => (stored[CACHE_KEY] as ScoreCache | undefined) ?? { topic: "", scores: {} });
  return cachePromise;
}

function schedulePersist(cache: ScoreCache): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void chrome.storage.local.set({ [CACHE_KEY]: cache }), PERSIST_DEBOUNCE_MS);
}

function pruneOldest(scores: Record<string, number>): void {
  const keys = Object.keys(scores); // insertion order, oldest first
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) delete scores[keys[i]!];
}

/** Returns the cached score for this video under this topic, or calls `compute` once
 * (concurrent requests for the same video share the one call) and caches the result.
 * Failures aren't cached, so a transient API error gets retried next time. */
export async function getScore(videoId: string, topic: string, compute: () => Promise<number>): Promise<number> {
  const cache = await loadCache();
  if (cache.topic !== topic) {
    cache.topic = topic;
    cache.scores = {};
    schedulePersist(cache);
  }

  const cached = cache.scores[videoId];
  if (cached !== undefined) return cached;

  const key = `${topic}\n${videoId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = compute()
    .then((score) => {
      if (cache.topic === topic) {
        cache.scores[videoId] = score;
        pruneOldest(cache.scores);
        schedulePersist(cache);
      }
      return score;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
