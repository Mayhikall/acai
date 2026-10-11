# Hero integration

Historical neutral-hero integration notes. The later orange redesign is documented in [CREATOR-HERO-REVIEW.md](./CREATOR-HERO-REVIEW.md).

The existing homepage hero now uses `app/components/ui/hero-1.tsx`. It keeps Prism's title and description, and its eyebrow and Start a project link navigate to the contact section. `app/components/ui/demo.tsx` contains the exact supplied demo content as an isolated usage example; its placeholder URL must be replaced before using that example as a page.

TypeScript and Tailwind CSS 4 were already configured. `components.json` now points the shadcn CLI to `app/components/ui`, `app/lib/utils.ts`, and `app/globals.css`. All components and utilities are consolidated under `app/components` and `app/lib`, including future CLI additions. No framework setup is necessary.

Installed dependencies: lucide-react, @radix-ui/react-slot, class-variance-authority, clsx, tailwind-merge, and tw-animate-css. No provider or state store is required; Hero is driven by its five props. There are no image assets in this component.

The Tailwind theme registers animation utilities in addition to the supplied keyframes. Decorations are isolated behind content, and reduced motion leaves text visible. Legacy anchor and margin resets use Tailwind's base layer so the component's text colors and spacing take precedence. The headline overrides the previous global italic serif style. The header wordmark uses dark text over the new light hero.

## Antislop review

Scope: the requested hero replacement, supporting UI utilities, and its connection to the existing page. Original demo copy is preserved as requested; it is not displayed as a studio claim.

- R-02 PASS: displayed hero uses existing Prism copy without em dashes; verbatim demo copy is user supplied.
- R-03 PASS: browser checked 320, 375, 390, 640, 768, 1000, and 1440px without horizontal overflow.
- R-17 PASS: no statistics added.
- R-18 PASS: no testimonials added.
- R-23 PASS: user-supplied component defines the visual; no new image or logo assets.
- R-24 PASS: browser verified every internal anchor resolves.
- R-25 PASS: neutral hero palette uses gray-600 over white (approximately 7.5:1), near-white CTA text over #171717 (approximately 17:1), and black-to-gray headline text; screenshots reviewed for readability.
- R-26 PASS: browser clicked both hero links, desktop navigation, project dialog buttons, mobile menu, and motion toggle.
- R-27 PASS: Hero has no asynchronous state; existing brief form states are unchanged.
- R-28 PASS: no FAQ added.
- R-32 PASS: focus styles retained; browser checked keyboard skip link and Escape on menu and dialogs.
- R-33 PASS: source changes made with apply_patch.
- R-34 PASS: no theme toggle introduced; hero defaults to the supplied light appearance and retains class-based dark variants.
- R-35 PASS: production webpack build, TypeScript, ESLint, formatting, browser checks, and desktop/mobile screenshot review completed.
- R-36 PASS: displayed copy preserves existing studio language, with no new security or performance claims.
- R-37 PASS: explicit user component direction and ENERGY 3 / RHYTHM 3 / MOTION 2 recorded in DESIGN.md.
- R-38 PASS: page retains existing concept identification.
- R-01 PASS: gradient establishes headline hierarchy and radial section boundary, as requested.
- R-04 PASS: requested Lucide ChevronRight identifies the eyebrow link direction.
- R-06 PASS: Barlow ties new headline and navigation together; uppercase eyebrow follows supplied component.
- R-07 PASS: grid follows explicit user direction; reason recorded in DESIGN.md.
- R-08 PASS: one chevron signals the eyebrow link; main CTA remains text only.
- R-09 PASS: eyebrow carries the existing Prism perspective and a working contact link.
- R-10 PASS: existing navigation and dialog blur unchanged.
- R-12 PASS: no new shadows.
- R-13 PASS: radial boundary follows the supplied component; no added button or card glows.
- R-14 PASS: no new cards.
- R-19 PASS: two once-only fade utilities with reduced-motion fallback; browser confirmed visible text with animation disabled.
- R-22 PASS: no illustrations added.
- Liveliness PASS: user-selected headline and radial boundary anchor the first screen; varied existing sections retain rhythm, botanical motif, and sage accent.
- C-1 PASS: design reasons recorded in DESIGN.md.
- C-2 PASS: new links have working contact destinations.
- C-3 PASS: existing hero is replaced without adding sections.
- C-4 PASS: responsive, reduced-motion, keyboard, and dialog checks completed.
- C-5 PASS: no fabricated evidence added.
- R-05 PASS: open services, panoramic process, and staggered studies remain.
- R-11 PASS: supplied eyebrow, button, and section radii serve different functions.
- R-15 PASS: displayed CTA names the project action.
- R-16 PASS: displayed hero uses the existing studio copy.
- R-20 PASS: supplied hero direction is combined with Prism's existing identity and sections.
- R-21 PASS: supplied light hero is honored without introducing a toggle.
- R-29 PASS: neutral hero palette transitions to existing botanical sage and black sections.
- R-30 PASS: user explicitly supplied this component.
- R-31 PASS: design rationale is documented.

Validation artifacts: `/tmp/hero-check.cjs`, `/tmp/hero-desktop.png`, and `/tmp/hero-mobile.png`.
