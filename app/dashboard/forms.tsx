"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiRequest } from "../lib/api/client";
import { useApi } from "../lib/api/hooks";
import type { YouTubeVideo } from "../lib/api/types";
import { useAuth } from "../lib/auth/context";
import { AUSDC_MINT } from "../lib/transactions/intents";
import { PageHeader, styles } from "./workspace-ui";
import { TransactionAction } from "./transaction-action";

function toBaseUnits(value: string) {
  const [whole = "0", decimal = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(decimal) || decimal.length > 6)
    return "";
  return `${whole}${decimal.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
}

export function CreateCampaignForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [sourceVideo, setSourceVideo] = useState("");
  const [mention, setMention] = useState("");
  const [cpm, setCpm] = useState("2");
  const [cap, setCap] = useState("50");
  const [budget, setBudget] = useState("500");
  const [endDate, setEndDate] = useState("");
  const [terms, setTerms] = useState<File>();
  const normalizedUrl = useMemo(() => {
    const trimmed = sourceVideo.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes(".")) return `https://${trimmed}`;
    return trimmed;
  }, [sourceVideo]);

  const isValidUrl = useMemo(() => {
    try {
      const u = new URL(normalizedUrl);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [normalizedUrl]);

  const [minTimestamp] = useState(() => Date.now());
  const isValidEndDate = useMemo(() => {
    const timestamp = new Date(endDate).getTime();
    return !Number.isNaN(timestamp) && timestamp > minTimestamp;
  }, [endDate, minTimestamp]);

  const body = useMemo(
    () => () => {
      const form = new FormData();
      if (terms) form.set("terms", terms);
      form.set("title", title.trim());
      form.set("brief", brief.trim());
      form.set("sourceVideo", normalizedUrl);
      form.set("requiredMention", mention.trim());
      form.set("paymentMint", AUSDC_MINT);
      form.set("cpmBaseUnits", toBaseUnits(cpm));
      form.set("maxPayoutPerVideo", toBaseUnits(cap));
      form.set("budget", toBaseUnits(budget));
      const now = Math.floor(Date.now() / 1000);
      form.set("startTime", String(now));
      form.set(
        "endTime",
        String(Math.floor(new Date(endDate).getTime() / 1000))
      );
      form.set("reviewPeriod", "86400");
      form.set("appealWindow", "86400");
      form.set("appealTimeout", "86400");
      form.set("settlementPeriod", "604800");
      form.set("maxReportAge", "3600");
      form.set("finalSnapshotTolerance", "3600");
      form.set("clockSkewTolerance", "60");
      form.set("maxVideosPerClipper", "5");
      return form;
    },
    [brief, budget, cap, cpm, endDate, mention, normalizedUrl, terms, title]
  );
  const valid = Boolean(
    title.trim() &&
    brief.trim() &&
    isValidUrl &&
    mention.trim() &&
    terms &&
    isValidEndDate &&
    toBaseUnits(cpm) &&
    toBaseUnits(cap) &&
    toBaseUnits(budget)
  );
  return (
    <>
      <PageHeader
        title="Create campaign"
        description="Create and fund the campaign vault in a single atomic transaction."
      />
      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Campaign brief</h2>
          </div>
          <div className={styles.panelBody}>
            <form className={styles.form}>
              <label>
                Campaign title
                <input
                  required
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                Brief
                <textarea
                  required
                  maxLength={10000}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                />
              </label>
              <label>
                Source YouTube URL
                <input
                  required
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={sourceVideo}
                  onChange={(event) => setSourceVideo(event.target.value)}
                />
                {sourceVideo && !isValidUrl && (
                  <span
                    style={{
                      color: "#ff8585",
                      fontSize: "0.8rem",
                      marginTop: "0.25rem",
                      display: "block",
                    }}
                  >
                    Must be a valid URL starting with https://
                  </span>
                )}
              </label>
              <label>
                Required mention
                <input
                  required
                  value={mention}
                  onChange={(event) => setMention(event.target.value)}
                />
              </label>
              <label>
                Terms PDF
                <input
                  required
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setTerms(event.target.files?.[0])}
                />
              </label>
            </form>
          </div>
        </section>
        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Funding</h2>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.form}>
              <label>
                CPM (aUSDC)
                <input
                  inputMode="decimal"
                  value={cpm}
                  onChange={(event) => setCpm(event.target.value)}
                />
              </label>
              <label>
                Max payout per video
                <input
                  inputMode="decimal"
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                />
              </label>
              <label>
                Initial budget
                <input
                  inputMode="decimal"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </label>
              <label>
                Campaign end
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
                {endDate && !isValidEndDate && (
                  <span
                    style={{
                      color: "#ff8585",
                      fontSize: "0.8rem",
                      marginTop: "0.25rem",
                      display: "block",
                    }}
                  >
                    End date must be in the future
                  </span>
                )}
              </label>
            </div>
            <div className={styles.actions}>
              <TransactionAction
                endpoint="/campaigns"
                body={body}
                label="Review create & fund"
                title="Create and fund campaign"
                disabled={!valid}
                details={[
                  ["Campaign", title || "—"],
                  ["Budget", `${budget} aUSDC`],
                  ["Token", "aUSDC"],
                ]}
                onSuccess={() => {
                  toast.success("Campaign transaction sent");
                  router.push("/dashboard/creator/campaigns");
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function SubmitVideoForm({ campaignId }: { campaignId: string }) {
  const [videoId, setVideoId] = useState("");
  const videos = useApi<{ videos: YouTubeVideo[] }>("/youtube/videos");
  const selectedVideo = videos.data?.videos.find(
    (video) => video.videoId === videoId
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Submit your clip</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.form}>
          <label>
            Choose a video from your connected YouTube channel
            <div className={styles.videoPicker} role="listbox">
              {videos.data?.videos.map((video) => {
                const thumbnail =
                  video.thumbnailUrl ||
                  `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                return (
                  <button
                    className={styles.videoOption}
                    data-selected={video.videoId === videoId}
                    key={video.videoId}
                    type="button"
                    role="option"
                    aria-selected={video.videoId === videoId}
                    onClick={() => setVideoId(video.videoId)}
                  >
                    <img src={thumbnail} alt="" />
                    <span>
                      <strong>{video.title}</strong>
                      <small>
                        {video.durationSeconds}s ·{" "}
                        {video.publishedAt
                          ? new Date(video.publishedAt).toLocaleDateString()
                          : "Publication date unavailable"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            <select
              value={videoId}
              onChange={(event) => setVideoId(event.target.value)}
              disabled={videos.isLoading || !videos.data?.videos.length}
            >
              <option value="">
                {videos.isLoading ? "Loading your videos…" : "Select a video"}
              </option>
              {videos.data?.videos.map((video) => (
                <option key={video.videoId} value={video.videoId}>
                  {video.title}
                </option>
              ))}
            </select>
          </label>
          {videos.error && (
            <p>
              Connect your YouTube channel in Settings before submitting a
              video.
            </p>
          )}
          {!videos.isLoading && videos.data && !videos.data.videos.length && (
            <p>No eligible videos were found on your connected channel.</p>
          )}
        </div>
        <div className={styles.actions}>
          <TransactionAction
            endpoint={`/campaigns/${campaignId}/submissions`}
            body={{ videoId }}
            label="Review submission"
            title="Register submission"
            disabled={!selectedVideo}
            details={[
              ["Campaign", `#${campaignId}`],
              ["YouTube video", videoId || "—"],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

export function CampaignFundingActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [amount, setAmount] = useState("100");
  const baseUnits = toBaseUnits(amount);
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Campaign funds</h2>
      </div>
      <div className={styles.panelBody}>
        {status === "FUNDED" ? (
          <>
            <div className={styles.form}>
              <label>
                Top-up amount (aUSDC)
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <TransactionAction
                endpoint={`/campaigns/${campaignId}/top-up-intent`}
                body={{ amount: baseUnits }}
                label="Review top-up"
                title="Top up campaign vault"
                disabled={!baseUnits}
                details={[
                  ["Campaign", `#${campaignId}`],
                  ["Amount", `${amount} aUSDC`],
                ]}
              />
              <TransactionAction
                endpoint={`/campaigns/${campaignId}/refund-intent`}
                label="Review refund"
                title="Refund remaining campaign funds"
                details={[
                  ["Campaign", `#${campaignId}`],
                  ["Eligibility", "After campaign settlement period"],
                ]}
              />
            </div>
          </>
        ) : (
          <p>Funding actions are available once the campaign is funded.</p>
        )}
      </div>
    </section>
  );
}

export function CreatorReviewActions({
  submissionId,
  status,
  appealedAt,
}: {
  submissionId: string;
  status: string;
  appealedAt?: string | null;
}) {
  const { session } = useAuth();
  const [reason, setReason] = useState("");
  if (status !== "PENDING_REVIEW" && status !== "REJECTED") return null;
  const isAppealReview = status === "REJECTED" && Boolean(appealedAt);
  const saveNote = async (signature: string) => {
    if (!session) return;
    try {
      await apiRequest(`/submissions/${submissionId}/review-note`, {
        method: "POST",
        token: session.token,
        body: { action: "REJECT", reason, txSignature: signature },
      });
    } catch {
      toast.warning(
        "Transaction submitted, but the rejection note could not be saved."
      );
    }
  };
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Review decision</h2>
      </div>
      <div className={styles.panelBody}>
        {(status === "PENDING_REVIEW" || isAppealReview) && (
          <>
            <div className={styles.actions}>
              <TransactionAction
                endpoint={`/submissions/${submissionId}/accept-intent`}
                label={isAppealReview ? "Accept appeal" : "Accept submission"}
                title={isAppealReview ? "Accept appeal" : "Accept submission"}
                details={[
                  ["Submission", `#${submissionId}`],
                  ["Result", "Eligible for oracle reports and claims"],
                ]}
              />
            </div>
            <div className={styles.form}>
              <label>
                Rejection reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <TransactionAction
                endpoint={`/submissions/${submissionId}/reject-intent`}
                body={{ reason }}
                label={isAppealReview ? "Final rejection" : "Review rejection"}
                title={isAppealReview ? "Reject appeal" : "Reject submission"}
                disabled={!reason.trim()}
                details={[
                  ["Submission", `#${submissionId}`],
                  ["Reason", reason || "—"],
                ]}
                onSuccess={(signature) => void saveNote(signature)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function ClipperSubmissionActions({
  submissionId,
  status,
  appealedAt,
}: {
  submissionId: string;
  status: string;
  appealedAt?: string | null;
}) {
  const { session } = useAuth();
  const [appealReason, setAppealReason] = useState("");
  const saveAppealNote = async (signature: string) => {
    if (!session) return;
    try {
      await apiRequest(`/submissions/${submissionId}/review-note`, {
        method: "POST",
        token: session.token,
        body: {
          action: "APPEAL",
          reason: appealReason,
          txSignature: signature,
        },
      });
    } catch {
      toast.warning(
        "Transaction submitted, but the appeal reason could not be saved."
      );
    }
  };
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Lifecycle actions</h2>
      </div>
      <div className={styles.panelBody}>
        {status === "REJECTED" && !appealedAt && (
          <div className={styles.form}>
            <label>
              Appeal reason
              <textarea
                value={appealReason}
                onChange={(event) => setAppealReason(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className={styles.actions}>
          {status === "REJECTED" && !appealedAt && (
            <TransactionAction
              endpoint={`/submissions/${submissionId}/appeal-intent`}
              label="Appeal rejection"
              title="Appeal submission"
              disabled={!appealReason.trim()}
              details={[
                ["Submission", `#${submissionId}`],
                ["Reason", appealReason || "—"],
              ]}
              onSuccess={(signature) => void saveAppealNote(signature)}
            />
          )}
          {(status === "PENDING_REVIEW" ||
            (status === "REJECTED" && Boolean(appealedAt))) && (
            <TransactionAction
              endpoint={`/submissions/${submissionId}/finalize-timeout-intent`}
              label="Finalize timeout"
              title="Finalize expired review"
              details={[
                ["Submission", `#${submissionId}`],
                ["Result", "Accepted if the on-chain deadline elapsed"],
              ]}
            />
          )}
          {status === "ACCEPTED" && (
            <TransactionAction
              endpoint={`/submissions/${submissionId}/claim-request`}
              label="Request & claim reward"
              title="Claim available reward"
              details={[
                ["Submission", `#${submissionId}`],
                ["Token", "aUSDC"],
              ]}
            />
          )}
        </div>
      </div>
    </section>
  );
}
