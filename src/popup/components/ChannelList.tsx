import { useState } from "react";
import type { AllowedChannel } from "@/lib/types";

/** A pasted channel link ("youtube.com/@lofigirl/videos", "youtube.com/channel/UC…") becomes
 * the exact id it points to; anything else is kept as typed. */
function normalizeEntry(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      const match = url.pathname.match(/^\/(@[^/]+|channel\/(UC[\w-]+))/);
      if (match) return decodeURIComponent(match[2] ?? match[1]!);
    }
  } catch {
    // not a URL - a handle or a name
  }
  return value;
}

interface ChannelListProps {
  channels: AllowedChannel[];
  onChange: (next: AllowedChannel[]) => void;
}

export function ChannelList({ channels, onChange }: ChannelListProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const name = normalizeEntry(draft);
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
          placeholder="@handle, channel link, or name"
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
      <p className="text-[11px] text-ink-muted mb-2 leading-relaxed">
        Best: type the handle <span className="text-ink font-mono">with the @</span> (e.g.{" "}
        <span className="text-ink font-mono">@lofigirl</span>) or paste the channel's link. That matches only that
        channel. Without the @ it's treated as a name, which also matches any channel whose name contains it.
      </p>
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
