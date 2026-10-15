import { useState } from "react";
import type { PinnedEntry } from "@/lib/types";
import { parseYouTubeUrl } from "@/lib/youtube";

interface PinnedListProps {
  pinned: PinnedEntry[];
  onChange: (next: PinnedEntry[]) => void;
}

export function PinnedList({ pinned, onChange }: PinnedListProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const parsed = parseYouTubeUrl(draft);
    if (!parsed) {
      setError("Paste a youtube.com/watch?v=... or playlist URL");
      return;
    }
    setError(null);
    onChange([...pinned, { url: draft.trim(), id: parsed.id, type: parsed.type, label: parsed.id }]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex gap-2 mb-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Paste a video or playlist URL"
          className="flex-1 bg-surface border border-hairline rounded-sm text-ink text-xs font-mono px-2 py-1.5 placeholder:text-ink-muted"
        />
        <button
          type="button"
          onClick={add}
          className="font-mono text-[11px] uppercase tracking-wider bg-accent text-accent-ink rounded-sm px-3 shadow-hard"
        >
          Pin
        </button>
      </div>
      {error && <p className="text-danger text-[11px] font-mono mb-2">{error}</p>}
      <div className="flex flex-col gap-1.5">
        {pinned.map((p, i) => (
          <div key={i} className="chip justify-between w-full">
            <span className="truncate">
              {p.type === "playlist" ? "PLAYLIST" : "VIDEO"} &middot; {p.id}
            </span>
            <button type="button" onClick={() => onChange(pinned.filter((_, idx) => idx !== i))}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
