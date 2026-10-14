import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { youtubeService } from "./youtube/index.js";

export async function verifySubmission({ campaign, wallet, videoId }) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (campaign.creator_wallet === wallet)
    throw new AppError(
      403,
      "SELF_SUBMISSION",
      "Creator cannot submit to their own campaign"
    );
  if (
    campaign.status !== "FUNDED" ||
    nowSeconds < Number(campaign.start_time) ||
    nowSeconds > Number(campaign.end_time)
  )
    throw new AppError(
      409,
      "CAMPAIGN_NOT_ACTIVE",
      "Campaign is not accepting submissions"
    );
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
    throw new AppError(
      400,
      "INVALID_VIDEO_ID",
      "YouTube video ID must contain 11 valid characters"
    );

  const channel = await db("youtube_channels")
    .where({ wallet })
    .whereNull("revoked_at")
    .first();
  if (!channel)
    throw new AppError(
      409,
      "CHANNEL_NOT_CONNECTED",
      "Connect a YouTube channel first"
    );
  const video = await youtubeService.getVideo(videoId);
  if (!video)
    throw new AppError(404, "VIDEO_NOT_FOUND", "YouTube video was not found");
  if (video.channelId !== channel.channel_id)
    throw new AppError(
      403,
      "VIDEO_NOT_OWNED",
      "Video does not belong to the connected channel"
    );
  if (video.availability !== "public")
    throw new AppError(400, "VIDEO_NOT_PUBLIC", "Video must be public");
  if (video.durationSeconds > 180)
    throw new AppError(
      400,
      "VIDEO_TOO_LONG",
      "Video must be 180 seconds or shorter"
    );
  const publishedAt = Math.floor(new Date(video.publishedAt).getTime() / 1000);
  const allowPastVideos = process.env.ALLOW_PAST_VIDEOS === "true";
  const publishedBeforeStart =
    !allowPastVideos && publishedAt < Number(campaign.start_time);
  if (
    !Number.isFinite(publishedAt) ||
    publishedBeforeStart ||
    publishedAt > nowSeconds ||
    publishedAt > Number(campaign.end_time)
  )
    throw new AppError(
      400,
      "INVALID_PUBLISH_TIME",
      "Video was published outside the campaign window"
    );
  if (
    !allowPastVideos &&
    !video.description.includes(campaign.required_mention)
  )
    throw new AppError(
      400,
      "MENTION_MISSING",
      "Required creator mention is missing from the description"
    );
  if (Number(channel.subscriber_count) < Number(campaign.min_subscribers ?? 0))
    throw new AppError(
      400,
      "SUBSCRIBERS_TOO_LOW",
      "Channel does not meet the subscriber requirement"
    );
  if (campaign.min_channel_age_days != null) {
    const ageDays =
      (Date.now() - new Date(channel.channel_created_at).getTime()) /
      86_400_000;
    if (!Number.isFinite(ageDays) || ageDays < campaign.min_channel_age_days)
      throw new AppError(
        400,
        "CHANNEL_TOO_NEW",
        "Channel does not meet the age requirement"
      );
  }
  if (
    await db("submissions")
      .where({ campaign_id: campaign.id, youtube_video_id: videoId })
      .first()
  )
    throw new AppError(
      409,
      "VIDEO_ALREADY_SUBMITTED",
      "Video was already submitted to this campaign"
    );
  const stats = await db("clipper_stats")
    .where({ campaign_id: campaign.id, clipper_wallet: wallet })
    .first();
  if (Number(stats?.active_count ?? 0) >= campaign.max_videos_per_clipper)
    throw new AppError(
      409,
      "ACTIVE_QUOTA_EXCEEDED",
      "Active submission quota reached"
    );
  if (
    Number(stats?.total_submitted ?? 0) >=
    2 * campaign.max_videos_per_clipper
  )
    throw new AppError(
      409,
      "TOTAL_QUOTA_EXCEEDED",
      "Total submission quota reached"
    );
  return video;
}
