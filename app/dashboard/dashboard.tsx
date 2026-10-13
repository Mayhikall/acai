"use client";

import Link from "next/link";
import { AcaiLogo } from "@/app/components/acai-logo";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  Eye,
  FileVideo,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import {
  campaignFor,
  campaigns,
  categories,
  compact,
  downloadCsv,
  isVideoUrl,
  money,
  number,
  parseVideoUrl,
  reward,
  sampleSubmissions,
  type Campaign,
  type Category,
  type Submission,
  type SubmissionStatus,
} from "./data";
import { PerformanceChart } from "./performance-chart";
import styles from "./dashboard.module.css";

type Screen =
  "Overview" | "Explore campaigns" | "My submissions" | "Earnings" | "Settings";
type ModalState =
  | { kind: "campaign"; campaign: Campaign }
  | { kind: "submit"; campaignId?: string }
  | { kind: "submission"; submission: Submission }
  | { kind: "help" }
  | { kind: "reset" }
  | null;
const storageKey = "acai-dashboard-v1";
const navigation = [
  { label: "Overview" as const, icon: LayoutDashboard },
  { label: "Explore campaigns" as const, icon: FolderOpen },
  { label: "My submissions" as const, icon: FileVideo },
  { label: "Earnings" as const, icon: Wallet },
];

function Modal({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${styles.modal} ${wide ? styles.wideModal : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modalInner}>
        <header className={styles.modalHeader}>
          <h2>{title}</h2>
          <button
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function Sidebar({
  screen,
  onNavigate,
  onHelp,
  name,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onHelp: () => void;
  name: string;
}) {
  return (
    <>
      <Link href="/" className={styles.wordmark} aria-label="Acai home">
        <AcaiLogo />
      </Link>
      <div className={styles.workspaceSelector}>
        <span className={styles.workspaceIcon}>
          <FileVideo size={19} aria-hidden="true" />
        </span>
        <div>
          <strong>Clipper workspace</strong>
          <span>Your creative corner</span>
        </div>
      </div>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.navigation} aria-label="Dashboard navigation">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            aria-current={screen === label ? "page" : undefined}
            className={screen === label ? styles.activeNav : ""}
            onClick={() => onNavigate(label)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {label === "Explore campaigns" && (
              <small aria-hidden="true">{campaigns.length}</small>
            )}
          </button>
        ))}
      </nav>
      <p className={styles.navLabel}>Preferences</p>
      <nav className={styles.navigation} aria-label="Workspace preferences">
        <button
          aria-current={screen === "Settings" ? "page" : undefined}
          className={screen === "Settings" ? styles.activeNav : ""}
          onClick={() => onNavigate("Settings")}
        >
          <Settings2 size={19} />
          <span>Settings</span>
        </button>
        <button onClick={onHelp}>
          <CircleHelp size={19} />
          <span>Help & getting started</span>
        </button>
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.sidebarCallout}>
          <div className={styles.calloutFrames} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <strong>
            Your next great clip
            <br />
            starts here.
          </strong>
          <p>Find a brief that feels like you.</p>
          <button onClick={() => onNavigate("Explore campaigns")}>
            Explore campaigns <ArrowRight size={15} />
          </button>
        </div>
        <button
          className={styles.profileButton}
          onClick={() => onNavigate("Settings")}
        >
          <span className={styles.avatar}>
            {(name || "You").slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{name || "Your workspace"}</strong>
            <small>Clipper account · Demo</small>
          </span>
          <ChevronRight size={17} />
        </button>
      </div>
    </>
  );
}

function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: Campaign;
  onOpen: () => void;
}) {
  return (
    <article className={styles.campaignCard}>
      <button
        className={`${styles.campaignArtwork} ${styles[campaign.tone]}`}
        onClick={onOpen}
        aria-label={`View ${campaign.creator} campaign`}
      >
        <span className={styles.artworkCategory}>{campaign.category}</span>
        <span className={styles.artworkWord}>{campaign.creator}</span>
        <span className={styles.artworkFrames} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.artworkCpm}>
          {money(campaign.cpm)} / 1K views
        </span>
      </button>
      <div className={styles.campaignInfo}>
        <div className={styles.campaignCreator}>
          <span
            className={`${styles.creatorInitials} ${styles[campaign.tone]}`}
          >
            {campaign.initials}
          </span>
          <div>
            <h3>{campaign.creator}</h3>
            <span>
              <FileVideo size={12} /> YouTube
            </span>
          </div>
          <button
            className={styles.iconButton}
            onClick={onOpen}
            aria-label={`Read ${campaign.creator} brief`}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <p>{campaign.name}</p>
        <div className={styles.budgetLabel}>
          <span>Budget remaining</span>
          <strong>
            {money(campaign.remaining)} <small>aUSDC</small>
          </strong>
        </div>
        <meter
          aria-label={`${campaign.creator} budget remaining`}
          min={0}
          max={campaign.budget}
          value={campaign.remaining}
        />
        <div className={styles.cardFooter}>
          <span>Example campaign</span>
          <button onClick={onOpen}>
            View brief <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Dashboard() {
  const [screen, setScreen] = useState<Screen>("Overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All campaigns");
  const [status, setStatus] = useState<"All statuses" | SubmissionStatus>(
    "All statuses"
  );
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<"views" | "earnings">("views");
  const [modal, setModal] = useState<ModalState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drafts, setDrafts] = useState<Submission[]>([]);
  const [profileName, setProfileName] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [ready, setReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (
            !parsed ||
            typeof parsed !== "object" ||
            !("drafts" in parsed) ||
            !Array.isArray(parsed.drafts) ||
            !("name" in parsed) ||
            typeof parsed.name !== "string"
          )
            throw new Error("Invalid workspace");
          const validDrafts = parsed.drafts.filter(
            (item: unknown): item is Submission =>
              !!item &&
              typeof item === "object" &&
              "id" in item &&
              typeof item.id === "string" &&
              "title" in item &&
              typeof item.title === "string" &&
              "url" in item &&
              typeof item.url === "string" &&
              isVideoUrl(item.url) &&
              "date" in item &&
              typeof item.date === "string" &&
              Number.isFinite(Date.parse(item.date)) &&
              "campaignId" in item &&
              campaigns.some((campaign) => campaign.id === item.campaignId) &&
              "status" in item &&
              item.status === "Draft" &&
              "views" in item &&
              item.views === 0
          );
          setDrafts(validDrafts);
          setProfileName(parsed.name.slice(0, 40));
        }
      } catch {
        setNotice(
          "Your saved workspace could not be loaded. You can reset local data in Settings."
        );
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !modal &&
        !mobileOpen
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal, mobileOpen]);

  const submissions = [...drafts, ...sampleSubmissions];
  const approved = submissions.filter((item) => item.status === "Approved");
  const pending = submissions.filter((item) => item.status === "In review");
  const earned = approved.reduce((sum, item) => sum + reward(item), 0);
  const verifiedViews = approved.reduce((sum, item) => sum + item.views, 0);
  const filteredCampaigns = campaigns.filter(
    (item) =>
      (category === "All campaigns" || item.category === category) &&
      `${item.creator} ${item.name} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const filteredSubmissions = submissions.filter(
    (item) =>
      (status === "All statuses" || item.status === status) &&
      `${item.title} ${campaignFor(item.campaignId).creator}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );

  function navigate(next: Screen) {
    setScreen(next);
    setQuery("");
    setMobileOpen(false);
    setStatus("All statuses");
    setCategory("All campaigns");
  }
  function openModal(next: ModalState) {
    setFormError("");
    setModal(next);
  }
  function persist(nextDrafts: Submission[], name: string) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ drafts: nextDrafts, name })
      );
      return true;
    } catch {
      setNotice(
        "Browser storage is unavailable. Changes will last until you leave or reload this page."
      );
      return false;
    }
  }
  function exportReport() {
    try {
      downloadCsv(filteredSubmissions);
      setNotice("Your demo report has been downloaded.");
    } catch {
      setNotice("The report could not be downloaded. Try exporting again.");
    }
  }
  function saveSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const campaignId = String(form.get("campaign"));
    let url: URL;
    try {
      url = parseVideoUrl(String(form.get("url")));
    } catch {
      setFormError(
        "Enter a valid HTTPS YouTube video or Shorts URL, including its video ID."
      );
      return;
    }
    if (!title || !campaigns.some((item) => item.id === campaignId)) {
      setFormError("Add a video title and choose a campaign.");
      return;
    }
    if (
      drafts.some(
        (item) => item.url === url.href && item.campaignId === campaignId
      )
    ) {
      setFormError("This video already has a draft for this campaign.");
      return;
    }
    const next = [
      {
        id: crypto.randomUUID(),
        title,
        campaignId,
        status: "Draft" as const,
        views: 0,
        date: new Date().toISOString(),
        url: url.href,
      },
      ...drafts,
    ];
    setDrafts(next);
    const saved = persist(next, profileName);
    setModal(null);
    navigate("My submissions");
    if (saved)
      setNotice(
        "Video draft saved on this browser. It has not been submitted for review."
      );
  }

  const sidebarProps = {
    screen,
    onNavigate: navigate,
    onHelp: () => {
      setMobileOpen(false);
      openModal({ kind: "help" });
    },
    name: profileName,
  };
  const heading =
    screen === "Overview"
      ? `Your creativity, in motion${profileName ? `, ${profileName}` : ""}.`
      : screen === "Explore campaigns"
        ? "Find your next great clip."
        : screen === "My submissions"
          ? "Every clip, in one place."
          : screen === "Earnings"
            ? "A clear view of your earnings."
            : "Make yourself at home.";
  const subtitle =
    screen === "Overview"
      ? "A little progress, every day. Here’s how your clips are doing."
      : screen === "Explore campaigns"
        ? "Discover a brief you connect with. Read the terms before you create."
        : screen === "My submissions"
          ? "Keep track of your videos, their review status, and your local drafts."
          : screen === "Earnings"
            ? "Preview how approved views translate into campaign rewards."
            : "Manage your local workspace and demo data.";

  function submissionTable(limit?: number) {
    const visible = limit
      ? filteredSubmissions.slice(0, limit)
      : filteredSubmissions;
    return visible.length ? (
      <div className={styles.tableScroll}>
        <table className={styles.submissionTable}>
          <thead>
            <tr>
              <th scope="col">Video</th>
              <th scope="col">Campaign</th>
              <th scope="col">Status</th>
              <th scope="col" className={styles.numeric}>
                Views
              </th>
              <th scope="col" className={styles.numeric}>
                Reward
              </th>
              <th scope="col">
                <span className={styles.srOnly}>Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const campaign = campaignFor(item.campaignId);
              return (
                <tr key={item.id}>
                  <td>
                    <button
                      className={styles.videoTitle}
                      onClick={() =>
                        openModal({ kind: "submission", submission: item })
                      }
                    >
                      <span
                        className={`${styles.videoThumb} ${styles[campaign.tone]}`}
                      >
                        <FileVideo size={18} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {new Date(item.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "Asia/Jakarta",
                          })}{" "}
                          ·{" "}
                          {item.status === "Draft"
                            ? "Local draft"
                            : "Example video"}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{campaign.creator}</td>
                  <td>
                    <span
                      className={`${styles.status} ${item.status === "Approved" ? styles.approved : item.status === "In review" ? styles.pending : styles.draft}`}
                    >
                      {item.status === "Approved" ? (
                        <Check size={12} />
                      ) : item.status === "In review" ? (
                        <Clock3 size={12} />
                      ) : (
                        <FileVideo size={12} />
                      )}
                      {item.status}
                    </span>
                  </td>
                  <td className={styles.numeric}>{compact(item.views)}</td>
                  <td className={styles.numeric}>{money(reward(item))}</td>
                  <td>
                    <button
                      className={styles.iconButton}
                      onClick={() =>
                        openModal({ kind: "submission", submission: item })
                      }
                      aria-label={`Details for ${item.title}`}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className={styles.emptyState}>
        <Search size={26} />
        <h3>No matching submissions</h3>
        <p>Try a different title, campaign, or status.</p>
        <button
          className={styles.secondaryButton}
          onClick={() => {
            setQuery("");
            setStatus("All statuses");
          }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <a className={styles.skipLink} href="#dashboard-content">
        Skip to dashboard
      </a>
      <aside className={styles.sidebar}>
        <Sidebar {...sidebarProps} />
      </aside>
      {mobileOpen && (
        <Modal title="Workspace menu" onClose={() => setMobileOpen(false)}>
          <div className={styles.mobileSidebar}>
            <Sidebar {...sidebarProps} />
          </div>
        </Modal>
      )}
      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <button
              className={`${styles.iconButton} ${styles.mobileMenu}`}
              onClick={() => setMobileOpen(true)}
              aria-label="Open workspace menu"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{screen}</strong>
          </div>
          <div className={styles.topbarRight}>
            <label className={styles.search}>
              <Search size={16} />
              <input
                ref={searchRef}
                placeholder="Search your workspace…"
                aria-label="Search campaigns and submissions"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (screen === "Settings") setScreen("Explore campaigns");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className={styles.demoTag}>Demo workspace</span>
            <button
              className={styles.iconButton}
              onClick={() => openModal({ kind: "help" })}
              aria-label="About this demo workspace"
            >
              <CircleHelp size={19} />
            </button>
            <button
              className={styles.topbarAvatar}
              onClick={() => navigate("Settings")}
              aria-label="Open workspace settings"
            >
              {(profileName || "You").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main id="dashboard-content" className={styles.main}>
          <div className={styles.pageHeading}>
            <div>
              <h1>{heading}</h1>
              <p>{subtitle}</p>
            </div>
            <div className={styles.headingActions}>
              <button className={styles.secondaryButton} onClick={exportReport}>
                <ArrowDownToLine size={16} />
                <span>Export report</span>
              </button>
              <button
                className={styles.primaryButton}
                disabled={!ready}
                onClick={() => openModal({ kind: "submit" })}
              >
                <Plus size={17} />
                Submit a video
              </button>
            </div>
          </div>
          {notice && (
            <div className={styles.notice} role="status">
              <span>{notice}</span>
              <button
                className={styles.iconButton}
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className={styles.demoNote}>
            <span className={styles.demoNoteIcon}>
              <Eye size={15} />
            </span>
            <p>
              You’re exploring a demo. Campaigns and performance are examples;
              your drafts stay in this browser.
            </p>
            <button onClick={() => openModal({ kind: "help" })}>
              How it works <ArrowRight size={14} />
            </button>
          </div>

          {(screen === "Overview" || screen === "Earnings") && (
            <>
              <section
                className={styles.stats}
                aria-label="Example submission totals"
              >
                <article>
                  <div className={styles.statLabel}>
                    Total earned <Wallet size={17} />
                  </div>
                  <div className={styles.statValue}>
                    {money(earned)}
                    <span>aUSDC</span>
                  </div>
                  <p>From {approved.length} approved example videos</p>
                </article>
                <article>
                  <div className={styles.statLabel}>
                    Verified views <Eye size={18} />
                  </div>
                  <div className={styles.statValue}>
                    {number(verifiedViews)}
                  </div>
                  <p>Across approved example submissions</p>
                </article>
                <article>
                  <div className={styles.statLabel}>
                    Submitted videos <FileVideo size={17} />
                  </div>
                  <div className={styles.statValue}>
                    {sampleSubmissions.length}
                    <span className={styles.statPill}>
                      {drafts.length} local drafts
                    </span>
                  </div>
                  <p>Your drafts are ready for your next step</p>
                </article>
                <article>
                  <div className={styles.statLabel}>
                    Awaiting review <Clock3 size={17} />
                  </div>
                  <div className={styles.statValue}>
                    {pending.length}
                    <span className={styles.pendingPill}>In review</span>
                  </div>
                  <p>
                    {money(
                      pending.reduce((sum, item) => sum + reward(item), 0)
                    )}{" "}
                    in potential example rewards
                  </p>
                </article>
              </section>
              <div className={styles.analyticsGrid}>
                <section className={styles.panel}>
                  <header className={styles.panelHeader}>
                    <div>
                      <h2>Content performance</h2>
                      <p>See how sample views build over time.</p>
                    </div>
                    <label className={styles.selectWrap}>
                      <span className={styles.srOnly}>Performance period</span>
                      <select
                        value={days}
                        onChange={(event) =>
                          setDays(Number(event.target.value))
                        }
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                      </select>
                      <ChevronDown size={14} />
                    </label>
                  </header>
                  <PerformanceChart
                    days={days}
                    metric={metric}
                    onMetricChange={setMetric}
                  />
                </section>
                <section className={`${styles.panel} ${styles.earningsPanel}`}>
                  <header className={styles.panelHeader}>
                    <div>
                      <h2>Earnings by campaign</h2>
                      <p>Approved example submissions</p>
                    </div>
                    <Wallet size={18} />
                  </header>
                  <div className={styles.donutWrap}>
                    <div
                      className={styles.donut}
                      style={{
                        background: `conic-gradient(#18181b 0% .5%, #b49aff .5% ${(reward(approved[0]) / earned) * 100 - 0.5}%, #18181b ${(reward(approved[0]) / earned) * 100 - 0.5}% ${(reward(approved[0]) / earned) * 100 + 0.5}%, #7760b9 ${(reward(approved[0]) / earned) * 100 + 0.5}% ${((reward(approved[0]) + reward(approved[1])) / earned) * 100 - 0.5}%, #18181b ${((reward(approved[0]) + reward(approved[1])) / earned) * 100 - 0.5}% ${((reward(approved[0]) + reward(approved[1])) / earned) * 100 + 0.5}%, #ddd1fc ${((reward(approved[0]) + reward(approved[1])) / earned) * 100 + 0.5}% 99.5%, #18181b 99.5% 100%)`,
                      }}
                      role="img"
                      aria-label={`Example earnings: ${approved.map((item) => `${campaignFor(item.campaignId).creator} ${money(reward(item))}`).join(", ")}`}
                    >
                      <div>
                        <span>Total earned</span>
                        <strong>{money(earned)}</strong>
                        <small>aUSDC</small>
                      </div>
                    </div>
                  </div>
                  <div className={styles.earningsLegend}>
                    {approved.map((item, index) => (
                      <div key={item.id}>
                        <span
                          className={`${styles.legendSwatch} ${styles[`swatch${index}`]}`}
                        />
                        <span>{campaignFor(item.campaignId).creator}</span>
                        <strong>{money(reward(item))}</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.panelLink}
                    onClick={() =>
                      screen === "Earnings"
                        ? exportReport()
                        : navigate("Earnings")
                    }
                  >
                    {screen === "Earnings"
                      ? "Download earnings report"
                      : "View earnings breakdown"}
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </>
          )}

          {(screen === "Overview" || screen === "Explore campaigns") && (
            <section className={styles.campaignSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>
                    {screen === "Overview"
                      ? "A brief with your name on it."
                      : "Explore example campaigns"}
                  </h2>
                  <p>Good content starts with a campaign you care about.</p>
                </div>
                {screen === "Overview" && (
                  <button
                    className={styles.textButton}
                    onClick={() => navigate("Explore campaigns")}
                  >
                    View all campaigns <ArrowRight size={16} />
                  </button>
                )}
              </div>
              <div className={styles.campaignFilters}>
                <div
                  className={styles.categoryTabs}
                  aria-label="Campaign categories"
                >
                  {categories.map((item) => (
                    <button
                      key={item}
                      aria-pressed={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <span className={styles.resultCount}>
                  {filteredCampaigns.length} campaigns
                </span>
              </div>
              {filteredCampaigns.length ? (
                <div className={styles.campaignGrid}>
                  {filteredCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onOpen={() => openModal({ kind: "campaign", campaign })}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FolderOpen size={28} />
                  <h3>No campaigns match your search</h3>
                  <p>Try another name or explore all categories.</p>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setQuery("");
                      setCategory("All campaigns");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          )}

          {(screen === "Overview" ||
            screen === "My submissions" ||
            screen === "Earnings") && (
            <section className={`${styles.panel} ${styles.submissionsPanel}`}>
              <header className={styles.panelHeader}>
                <div>
                  <h2>
                    {screen === "Earnings"
                      ? "Example reward breakdown"
                      : screen === "My submissions"
                        ? "Your videos & drafts"
                        : "Your recent submissions"}
                  </h2>
                  <p>
                    {screen === "Earnings"
                      ? "Amounts shown in aUSDC. Only approved videos earn rewards."
                      : "The work you’ve put out, and what’s happening next."}
                  </p>
                </div>
                {screen === "Overview" ? (
                  <button
                    className={styles.secondaryButton}
                    onClick={() => navigate("My submissions")}
                  >
                    View all <ArrowRight size={14} />
                  </button>
                ) : (
                  <label className={styles.selectWrap}>
                    <SlidersHorizontal size={14} />
                    <span className={styles.srOnly}>Submission status</span>
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as typeof status)
                      }
                    >
                      {["All statuses", "Approved", "In review", "Draft"].map(
                        (item) => (
                          <option key={item}>{item}</option>
                        )
                      )}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                )}
              </header>
              {submissionTable(screen === "Overview" ? 5 : undefined)}
              <div className={styles.tableFooter}>
                <span>
                  {filteredSubmissions.length} videos & drafts · Example rewards
                  in aUSDC
                </span>
                <span>Views count after submission</span>
              </div>
            </section>
          )}

          {screen === "Settings" && (
            <div className={styles.settingsGrid}>
              <section className={styles.panel}>
                <header className={styles.panelHeader}>
                  <div>
                    <h2>Your workspace</h2>
                    <p>A name to make this space yours.</p>
                  </div>
                  <Settings2 size={18} />
                </header>
                <form
                  key={profileName}
                  className={styles.settingsForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = String(
                      new FormData(event.currentTarget).get("name") || ""
                    ).trim();
                    setProfileName(name);
                    if (persist(drafts, name))
                      setNotice("Workspace name saved in this browser.");
                  }}
                >
                  <label>
                    Display name
                    <input
                      name="name"
                      maxLength={40}
                      defaultValue={profileName}
                      placeholder="Your name"
                      autoComplete="nickname"
                    />
                  </label>
                  <p>
                    This changes your local workspace name. It does not create
                    an account.
                  </p>
                  <button
                    className={styles.primaryButton}
                    disabled={!ready}
                    type="submit"
                  >
                    <Check size={16} />
                    Save changes
                  </button>
                </form>
              </section>
              <section className={styles.panel}>
                <header className={styles.panelHeader}>
                  <div>
                    <h2>Your local data</h2>
                    <p>You’re in control of your drafts.</p>
                  </div>
                </header>
                <div className={styles.settingsForm}>
                  <p>
                    {drafts.length} video drafts stored in this browser. Demo
                    performance is illustrative; wallet, YouTube verification,
                    and payouts are not connected in this preview.
                  </p>
                  <button
                    className={styles.secondaryButton}
                    onClick={exportReport}
                  >
                    <ArrowDownToLine size={16} />
                    Download report
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={!ready}
                    onClick={() => openModal({ kind: "reset" })}
                  >
                    Reset local workspace
                  </button>
                </div>
              </section>
            </div>
          )}
          <footer className={styles.footer}>
            <span>Made for the moments worth sharing.</span>
            <Link href="/">
              Acai home <ExternalLink size={13} />
            </Link>
          </footer>
        </main>
      </div>

      {modal?.kind === "campaign" && (
        <Modal
          title={modal.campaign.creator}
          onClose={() => setModal(null)}
          wide
        >
          <div
            className={`${styles.briefArtwork} ${styles[modal.campaign.tone]}`}
          >
            <span>{modal.campaign.category} · Example campaign</span>
            <strong>{modal.campaign.name}</strong>
          </div>
          <div className={styles.briefStats}>
            <div>
              <span>Rate / 1,000 views</span>
              <strong>{money(modal.campaign.cpm)} aUSDC</strong>
            </div>
            <div>
              <span>Maximum / video</span>
              <strong>{money(modal.campaign.maxPayout)} aUSDC</strong>
            </div>
            <div>
              <span>Budget remaining</span>
              <strong>{money(modal.campaign.remaining)} aUSDC</strong>
            </div>
          </div>
          <div className={styles.briefBody}>
            <h3>The brief</h3>
            <p>{modal.campaign.brief}</p>
            <h3>Before you publish</h3>
            <ul>
              <li>Publish a public YouTube video from your own channel.</li>
              <li>
                Include {modal.campaign.mention} and confirm your content
                rights.
              </li>
              <li>
                Views are counted from submission; rewards require approval.
              </li>
              <li>
                This is a sample brief. Saving creates a local draft only.
              </li>
            </ul>
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setModal(null)}
            >
              Close brief
            </button>
            <button
              className={styles.primaryButton}
              onClick={() =>
                openModal({ kind: "submit", campaignId: modal.campaign.id })
              }
            >
              <Plus size={16} />
              Prepare a video draft
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "submit" && (
        <Modal title="Prepare your video" onClose={() => setModal(null)}>
          <p className={styles.modalIntro}>
            Keep your published video and campaign together. This saves a local
            draft; it does not send a submission or verify views.
          </p>
          <form className={styles.submissionForm} onSubmit={saveSubmission}>
            <label>
              Campaign
              <select
                name="campaign"
                aria-label="Campaign"
                defaultValue={modal.campaignId || ""}
                required
              >
                <option value="" disabled>
                  Select an example campaign
                </option>
                {campaigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.creator} · {money(item.cpm)} / 1K views
                  </option>
                ))}
              </select>
            </label>
            <label>
              Video title
              <input
                name="title"
                placeholder="Give your clip a title"
                maxLength={100}
                required
              />
            </label>
            <label>
              YouTube video URL
              <input
                name="url"
                type="url"
                placeholder="https://www.youtube.com/shorts/…"
                required
                aria-describedby="video-url-help"
              />
            </label>
            <p id="video-url-help" className={styles.fieldHelp}>
              Use a YouTube watch, Shorts, live, or youtu.be video link.
            </p>
            <label className={styles.checkboxLabel}>
              <input name="rights" type="checkbox" required />
              <span>
                I have permission to use this content and have read the example
                brief.
              </span>
            </label>
            {formError && (
              <p className={styles.formError} role="alert">
                {formError}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className={styles.primaryButton} type="submit">
                <Check size={16} />
                Save video draft
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === "submission" && (
        <Modal title="Video details" onClose={() => setModal(null)}>
          <div className={styles.submissionDetail}>
            <span
              className={`${styles.status} ${modal.submission.status === "Approved" ? styles.approved : modal.submission.status === "Draft" ? styles.draft : styles.pending}`}
            >
              {modal.submission.status}
            </span>
            <h3>{modal.submission.title}</h3>
            <p>{campaignFor(modal.submission.campaignId).creator}</p>
            <dl>
              <div>
                <dt>Views</dt>
                <dd>{number(modal.submission.views)}</dd>
              </div>
              <div>
                <dt>
                  {modal.submission.status === "Approved"
                    ? "Example reward"
                    : "Potential example reward"}
                </dt>
                <dd>{money(reward(modal.submission))} aUSDC</dd>
              </div>
            </dl>
            {modal.submission.status === "Draft" ? (
              <>
                <p>
                  This draft is saved on this browser. It has not been sent to a
                  creator or verified by YouTube.
                </p>
                <a
                  className={styles.secondaryButton}
                  href={modal.submission.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open your video <ExternalLink size={15} />
                </a>
              </>
            ) : (
              <p>
                This video and its performance are example data for the Acai
                dashboard preview.
              </p>
            )}
          </div>
          <div className={styles.modalActions}>
            {modal.submission.status === "Draft" && (
              <button
                className={styles.dangerButton}
                onClick={() => {
                  const next = drafts.filter(
                    (item) => item.id !== modal.submission.id
                  );
                  setDrafts(next);
                  if (persist(next, profileName))
                    setNotice("Local video draft removed.");
                  setModal(null);
                }}
              >
                Remove draft
              </button>
            )}
            <button
              className={styles.secondaryButton}
              onClick={() => setModal(null)}
            >
              Close details
            </button>
          </div>
        </Modal>
      )}

      {modal?.kind === "help" && (
        <Modal
          title="A space for your next clip"
          onClose={() => setModal(null)}
        >
          <div className={styles.helpContent}>
            <p>
              Explore Acai’s clipper workflow with clearly labeled example
              campaigns and performance data.
            </p>
            <div>
              <FolderOpen size={22} />
              <section>
                <h3>Find a campaign</h3>
                <p>
                  Compare the brief, rate per 1,000 views, budget, and maximum
                  reward per video.
                </p>
              </section>
            </div>
            <div>
              <FileVideo size={22} />
              <section>
                <h3>Make and organize your clip</h3>
                <p>
                  Publish your video on YouTube, then save a draft with its link
                  and campaign in this browser.
                </p>
              </section>
            </div>
            <div>
              <CheckCheck size={22} />
              <section>
                <h3>Understand the review</h3>
                <p>
                  In the full product, views count from submission and rewards
                  require approval. This preview does not connect a wallet,
                  verify videos, or process payouts.
                </p>
              </section>
            </div>
            <p>
              aUSDC is the mock payment token specified for Acai on Solana
              Devnet. Example amounts are not real funds.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => {
              setModal(null);
              navigate("Explore campaigns");
            }}
          >
            Explore example campaigns <ArrowRight size={16} />
          </button>
        </Modal>
      )}

      {modal?.kind === "reset" && (
        <Modal title="Reset this workspace?" onClose={() => setModal(null)}>
          <p className={styles.modalIntro}>
            This removes your {drafts.length} local video drafts and workspace
            name from this browser. Example campaigns and performance will still
            be available.
          </p>
          <div className={styles.modalActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setModal(null)}
            >
              Keep my workspace
            </button>
            <button
              className={styles.dangerButton}
              onClick={() => {
                try {
                  localStorage.removeItem(storageKey);
                  setDrafts([]);
                  setProfileName("");
                  setNotice("Local workspace reset.");
                  setModal(null);
                } catch {
                  setFormError(
                    "Browser storage could not be cleared. Check your browser permissions and try again."
                  );
                }
              }}
            >
              Reset workspace
            </button>
          </div>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
