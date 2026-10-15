import type { ScheduleWindow } from "@/lib/types";
import { DAY_LABELS } from "@/lib/schedule";

interface ScheduleEditorProps {
  schedule: ScheduleWindow[];
  onChange: (next: ScheduleWindow[]) => void;
}

export function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  function addWindow() {
    onChange([...schedule, { day: 1, start: "09:00", end: "18:00" }]);
  }

  function updateWindow(index: number, patch: Partial<ScheduleWindow>) {
    onChange(schedule.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function removeWindow(index: number) {
    onChange(schedule.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {schedule.map((w, i) => (
        <div key={i} className="flex items-center gap-2 bg-surface border border-hairline rounded-md px-2 py-2">
          <select
            value={w.day}
            onChange={(e) => updateWindow(i, { day: Number(e.target.value) })}
            className="bg-surface-raised border border-hairline rounded-sm text-ink text-xs font-mono px-1.5 py-1"
          >
            {DAY_LABELS.map((label, day) => (
              <option key={day} value={day}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={w.start}
            onChange={(e) => updateWindow(i, { start: e.target.value })}
            className="bg-surface-raised border border-hairline rounded-sm text-ink text-xs font-mono px-1.5 py-1 flex-1"
          />
          <span className="text-ink-muted text-xs">&rarr;</span>
          <input
            type="time"
            value={w.end}
            onChange={(e) => updateWindow(i, { end: e.target.value })}
            className="bg-surface-raised border border-hairline rounded-sm text-ink text-xs font-mono px-1.5 py-1 flex-1"
          />
          <button
            type="button"
            onClick={() => removeWindow(i)}
            className="text-ink-muted hover:text-danger text-sm px-1"
            aria-label="Remove window"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addWindow}
        className="w-full font-mono text-[11px] uppercase tracking-wider border border-dashed border-hairline rounded-md py-2 text-ink-muted hover:text-accent hover:border-accent"
      >
        + Add locked window
      </button>
    </div>
  );
}
