# Landing reference redesign review

10 October 2026. Current review for the TryBuzzer-inspired landing page. Earlier hero and botanical reviews describe historical versions. Design direction and reasons are recorded in [DESIGN.md](DESIGN.md).

Reference: https://www.trybuzzer.com/en. Reused the reference's rounded hero framing, creator/brand entry, functional feature previews, phone composition, FAQ, and closing invitation. Retained the user's black-and-purple palette and visible cursor-following particles. Prism remains a placeholder brand. No statistics, testimonials, customer logos, live campaigns, payment features, or native-app distribution claims were copied.

## Verification evidence

- Production: `npm run build -- --webpack` completes compilation, TypeScript, and route generation.
- Lint: `npm run lint` exits 0 with four existing warnings in wallet-button.tsx, wallet/signer.ts, and devnet-smoke.mjs; none in the redesign files.
- Browser: Chrome with Playwright at localhost:3000; no runtime errors during the recorded interaction run.
- Calculator: keyboard Home/End tests 10,000 and 2,000,000 views; all three sample rates produce the expected IDR values. Example assumptions remain visible.
- Controls: clicked all three workflow steps, four category planners, four checklist inputs, three format previews, both workspace modes, both phone actions, header/hero/brand/closing CTAs, all FAQ summaries, and every desktop/footer/mobile navigation destination.
- Planner: Creator and Brand download filenames and actual file contents verified; required fields, preparation feedback, success, reset, simulated object-URL failure, error/retry, close button, backdrop, and Escape verified. Closing during preparation creates no orphaned blob URL.
- Keyboard: native role-radio arrow keys select the matching planner; native dialog contains focus and restores the opener on Escape; mobile menu Escape returns focus to its toggle; FAQ summaries respond to Enter. Source includes visible focus outlines and a skip link.
- Responsive: no horizontal page overflow at 320, 350, 390, 600, 768, 1024, or 1440px. Desktop, phone, feature, and FAQ screenshots inspected. Mobile navigation is hidden above 800px even after opening it on a small screen.
- Particles: nonempty static canvas under reduced motion; pixel output changes on cursor input, stops after idle, and remains static when paused, offscreen, or receiving touch input. Hidden-tab and dialog stopping are retained in the existing observer/visibility code.
- Contrast: computed text/background checks cover 145 page text elements and 153 with the planner open, including the brightest hero gradient stop behind the overlaid header. Minimum checked text contrast is 4.88:1. Placeholder contrast is 4.99:1. Format-caption and light-surface wordmark colors were corrected before the final check.
- Scope: local source changes only; no deployment, registration service, payment service, or new image assets. CTAs create local downloadable plans and explicitly describe that behavior.

## Antislop delivery gate

### Hard gate

- R-02 PASS: page, planner, calculator, layout, and CSS scan contains no em dashes.
- R-03 PASS: browser width checks pass at seven widths from 320px through 1440px; mobile screenshots inspected.
- R-17 PASS: calculator amounts are labeled illustrative; no user counts, payout totals, or other invented statistics.
- R-18 PASS: no testimonial or customer-avatar section.
- R-23 PASS: user supplied the reference and palette; existing placeholder brand retained; workspace/category content explicitly labeled examples; no new bitmap assets.
- R-24 PASS: every internal anchor resolves to exactly one existing ID; desktop, footer, and mobile links clicked.
- R-25 PASS: checked text pairs are at least 4.88:1 and placeholder text is 4.99:1, exceeding normal-text AA requirements.
- R-26 PASS: every rendered control changes state, navigates, opens a planner, submits, resets, closes, or downloads; click-through recorded.
- R-27 PASS: blank required fields validate; empty checklist, preparation, ready/download, reset, and retryable error states exercised.
- R-28 PASS: FAQ explains clipping, calculator assumptions, campaign eligibility, brand briefs, and what the planner actually does.
- R-32 PASS: role radios, FAQ, menu dismissal, dialog focus containment and restoration tested with keyboard; shared focus-visible rules present.
- R-33 PASS: implementation changes written directly to source with apply_patch; temporary scripts only exercise and inspect the page.
- R-34 PASS: one intentional light-content/dark-hero composition; no theme switch promises an unimplemented mode.
- R-35 PASS: production build and TypeScript pass; full browser control run completes without runtime errors.
- R-36 PASS: no invented security, compliance, speed, customer, or payment claims.
- R-37 PASS: user reference plus prior palette/particle requests provide direction; current Design Read and three-level dials recorded in DESIGN.md.
- R-38 PASS: categories, rates, briefs, and phone workspace clearly identify illustrative content; no simulated activity or fabricated team.

### Purpose gate

- R-01 PASS: dark purple gradients frame the hero headline and preserve the user's requested palette; light surfaces carry longer reading.
- R-04 PASS: documents, scissors, upload, devices, and checks identify briefs, editing, saved work, formats, and checklist state; visible labels accompany controls.
- R-06 PASS: Arial's bold sans-serif treatment follows the reference's direct creator-oriented typography; no large monospace or tracked-uppercase labels.
- R-07 PASS: the particle texture is explicitly requested, cursor-responsive, and softer behind copy; no decorative grid overlay.
- R-08 PASS: arrows identify primary actions and onward destinations; ordinary navigation stays text-only.
- R-09 PASS: no promotional badge above the headline or unsupported status capsule.
- R-10 PASS: surfaces are opaque; no stacked glass treatment.
- R-12 PASS: shadows are limited to the elevated phone, dialog, slider thumb, and open mobile menu; flat feature cards use borders.
- R-13 PASS: no glowing cards, controls, badges, or status lights; purple field belongs to the requested hero only.
- R-14 PASS: calculator, step list, category grid, checklist, vertical format preview, and brief panel have different content-driven interiors and complementary widths.
- R-19 PASS: cursor-triggered particles settle after 1.8 seconds; pause and reduced motion work; other UI uses short transitions.
- R-22 PASS: code-native phone and brief examples connect directly to the creator workflow; no stock illustrations or abstract blob art.

### Liveliness

- Dials PASS: ENERGY 3 / RHYTHM 3 / MOTION 2 declared in the current design section.
- Consistency PASS: oversized hero, quiet tool cards, split workspace, open FAQ, and dark closing panel vary composition without adding competing animation.
- Focal point PASS: headline, active tool/preview, phone, FAQ questions, and closing invitation provide a clear focus in their respective sections.
- Whitespace PASS: section gaps separate decisions; card spacing groups each tool's instructions and controls.
- Accent PASS: purple marks primary actions and selected state within the user-requested palette.
- Motif PASS: lavender particles, rounded framing, and bold short-form typography connect the beginning and closing compositions.
- Design Read PASS: current reference-led direction is recorded in DESIGN.md; earlier in-session direction informed generation.

### Craftsmanship and quality locks

- C-1 PASS: palette, type, card widths, spacing, icons, motion, shape, and elevation have written purposes in DESIGN.md.
- C-2 PASS: all interactive controls exercised; no fake auth, payout, app-download, or community links.
- C-3 PASS: content follows the creator's decisions from understanding clipping to planning a clip or campaign; no filler customer or pricing section.
- C-4 PASS: responsive checks, keyboard navigation, planner states, error retry, and motion preferences pass.
- C-5 PASS: examples are labeled; no testimonial, count, partnership, or performance claim presented as fact.
- R-05 PASS: reference-driven sections vary between centered hero, compact strip, working tools, split phone, FAQ, and closing panel; no generic pricing or logo bar.
- R-11 PASS: hero, cards, buttons, inputs, checkboxes, phone, and radio group use different purposeful corner sizes.
- R-15 PASS: Plan a campaign, Plan your first clip, Draft your first campaign, and download actions name their outcome; the previously user-supplied Get Started entry remains and opens the selected role's planner.
- R-16 PASS: copy describes clipping, rates, briefs, and local planning without AI marketing buzzwords.
- R-20 PASS: the user's black-purple particle hero, clipping tools, vertical-format examples, and brand brief composition provide a specific creator identity.
- R-21 PASS: the user explicitly requested the dark hero; light reading surfaces adapt the reference and maintain contrast.
- R-29 PASS: black/off-white neutrals plus one purple family; category variants stay inside that family.
- R-30 PASS: the user explicitly requested this reference; palette, particle interaction, local planner, labels, and content remain Prism-specific.
- R-31 PASS: one-line reasons for each major visual decision are recorded in DESIGN.md.

### UI supplement

- Palette PASS: derived from the user's black-purple request and the reference's light content surfaces.
- Accent PASS: primary actions, active selections, and purposeful previews carry purple; neutral text handles reading.
- Emoji PASS: no decorative emoji in page headings or actions.
- Rhythm PASS: compositions vary across the full page.
- Shapes PASS: cards contain actual tools and examples; no fake terminal, pricing columns, or meaningless edge stripes.
- Headline PASS: no capsule badge above the H1.
- Destinations PASS: links resolve; controls have tested behavior.
- Motion PASS: cursor-triggered field respects pause, reduced motion, and visibility; no endless carousel or pulse.
- Dose PASS: opaque surfaces, limited shadows, distinct radii, no general glass or glow.
- Status PASS: checks represent user-selected checklist state; no fake live indicators.
- Workspace PASS: phone preview focuses on the next content idea, brief, tasks, and role-specific planning action.
- Data PASS: all sample rates and workspace/category examples are visibly identified.
- Fields PASS: empty name and idea fields have descriptive placeholders rather than fake people or messages.
- States PASS: preparation names the file action; errors explain retry; ready state offers download and reset.
- Resilience PASS: all supported widths, keyboard flows, reduced motion, and form states checked.
