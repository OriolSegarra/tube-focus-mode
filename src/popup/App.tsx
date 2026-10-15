import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type FocusSettings } from "@/lib/types";
import { getSecrets, getSettings, setSecrets, setSettings } from "@/lib/storage";
import { isWithinSchedule } from "@/lib/schedule";
import { Toggle } from "./components/Toggle";
import { Section } from "./components/Section";
import { ScheduleEditor } from "./components/ScheduleEditor";
import { ChannelList } from "./components/ChannelList";
import { PinnedList } from "./components/PinnedList";

export default function App() {
  const [settings, setLocalSettings] = useState<FocusSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);

  const pendingWriteRef = useRef<FocusSettings | null>(null);
  const writeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const [s, secrets] = await Promise.all([getSettings(), getSecrets()]);
      setLocalSettings(s);
      setApiKey(secrets.typesafeApiKey);
      setLoaded(true);
    })();

    // Flush any pending debounced write if the popup closes mid-edit, so a fast
    // close-after-typing doesn't drop the last change.
    return () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
      if (pendingWriteRef.current) void setSettings(pendingWriteRef.current);
    };
  }, []);

  function update(patch: Partial<FocusSettings>) {
    setLocalSettings((prev) => {
      const next = { ...prev, ...patch };
      pendingWriteRef.current = next;
      return next;
    });
    // Debounce the storage write: every keystroke in the topic textarea and every tick of
    // the threshold slider was writing to chrome.storage immediately, and any open YouTube
    // tab re-runs its whole focus-mode check on every settings change it sees - so typing
    // or dragging made the overlay flicker repeatedly on whatever video was open elsewhere.
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      if (pendingWriteRef.current) void setSettings(pendingWriteRef.current);
    }, 400);
  }

  function saveApiKey(value: string) {
    setApiKey(value);
    void setSecrets({ typesafeApiKey: value });
  }

  if (!loaded) return null;

  const locked = isWithinSchedule(settings.schedule);

  return (
    <div className="bg-canvas text-ink font-display min-h-screen">
      <header className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent block mb-1">
            {">>> Síntesi Labs"}
          </span>
          <h1 className="font-bold text-lg leading-none">Focus Mode</h1>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-warn border border-warn rounded-full px-2 py-1">
              Locked
            </span>
          )}
          <Toggle on={settings.manualEnabled} disabled={locked} onChange={(v) => update({ manualEnabled: v })} />
        </div>
      </header>

      <Section tag="01" title="Locked work hours">
        <ScheduleEditor schedule={settings.schedule} onChange={(schedule) => update({ schedule })} />
      </Section>

      <Section tag="02" title="Always allowed channels">
        <ChannelList channels={settings.allowedChannels} onChange={(allowedChannels) => update({ allowedChannels })} />
      </Section>

      <Section tag="03" title="Pinned videos & playlists">
        <PinnedList pinned={settings.pinned} onChange={(pinned) => update({ pinned })} />
      </Section>

      <Section tag="04" title="Topic allowlist (Jev)">
        <textarea
          value={settings.topicDescription}
          onChange={(e) => update({ topicDescription: e.target.value })}
          placeholder="e.g. lo-fi or instrumental music, programming tutorials"
          rows={3}
          className="w-full bg-surface border border-hairline rounded-sm text-ink text-xs font-mono px-2 py-1.5 placeholder:text-ink-muted mb-3"
        />
        <label className="flex items-center justify-between text-xs font-mono text-ink-muted mb-1">
          <span>Allow threshold</span>
          <span className="text-ink">{settings.allowThreshold.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.allowThreshold}
          onChange={(e) => update({ allowThreshold: Number(e.target.value) })}
          className="w-full"
        />
      </Section>

      <Section tag="05" title="TypeSafe API key">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="tsk_..."
          className="w-full bg-surface border border-hairline rounded-sm text-ink text-xs font-mono px-2 py-1.5 placeholder:text-ink-muted"
        />
        <p className="text-[11px] text-ink-muted mt-1.5">Stored locally only, never synced across devices.</p>
      </Section>

      <Section tag="06" title="What gets filtered">
        <label className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink">Homepage feed (Jev filters each video) & watch recommendations</span>
          <Toggle on={settings.hideHomepage} onChange={(v) => update({ hideHomepage: v })} />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-xs text-ink">Shorts</span>
          <Toggle on={settings.hideShorts} onChange={(v) => update({ hideShorts: v })} />
        </label>
      </Section>
    </div>
  );
}
