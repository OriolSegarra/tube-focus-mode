import { DEFAULT_SETTINGS, type FocusSettings, type SecretSettings } from "./types";

const SETTINGS_KEY = "focusSettings";
const SECRETS_KEY = "focusSecrets";

export async function getSettings(): Promise<FocusSettings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<FocusSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function setSettings(settings: FocusSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: FocusSettings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    const next = changes[SETTINGS_KEY]?.newValue as Partial<FocusSettings> | undefined;
    callback({ ...DEFAULT_SETTINGS, ...next });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function getSecrets(): Promise<SecretSettings> {
  const stored = await chrome.storage.local.get(SECRETS_KEY);
  return (stored[SECRETS_KEY] as SecretSettings | undefined) ?? { typesafeApiKey: "" };
}

export async function setSecrets(secrets: SecretSettings): Promise<void> {
  await chrome.storage.local.set({ [SECRETS_KEY]: secrets });
}
