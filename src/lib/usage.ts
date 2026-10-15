/** Spending guard for Jev calls. Every check is paid from the user's own TypeSafe key, so
 * a bug (like the re-check-on-scroll one) or a page spawning endless fake cards must not
 * be able to drain their credits. Past a limit, videos stay blocked (fail closed). */

const USAGE_KEY = "jevUsage";
export const DAILY_LIMIT = 1000;
const PER_MINUTE_LIMIT = 60;
const MAX_CONCURRENT = 4;

export interface DailyUsage {
  /** Local date, YYYY-MM-DD */
  date: string;
  count: number;
}

export class UsageLimitError extends Error {}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getDailyUsage(): Promise<DailyUsage> {
  const stored = (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY] as DailyUsage | undefined;
  return stored?.date === today() ? stored : { date: today(), count: 0 };
}

// Per-minute window lives in memory: a service worker restart resets it, which is fine
// since the daily cap (persisted) is the real backstop.
const recentCalls: number[] = [];
let usagePromise: Promise<DailyUsage> | null = null;
let active = 0;
const waiting: (() => void)[] = [];

async function reserveSlot(): Promise<void> {
  usagePromise ??= getDailyUsage();
  const usage = await usagePromise;
  if (usage.date !== today()) {
    usage.date = today();
    usage.count = 0;
  }
  const now = Date.now();
  while (recentCalls.length && now - recentCalls[0]! > 60_000) recentCalls.shift();

  if (usage.count >= DAILY_LIMIT) throw new UsageLimitError(`Daily limit of ${DAILY_LIMIT} Jev checks reached`);
  if (recentCalls.length >= PER_MINUTE_LIMIT) throw new UsageLimitError("Too many Jev checks this minute");

  usage.count++;
  recentCalls.push(now);
  void chrome.storage.local.set({ [USAGE_KEY]: usage });
}

/** Runs `call` if under the daily/per-minute limits, with at most MAX_CONCURRENT in flight
 * so a homepage load doesn't fire 50 requests at once and trip TypeSafe's rate limit. */
export async function withUsageLimit<T>(call: () => Promise<T>): Promise<T> {
  await reserveSlot();
  // A finishing call hands its slot straight to the next waiter, so `active` never overshoots.
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await call();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
