# Creator hero review

The user supplied the orange creator hero reference and requested removal of Gabung Discord. `app/components/ui/hero-1.tsx` now renders the supplied headline and description, Brand/Creator radio choices, and a single Get Started link. Creator is initially selected. The CTA retains the existing contact destination, with its accessible name reflecting the selected role. This change does not implement separate onboarding flows.

Styles live in `app/globals.css`; `app/page.tsx` supplies the reference copy. `app/components/ui/demo.tsx` follows the updated API. No images, new dependencies, or providers are required.

## Antislop delivery gate

- R-02 PASS: the dash in the copy is transcribed from the explicit user reference.
- R-03 PASS: browser checked 320, 375, 390, 640, 744, 768, 1000, and 1440px for horizontal overflow.
- R-17 PASS: the percentage is supplied reference copy, not an invented metric.
- R-18 PASS: no testimonials added.
- R-23 PASS: visual and copy direction explicitly supplied; no image assets created.
- R-24 PASS: CTA uses existing #contact destination, exercised in browser.
- R-25 PASS: navy text contrasts with orange; white selected role uses navy text; orange CTA text uses #c83a00 on white (approximately 5.2:1).
- R-26 PASS: role selection updates with clicks and keyboard arrows; CTA navigates to contact.
- R-27 PASS: role selection is local synchronous state; no loading/error state required.
- R-28 PASS: no FAQ added.
- R-32 PASS: native radios, visible focus indicators, keyboard arrow selection, and mobile menu Escape verified.
- R-33 PASS: implementation uses apply_patch.
- R-34 PASS: reference specifies the orange appearance; no theme toggle added.
- R-35 PASS: production build, ESLint, formatting, browser interaction checks, and desktop/mobile visual review completed.
- R-36 PASS: promotional language copied from the user-supplied reference; no additional claims authored.
- R-37 PASS: latest reference and ENERGY 4 / RHYTHM 3 / MOTION 1 recorded in DESIGN.md.
- R-38 PASS: content is the explicitly requested reference copy.
- R-01 PASS: gradients recreate the supplied orange backdrop.
- R-04 PASS: building and person icons identify role choices.
- R-06 PASS: bold sans-serif headline follows the reference's typographic hierarchy.
- R-07 PASS: previous grid removed.
- R-08 PASS: one arrow identifies the main onward action.
- R-09 PASS: no eyebrow badge added.
- R-10 PASS: existing navigation/dialog blur unchanged.
- R-12 PASS: shadows distinguish the two raised controls as in the reference.
- R-13 PASS: no component glows added.
- R-14 PASS: no cards added.
- R-19 PASS: only headline/description entrance fades, disabled under reduced motion.
- R-22 PASS: background uses CSS; no unrelated illustrations.
- Liveliness PASS: headline anchors the scene, warm orange is the deliberate accent, control spacing separates selection and action, and existing sections retain varied rhythm.
- C-1 PASS: choices follow the explicit visual reference and are recorded in DESIGN.md.
- C-2 PASS: both role choices and the CTA are exercised in browser.
- C-3 PASS: replacement affects the existing hero only.
- C-4 PASS: eight widths, keyboard selection, and reduced motion checked.
- C-5 PASS: no testimonials or evidence invented.
- R-05 PASS: existing sections retain their composition.
- R-11 PASS: segmented control and CTA use different corner sizes.
- R-15 PASS: Get Started is the user's explicit requested label.
- R-16 PASS: copy is supplied by the user reference.
- R-20 PASS: composition follows the user's chosen design rather than adding a default template.
- R-21 PASS: palette follows the supplied orange reference.
- R-29 PASS: orange, navy, and white follow the supplied palette.
- R-30 PASS: reference explicitly requested.
- R-31 PASS: visual reasons documented in DESIGN.md.

Browser evidence: `/tmp/creator-hero-check.cjs`, `/tmp/creator-hero-desktop.png`, and `/tmp/creator-hero-mobile.png`.
