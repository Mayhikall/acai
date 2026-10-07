import { google } from "googleapis";

export function parseIsoDuration(value = "") {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) return 0;
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

function normalizeVideo(item) {
  return {
    videoId: item.id,
    channelId: item.snippet?.channelId ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? null,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    availability: item.status?.privacyStatus ?? "unknown",
    viewCount: Number(item.statistics?.viewCount ?? 0),
    fetchTime: new Date().toISOString(),
  };
}

export class YouTubeApiService {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
  }

  client(auth = this.apiKey) {
    return google.youtube({ version: "v3", auth });
  }

  async getOwnChannel(auth) {
    const response = await this.client(auth).channels.list({
      part: ["snippet", "statistics", "contentDetails"],
      mine: true,
      maxResults: 1,
    });
    const item = response.data.items?.[0];
    if (!item?.id) return null;
    return {
      channelId: item.id,
      title: item.snippet?.title ?? "",
      subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
      channelCreatedAt: item.snippet?.publishedAt ?? null,
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    };
  }

  async listOwnVideos(auth, uploadsPlaylistId, maxResults = 50) {
    const playlist = await this.client(auth).playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(maxResults, 50),
    });
    const ids = (playlist.data.items ?? [])
      .map((item) => item.contentDetails?.videoId)
      .filter(Boolean);
    return [...(await this.getVideosBatch(ids, auth)).values()];
  }

  async getVideo(videoId, auth) {
    return (await this.getVideosBatch([videoId], auth)).get(videoId) ?? null;
  }

  async getVideosBatch(videoIds, auth) {
    const uniqueIds = [...new Set(videoIds)].slice(0, 50);
    if (!uniqueIds.length) return new Map();
    const response = await this.client(auth).videos.list({
      id: uniqueIds,
      part: ["snippet", "contentDetails", "statistics", "status"],
    });
    return new Map(
      (response.data.items ?? []).map((item) => [item.id, normalizeVideo(item)])
    );
  }
}
