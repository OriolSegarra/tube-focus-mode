import type { ScheduleWindow } from "./types";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Is `now` inside any configured weekly window? Used to lock the manual toggle. */
export function isWithinSchedule(schedule: ScheduleWindow[], now: Date = new Date()): boolean {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return schedule.some((w) => {
    if (w.day !== day) return false;
    const start = toMinutes(w.start);
    const end = toMinutes(w.end);
    return minutes >= start && minutes < end;
  });
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
