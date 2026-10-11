# Black and purple hero review

Scope: the user's requested black and purple hero palette and subsequent request for more visible particles. Reading this as: a creator-platform hero with a dark purple visual language, ENERGY 4 / RHYTHM 3 / MOTION 2. Almost-black anchors the section, deep-purple gradients frame the headline, and brighter lavender particles make the cursor response visible. The desktop particle limit is now 1800, sizes range from 0.8 to 2.2 CSS pixels, static particle opacity is 50%, animated particle opacity peaks at 36%, and canvas opacity is 85%. A soft mask keeps particles quieter behind the centered text and near the header while retaining stronger particles around the outer hero. White headings and selected controls preserve hierarchy. The existing layout, copy, controls, and motion limits are retained.

Initial palette validation: production webpack build including TypeScript passed; Prettier and `git diff --check` passed. `/tmp/acai-purple-hero-check.cjs` passed in Chrome, checking rendered colors, pointer animation, role selection, keyboard focus, CTA destination, mobile menu, and overflow at 320, 390, 768, and 1440px. No browser runtime errors occurred. `/tmp/acai-purple-hero-desktop.png` and `/tmp/acai-purple-hero-mobile.png` were visually reviewed. The earlier complete motion and connected-form checks remain documented in `CURSOR-BACKGROUND-REVIEW.md`; the initial palette change only edited CSS and design documentation.

Visibility follow-up: production build including TypeScript and targeted ESLint passed. `/tmp/acai-visible-particles-check.cjs` passed in Chrome, confirming 1800 particles drawn before mouse input, increased particle size and opacity, pointer animation, idle settling, reduced-motion static texture, role selection, keyboard arrows, CTA destination, and no overflow at 320, 390, 768, and 1440px. The browser verified that the full supporting-text rectangle remains inside the quieter part of the mask at all four widths. No runtime errors occurred. `/tmp/acai-particles-static.png`, `/tmp/acai-particles-moving.png`, and `/tmp/acai-particles-mobile.png` were visually reviewed and show the stronger particle field.

Current contrast calculations use the brightest purple background and a fully opaque brighter lavender particle, composited with 85% canvas opacity and the mask's one-third alpha behind the text: heading 7.81:1, supporting text 5.42:1, and the radio focus indicator 5.31:1. Unchanged opaque controls retain CTA 8.72:1, CTA hover 7.33:1, selected role 17.32:1, and unselected role 18.46:1.

## Hard gate

- R-02 PASS: no displayed copy edited; original user wording retained.
- R-03 PASS: four current browser widths show no horizontal overflow; mobile screenshot reviewed.
- R-17 PASS: CSS-only change adds no statistics.
- R-18 PASS: CSS-only change adds no testimonials.
- R-23 PASS: user explicitly requested this palette; no assets created.
- R-24 PASS: no destinations changed; browser clicked the hero CTA to `#contact`.
- R-25 PASS: contrast calculations above exceed AA thresholds, including overlapping particles.
- R-26 PASS: browser verified role controls, CTA, and mobile menu; existing pause and form behavior remain as previously checked.
- R-27 PASS: no asynchronous UI added; background fallback and existing form states retained.
- R-28 PASS: no FAQ added.
- R-32 PASS: native keyboard role selection and visible lavender focus outline verified in the browser; mobile menu closes with Escape.
- R-33 PASS: CSS edited with `apply_patch`; browser script only inspects the page.
- R-34 PASS: hero explicitly uses the requested dark palette; no theme toggle introduced.
- R-35 PASS: production build and current browser checks passed; screenshots reviewed.
- R-36 PASS: CSS-only change adds no claims.
- R-37 PASS: explicit user palette request and existing motion direction recorded in `DESIGN.md`.
- R-38 PASS: no content fabricated.

## Purpose gate

- R-01 PASS: deep-purple gradients implement the requested palette and frame the centered headline.
- R-04 PASS: existing audience and CTA icons retained; no new icons.
- R-06 PASS: existing typography retained.
- R-07 PASS: existing fluid texture is denser and more visible as explicitly requested; no grid added.
- R-08 PASS: existing directional arrow retained; no arrows added.
- R-09 PASS: no badges added.
- R-10 PASS: no glass or blur added.
- R-12 PASS: existing control shadows recolored black to separate white controls from the dark surface.
- R-13 PASS: no glows added; background uses two broad color gradients.
- R-14 PASS: no cards added.
- R-19 PASS: pointer-triggered animation retained and exercised in the browser; prior idle and reduced-motion checks still apply.
- R-22 PASS: no illustrations added.

## Liveliness

- Dials PASS: ENERGY 4 / RHYTHM 3 / MOTION 2 retained in the design record.
- Motion consistency PASS: CSS-only palette change preserves bounded cursor motion; browser verified animation still runs.
- Focal point PASS: desktop and mobile screenshots show the white headline as the dominant element.
- Whitespace PASS: existing content spacing and responsive composition retained.
- Accent PASS: purple is the single hero accent against black and white.
- Identity PASS: the user's purple palette now carries the existing interactive fluid texture.
- Design read PASS: black and purple direction stated in chat and recorded above.

## Craftsmanship and quality locks

- C-1 PASS: color decisions implement the user request and preserve contrast.
- C-2 PASS: browser verified the recolored controls remain functional.
- C-3 PASS: no sections or content added.
- C-4 PASS: desktop, mobile, keyboard focus, and menu checks passed; motion logic unchanged.
- C-5 PASS: no claims or content added.
- R-05 PASS: page composition and section variety retained.
- R-11 PASS: existing control radii retained.
- R-15 PASS: existing user-supplied CTA retained.
- R-16 PASS: no marketing copy added.
- R-20 PASS: static, moving, and mobile screenshots confirm the existing composition carries the requested palette and clearly visible fluid texture.
- R-21 PASS: dark hero explicitly requested by the user.
- R-29 PASS: black, purple, and white palette; lavender is a purple tint.
- R-30 PASS: user direction applied without introducing another product reference.
- R-31 PASS: background frames the headline; white supplies hierarchy; larger and brighter particles satisfy the visibility request, while the mask preserves text contrast.

## UI checklist

- Palette and accent PASS: user-requested black and purple with white controls.
- Copy and composition PASS: no copy, badges, cards, icons, or sections added.
- Controls and motion PASS: current browser checks plus the previous motion checks cover the retained behavior.
- Decoration limits PASS: no new glow, blur, glass, status dots, or repeated shapes.
- Content and states PASS: CSS-only change retains original content and form states.
- Responsive and keyboard PASS: four current widths, keyboard role selection, focus color, and mobile Escape dismissal passed.
