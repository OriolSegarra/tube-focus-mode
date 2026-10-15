import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type FocusSettings } from "@/lib/types";
import { getSecrets, getSettings, setSecrets, setSettings } from "@/lib/storage";
import { isWithinSchedule } from "@/lib/schedule";
import { DAILY_LIMIT, USAGE_STORAGE_KEY, getDailyUsage, type DailyUsage } from "@/lib/usage";
import { Toggle } from "./components/Toggle";
import { Section } from "./components/Section";
import { ScheduleEditor } from "./components/ScheduleEditor";
import { ChannelList } from "./components/ChannelList";
import { PinnedList } from "./components/PinnedList";

export default function App() {
  const [settings, setLocalSettings] = useState<FocusSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [checksToday, setChecksToday] = useState(0);

  const pendingWriteRef = useRef<FocusSettings | null>(null);
  const writeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const [s, secrets, usage] = await Promise.all([getSettings(), getSecrets(), getDailyUsage()]);
      setLocalSettings(s);
      setApiKey(secrets.typesafeApiKey);
      setChecksToday(usage.count);
      setLoaded(true);
    })();

    // A closing popup never unmounts React, so effect cleanup can't flush the last edit.
    // pagehide does fire on close.
    const flush = () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
      if (pendingWriteRef.current) void setSettings(pendingWriteRef.current);
      pendingWriteRef.current = null;
    };
    window.addEventListener("pagehide", flush);

    // Live counter: the popup often stays open while you scroll YouTube.
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes[USAGE_STORAGE_KEY]?.newValue as DailyUsage | undefined;
      if (area === "local" && next) setChecksToday(next.count);
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      window.removeEventListener("pagehide", flush);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, []);

  /** Clicks (toggles, add/remove) save immediately. Typing and slider drags are debounced:
   * every open YouTube tab re-checks on each settings change it sees, so writing per
   * keystroke made the overlay flicker and re-asked Jev about half-typed topics. */
  function update(patch: Partial<FocusSettings>, { debounce = false } = {}) {
    setLocalSettings((prev) => {
      const next = { ...prev, ...patch };
      pendingWriteRef.current = next;
      return next;
    });
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(
      () => {
        if (pendingWriteRef.current) void setSettings(pendingWriteRef.current);
        pendingWriteRef.current = null;
      },
      debounce ? 800 : 0,
    );
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
          <h1 className="font-bold text-lg leading-none">Tube Focus Mode</h1>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-warn border border-warn rounded-full px-2 py-1">
              Locked
            </span>
          )}
          <Toggle on={settings.manualEnabled || locked} disabled={locked} onChange={(v) => update({ manualEnabled: v })} />
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
        {!settings.dataConsent && (
          <div className="border border-accent rounded-md p-3 mb-3 bg-surface">
            <p className="text-xs text-ink leading-relaxed mb-2">
              To check topics, the <strong>title, channel and description</strong> of YouTube videos you come across are
              sent to TypeSafe (the company behind Jev), using your own API key. Nothing else leaves your browser: no
              account, no tracking, no data sold.
            </p>
            <p className="text-[11px] text-ink-muted mb-3">
              Allowed channels and pinned videos work without this, and never leave your browser.
            </p>
            <button
              type="button"
              onClick={() => update({ dataConsent: true })}
              className="font-mono text-[11px] uppercase tracking-wider bg-accent text-accent-ink rounded-sm px-3 py-1.5 shadow-hard"
            >
              Allow topic checks
            </button>
          </div>
        )}
        <textarea
          value={settings.topicDescription}
          onChange={(e) => update({ topicDescription: e.target.value }, { debounce: true })}
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
          onChange={(e) => update({ allowThreshold: Number(e.target.value) }, { debounce: true })}
          className="w-full"
        />
        {settings.dataConsent && (
          <button
            type="button"
            onClick={() => update({ dataConsent: false })}
            className="mt-2 text-[11px] font-mono text-ink-muted underline hover:text-danger"
          >
            Stop sending videos to TypeSafe
          </button>
        )}
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
        <p className="text-[11px] font-mono text-ink-muted mt-1">
          Jev checks today: <span className={checksToday >= DAILY_LIMIT ? "text-danger" : "text-ink"}>{checksToday}</span> / {DAILY_LIMIT}
        </p>
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
