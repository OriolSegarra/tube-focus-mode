export interface ScheduleWindow {
  /** 0 = Sunday ... 6 = Saturday */
  day: number;
  /** "HH:MM" 24h, local time */
  start: string;
  end: string;
}

export interface PinnedEntry {
  /** raw URL the user pasted */
  url: string;
  /** extracted video or playlist id */
  id: string;
  type: "video" | "playlist";
  label: string;
}

export interface AllowedChannel {
  /** "@handle" or "UC…" channel id (exact match), or a display name (fuzzy match) */
  name: string;
}

export interface FocusSettings {
  manualEnabled: boolean;
  schedule: ScheduleWindow[];
  allowedChannels: AllowedChannel[];
  pinned: PinnedEntry[];
  topicDescription: string;
  allowThreshold: number; // 0..1
  hideHomepage: boolean;
  hideShorts: boolean;
  /** User agreed to video titles/channels/descriptions being sent to TypeSafe for topic checks. */
  dataConsent: boolean;
}

export interface SecretSettings {
  typesafeApiKey: string;
}

/** "card" = homepage tile (no description), "watch" = full /watch page metadata. */
export type MetaSource = "card" | "watch";

export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  /** Channel @handles / UC… ids linked from the video (several on collabs), for exact
   * allowlist matching - display names can be imitated, handles can't. */
  channelIds: string[];
  /** `list=` param on /watch, so pinned playlists can match their videos. */
  playlistId?: string;
  source: MetaSource;
}

export type VideoDecision =
  | { allowed: true; reason: "pinned" | "channel" }
  | { allowed: true; reason: "topic"; confidence: number }
  | { allowed: false; reason: "topic"; confidence: number }
  | { allowed: false; reason: "no-api-key" | "no-topic" | "no-consent" | "limit" }
  | { allowed: false; reason: "error"; message: string };

export const DEFAULT_SETTINGS: FocusSettings = {
  manualEnabled: false,
  schedule: [],
  allowedChannels: [],
  pinned: [],
  topicDescription: "",
  allowThreshold: 0.7,
  hideHomepage: true,
  hideShorts: true,
  dataConsent: false,
};
