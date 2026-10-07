import { google } from "googleapis";
import { YouTubeApiService } from "./api.js";
import { YouTubeMockService } from "./mock.js";

export function createOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw new Error("Google OAuth is not configured");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/youtube/callback"
  );
}

export const youtubeService =
  process.env.YOUTUBE_ADAPTER === "mock"
    ? new YouTubeMockService({
        fixturePath:
          process.env.YOUTUBE_MOCK_FIXTURE ||
          "src/db/fixtures/youtube-videos.json",
      })
    : new YouTubeApiService({ apiKey: process.env.YOUTUBE_API_KEY });
