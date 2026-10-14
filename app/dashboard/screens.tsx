"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ExternalLink, Plus, WalletCards } from "lucide-react";
import { useApi, usePublicApi } from "../lib/api/hooks";
import type {
  Campaign,
  CampaignIntent,
  Notification,
  Submission,
} from "../lib/api/types";
import { formatAusdc, formatDate, shortAddress } from "../lib/format";
import { useAuth } from "../lib/auth/context";
import {
  DataState,
  Metric,
  PageHeader,
  PrimaryLink,
  StatusBadge,
  styles,
} from "./workspace-ui";
import {
  CampaignFundingActions,
  ClipperSubmissionActions,
  CreatorReviewActions,
  SubmitVideoForm,
} from "./forms";

export function ClipperOverview() {
  const summary = useApi<{
    summary: {
      submissions: number;
      pendingReview: number;
      accepted: number;
      totalEarned: string;
    };
  }>("/me/summary?workspace=clipper");
  const recent = useApi<{ submissions: Submission[] }>("/me/submissions");
  const data = summary.data?.summary;
  return (
    <>
      <PageHeader
        title="Clipper overview"
        description="Manage your clips, review deadlines, and earnings from creator campaigns."
        action={
          <PrimaryLink href="/dashboard/clipper/campaigns">
            Explore campaigns <ArrowRight size={16} />
          </PrimaryLink>
        }
      />
      <div className={styles.grid4}>
        <Metric label="Submissions" value={data?.submissions ?? "—"} />
        <Metric label="Pending review" value={data?.pendingReview ?? "—"} />
        <Metric label="Accepted" value={data?.accepted ?? "—"} />
        <Metric
          label="Claimed"
          value={data ? formatAusdc(data.totalEarned) : "—"}
        />
      </div>
      <SubmissionPanel
        submissions={recent.data?.submissions}
        loading={recent.isLoading}
        error={recent.error}
        limit={5}
      />
    </>
  );
}

export function CreatorOverview() {
  const summary = useApi<{
    summary: {
      campaigns: number;
      activeCampaigns: number;
      pendingReviews: number;
      totalFunded: string;
    };
  }>("/me/summary?workspace=creator");
  const campaigns = useApi<{ campaigns: Campaign[] }>("/me/campaigns");
  const data = summary.data?.summary;
  return (
    <>
      <PageHeader
        title="Creator overview"
        description="Monitor your campaigns, vault balances, and pending submissions."
        action={
          <PrimaryLink href="/dashboard/creator/campaigns/new">
            <Plus size={16} /> Create campaign
          </PrimaryLink>
        }
      />
      <div className={styles.grid4}>
        <Metric label="Campaigns" value={data?.campaigns ?? "—"} />
        <Metric label="Active" value={data?.activeCampaigns ?? "—"} />
        <Metric label="Review queue" value={data?.pendingReviews ?? "—"} />
        <Metric
          label="Total funded"
          value={data ? formatAusdc(data.totalFunded) : "—"}
        />
      </div>
      <CampaignPanel
        campaigns={campaigns.data?.campaigns}
        loading={campaigns.isLoading}
        error={campaigns.error}
        creator
      />
    </>
  );
}

export function CampaignExplorer({ creator = false }: { creator?: boolean }) {
  const creatorResponse = useApi<{
    campaigns: Campaign[];
    campaignIntents: CampaignIntent[];
  }>(creator ? "/me/campaigns" : null, {
    refreshInterval: creator ? 3000 : 0,
  });
  const publicResponse = usePublicApi<{ campaigns: Campaign[] }>(
    creator ? null : "/campaigns?status=FUNDED&limit=100"
  );
  const response = creator ? creatorResponse : publicResponse;
  const pendingIntents = creatorResponse.data?.campaignIntents ?? [];
  const isEmpty =
    response.data?.campaigns.length === 0 && pendingIntents.length === 0;
  return (
    <>
      <PageHeader
        title={creator ? "My campaigns" : "Explore campaigns"}
        description={
          creator
            ? "Campaigns created and funded by this connected wallet."
            : "Browse active campaign briefs and submit your YouTube clips."
        }
        action={
          creator ? (
            <PrimaryLink href="/dashboard/creator/campaigns/new">
              <Plus size={16} /> Create campaign
            </PrimaryLink>
          ) : undefined
        }
      />
      <DataState
        loading={response.isLoading}
        error={response.error}
        empty={isEmpty}
        emptyText={
          creator
            ? "Create your first campaign to start receiving clips."
            : "No active campaigns available."
        }
      />
      {creator && pendingIntents.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Waiting for network confirmation</h2>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.campaignGrid}>
              {pendingIntents.map((intent) => (
                <article
                  className={styles.campaignCard}
                  key={intent.campaignId}
                >
                  <StatusBadge status={intent.status} />
                  <h2>{intent.title}</h2>
                  <p>
                    This campaign will appear as active after its transaction is
                    finalized on Solana Devnet.
                  </p>
                  <div className={styles.cardMeta}>
                    <span>{formatAusdc(intent.budget)}</span>
                    <span>Campaign #{intent.campaignId}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      {response.data && response.data.campaigns.length > 0 && (
        <div className={styles.campaignGrid}>
          {response.data.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              creator={creator}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CampaignCard({
  campaign,
  creator,
}: {
  campaign: Campaign;
  creator: boolean;
}) {
  const href = creator
    ? `/dashboard/creator/campaigns/${campaign.id}`
    : `/dashboard/clipper/campaigns/${campaign.id}`;
  return (
    <Link className={styles.campaignCard} href={href}>
      <StatusBadge status={campaign.status} />
      <h2>{campaign.title}</h2>
      <p>
        {campaign.brief.slice(0, 145)}
        {campaign.brief.length > 145 ? "…" : ""}
      </p>
      <div className={styles.cardMeta}>
        <span>{formatAusdc(campaign.cpm)} / 1K views</span>
        <span>Ends {formatDate(campaign.end_time)}</span>
      </div>
    </Link>
  );
}

function CampaignPanel({
  campaigns,
  loading,
  error,
  creator = false,
}: {
  campaigns?: Campaign[];
  loading?: boolean;
  error?: unknown;
  creator?: boolean;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Recent campaigns</h2>
        <Link
          href={
            creator
              ? "/dashboard/creator/campaigns"
              : "/dashboard/clipper/campaigns"
          }
        >
          View all
        </Link>
      </div>
      <DataState
        loading={loading}
        error={error}
        empty={campaigns?.length === 0}
      />
      {campaigns && campaigns.length > 0 && (
        <div className={styles.panelBody}>
          <div className={styles.campaignGrid}>
            {campaigns.slice(0, 3).map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                creator={creator}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function SubmissionList({
  reviewQueue = false,
}: {
  reviewQueue?: boolean;
}) {
  const endpoint = reviewQueue
    ? "/me/submissions?role=creator"
    : "/me/submissions";
  const response = useApi<{ submissions: Submission[] }>(endpoint);
  const filtered = reviewQueue
    ? response.data?.submissions.filter(
        (item) => item.status === "PENDING_REVIEW"
      )
    : response.data?.submissions;
  return (
    <>
      <PageHeader
        title={reviewQueue ? "Review queue" : "My submissions"}
        description={
          reviewQueue
            ? "Review submissions waiting for decision across your campaigns."
            : "Track review progress, appeal windows, oracle updates, and reward claims."
        }
      />
      <SubmissionPanel
        submissions={filtered}
        loading={response.isLoading}
        error={response.error}
        isReviewQueue={reviewQueue}
        emptyText={
          reviewQueue
            ? "No pending submissions waiting for review."
            : "Submit a video to an active campaign to track your progress here."
        }
      />
    </>
  );
}

function SubmissionPanel({
  submissions,
  loading,
  error,
  limit,
  emptyText,
  isReviewQueue = false,
}: {
  submissions?: Submission[];
  loading?: boolean;
  error?: unknown;
  limit?: number;
  emptyText?: string;
  isReviewQueue?: boolean;
}) {
  const rows = limit ? submissions?.slice(0, limit) : submissions;
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{isReviewQueue ? "Pending submissions" : "Submissions"}</h2>
        {!isReviewQueue && (
          <Link href="/dashboard/clipper/submissions">View all</Link>
        )}
      </div>
      <DataState
        loading={loading}
        error={error}
        empty={rows?.length === 0}
        emptyText={
          emptyText ??
          "Submit a video to an active campaign to track your progress here."
        }
      />
      {rows && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Video</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>{isReviewQueue ? "Deadline" : "Submitted"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.title}</td>
                  <td>
                    {submission.campaign_title || `#${submission.campaign_id}`}
                  </td>
                  <td>
                    <StatusBadge status={submission.status} />
                  </td>
                  <td>
                    {formatDate(
                      isReviewQueue
                        ? submission.review_deadline
                        : submission.submitted_at
                    )}
                  </td>
                  <td>
                    <Link
                      href={
                        isReviewQueue
                          ? `/dashboard/creator/reviews/${submission.id}`
                          : `/dashboard/clipper/submissions/${submission.id}`
                      }
                    >
                      {isReviewQueue ? "Review" : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Earnings() {
  const response = useApi<{
    claims: Array<{
      id: number;
      amount: string;
      remaining_claim: string;
      tx_signature: string;
      created_at: string;
      campaign_title: string;
      submission_title: string;
    }>;
  }>("/me/claims");
  const total = useMemo(
    () =>
      response.data?.claims.reduce(
        (sum, claim) => sum + BigInt(claim.amount),
        0n
      ) ?? 0n,
    [response.data]
  );
  return (
    <>
      <PageHeader
        title="Earnings & claims"
        description="History of reward claims confirmed on-chain and synced by the indexer."
      />
      <div className={styles.grid3}>
        <Metric label="Total claimed" value={formatAusdc(total)} />
        <Metric label="Claims" value={response.data?.claims.length ?? "—"} />
        <Metric label="Network" value="Devnet" />
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Claim history</h2>
        </div>
        <DataState
          loading={response.isLoading}
          error={response.error}
          empty={response.data?.claims.length === 0}
        />
        {response.data && response.data.claims.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Video</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {response.data.claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>{claim.campaign_title}</td>
                    <td>{claim.submission_title}</td>
                    <td>{formatAusdc(claim.amount)}</td>
                    <td>{formatDate(claim.created_at)}</td>
                    <td>
                      <a
                        href={`https://explorer.solana.com/tx/${claim.tx_signature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function Notifications() {
  const response = useApi<{ notifications: Notification[] }>(
    "/me/notifications"
  );
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Cross-workspace updates from finalized on-chain events and backend indexers."
      />
      <section className={styles.panel}>
        <DataState
          loading={response.isLoading}
          error={response.error}
          empty={response.data?.notifications.length === 0}
        />
        {response.data?.notifications.map((item) => (
          <article className={styles.panelBody} key={item.id}>
            <StatusBadge status={item.read_at ? "read" : "new"} />
            <h3>{item.type.replaceAll("_", " ")}</h3>
            <p>{formatDate(item.created_at)}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function WalletSettings() {
  const { session, logout } = useAuth();
  return (
    <>
      <PageHeader
        title="Wallet settings"
        description="Your wallet is the shared identity for both Creator and Clipper workspaces."
      />
      <section className={styles.panel}>
        <div className={styles.panelBody}>
          <dl className={styles.details}>
            <div>
              <dt>Address</dt>
              <dd>{session?.wallet}</dd>
            </div>
            <div>
              <dt>Cluster</dt>
              <dd>Solana Devnet</dd>
            </div>
            <div>
              <dt>Session storage</dt>
              <dd>Current browser tab</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <Link className={styles.button} href="/dashboard/settings/devnet">
              Devnet faucet
            </Link>
            <Link
              className={`${styles.button} ${styles.buttonSecondary}`}
              href="/dashboard/settings/youtube"
            >
              YouTube settings
            </Link>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              type="button"
              onClick={() => void logout()}
            >
              <WalletCards size={17} /> Disconnect & logout
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function CampaignDetail({
  id,
  creator,
}: {
  id: string;
  creator: boolean;
}) {
  const response = usePublicApi<{ campaign: Campaign }>(`/campaigns/${id}`);
  const campaign = response.data?.campaign;
  return (
    <>
      <PageHeader
        title={campaign?.title || "Campaign detail"}
        description={
          creator
            ? "Manage campaign funds, terms, and incoming submissions."
            : "Review the brief and eligibility requirements before selecting a video."
        }
        action={campaign && <StatusBadge status={campaign.status} />}
      />
      <DataState loading={response.isLoading} error={response.error} />
      {campaign && (
        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Brief</h2>
            </div>
            <div className={styles.panelBody}>
              <p>{campaign.brief}</p>
              <div className={styles.actions}>
                <a
                  className={styles.button}
                  href={campaign.source_video}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source video <ExternalLink size={15} />
                </a>
                {!creator && (
                  <Link
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    href={`/dashboard/settings/youtube?campaign=${id}`}
                  >
                    Connect YouTube
                  </Link>
                )}
              </div>
            </div>
          </section>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Campaign terms</h2>
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.details}>
                <div>
                  <dt>CPM</dt>
                  <dd>{formatAusdc(campaign.cpm)}</dd>
                </div>
                <div>
                  <dt>Max payout</dt>
                  <dd>{formatAusdc(campaign.max_payout_per_video)}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>{formatAusdc(campaign.total_funded)}</dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>{formatDate(campaign.end_time)}</dd>
                </div>
                <div>
                  <dt>Required mention</dt>
                  <dd>{campaign.required_mention}</dd>
                </div>
                <div>
                  <dt>Creator</dt>
                  <dd>{shortAddress(campaign.creator_wallet)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      )}
      {campaign &&
        (creator ? (
          <CampaignFundingActions campaignId={id} status={campaign.status} />
        ) : (
          <SubmitVideoForm campaignId={id} />
        ))}
      {creator && campaign && (
        <CreatorCampaignSubmissions campaignId={id} compact />
      )}
    </>
  );
}

export function CreatorCampaignSubmissions({
  campaignId,
  compact = false,
}: {
  campaignId: string;
  compact?: boolean;
}) {
  const response = useApi<{ submissions: Submission[] }>(
    `/campaigns/${campaignId}/submissions`
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Campaign submissions</h2>
        {compact && (
          <Link href={`/dashboard/creator/campaigns/${campaignId}/submissions`}>
            View all
          </Link>
        )}
      </div>
      <DataState
        loading={response.isLoading}
        error={response.error}
        empty={response.data?.submissions.length === 0}
      />
      {response.data && response.data.submissions.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Video</th>
                <th>Clipper</th>
                <th>Status</th>
                <th>Deadline</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {response.data.submissions
                .slice(0, compact ? 5 : undefined)
                .map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.title}</td>
                    <td>{shortAddress(submission.clipper_wallet)}</td>
                    <td>
                      <StatusBadge status={submission.status} />
                    </td>
                    <td>{formatDate(submission.review_deadline)}</td>
                    <td>
                      <Link
                        href={`/dashboard/creator/reviews/${submission.id}`}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SubmissionDetail({
  id,
  creator = false,
}: {
  id: string;
  creator?: boolean;
}) {
  const response = useApi<{
    submission: Submission & { creator_wallet?: string };
  }>(`/submissions/${id}`);
  const submission = response.data?.submission;
  return (
    <>
      <PageHeader
        title={submission?.title || "Submission detail"}
        description={
          creator
            ? "Review submissions against the campaign brief and locked terms hash."
            : "Track review progress, appeal windows, oracle updates, and reward claims."
        }
        action={submission && <StatusBadge status={submission.status} />}
      />
      <DataState loading={response.isLoading} error={response.error} />
      {submission && (
        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Submission</h2>
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.details}>
                <div>
                  <dt>YouTube video</dt>
                  <dd>
                    <a
                      href={`https://youtube.com/watch?v=${submission.youtube_video_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {submission.youtube_video_id} <ExternalLink size={12} />
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Clipper</dt>
                  <dd>{shortAddress(submission.clipper_wallet)}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{formatDate(submission.submitted_at)}</dd>
                </div>
                <div>
                  <dt>Review deadline</dt>
                  <dd>{formatDate(submission.review_deadline)}</dd>
                </div>
                <div>
                  <dt>Total paid</dt>
                  <dd>{formatAusdc(submission.total_paid)}</dd>
                </div>
              </dl>
            </div>
          </section>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Available actions</h2>
            </div>
            <div className={styles.panelBody}>
              <p>
                Transaction actions become active once the intent is validated
                and the simulation succeeds.
              </p>
            </div>
          </aside>
        </div>
      )}
      {submission &&
        (creator ? (
          <CreatorReviewActions
            submissionId={id}
            status={submission.status}
            appealedAt={submission.appealed_at}
          />
        ) : (
          <ClipperSubmissionActions
            submissionId={id}
            status={submission.status}
            appealedAt={submission.appealed_at}
          />
        ))}
    </>
  );
}
