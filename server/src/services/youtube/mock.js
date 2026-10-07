import fs from "node:fs";
import path from "node:path";

export class YouTubeMockService {
  constructor({ fixturePath }) {
    const absolute = path.resolve(process.cwd(), fixturePath);
    const fixture = JSON.parse(fs.readFileSync(absolute, "utf8"));
    this.channel = fixture.channel;
    this.videos = new Map(
      fixture.videos.map((video) => [video.videoId, video])
    );
  }

  materialize(video) {
    const publishedAt =
      video.publishedAt ??
      new Date(
        Date.now() + Number(video.publishedAtOffsetSeconds ?? 0) * 1000
      ).toISOString();
    return { ...video, publishedAt, fetchTime: new Date().toISOString() };
  }

  async getOwnChannel() {
    return { ...this.channel, uploadsPlaylistId: "UU_MOCK_UPLOADS" };
  }

  async listOwnVideos(_auth, _playlist, maxResults = 50) {
    return [...this.videos.values()]
      .slice(0, maxResults)
      .map((video) => this.materialize(video));
  }

  async getVideo(videoId) {
    const video = this.videos.get(videoId);
    return video ? this.materialize(video) : null;
  }

  async getVideosBatch(videoIds) {
    const entries = await Promise.all(
      videoIds.map(async (id) => [id, await this.getVideo(id)])
    );
    return new Map(entries.filter(([, video]) => video));
  }

  setViews(videoId, viewCount) {
    const video = this.videos.get(videoId);
    if (video) video.viewCount = Number(viewCount);
  }
}
