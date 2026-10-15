export function parseYouTubeUrl(raw: string): { id: string; type: "video" | "playlist" } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const playlistId = url.searchParams.get("list");
  if (playlistId) return { id: playlistId, type: "playlist" };

  const videoId = url.searchParams.get("v");
  if (videoId) return { id: videoId, type: "video" };

  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return { id, type: "video" };
  }

  return null;
}
