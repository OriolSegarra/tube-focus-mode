import { useState } from "react";
import type { AllowedChannel } from "@/lib/types";

interface ChannelListProps {
  channels: AllowedChannel[];
  onChange: (next: AllowedChannel[]) => void;
}

export function ChannelList({ channels, onChange }: ChannelListProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim();
    if (!name) return;
    onChange([...channels, { name }]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Channel display name (as shown under the video)"
          className="flex-1 bg-surface border border-hairline rounded-sm text-ink text-xs font-mono px-2 py-1.5 placeholder:text-ink-muted"
        />
        <button
          type="button"
          onClick={add}
          className="font-mono text-[11px] uppercase tracking-wider bg-accent text-accent-ink rounded-sm px-3 shadow-hard"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((c, i) => (
          <span key={i} className="chip">
            {c.name}
            <button type="button" onClick={() => onChange(channels.filter((_, idx) => idx !== i))}>
              &times;
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
