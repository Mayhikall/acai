# Prism landing page

## TryBuzzer reference redesign, 10 October 2026

Current direction: the user requested https://www.trybuzzer.com/en as the landing-page reference. Apply antislop during implementation, retaining the earlier black-and-purple hero, visible cursor-following particles, Brand/Creator choice, and absence of Discord. This section supersedes the historical directions below. Prism remains the existing placeholder brand.

Reading: a creator-platform concept for creators and brands, with the reference's rounded hero, approachable typography, practical feature previews, and alternating section compositions. ENERGY 3 / RHYTHM 3 / MOTION 2 on the current three-level scale.

- Color: an almost-black hero and deep purple corners preserve the user's chosen palette; off-white content surfaces make the longer page easier to scan. Purple is reserved for primary actions, selected controls, and related product previews.
- Typography: bold Arial gives the centered headline the direct, rounded sans-serif voice of the reference without adding a remote font dependency. Supporting copy uses the same family with a clear size hierarchy. The existing local Barlow variable remains available to shared components.
- Composition: move from the centered hero to a compact workflow strip, six functional creator cards, a split phone preview, an open FAQ, and a dark closing invitation. Each section answers the next question: what is this, how does clipping work, what might I make, and how can I plan it?
- Cards: calculator and workflow occupy complementary widths; category and checklist panels share a row; format and brand panels balance a narrower preview with a longer brief. These are product tools and examples rather than six repeated icon-and-paragraph blocks. Mobile stacks them in reading order.
- Spacing: the 1120px content width and generous section gaps keep the reference's open rhythm. Compact spacing inside previews keeps related controls together. The hero uses a 12px outer margin and 32px corners on desktop.
- Identity: the visible lavender particle field is the main recurring texture, supported by rounded framing and oversized bold type. The closing panel repeats the hero's dark purple treatment to connect the start and end of the page.
- Motion: particles respond to mouse or pen movement and settle after 1.8 seconds. Reduced motion and touch use a static field; pause, offscreen, hidden-tab, and open-dialog states stop animation. Other controls use short state transitions rather than scroll choreography or endless loops.
- Icons: document, scissors, upload, platform, and device symbols identify a brief, editing, saved work, content categories, and short-form viewing. Arrows indicate actions or onward links. Checks represent actual checklist state. Icons never replace a visible control label.
- Elevation and shape: flat cards use borders; the phone and dialog receive shadows to establish depth. Cards, buttons, inputs, and the phone frame have distinct corner sizes. No glass panels or general glow treatment are used.
- Content: no copied payout figures, testimonials, customer logos, member counts, payment features, or app-store claims. The calculator clearly uses example rates; category and workspace content are labeled examples. Inputs start empty with descriptive placeholders.
- Interaction: role-specific CTAs open a native dialog that creates a local downloadable creator plan or campaign brief. Forms have native required-field validation, preparation feedback, retryable error feedback, success/download, and reset. Nothing is submitted to a service. Category choices prefill the planner; the calculator, steps, checklist, format selectors, workspace selectors, mobile navigation, and FAQ all work.
- Assets and scope: this is a local redesign of the existing checkout. It adds no generated images, remote media, or dependencies and does not publish a site. Existing botanical media remains available in the repository but is not part of the new page.

Current verification: [LANDING-REFERENCE-REVIEW.md](LANDING-REFERENCE-REVIEW.md).

## Historical design notes

## Creator hero update

Particle visibility adjustment: the user asked for more visible particles on the dark hero. Raise the desktop particle limit from 1200 to 1800, increase their size and static opacity, and use brighter lavender at 85% canvas opacity. A soft canvas mask keeps the field quieter behind the centered copy and near the header while leaving stronger trails around the outer hero. Particles remain visible before any pointer movement and on touch devices. Cursor forces, idle settling, pause controls, and reduced-motion behavior are retained.

Black and purple update: the user requested a black and purple hero background. ENERGY 4 / RHYTHM 3 / MOTION 2. Use an almost-black base with restrained deep-purple gradients at the upper right and lower left to frame the centered headline. Off-white headings and muted lavender supporting text preserve hierarchy. Cursor particles use lavender at the existing low opacity; selected controls and the primary CTA remain white with deep-purple text. Header lettering and keyboard focus indicators become light for contrast against the dark hero. Existing layout, copy, motion behavior, and sections are retained. This palette supersedes the orange and terracotta choices below.

Cursor background update, 10 October 2026: adapt the supplied FluidParticlesBackground canvas to the orange hero. ENERGY 4 / RHYTHM 3 / MOTION 2. Warm brown particles reveal fluid trails around the pointer, keeping the headline as the focal point. Motion is triggered by mouse or pen movement, settles within 1.8 seconds of inactivity, and stops offscreen, in a hidden tab, during dialogs, or with the existing Pause motion control. Reduced motion keeps a static texture; touch scrolling does not trigger animation. The transparent canvas preserves the warm palette and never intercepts clicks. No external assets or new dependencies are needed. This supersedes the hero's previous MOTION 1 setting below.

The latest user reference replaces the neutral hero with an orange creator-platform introduction. Use the exact supplied headline, supporting copy, Brand/Creator choice, and Get Started CTA; omit Discord. ENERGY 4 / RHYTHM 3 / MOTION 1. Peach-to-orange gradients recreate the supplied warm backdrop without fetching assets. A navy headline and compact role selector establish hierarchy; white highlights the selected role and primary action. Building and person icons identify the two audiences, while an arrow indicates the CTA destination. Native radio controls support keyboard selection; Creator is selected initially, as pictured. The existing contact destination remains the CTA target because separate onboarding pages are not present. These latest choices supersede the older hero directions below.

## Hero update, 8 October 2026

The user supplied `hero-1.tsx` and asked to replace the botanical hero, applying antislop only. ENERGY 3 / RHYTHM 3 / MOTION 2 remains the page direction. The new hero follows that supplied visual: neutral gradient text makes the headline the focal point, the grid echoes the requested tool-oriented component, and the radial boundary separates the introduction from the darker studio content. The eyebrow introduces the existing Prism perspective and links to contact; its chevron signals that destination. Barlow keeps this new sans-serif headline connected to existing navigation. Fade animations introduce the headline and backdrop once; reduced motion disables them while preserving visible content. The existing botanical sections and sage focus accent continue the studio identity below the hero. No additional image assets are needed. The sections below describe the earlier botanical design.

Reference: https://hirael.com/embed/templates/prism

This is a concept landing page using the reference's media, not a live studio with customers or a sales backend. The user requested the Prism reference and antislop, and explicitly skipped brainstorming. Prism is a text-only placeholder until the user supplies a brand.

Reading: a creative studio landing page for brand owners, with cinematic nature imagery and editorial typography. ENERGY 3 / RHYTHM 3 / MOTION 2.

- Black and off-white preserve the reference's cinematic atmosphere; botanical sage connects controls to the garden.
- Instrument Serif italic echoes slender organic forms; Barlow keeps navigation and smaller copy legible.
- The garden hero is the focal point; large serif text supplies hierarchy without extra ornaments.
- Header blur separates navigation from the moving garden. Only the dialog backdrop uses a second blur.
- Dark scrims preserve text contrast over changing video frames while retaining visible scenery.
- Sections vary from a centered introduction and open service list to a full-width process scene, staggered visual studies, and a centered closing scene.
- Typography, layout, and code symbols identify the actual service categories, without generic decorative icons.
- Arrows distinguish project actions and onward links; film uses a play icon; navigation stays text-only.
- Rounded navigation unifies the floating control group; buttons and inputs have smaller radii; visual studies stay nearly square.
- Video supplies the living-garden motif; offscreen backgrounds pause, a global pause control is provided, and reduced-motion preferences stop playback.
- Studies are labeled concept work. No invented customers, testimonials, performance statistics, pricing, or compliance claims are included.
- Project actions prepare a downloadable local brief with validation, progress, retryable error feedback, and a download state. The UI explicitly says nothing is sent or stored.
- Fonts and videos are local so the page does not depend on third-party media at runtime.

The footer links to the user-selected reference. No new logo, profile photos, or other generated visual assets are used.
