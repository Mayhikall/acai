"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Film,
  Gamepad2,
  Layers3,
  Menu,
  MonitorSmartphone,
  Pause,
  Play,
  Scissors,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { Hero, type Audience } from "@/app/components/ui/hero-1";
import { EarningsCalculator } from "@/app/components/landing/earnings-calculator";
import { StartDialog } from "@/app/components/landing/start-dialog";
import { AcaiLogo } from "@/app/components/acai-logo";

const navigation = [
  ["How it works", "how-it-works"],
  ["Browse campaigns", "campaigns"],
  ["For brands", "brands"],
] as const;

const steps = [
  {
    title: "Find your brief",
    description:
      "Choose a subject you know. Read the content guidelines, eligible view rules, and rate before you start.",
    icon: FileText,
    label: "Read the direction",
  },
  {
    title: "Make it your own",
    description:
      "Find the moment, build your hook, and edit for the feed. Check the content rights before publishing.",
    icon: Scissors,
    label: "Edit, caption, publish",
  },
  {
    title: "Keep track of your work",
    description:
      "Keep your published link and analytics together. Follow the campaign's review and payment terms.",
    icon: Upload,
    label: "Save the link & analytics",
  },
];

const categories = [
  {
    name: "Lifestyle",
    title: "Life, in little moments.",
    icon: Smartphone,
    className: "category-lifestyle",
    format: "Daily stories",
  },
  {
    name: "Gaming",
    title: "Make the highlight count.",
    icon: Gamepad2,
    className: "category-gaming",
    format: "Clips & highlights",
  },
  {
    name: "Film & culture",
    title: "Find a different angle.",
    icon: Film,
    className: "category-film",
    format: "Stories & commentary",
  },
  {
    name: "Tech",
    title: "Show what it can do.",
    icon: MonitorSmartphone,
    className: "category-tech",
    format: "Demos & discoveries",
  },
];

const checklistItems = [
  "The opening makes me want to watch",
  "Captions are clear on a small screen",
  "The clip follows the campaign brief",
  "I have permission to use the content",
];

const questions = [
  {
    question: "What is content clipping?",
    answer:
      "Clipping means turning source footage into a shorter, focused piece of content. It could be a highlight, a useful explanation, or a moment that tells a story. Always check that you have permission to use the original footage.",
  },
  {
    question: "How does the earnings calculator work?",
    answer:
      "It multiplies the number of views by the example rate per 1,000 views. The result is an illustration, not a promised payout. A real campaign defines its own rate, eligible views, review process, and payment terms.",
  },
  {
    question: "Do I need a large following to start?",
    answer:
      "Eligibility depends on the campaign. Read the brief for supported platforms, account requirements, and content guidelines before making a clip. A clear hook and a relevant story are useful at any audience size.",
  },
  {
    question: "What should a brand include in a campaign brief?",
    answer:
      "Start with the audience, the message, and the kind of content you want. Include source materials, usage permissions, required mentions, deadlines, budget, and the rules for reviewing views and paying creators.",
  },
  {
    question: "What happens when I choose Get Started?",
    answer:
      "You can prepare a creator plan or a brand campaign brief and download it as a text file. This landing-page planner does not create an account, publish a campaign, submit content, or process a payment.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(true);
  const [start, setStart] = useState<{
    audience: Audience;
    category: string;
  } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [checked, setChecked] = useState<string[]>([checklistItems[0]]);
  const [platform, setPlatform] = useState("TikTok");
  const [previewAudience, setPreviewAudience] = useState<Audience>("creator");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPaused(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  function openStart(audience: Audience, category = "") {
    if (menuOpen) menuButtonRef.current?.focus();
    setMenuOpen(false);
    setStart({ audience, category });
  }

  const CurrentStepIcon = steps[activeStep].icon;

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header page-container">
        <a className="wordmark" href="#home" aria-label="Acai home">
          <AcaiLogo />
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(([label, id]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="header-explore" href="/dashboard">
            Dashboard
          </Link>
          <button
            className="action-button action-button-small"
            onClick={() => openStart("creator")}
          >
            Get Started
          </button>
        </div>
        <button
          ref={menuButtonRef}
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          {navigation.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </Link>
          <a href="#creators" onClick={() => setMenuOpen(false)}>
            For creators
          </a>
          <button
            className="action-button"
            onClick={() => openStart("creator")}
          >
            Get Started
          </button>
        </nav>
      </header>

      <main id="main">
        <div id="home" className="landing-hero-shell">
          <Hero
            title={
              <>
                Get paid to make
                <br />
                content, from
                <br />
                anywhere.
              </>
            }
            subtitle={
              <>
                Find your next campaign. Make a clip worth watching. <br />
                Explore what your content could earn.
              </>
            }
            onGetStarted={(audience) => openStart(audience)}
            paused={paused || start !== null}
          />
          <button
            className="hero-motion-toggle"
            onClick={() => setPaused(!paused)}
            aria-label={
              paused ? "Play background motion" : "Pause background motion"
            }
          >
            {paused ? (
              <Play size={13} fill="currentColor" />
            ) : (
              <Pause size={13} fill="currentColor" />
            )}
            <span>{paused ? "Play motion" : "Pause motion"}</span>
          </button>
        </div>

        <section
          className="intro-strip page-container"
          aria-label="The creator workflow"
        >
          <p>
            Your content.
            <br />
            <strong>A new possibility.</strong>
          </p>
          <div>
            <FileText size={21} aria-hidden="true" />
            <span>
              Find a campaign
              <br />
              <strong>Start with a clear brief</strong>
            </span>
          </div>
          <div>
            <Scissors size={21} aria-hidden="true" />
            <span>
              Create your clip
              <br />
              <strong>Put your perspective in it</strong>
            </span>
          </div>
          <div>
            <Layers3 size={21} aria-hidden="true" />
            <span>
              Understand the numbers
              <br />
              <strong>Explore views and rates</strong>
            </span>
          </div>
        </section>

        <section
          className="creator-section section-spacing page-container"
          id="creators"
          aria-labelledby="creators-title"
        >
          <div className="section-heading">
            <p className="section-kicker">For creators</p>
            <h2 id="creators-title">
              Good content starts
              <br />
              with a little clarity.
            </h2>
            <p>
              From the first idea to the final clip, get a feel for the work
              <br className="desktop-break" /> and the numbers behind it.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card earnings-card">
              <div className="feature-copy">
                <span className="feature-symbol">
                  <Layers3 size={23} aria-hidden="true" />
                </span>
                <h3>See what your views could earn.</h3>
                <p>
                  Adjust the views and sample rate. Get to know the numbers
                  before choosing a campaign.
                </p>
              </div>
              <EarningsCalculator />
            </article>

            <article className="feature-card workflow-card" id="how-it-works">
              <div className="feature-copy">
                <h3>A simple path from idea to clip.</h3>
                <p>Choose a step to take a closer look.</p>
              </div>
              <div className="workflow-steps" aria-label="Clipping steps">
                {steps.map((step, index) => (
                  <button
                    key={step.title}
                    className={
                      activeStep === index
                        ? "workflow-step is-active"
                        : "workflow-step"
                    }
                    aria-pressed={activeStep === index}
                    onClick={() => setActiveStep(index)}
                  >
                    <span className="step-number">{index + 1}</span>
                    <span>{step.title}</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="step-preview" aria-live="polite">
                <CurrentStepIcon
                  size={28}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <strong>{steps[activeStep].label}</strong>
                <p>{steps[activeStep].description}</p>
              </div>
            </article>

            <article className="feature-card campaign-card" id="campaigns">
              <div className="feature-copy">
                <h3>Find your kind of content.</h3>
                <p>Pick an example category to start planning a clip.</p>
              </div>
              <div className="category-grid">
                {categories.map(
                  ({ name, title, icon: Icon, className, format }) => (
                    <button
                      key={name}
                      className={`category-card ${className}`}
                      onClick={() => openStart("creator", name)}
                      aria-label={`Plan a ${name} clip`}
                    >
                      <span className="category-art">
                        <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
                        <strong>{title}</strong>
                      </span>
                      <span className="category-caption">
                        <span>
                          <strong>{name}</strong>
                          <small>{format}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </button>
                  )
                )}
              </div>
              <p className="card-footnote">
                Category examples, not live campaign listings.
              </p>
            </article>

            <article className="feature-card checklist-card">
              <div className="feature-copy">
                <h3>Before you hit publish.</h3>
                <p>
                  A few small checks make a better clip. Try your pre-publish
                  checklist.
                </p>
              </div>
              <div className="checklist">
                {checklistItems.map((item) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={checked.includes(item)}
                      onChange={(event) =>
                        setChecked(
                          event.target.checked
                            ? [...checked, item]
                            : checked.filter((value) => value !== item)
                        )
                      }
                    />
                    <span className="checklist-box" aria-hidden="true">
                      {checked.includes(item) && <Check size={14} />}
                    </span>
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <div className="checklist-progress">
                <span>
                  {checked.length} of {checklistItems.length} checked
                </span>
                <span>
                  {checked.length === checklistItems.length
                    ? "Ready for a final review"
                    : "A little attention goes a long way"}
                </span>
              </div>
            </article>

            <article className="feature-card format-card">
              <div className="feature-copy">
                <h3>Think in short form.</h3>
                <p>Different feeds. The same need for a strong first second.</p>
              </div>
              <div
                className="platform-picker"
                aria-label="Preview a content platform"
              >
                {["TikTok", "Reels", "Shorts"].map((name) => (
                  <button
                    key={name}
                    aria-pressed={platform === name}
                    className={platform === name ? "is-active" : ""}
                    onClick={() => setPlatform(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div
                className={`vertical-preview platform-${platform.toLowerCase()}`}
                aria-label={`${platform} vertical layout preview`}
              >
                <span className="preview-platform">{platform} · 9:16</span>
                <div className="clip-type">
                  <span>Make the first</span>
                  <strong>
                    second
                    <br />
                    count.
                  </strong>
                </div>
                <span className="preview-caption">
                  Hook. Story. A reason to keep watching.
                </span>
              </div>
              <p className="card-footnote">An example content layout.</p>
            </article>

            <article className="feature-card brand-card" id="brands">
              <div className="feature-copy">
                <p className="section-kicker">For brands</p>
                <h3>
                  Better content begins
                  <br />
                  with a better brief.
                </h3>
                <p>
                  Give creators a clear direction and room to make it their own.
                  Start with the audience, the message, and what success looks
                  like.
                </p>
              </div>
              <div className="brief-preview">
                <div className="brief-preview-header">
                  <FileText size={20} aria-hidden="true" />
                  <span>Campaign brief</span>
                  <span>Example</span>
                </div>
                <dl>
                  <div>
                    <dt>Your audience</dt>
                    <dd>The people you want to reach</dd>
                  </div>
                  <div>
                    <dt>The deliverable</dt>
                    <dd>A focused short-form story</dd>
                  </div>
                  <div>
                    <dt>The details</dt>
                    <dd>Guidelines, rate, and review terms</dd>
                  </div>
                </dl>
                <div className="brief-preview-bottom">
                  <span className="brief-initial" aria-hidden="true">
                    <AcaiLogo symbolOnly small />
                  </span>
                  <span>Your brand. A creator’s perspective.</span>
                </div>
              </div>
              <button
                className="text-action"
                onClick={() => openStart("brand")}
              >
                Plan a campaign
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>

        <section
          className="workspace-section"
          id="workspace"
          aria-labelledby="workspace-title"
        >
          <div className="workspace-inner page-container">
            <div className="workspace-copy">
              <p className="section-kicker">A closer look</p>
              <h2 id="workspace-title">
                A big idea.
                <br />A small screen.
                <br />
                Your next move.
              </h2>
              <p>
                Keep the brief close while you create. Preview a creator
                workspace or see the campaign from a brand’s side.
              </p>
              <div
                className="audience-tabs"
                aria-label="Workspace preview role"
              >
                <button
                  aria-pressed={previewAudience === "creator"}
                  className={previewAudience === "creator" ? "is-active" : ""}
                  onClick={() => setPreviewAudience("creator")}
                >
                  Creator view
                </button>
                <button
                  aria-pressed={previewAudience === "brand"}
                  className={previewAudience === "brand" ? "is-active" : ""}
                  onClick={() => setPreviewAudience("brand")}
                >
                  Brand view
                </button>
              </div>
              <button
                className="action-button"
                onClick={() => openStart(previewAudience)}
              >
                {previewAudience === "creator"
                  ? "Plan your first clip"
                  : "Draft your first campaign"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="workspace-note">Interactive workspace preview.</p>
            </div>
            <div className="phone-scene">
              <div className="phone-frame">
                <div className="phone-top">
                  <span>9:41</span>
                  <span className="phone-island" />
                  <span className="phone-battery" aria-hidden="true" />
                </div>
                <div className="phone-content" aria-live="polite">
                  <div className="phone-header">
                    <span className="wordmark">
                      <AcaiLogo small onLight />
                    </span>
                    <span className="phone-avatar" aria-hidden="true">
                      <AcaiLogo symbolOnly small />
                    </span>
                  </div>
                  <p className="phone-greeting">Let’s make something.</p>
                  <h3>
                    {previewAudience === "creator"
                      ? "Your next clip"
                      : "Your next campaign"}
                  </h3>
                  <div className="phone-story">
                    <span>
                      {previewAudience === "creator"
                        ? "Lifestyle idea"
                        : "Lifestyle campaign"}
                    </span>
                    <strong>
                      {previewAudience === "creator" ? (
                        <>
                          A day in
                          <br />
                          15 seconds.
                        </>
                      ) : (
                        <>
                          Your story.
                          <br />
                          Their perspective.
                        </>
                      )}
                    </strong>
                    <span className="phone-story-bottom">
                      Sample brief
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="phone-task">
                    <span>
                      <FileText size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>
                        {previewAudience === "creator"
                          ? "Start with the hook"
                          : "Set the direction"}
                      </strong>
                      <p>
                        {previewAudience === "creator"
                          ? "What happens in the first second?"
                          : "Who should this content reach?"}
                      </p>
                    </div>
                  </div>
                  <div className="phone-task">
                    <span>
                      <Scissors size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>
                        {previewAudience === "creator"
                          ? "Make a quick shot list"
                          : "Define the deliverable"}
                      </strong>
                      <p>
                        {previewAudience === "creator"
                          ? "A beginning, a middle, a reason to watch."
                          : "Format, guidelines, and usage rights."}
                      </p>
                    </div>
                  </div>
                  <button
                    className="phone-button"
                    onClick={() => openStart(previewAudience)}
                  >
                    {previewAudience === "creator"
                      ? "Create my plan"
                      : "Create my brief"}
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
                <div className="phone-home" />
              </div>
              <div className="phone-side-note">
                <span>
                  <Check size={17} aria-hidden="true" />
                </span>
                <div>
                  <strong>Clarity before you create.</strong>
                  <p>The brief comes first.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="faq-section section-spacing page-container"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div className="faq-heading">
            <p className="section-kicker">A few useful answers</p>
            <h2 id="faq-title">
              Before your
              <br />
              first clip.
            </h2>
            <p>
              Get to know the process,
              <br />
              then make it your own.
            </p>
            <a className="text-action" href="#how-it-works">
              Explore the steps
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="faq-list">
            {questions.map(({ question, answer }, index) => (
              <details key={question} open={index === 0}>
                <summary>
                  {question}
                  <span aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="closing-section"
          id="start"
          aria-labelledby="closing-title"
        >
          <div className="closing-inner page-container">
            <p className="section-kicker">Make your next move</p>
            <h2 id="closing-title">
              You’ve got a perspective.
              <br />
              Put it in the frame.
            </h2>
            <p>Start with an idea. Give it a little direction.</p>
            <div className="closing-actions">
              <button
                className="action-button action-button-light"
                onClick={() => openStart("creator")}
              >
                I’m ready to create
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button
                className="action-button action-button-outline"
                onClick={() => openStart("brand")}
              >
                I’m building a campaign
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer page-container">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="#home" className="wordmark" aria-label="Acai home">
              <AcaiLogo onLight />
            </a>
            <p>
              A place for content ideas
              <br />
              and the people behind them.
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/dashboard">Dashboard</Link>
            <a href="#creators">For creators</a>
            <a href="#brands">For brands</a>
            <a href="#campaigns">Campaign categories</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="footer-back" href="#home">
            Back to top ↑
          </a>
        </div>
        <div className="footer-bottom">
          <p>
            © 2026 Acai. A creator-platform concept. Calculations and workspace
            content are examples.
          </p>
          <a
            href="https://www.trybuzzer.com/en"
            target="_blank"
            rel="noreferrer"
          >
            Design reference
          </a>
        </div>
      </footer>
      {start && (
        <StartDialog
          audience={start.audience}
          category={start.category}
          onClose={() => setStart(null)}
        />
      )}
    </div>
  );
}
