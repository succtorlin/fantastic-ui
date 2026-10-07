---
name: fantastic-ui
description: >-
  Design and build instrument-grade marketing pages and in-product surfaces
  (app pages, dashboards, panels, and subpanels) that feel like the product,
  not a template. Use for landing, hero, homepage, premium/polished redesign,
  whole-app visual retrofit, data-heavy or technical UI, and accessibility or
  WCAG work. Also use for confusing or unintuitive interactions, affordance,
  discoverability, mental-model, error-prevention, cognitive-walkthrough,
  usability, navigation, form, heuristic, or dark-pattern analysis. Covers
  editorial visual systems, live proof, performance, keyboard/screen-reader
  access, Norman's interaction foundations, Krug's usability rules, and
  Nielsen heuristic audits.
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

## Usability foundation: make the instrument understandable

Fantastic visual treatment never compensates for an interface that makes
people guess. Treat visual quality, interaction quality, and accessibility as
one system. The following Norman/Krug/Nielsen principles are part of this
skill, not an optional review after styling.

### Route the work before designing

Choose the smallest mode that covers the request:

- **Build or redesign:** establish the visual brief and token system, then
  apply the interaction foundations below while building each control and
  state.
- **Usability review:** run the [heuristic audit](#heuristic-audit-and-scoring),
  report severity-ranked findings, and propose fixes that preserve
  the product's visual language.
- **Confusion or error investigation:** walk the critical task through the
  [seven stages of action](references/design-everyday-things/seven-stages.md)
  and the two gulfs before changing layout or copy.
- **Navigation, forms, or content review:** use the Trunk Test, Krug's
  scanning/satisficing rules, and the Nielsen checklist; test keyboard,
  touch, zoom, and screen-reader paths as applicable.

Do not treat a heuristic score as a substitute for observing real users. Use
analytics, support tickets, session recordings, or a small task test to check
whether the suspected problem occurs in context.

### Bridge the two gulfs

Every task has a **gulf of execution** (the user cannot tell what action is
possible or how to perform it) and a **gulf of evaluation** (the user cannot
tell what happened or whether the result is correct). Narrow both:

- Use visible **affordances** and **signifiers**: controls look and read as
  controls, icons have labels or accessible names, and hover is never the only
  signal.
- Use natural **mapping**: put controls near what they affect, mirror the
  spatial or sequential relationship users expect, and keep labels consistent.
- Use **constraints** and forgiving inputs to prevent slips and mistakes, but
  preserve undo, cancel, back, and recovery paths.
- Give timely **feedback**: acknowledge direct actions immediately, show
  progress for long work, expose saved/loading/error state, and preserve user
  input when something fails.
- Make the system's **conceptual model** visible. Explain modes, scope,
  defaults, and irreversible consequences in the interface rather than in a
  manual.

For a critical flow, trace: goal → plan → specify → perform → perceive →
interpret → compare. The first four stages diagnose execution; the last three
diagnose evaluation. See the detailed patterns in
[the design-foundation references](references/design-everyday-things/).

### Krug and Nielsen operating rules

Apply these defaults unless the product context gives a documented reason not
to:

1. Make the primary action and the page's purpose self-evident; use plain,
   action-oriented labels and remove happy-talk and jargon.
2. Make each click confidence-building; click count is not the goal. Never
   add friction to hide cancellation, pricing, terms, or data use.
3. Keep users oriented: a page title, current location, hierarchy, major
   options, and search (when relevant) should be findable in the Trunk Test.
4. Keep system status visible; use specific errors that say what happened,
   why, and what to do next. Never blame the user or erase their work.
5. Prefer recognition over recall, progressive disclosure over a wall of
   options, and undo over reflexive confirmation dialogs.
6. Be consistent with product and platform conventions; one concept gets one
   term, one behavior, and one visual treatment.
7. Support novices and experts with accessible defaults plus shortcuts, bulk
   actions, saved views, or command surfaces where they add real value.
8. Keep every element purposeful. Minimalism means removing noise, not
   removing required disclosure, context, or accessible names.

The ten Nielsen checks are: visibility of system status; match to the real
world; user control and freedom; consistency and standards; error prevention;
recognition rather than recall; flexibility and efficiency; aesthetic and
minimalist design; error recognition/diagnosis/recovery; and help/documentation.
Use the detailed tables in
[the heuristic references](references/ux-heuristics/), especially when a
finding needs a concrete implementation or copy pattern.

### Heuristic audit and scoring

When auditing, inspect the critical tasks and every state they traverse
(empty, loading, success, validation, permission, offline, destructive,
failure, and recovery). Record each finding with:

- screen, task, and user/context;
- violated principle or heuristic;
- evidence and the user's likely failure mode;
- **severity 0–4**: 0 not a problem, 1 cosmetic, 2 minor friction, 3 major
  task failure, 4 catastrophic blocker;
- a fix at the highest useful level (token → primitive → component → copy →
  instance), plus a verification method.

Report two complementary scores, never one blended number:

- **Interaction foundation score (0–10):** two points each for
  discoverability, evaluation/feedback, error recovery, natural mapping, and
  constraints/error prevention. State which rows failed.
- **Heuristic readiness score (0–10):** start at 10 and subtract for failed
  diagnostic rows, weighting severity-3/4 findings more heavily. State the
  highest-severity issues and the specific changes needed to reach 10/10.

Treat severity 3–4 findings, keyboard blockers, inaccessible names/focus,
and dark patterns as ship blockers. Check for manipulative patterns such as
forced continuity, roach motels, confirmshaming, and hidden costs; replace
them with clear choices and equally easy exits. Resolve conflicts with
progressive disclosure (simplicity vs flexibility), contextual prominence
(consistency vs context), undo (efficiency vs prevention), and visible
primary actions (discoverability vs minimalism).

### Unified interaction checklist

- Can a first-time user identify the page, primary action, and available
  controls without a manual?
- Do controls have clear affordances, labels, mappings, touch targets, and
  keyboard behavior?
- Does every action expose status and outcome, including delayed and failed
  work?
- Are invalid actions constrained before submission, and can users undo,
  cancel, go back, and recover without losing input?
- Are labels, navigation, focus, and system conventions consistent across
  screens and responsive breakpoints?
- Do empty/loading/error/success states explain what happened and what to do
  next?
- Does the design work without hover, with reduced motion, at 320 px and
  200% zoom, and with a screen reader?
- Has the fix been re-audited with the same task and evidence that exposed the
  problem?

## Step 0 — Write the one-sentence brief first

Before any code, commit to a named direction in one sentence. Example from the
worked case:

> "Dark, instrument-grade market terminal elevated to editorial: warm-charcoal
> ground, single sodium-amber accent, teal/red only as semantic signal colors,
> humanist serif display over monospace data."

### Step 0a — Run the preset check FIRST (do not skip, do not skip silently)

Before writing a brief, decide whether one of the eleven presets in
[references/theme-presets.md](references/theme-presets.md) already is the brief.
Work the gates in order and stop at the first that answers:

1. **Did the user name a direction?** Any preset name, or a described look
   ("monochrome architectural", "warm cream deck"). → Use it. Their words win,
   including when they ask for something you would not have chosen.
2. **Does the codebase already have a token system?** Grep the global
   stylesheet for token names, accent variables, shared primitive classes. If
   one exists → **no preset.** Recover its brief and extend it (Phase B of
   `recursive-polish.md`). A preset here would run a second design system in
   parallel, which is the exact failure Shift 1 forbids.
3. **Otherwise, score the request** against the signal table in
   `theme-presets.md` — medium, domain, imagery, density — and apply each
   preset's disqualifier.

Then act on the confidence you actually have:

| Result | What you do |
|---|---|
| One preset matches on ≥2 signals with no disqualifier hit | **Adopt it.** State the choice in one line and continue without asking. |
| Two or more are plausible | **Ask**, offering at most three, each with the one differentiator that decides it. |
| A preset half-fits, or a disqualifier fires | **Say so and write a fresh brief.** A stretched preset produces exactly the template output the Anti-Template Policy exists to prevent. |
| Nothing fits | Fresh brief via Step 0. Note which preset was closest and why it failed. |

**Always announce the outcome in one line before building**, so the user can
redirect before code exists:

> Using **Terracotta Commerce** — retail storefront, product photography,
> soft-shadow cards. Say the word if you'd rather I write a fresh direction.

> No preset fits: this is a data-dense operator console, and every preset
> either fails at density or has no accent to encode state. Writing a fresh
> brief.

**Known gap, state it rather than forcing a fit:** all eleven presets are
content- or product-led. **Data-heavy analytics, developer tools, dashboards
and trading/finance surfaces are still not covered.** Two presets are dark, but
Midnight Showroom sells objects and has no data grammar at all — no monospace
numerals, no chart treatment, no semantic up/down. Those surfaces want the dark
instrument direction of the worked example above. Route them there or to a
fresh brief; do not reach for Midnight Showroom because it is dark, or
Blueprint Mono because it looks technical.

One preset per application. Marketing surfaces may diverge from the app;
screens inside one product may not.

Every later decision gets tested against this sentence. If you can't write it,
you don't have a direction yet — interrogate the product first: What does it
actually look like in use? What's its most impressive live behavior? What
color already *means something* in it? A vague brief ("clean, modern") produces
template output; a specific one produces a point of view.

## Step 0b — Translate visual references into a concrete specification

When reference screenshots, typography, logos or mood images are supplied, or the direction is too vague to implement, read [references/visual-reference-analysis.md](references/visual-reference-analysis.md). Specify composition and hierarchy before atmosphere. Describe typography through proportions, strokes, terminals/serifs, spacing and alignment, then select native fonts within the existing font policy. Record **Observed**, **Inferred** and **Proposed adaptation** separately; screenshots do not reveal exact prompts, fonts, hidden settings or interaction behavior.

Turn the analysis into shared tokens, responsive constraints and native components, with explicit invariants, allowed variation and exclusions. Preserve meaningful product behavior and accessible DOM text. A reference establishes visual intent, not evidence of working interactions or live data. Use the existing brief and design system; this step adds no confirmation gate when the user has already chosen a direction.

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
[references/css-architecture.md](references/css-architecture.md); **how to pick the
actual HSL values** — three anchors, saturation at the extremes, hue rotation, tinted-grey
ranges, and the two contrast escape hatches — in
[references/ui-mechanics.md](references/ui-mechanics.md) §4.

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

Hand-pick the size scale rather than generating it from a ratio, and set line-height
*proportionally* — tight for display, loose for small text — never one global value.
Scale, line-length and letter-spacing mechanics in
[references/ui-mechanics.md](references/ui-mechanics.md) §3.

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

## The mechanics layer

The five disciplines decide **direction**. They do not, on their own, stop a surface
from looking amateur — a correct palette laid out with ad-hoc spacing and one global
line-height still reads as assembled. The mechanics below are the second layer, and
they are where most "I don't know why this looks off" problems actually live.

Full treatment in [references/ui-mechanics.md](references/ui-mechanics.md). The rules
that change the most outcomes:

- **Hierarchy runs on color first, weight second, size last.** Most clutter is fixed by
  demoting something to `--muted`, not by enlarging what you want seen. To emphasise,
  **de-emphasise everything around it**.
- **Pick a spacing scale and obey it.** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.
  If two values need measuring to tell apart, one is surplus. **Ambiguous spacing** — a
  label equidistant from the field above and below — is a real bug, not a nitpick.
- **Start with too much white space and subtract.** The dense rhythm in discipline 4 is a
  destination reached by removal; nobody ever loosens a cramped layout later.
- **Line-height is proportional to line length and size**, never one global value. Prose
  caps at 45–75 characters (`max-width: 65ch`). Display type tightens; small text loosens.
- **Build color in HSL from three anchors**, and **raise saturation at both extremes** or
  the ends of the ramp drift back to neutral — which defeats discipline 1's tinted ground.
  Use **hue rotation** (toward 60/180/300 to lighten, 0/120/240 to darken, capped at
  20–30°) as a second brightness dial that doesn't wash the color out.
- **Depth on this ground is lightness + hairline, not shadow.** Shadows have nothing to
  block against near-black. This is *why* discipline 1 says hairlines — and note a raised
  dark surface usually needs both cues, since adjacent ramp steps are often under 1.3:1.
- **Empty states are a designed surface.** Distinguish *empty* from *filtered to nothing*
  from *failed to load* — three states, three messages. Collapsing them is a common bug.
- **Never put grey text on a colored background.** Use a hue-shifted tint of the panel's
  own color instead.

### The AI-default tells

Generated UI converges on the same handful of defaults. Before shipping, check for:
purple/violet gradients · `rounded-2xl` on everything · three identical feature cards ·
`shadow-lg` everywhere · indigo accent by default · hero→features→testimonials→CTA on a
product that isn't a landing page · uniform section spacing · an icon on every card.

The gut check: **would a developer guess this was generated?** If yes, the most generic
element is almost always the color scheme or the layout skeleton — fix that one first.
Discipline 4's bento is asymmetric and carries proof artifacts instead of icons precisely
to break this pattern.

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

## Recursive whole-app polish mode

When the scope is **every surface of the application** — "polish every page",
"apply this across the whole app", "make sure nothing is missed" — the
per-screen retrofit procedure alone is not enough: it has no traversal, no
persistent progress tracking, and no provable end. Use the sweep mode in
[references/recursive-polish.md](references/recursive-polish.md) — read it
before starting any whole-app job. It adds, on top of everything above:

- **Inventory by recursive traversal** of every route's import tree —
  including modals, drawers, toasts, dropdowns, and command palettes, which
  are in scope — deduplicating shared components into single work items
- **Prior-art reconciliation** — detect an existing token system and recover
  its brief instead of writing a competing one
- **Shared-primitives-first ordering**, then routes by traffic (with a stated
  fallback ranking when no analytics exist)
- **Batches of 3–5 surfaces** with a presentation-only diff gate, per-batch
  a11y pass, and a persistent ledger file that survives session boundaries
- **Loop-until-dry completion**: re-run the inventory from scratch at the end;
  the job is done only when a fresh sweep finds zero non-done surfaces and the
  mechanical proofs (hex-grep zero, axe-core zero critical/serious) pass

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

Four rules that keep fixes on-system:

- **Fix at the highest level possible.** Token > primitive > component >
  instance. A contrast failure fixed on one card will recur on the next
  screen; fixed in the token it can never recur.
- **Accessibility fixes must not fork the design.** If a fix seems to
  require a new color or a louder style, re-read the failing criterion —
  the compliant answer is almost always *within* the system (a lighter ink
  step, a thicker hairline, a visible focus ring from the existing accent).
- **Never dim text with `opacity-*`.** Use an ink token. Opacity survives
  code review — every class references an approved token — while silently
  failing contrast, and it **compounds**: `opacity-60` on a card times
  `opacity-70` on its counter renders at 0.42 alpha, measured 1.83:1. It
  also creates a stacking context that blinds the auditor, so it hides the
  bug it causes. `disabled:`, `hover:` and transient states stay fine.
- **`incomplete` is not `violations`.** axe returns both; the DevTools
  extension paints them with the same red SERIOUS card, so an `incomplete`
  gets reported as a violation the API never raised. It means "could not
  compute" — neither a pass nor a failure. Measure every one by hand: on a
  real audit, 0 violations and 14 incomplete concealed 9 genuine AA
  failures, the worst at 1.83:1.

When a dimming you are removing **encodes state** (unapproved, locked,
inactive), find the replacement channel before deleting it — often another
channel already carries it and the opacity was redundant. Procedure and the
trap that follows it are in the reference.

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
      axe-core (wcag2a/wcag2aa/wcag22aa tags) at zero critical/serious
      *violations*, every *incomplete* node measured and recorded, zero bare
      `opacity-*` on text, keyboard + screen-reader + reduced-motion + reflow
      manual passes done, findings fixed and re-audited (see
      references/wcag-audit.md)

Additional gates when the work touched product surfaces:

- [ ] No hex/rgb literals outside the token file (grep proves it)
- [ ] Every panel uses the shared anatomy (eyebrow header, hairline
      separation, actions right) — no one-off panel styles
- [ ] Subpanel nesting encoded by ground-scale steps, ≤ 3 levels, no
      stacked shadows
- [ ] Empty, loading, and error states designed for every migrated panel
      (skeletons on ground scale, semantic color only on real errors)
- [ ] Mechanics pass: spacing values all on the scale; no ambiguous grouping; prose
      ≤75ch; line-height varies with size; no grey text on a colored panel; empty /
      filtered / failed states distinguished
- [ ] AI-default sweep: no stray gradient, uniform radius, three-identical-cards row,
      blanket shadow, default indigo, or icon-per-card
- [ ] Cross-screen pass: accent means the same thing on every page; focus
      rings identical; density comparable between sibling panels
- [ ] Before/after screenshots captured for each migrated screen

## References

- [references/visual-reference-analysis.md](references/visual-reference-analysis.md) — observable image and typography analysis, inference boundaries, reusable briefs, exclusions, and translation into responsive native UI. Read at Step 0b for reference-driven design.

- `scripts/verify-preset.mjs` + `scripts/preset-gates.json` — runnable gates for
  all eleven presets: seven universal (contrast, webfonts, asset weight, reflow,
  focus ring, reduced motion, token roles) plus per-preset accent, separation
  strategy, and stated traps. Handles a stated accent deviation by resolving the
  live token. Does NOT check density or whether the result reads as the
  direction. See "Verifying an applied preset" in theme-presets.md.
- [references/theme-presets.md](references/theme-presets.md) — eleven named
  directions with contrast-validated token blocks and component grammar, the
  selection signal table, a disambiguation note for the four warm-yellow
  directions, the shared device set, and the procedure for adding a preset:
  Coastal Editorial, Blueprint Mono, Marigold Report, Atelier Warm, Terracotta
  Commerce, Midnight Showroom, Broadcast Light, Studio Kinetic, Campus Bright,
  Charter Navy, Dispatch Yellow. Read at Step 0, before writing a brief.
- [references/css-architecture.md](references/css-architecture.md) — the full
  token system, scoping rules, shared primitives, and responsive patterns.
  Read when writing the stylesheet.
- [references/ui-mechanics.md](references/ui-mechanics.md) — the mechanics layer:
  hierarchy dials, the spacing scale and ambiguous-spacing bug, type scale and
  line-length/line-height coupling, HSL scale construction (saturation at the extremes,
  hue-rotation brightness, tinted-grey ranges, two contrast escape hatches), depth on a
  dark ground vs. the light-source/two-part-shadow mechanics, empty states, form
  mechanics, and the AI-default checklist. Derived from *Refactoring UI* (Wathan &
  Schoger) and adapted — rules that invert on this skill's dark ground are marked ↯.
  Read when a surface looks off but the palette and structure are right.
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
- [references/recursive-polish.md](references/recursive-polish.md) — the
  whole-app sweep mode: recursive surface inventory, prior-art reconciliation,
  shared-first ordering, batch loop with ledger, loop-until-dry completion.
  Read whenever the scope is every surface of the app rather than one screen.
- [references/wcag-audit.md](references/wcag-audit.md) — the accessibility
  check-and-fix phase: token contrast matrix script, semantic tints as
  grounds, the opacity rule and why it compounds, automated sweep
  (axe-core / Lighthouse) with `violations` vs `incomplete` triage, how to
  validate your own contrast checker (and the four bugs that make one lie),
  auditing the surface that actually renders, the four manual passes, WCAG 2.2
  new criteria, fix patterns keyed to the design system — including never
  faking a grid role, and replacing a dimming that encodes state — guard tests
  with mutation checks, and the report/re-audit loop.
  Read when entering the accessibility phase or on any a11y/WCAG request.

### Consolidated interaction references

The following references are bundled with this skill so the former standalone
frameworks remain available without invoking a second skill:

- [Design foundations](references/design-everyday-things/) — affordances,
  signifiers, mappings, constraints, feedback, conceptual models, human error,
  the two gulfs, and the seven stages of action.
- [Krug and Nielsen heuristics](references/ux-heuristics/) — heuristic detail
  tables, audit template, severity guidance, cultural UX, dark-pattern
  recognition, conflict resolution, and accessibility checklists.
