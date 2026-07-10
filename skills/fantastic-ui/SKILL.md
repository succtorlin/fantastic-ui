---
name: fantastic-ui
description: >-
  Design and build "instrument-grade" UI — marketing pages AND in-product
  surfaces (app pages, dashboards, panels, subpanels) that read like the
  product itself, not like a template. Distilled from the sectorRRG "The
  Instrument" landing redesign: dark editorial ground, single-accent color
  discipline, serif display + monospace data type pairing, live data as proof,
  zero-webfont performance, and accessibility gates baked in. Use this skill
  whenever the user asks for a landing page, marketing page, hero section, or
  homepage redesign; wants to restyle or modify existing app pages, panels,
  subpanels, or dashboards; asks to "apply the same style across the app" or
  make screens consistent; says "make it look premium / expensive / high-end /
  less generic"; complains a page looks like a template; asks for an
  accessibility or WCAG audit, accessibility fixes, or contrast / keyboard /
  screen-reader compliance work on any web UI; or wants any surface for a
  data-heavy, technical, developer, or finance product — even if they don't
  say "design".
---

# Fantastic UI — instrument-grade marketing pages and product surfaces

## The core idea

A marketing page for a serious product should feel like **holding the
instrument**, not reading a brochure about it. Most landing pages fail because
they dress the product in someone else's clothes: gradient blobs, stock
screenshots in tilted browser frames, three-column feature grids with icon
libraries. The methodology here inverts that: take the product's own visual
language (its data, its density, its color logic) and elevate it to editorial
quality. The visitor should feel they've already started using the product by
the time they reach the CTA.

This is a **flexible** skill: adapt the principles to the product's actual
character. The worked example is a dark finance terminal, but the discipline
(one accent, semantic color, live proof, performance and accessibility gates)
transfers to any product that has real data or real behavior to show.

The same philosophy applies **inside the product**: app pages, dashboards,
panels, and subpanels are instruments too, and they fail the same way
(uniform card grids, decorative color, shadow soup, default focus rings).
For marketing pages, follow the five disciplines and page rhythm below. For
modifying existing product surfaces, start at
[Applying the disciplines to product surfaces](#applying-the-disciplines-to-product-surfaces-pages-panels-subpanels)
— the disciplines are the same; the procedure and anatomy differ.

## Step 0 — Write the one-sentence brief first

Before any code, commit to a named direction in one sentence. Example from the
worked case:

> "Dark, instrument-grade market terminal elevated to editorial: warm-charcoal
> ground, single sodium-amber accent, teal/red only as semantic signal colors,
> humanist serif display over monospace data."

Every later decision gets tested against this sentence. If you can't write it,
you don't have a direction yet — interrogate the product first: What does it
actually look like in use? What's its most impressive live behavior? What
color already *means something* in it? A vague brief ("clean, modern") produces
template output; a specific one produces a point of view.

## The five disciplines

### 1. Single-accent color system

Build the palette as a scale from one ground hue, with exactly **one** accent
and a small set of **semantic** colors that are never used decoratively:

- **Ground scale** — 4–5 steps of near-black tinted *toward the accent's
  warmth* (e.g. warm charcoal `#0b0b0a` → panel `#151309`), so even empty
  space carries the direction.
- **Hairlines, not shadows** — 1px borders from the ground scale
  (`--hair`, `--hair-lit`) define surfaces. Dark UIs read cheap when they lean
  on drop shadows.
- **Ink scale** — 3 steps of off-white text tinted the same direction
  (`--ink`, `--ink-2`, `--muted`). Pure `#fff` on near-black glares.
- **One accent + one highlight** of it (`--sodium: #f2a83c`,
  `--sodium-hi: #ffc164`). The accent marks *what matters*: eyebrows, CTAs,
  focus rings, the brand mark, selection color. If it's everywhere, it's
  nowhere.
- **Semantic colors stay semantic** — if the domain has meaning-colors (up
  teal / down red, pass green / fail red), they appear **only** with that
  meaning, never as decoration. This is what makes a page feel like an
  instrument: color is information.

Define all of it as CSS custom properties on the page root so the direction is
auditable in one place. Full token block in
[references/css-architecture.md](references/css-architecture.md).

### 2. Three-face typography, zero webfonts

Pair three type roles using **system font stacks only** — no font requests, no
FOUT, no layout shift:

- **Display serif** for headlines — a humanist serif stack
  (`"Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia`)
  gives editorial gravity that default sans headlines can't. `text-wrap:
  balance`, tight letter-spacing, `clamp()` sizing, an italic `<em>` in the
  accent-highlight color for the one word that matters.
- **Monospace** for data, eyebrows, buttons, microcopy — with
  `font-variant-numeric: tabular-nums`. Mono is what makes numbers feel
  *measured* rather than claimed. Eyebrow kickers: mono, uppercase, ~0.22em
  tracking, accent color, a short rule-line before the text.
- **System sans** for body prose.

The serif/mono contrast does the aesthetic work that webfonts usually get
hired for, at zero performance cost.

### 3. Live proof over screenshots

The hero visual should be the product **actually running**, drawn on a
`<canvas>` — not a screenshot, not a stock illustration. A screenshot says
"trust us"; a live rendering says "look at it go". Simulated data is fine
(random walks tuned to look plausible); the honesty is in the *mechanics*
being real.

Non-negotiables for any canvas animation (full annotated pattern in
[references/canvas-hero.md](references/canvas-hero.md)):

- DPR-aware sizing, capped at 2, re-applied on resize
- Pause via `visibilitychange` when the tab is hidden
- `prefers-reduced-motion` renders **one static frame** — same composition,
  no loop
- Full effect cleanup: cancel RAF, remove every listener
- Colors pulled from the same palette tokens as the CSS

Smaller instances of the same idea (sparklines painted into feature cards)
make the whole page feel alive without any animation library.

### 4. Page rhythm — dense, alternating, specific

Structure the page as alternating **texture bands** rather than uniform
sections. The worked skeleton, generalizable:

1. **Sticky nav** — transparent until scrolled, then blur + hairline
2. **Hero** — copy left, live canvas right; trust stats under the CTA
3. **Stat tape** — a slow marquee of real numbers (with an `srOnly` static
   list for screen readers, marquee `aria-hidden`)
4. **Thesis explainer** — diagram + editorial copy; teach the product's core
   mental model in one section
5. **Feature bento** — asymmetric grid (3+3 / 2+2+2 columns, 6→2→1
   responsive), each card carrying a *proof artifact* (sparkline, pill row,
   mini-table), never an icon
6. **Atmosphere band** — full-bleed section over a subtle AI-generated
   background (see [references/ai-atmosphere.md](references/ai-atmosphere.md))
   carrying the accountability/credibility content
7. **Interactive toggle section** — one real state switch (markets, plans,
   platforms) with proper ARIA tabs, proving the page is an application
8. **Principles trio** — the "why trust us" values, stated plainly
9. **Final CTA + honest fine print**

Copywriting voice: numbers are the protagonists (`5,000+ tickers`, `±70 mints
a call`); microcopy in monospace reads like terminal output; fine print is
honest ("Not investment advice · Track record is paper trading") — candor is
a premium signal. Headlines state a thesis, not a feature list ("The market is
always in rotation. See it turn first.").

### 5. Performance and accessibility as gates, not polish

These are pass/fail, checked before shipping:

**Performance**
- Zero webfonts, zero animation/UI libraries — the page needs only the
  framework it lives in
- Any raster asset ≤ ~30 KB (generate large, compress hard to webp)
- Motion on compositor properties only (`transform`, `opacity`); scroll work
  via IntersectionObserver, never scroll handlers doing layout reads
- Explicit dimensions on media; hero canvas gets width/height attributes

**Accessibility**
- Every animation (canvas, reveals, marquee, pulse) gated behind
  `prefers-reduced-motion` — reveals appear instantly, canvas draws one frame
- Skip link as the first focusable element
- A shared `.focusable` class: `outline: 2px solid var(--accent);
  outline-offset: 3px` on `:focus-visible` — designed focus, not default
- Real ARIA on interactive widgets (`role="tablist"` / `aria-selected` on
  toggles); decorative canvases `aria-hidden="true"`
- Marquee/ticker content duplicated in a visually-hidden static list
- Semantic landmarks: `nav`, `header`, `section` with ids, `footer`

## Applying the disciplines to product surfaces (pages, panels, subpanels)

Same five disciplines, two shifts in how they're applied. Full procedure,
panel anatomy, and state patterns:
[references/product-surfaces.md](references/product-surfaces.md) — read it
before touching any app page or panel.

**Shift 1 — the brief and the tokens belong to the app, not the page.**
A marketing page can own its look; product surfaces can't, or the app becomes
a costume party. Write ONE one-sentence brief for the whole application, lift
the token block to the app shell (`:root` or the app's root class), and
forbid page-local color definitions. Every page, panel, and subpanel draws
from the same ground scale, ink scale, one accent, and semantic set. A panel
that needs "its own color" is almost always misusing decoration where it
needs hierarchy.

**Shift 2 — rhythm becomes hierarchy.** A landing page alternates texture
bands to keep a scrolling reader engaged; an app screen is *operated*, so
composition follows attention instead: summary before detail, primary panel
visibly primary (span, position, density — not louder color), and nesting
depth encoded by the ground scale (each subpanel level exactly one ground
step lighter, hairline-separated — never stacked shadows, max ~3 levels).

**Retrofit procedure for existing screens** (details in the reference):

1. **Audit** — inventory every page/panel/subpanel; screenshot before;
   extract every color, face, radius, and shadow in use. The audit usually
   finds 30+ greys and 3 accents; the target is one scale and one accent.
2. **Brief** — one sentence for the whole app, tested against real screens.
3. **Tokens first** — install the shared token block and map old values to
   tokens *without* redesigning anything yet. This is the mechanical commit.
4. **Primitives second** — build the shared panel/eyebrow/stat/table/state
   primitives once, from the tokens.
5. **Migrate surface by surface** — highest-traffic screen first, one PR per
   screen, information identical, presentation rebuilt from primitives.
   Never fork a token locally to "match the old look".
6. **Consistency gate** — cross-screen pass at the end: same accent meaning,
   same focus ring, same panel anatomy everywhere; grep for hex literals
   outside the token file (there should be none).

## The accessibility phase — check and fix (WCAG 2.2 AA)

Discipline 5 states the gates; this phase is **how you actually pass them**.
It is a required workflow phase, not an optional polish step — run it on
every build and on every retrofitted screen. Full audit procedure, contrast
math, manual pass scripts, and fix patterns:
[references/wcag-audit.md](references/wcag-audit.md) — read it when you
enter this phase.

The phase runs at three moments:

1. **Token time — validate contrast once, inherit it everywhere.** Before
   any component is styled, compute the contrast matrix for every ink×ground
   and accent×ground token pair (script in the reference). Every text token
   must clear 4.5:1 on every ground step it will sit on (3:1 for large
   text); accent-as-UI-component and focus rings must clear 3:1 against
   adjacent colors. Fixing a failing pair means adjusting the *token*, never
   a local override — one fix repairs every screen at once. Record the
   passing matrix as a comment in the token file.
2. **Build time — semantics as you go.** Landmarks, heading order, real
   ARIA on widgets, canvas/marquee alternatives, labels on every input —
   cheaper to build in than to bolt on (patterns in the reference).
3. **Pre-ship — audit, fix, re-audit.** Automated sweep (axe-core with
   WCAG 2.2 AA tags + Lighthouse a11y) plus the four manual passes no tool
   can do: keyboard traversal, screen-reader walkthrough, reduced-motion
   toggle, and 320 px / 200 % zoom reflow. Triage: axe critical/serious
   findings and any manual-pass failure are **ship blockers**; moderates are
   fixed or explicitly documented; minors go to the backlog. Fix, then
   re-run to zero blockers — an audit without the re-run is theater.

Two rules that keep fixes on-system:

- **Fix at the highest level possible.** Token > primitive > component >
  instance. A contrast failure fixed on one card will recur on the next
  screen; fixed in the token it can never recur.
- **Accessibility fixes must not fork the design.** If a fix seems to
  require a new color or a louder style, re-read the failing criterion —
  the compliant answer is almost always *within* the system (a lighter ink
  step, a thicker hairline, a visible focus ring from the existing accent).

## CSS architecture

Use a CSS module (or equivalent scoping) with **every rule scoped under the
page root class** — no bare element selectors that leak into the rest of the
app. For a single marketing page, tokens live on `.page`; for product
surfaces, tokens are promoted to the app shell and pages scope only their
layout rules. Shared primitives (`.wrap`, `.eyebrow`, `.btn`, `.mono`,
`.focusable`, `.srOnly`, and for apps `.panel`, `.panelHead`, `.stat`)
compose via multiple classes. Reveal-on-scroll is one `[data-reveal]`
attribute + an `isIn` class toggled by a single IntersectionObserver. Full
patterns and the token block:
[references/css-architecture.md](references/css-architecture.md).

## Ship checklist

Run through this before calling the page done:

- [ ] The one-sentence brief still describes the shipped page
- [ ] One accent color; semantic colors appear only with their meaning
- [ ] No webfonts, no new dependencies, assets ≤ 30 KB each
- [ ] Hero shows the product *running*, not a picture of it
- [ ] `prefers-reduced-motion`: every animation has a static path (verify by
      toggling the OS setting or DevTools emulation)
- [ ] Keyboard pass: skip link, visible focus rings, tabs operable
- [ ] Responsive pass at 320 / 768 / 1024 / 1440 — bento collapses cleanly,
      no horizontal overflow
- [ ] Tab-hidden pass: canvas RAF actually stops (check via Performance panel)
- [ ] Copy pass: numbers concrete, fine print honest, zero hype adjectives
      ("revolutionary", "powerful", "seamless" are banned)
- [ ] **Accessibility phase completed**: token contrast matrix validated,
      axe-core (wcag2a/wcag2aa/wcag22aa tags) at zero critical/serious,
      keyboard + screen-reader + reduced-motion + reflow manual passes done,
      findings fixed and re-audited (see references/wcag-audit.md)

Additional gates when the work touched product surfaces:

- [ ] No hex/rgb literals outside the token file (grep proves it)
- [ ] Every panel uses the shared anatomy (eyebrow header, hairline
      separation, actions right) — no one-off panel styles
- [ ] Subpanel nesting encoded by ground-scale steps, ≤ 3 levels, no
      stacked shadows
- [ ] Empty, loading, and error states designed for every migrated panel
      (skeletons on ground scale, semantic color only on real errors)
- [ ] Cross-screen pass: accent means the same thing on every page; focus
      rings identical; density comparable between sibling panels
- [ ] Before/after screenshots captured for each migrated screen

## References

- [references/css-architecture.md](references/css-architecture.md) — the full
  token system, scoping rules, shared primitives, and responsive patterns.
  Read when writing the stylesheet.
- [references/canvas-hero.md](references/canvas-hero.md) — annotated live
  canvas hero + sparkline + scroll-reveal code with all lifecycle handling.
  Read when building any canvas or reveal behavior.
- [references/ai-atmosphere.md](references/ai-atmosphere.md) — generating and
  compressing AI atmosphere backgrounds (prompt recipe + pipeline script).
  Read when a section needs an atmospheric background image.
- [references/product-surfaces.md](references/product-surfaces.md) — the full
  retrofit procedure for existing app pages, panel and subpanel anatomy,
  nesting/depth rules, state design (empty/loading/error), and density
  guidance. Read whenever modifying or restyling in-product UI.
- [references/wcag-audit.md](references/wcag-audit.md) — the accessibility
  check-and-fix phase: token contrast matrix script, automated sweep
  (axe-core / Lighthouse), the four manual passes, WCAG 2.2 new criteria,
  fix patterns keyed to the design system, and the report/re-audit loop.
  Read when entering the accessibility phase or on any a11y/WCAG request.
