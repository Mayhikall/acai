export type Category =
  "All campaigns" | "Podcast" | "Lifestyle" | "Gaming" | "Technology";
export type SubmissionStatus = "Approved" | "In review" | "Draft";

export interface Campaign {
  id: string;
  name: string;
  creator: string;
  category: Exclude<Category, "All campaigns">;
  initials: string;
  tone: string;
  cpm: number;
  budget: number;
  remaining: number;
  maxPayout: number;
  brief: string;
  mention: string;
}

export interface Submission {
  id: string;
  title: string;
  campaignId: string;
  status: SubmissionStatus;
  views: number;
  date: string;
  url: string;
}

export const campaigns: Campaign[] = [
  {
    id: "afterhours",
    name: "Good conversations. Great clips.",
    creator: "After Hours",
    category: "Podcast",
    initials: "ah",
    tone: "violet",
    cpm: 3,
    budget: 4000,
    remaining: 2840,
    maxPayout: 250,
    brief:
      "Turn an insightful conversation into a 20–60 second clip. Open with a compelling quote, keep the speaker in frame, and add readable captions. Use only the source footage provided in the campaign.",
    mention: "@afterhours",
  },
  {
    id: "offscript",
    name: "Find your everyday story.",
    creator: "Offscript Studio",
    category: "Lifestyle",
    initials: "os",
    tone: "peach",
    cpm: 2.5,
    budget: 3000,
    remaining: 1950,
    maxPayout: 200,
    brief:
      "Make an everyday moment worth watching. Edit a 15–45 second story with a clear beginning and end. Add captions, credit the source, and use footage you have permission to publish.",
    mention: "@offscript",
  },
  {
    id: "respawn",
    name: "One play. Every angle.",
    creator: "Respawn",
    category: "Gaming",
    initials: "r",
    tone: "mint",
    cpm: 4,
    budget: 5000,
    remaining: 3650,
    maxPayout: 300,
    brief:
      "Find a standout gaming moment and build a short highlight around it. Include the setup, the play, and the reaction. Keep the edit under 60 seconds and credit the original streamer.",
    mention: "@respawn",
  },
  {
    id: "futureform",
    name: "Make the next thing make sense.",
    creator: "Future Form",
    category: "Technology",
    initials: "ff",
    tone: "blue",
    cpm: 3.5,
    budget: 2500,
    remaining: 1875,
    maxPayout: 225,
    brief:
      "Explain one useful technology idea in under a minute. Show what it does, use plain language, and include accurate captions. Avoid unsupported product or performance claims.",
    mention: "@futureform",
  },
];

export const sampleSubmissions: Submission[] = [
  {
    id: "sample-1",
    title: "The advice nobody gives you",
    campaignId: "afterhours",
    status: "Approved",
    views: 48200,
    date: "2026-10-10T09:00:00Z",
    url: "",
  },
  {
    id: "sample-2",
    title: "A slower kind of morning",
    campaignId: "offscript",
    status: "Approved",
    views: 32600,
    date: "2026-10-08T09:00:00Z",
    url: "",
  },
  {
    id: "sample-3",
    title: "The comeback starts here",
    campaignId: "respawn",
    status: "Approved",
    views: 24800,
    date: "2026-10-06T09:00:00Z",
    url: "",
  },
  {
    id: "sample-4",
    title: "Small idea, big difference",
    campaignId: "futureform",
    status: "In review",
    views: 12600,
    date: "2026-10-12T09:00:00Z",
    url: "",
  },
  {
    id: "sample-5",
    title: "Listen to this part again",
    campaignId: "afterhours",
    status: "In review",
    views: 8500,
    date: "2026-10-11T09:00:00Z",
    url: "",
  },
];

export const categories: Category[] = [
  "All campaigns",
  "Podcast",
  "Lifestyle",
  "Gaming",
  "Technology",
];
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const campaignFor = (id: string) =>
  campaigns.find((campaign) => campaign.id === id)!;
export const reward = (submission: Submission) =>
  Math.min(
    (submission.views / 1000) * campaignFor(submission.campaignId).cpm,
    campaignFor(submission.campaignId).maxPayout
  );

export function parseVideoUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const videoId =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : /^\/(shorts|live)\//.test(url.pathname)
          ? url.pathname.split("/")[2]
          : null;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
      host
    ) ||
    !videoId ||
    !/^[A-Za-z0-9_-]{11}$/.test(videoId)
  )
    throw new Error("Invalid YouTube video");
  return url;
}

export function isVideoUrl(value: string) {
  try {
    parseVideoUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function downloadCsv(submissions: Submission[]) {
  const escape = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const lines = [
    ["Acai demo workspace", "Example data and local drafts; no real payouts"],
    ["Title", "Campaign", "Status", "Views", "Example reward (aUSDC)", "Date"],
    ...submissions.map((item) => [
      item.title,
      campaignFor(item.campaignId).creator,
      item.status,
      String(item.views),
      reward(item).toFixed(2),
      item.date,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.map((line) => line.map(escape).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "acai-demo-report.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
