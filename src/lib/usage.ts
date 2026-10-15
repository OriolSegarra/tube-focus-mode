/** Spending guard for Jev calls. Every check is paid from the user's own TypeSafe key, so
 * a bug (like the re-check-on-scroll one) or a page spawning endless fake cards must not
 * be able to drain their credits. Past a limit, videos stay blocked (fail closed). */

const USAGE_KEY = "jevUsage";
export const DAILY_LIMIT = 1000;
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

export const USAGE_STORAGE_KEY = USAGE_KEY;

export async function getDailyUsage(): Promise<DailyUsage> {
  const stored = (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY] as DailyUsage | undefined;
  return stored?.date === today() ? stored : { date: today(), count: 0 };
}

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
  if (usage.count >= DAILY_LIMIT) throw new UsageLimitError(`Daily limit of ${DAILY_LIMIT} Jev checks reached`);
  usage.count++;
  void chrome.storage.local.set({ [USAGE_KEY]: usage });
}

/** Runs `call` if under the daily cap, with at most MAX_CONCURRENT in flight. Bursts (a fast
 * scroll loads 100+ new cards) queue here instead of being refused: an earlier per-minute
 * cap marked everything past 60 as blocked, which looked exactly like Jev rejecting them. */
export async function withUsageLimit<T>(call: () => Promise<T>, { urgent = false } = {}): Promise<T> {
  await reserveSlot();
  // A finishing call hands its slot straight to the next waiter, so `active` never overshoots.
  // Urgent (the video you just opened) jumps ahead of a backlog of homepage cards.
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => (urgent ? waiting.unshift(resolve) : waiting.push(resolve)));
  }
  else active++;
  try {
    return await call();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
