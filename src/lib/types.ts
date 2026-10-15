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
  /** channel name or @handle as it appears on the page */
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
}

export interface SecretSettings {
  typesafeApiKey: string;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  description: string;
}

export type VideoDecision =
  | { allowed: true; reason: "pinned" | "channel" }
  | { allowed: true; reason: "topic"; confidence: number }
  | { allowed: false; reason: "topic"; confidence: number }
  | { allowed: false; reason: "no-api-key" }
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
};
