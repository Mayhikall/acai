# Cursor background review

Historical orange-palette review. The subsequent black and purple palette is documented in [HERO-COLOR-REVIEW.md](./HERO-COLOR-REVIEW.md).

10 October 2026. Scope: the supplied fluid-particle component adapted to the existing creator hero, its motion control, and responsive behavior. Antislop applied during implementation, as requested.

Reading this as: a creator-platform introduction with the existing warm orange visual language, ENERGY 4 / RHYTHM 3 / MOTION 2. Mouse and pen movement bend particles toward a local swirl; the texture settles after 1.8 seconds without pointer movement. The transparent canvas sits behind content. Terracotta particles at 45% canvas opacity preserve contrast, including when trails overlap. Touch keeps a static texture.

The component lives in `app/components/ui/fluid-particles-background.tsx`, following the consolidated project structure. It retains the supplied noise field and particle settings, adds cursor forces and frame cleanup, sizes the canvas to its container, and caps pixel density at 2. No dependencies, providers, image assets, or separate demo page are required. `Hero` passes its existing children into the background; page pause state and open dialogs disable motion. The observer and event listeners are removed on unmount.

Evidence: `/tmp/acai-fluid-check.cjs` passed in Chrome against the existing localhost development server. It checks canvas frame counts and pixel changes, idle settling, role selection without effect recreation, keyboard arrows, pause/play, offscreen suspension, reduced motion including manual play, touch input, hero CTA, brief download, dialogs, mobile menu, internal destinations, and widths 320, 375, 390, 640, 768, 1000, and 1440px. No browser runtime errors occurred. Desktop and mobile screenshots were visually reviewed. Production webpack build, TypeScript, targeted ESLint, formatting, and `git diff --check` passed.

## Hard gate

- R-02 PASS: no display copy added; the supplied hero copy remains verbatim.
- R-03 PASS: browser checks found no horizontal overflow at all seven recorded widths; canvas follows the container at device pixel ratio 2.
- R-17 PASS: no statistics added; reference copy remains unchanged.
- R-18 PASS: no testimonials or people added.
- R-23 PASS: the user supplied the particle reference and requested cursor animation; no image or identity assets created.
- R-24 PASS: browser checked every internal anchor destination exists; hero CTA reaches `#contact`.
- R-25 PASS: navy text against the darkest orange with a fully opaque terracotta particle at 45% canvas opacity has 4.71:1 contrast; the CTA remains 5.17:1 on white. Lighter gradient regions have higher contrast.
- R-26 PASS: browser exercised role radios, CTA, pause/play, mobile menu, dialogs, brief validation, download, and reset; canvas does not intercept clicks.
- R-27 PASS: decorative canvas has no loading flow; if its context is unavailable, the CSS background and content remain visible. Browser verified existing brief validation and completion states.
- R-28 PASS: no FAQ introduced.
- R-32 PASS: canvas is hidden from assistive technology; native radio keyboard arrows and Escape dismissal passed browser checks; existing focus styles retained.
- R-33 PASS: product code and CSS were edited with `apply_patch`; browser scripts only inspect the app.
- R-34 PASS: hero remains explicitly light with its original palette; no theme toggle introduced.
- R-35 PASS: production build completed; browser exercised the changed hero and connected controls, with desktop and mobile screenshot review.
- R-36 PASS: no security or performance claims added.
- R-37 PASS: supplied component and existing orange direction recorded in `DESIGN.md`, with ENERGY 4 / RHYTHM 3 / MOTION 2.
- R-38 PASS: no fabricated content added; existing concept identification and user copy retained.

## Purpose gate

- R-01 PASS: existing orange gradients preserve the user's hero direction; transparent particle rendering does not paint over them.
- R-04 PASS: existing building, person, and directional icons retained for their recorded roles; no icons added.
- R-06 PASS: existing hero typography retained; background work does not introduce type choices.
- R-07 PASS: particle trails implement the supplied fluid reference and requested cursor feedback; no grid added.
- R-08 PASS: existing CTA arrow retained; no decorative arrows added.
- R-09 PASS: no badges introduced.
- R-10 PASS: no blur or glass surfaces added.
- R-12 PASS: no shadows added.
- R-13 PASS: no glow effects added.
- R-14 PASS: no cards added.
- R-19 PASS: motion directly follows pointer input and settles after inactivity; frame checks verified pause, offscreen suspension, and reduced motion.
- R-22 PASS: no illustrations added; the canvas renders the requested particle field.

## Liveliness

- Dials PASS: ENERGY 4 / RHYTHM 3 / MOTION 2 recorded for the cursor update.
- Motion consistency PASS: motion is triggered by the pointer and stops when idle rather than running continuously.
- Focal point PASS: screenshot review confirms the navy headline remains dominant over the subdued particle layer.
- Whitespace PASS: original centered content spacing and section proportions retained at desktop and mobile widths.
- Accent PASS: orange remains the hero accent; particles use related terracotta rather than another accent color.
- Identity PASS: the supplied warm creator hero now carries a fluid texture that responds to the user's gesture.
- Design read PASS: visual intent and cursor behavior declared in chat before implementation and recorded above.

## Craftsmanship and quality locks

- C-1 PASS: particles implement the explicit user request; color, opacity, layering, and motion limits have recorded purposes.
- C-2 PASS: browser verified hero controls and the shared motion control work.
- C-3 PASS: the existing hero is enhanced; no sections added.
- C-4 PASS: all seven widths, keyboard selection, touch, reduced motion, and offscreen suspension passed browser checks.
- C-5 PASS: no testimonials, statistics, or claims generated.
- R-05 PASS: existing varied page sections retained; no template sections added.
- R-11 PASS: existing role-selector and CTA radii retained; canvas introduces no rounded controls.
- R-15 PASS: supplied CTA copy retained; no new generic CTA added.
- R-16 PASS: no marketing copy added.
- R-20 PASS: the existing warm hero and supplied fluid behavior guide the change; screenshot review confirms the original composition remains legible.
- R-21 PASS: the existing light hero direction retained.
- R-29 PASS: particles use related terracotta alongside the existing orange, navy, and white palette.
- R-30 PASS: the user supplied the particle reference; no unrelated product design copied.
- R-31 PASS: motion serves cursor feedback, warm color preserves the palette, low opacity preserves contrast, and canvas layering preserves controls.

## UI checklist

- Palette and accent PASS: existing orange direction plus related terracotta; contrast calculated above.
- Composition and hierarchy PASS: existing sections and headline hierarchy retained; no badges, filler cards, or app-shell elements introduced.
- Controls and motion PASS: browser checked working destinations, input controls, pause/play, and bounded pointer-triggered animation.
- Decoration limits PASS: no new glow, shadow, glass, icons, arrows, or status dots.
- Content and states PASS: no data, fields, or claims added; existing brief validation and downloadable result exercised.
- Responsive and keyboard PASS: seven widths, native keyboard role selection, dialog Escape, menu Escape, reduced motion, and touch checks passed.
