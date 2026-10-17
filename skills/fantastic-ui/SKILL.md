---
name: fantastic-ui
description: >-
  Design and build instrument-grade marketing pages and in-product surfaces
  (app pages, dashboards, panels, and subpanels) that feel like the product,
  not a template. Use for landing, hero, homepage, portfolio, premium/polished
  redesign, whole-app visual retrofit, data-heavy or technical UI, charts,
  agent/AI consoles, wizards, settings and checkout flows, phone-only screens,
  single components with all their states, motion that should not look
  generic, and accessibility or
  WCAG work, and for following, checking against the CSS, creating or
  replacing a project's DESIGN.md design-system file. Also use for confusing or unintuitive interactions, affordance,
  discoverability, mental-model, error-prevention, cognitive-walkthrough,
  usability, navigation, form, heuristic, or dark-pattern analysis. Covers
  editorial visual systems, live proof, generated token-driven decorative
  imagery (palette plates, SVG texture, AI atmosphere, ≤30 KB), performance,
  keyboard/screen-reader access, Norman's interaction foundations, Krug's
  usability rules, and Nielsen heuristic audits.
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
- **One component** ("just the button", "a date input", a brief under ~30
  words naming one element): skip the page apparatus and run
  [component-states.md](references/component-states.md) — eight states and a
  preview file, drawn from the project's tokens.
- **A surface an agent works in** (run console, copilot panel, approval
  queue): the product-surface route plus
  [agent-console.md](references/agent-console.md).
- **Forms, wizards, settings, review queues, checkout:**
  [workflow-surfaces.md](references/workflow-surfaces.md).
- **Phone-only screens** (app prototypes, mobile web apps, H5 pages):
  [phone-surfaces.md](references/phone-surfaces.md).

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

Write each finding so the person reading it can see it without opening the
code:

- an **On screen:** line, saying what a visitor would actually see ("the
  Save button wraps onto two lines at 375 px");
- the failure mode as a **cost to that visitor** ("they read it as two
  buttons and tap the wrong half"), never a restatement of the finding;
- every term of art glossed once per reply, in one plain clause of what it
  looks like ("focus ring: the outline that shows which control the
  keyboard is on");
- past about eight findings, list every severity 3–4 in full and give the
  rest as a count by severity, with the full list on request. A wall of
  forty equal-weight bullets hides the three that block shipping.

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

Before any code, commit to a named direction in one sentence that ends with
an **imagery clause**. This sentence is **the brief line**; every later
reference to it means this sentence. Example from the worked case:

> "Dark, instrument-grade market terminal elevated to editorial: warm-charcoal
> ground, single sodium-amber accent, teal/red only as semantic signal colors,
> humanist serif display over monospace data; imagery: warp plate behind the
> atmosphere band and the hero copy column."

### Step 0a — Run the preset check FIRST (do not skip, do not skip silently)

Before writing a brief, decide whether one of the twelve presets in
[references/theme-presets.md](references/theme-presets.md) already is the brief.
Work the gates in order and stop at the first that answers:

0. **Does the project have a DESIGN.md?** Run
   `python3 scripts/design_md.py find --root .` first, every time. A DESIGN.md
   (Google Labs' open format) is the project's recorded direction, and it
   decides before the gates below. Procedure:
   [references/design-md.md](references/design-md.md).
   - **The user explicitly asks to replace it** ("replace our DESIGN.md with
     Gallery White"): run the replace procedure. Write the new file beside the
     old one, show the diff, and move it into place only on a yes. Then migrate
     the code.
   - **The user names a preset or a look, but does not ask to replace the
     file**: do not apply it. Say the file exists and what direction it records,
     then ask: *follow the file, or replace it with this preset?*
   - **Otherwise follow it.** `read` it, then announce its direction in one line
     with the imagery clause. Run `drift` against the stylesheet, and put every
     mismatch to the user as a question, every time. Never decide which side is
     right. Gates 1–3 do not run.

   No file → continue with gate 1. After the direction is settled, offer to
   write a DESIGN.md (`design_md.py export`), and write it only on a yes.
1. **Did the user name a direction?** Any preset name, or a described look
   ("monochrome architectural", "warm cream deck"). → Use it. Their words win,
   including when they ask for something you would not have chosen.
2. **Does the codebase already have a token system (and no DESIGN.md)?** Grep the global
   stylesheet for token names, accent variables, shared primitive classes. If
   one exists → **no preset.** Recover its brief and extend it (Phase B of
   `recursive-polish.md`); the recovered brief line still gets an imagery
   clause. A preset here would run a second design system in parallel, which
   is the exact failure Shift 1 forbids.
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
| The brief is only praise words ("premium", "clean", "make it pop") or the user cannot say what they want, and this is a marketing page | **Offer to show rather than ask.** Announce your recommended direction as usual, and offer three low-fidelity first-screen sketches (static, tokens + skeleton only, no imagery) that differ on *different* axes (palette, layout skeleton, type, motion), each labelled with one concrete noun ("Ledger", "Darkroom", "Field notes"). Build them only on a yes. Two sketches that could share a label, or labels that differ only by an adjective, are one sketch: rework. Inside an existing product, never: recover the app's brief instead. |

**Always announce the outcome in one line before building**, with the
imagery clause attached, so the user can redirect before code exists. When a
preset is adopted, this announcement is the brief line:

> Using **Terracotta Commerce** — retail storefront, product photography,
> soft-shadow cards. Imagery: your product shots via `compress`, timber band
> via `ai`, else `plate --style warp`. Not right? Say *darker* for a
> Midnight Showroom ground, or *quieter* for no motion beyond state changes.

End the announcement with one or two **named** forks that differ from each
other (usually theme and motion), as above, rather than an open "say the
word": a person can pick a named alternative in two words, and cannot easily
describe the one they have not seen.

> No preset fits: this is a data-dense operator console, and every preset
> either fails at density or has no accent to encode state. Writing a fresh
> brief. Imagery: warp plate behind the page header, inherited by every
> panel's empty states (gen_atmosphere, seed 7).

Every path needs the clause: preset, fresh brief, and recovered brief alike.
"Imagery: none" is allowed only with its reason ("dense table route — a plate
would sit behind numbers"). Slots, tools and limits:
[references/ai-atmosphere.md](references/ai-atmosphere.md).

**Known gap, state it rather than forcing a fit:** all twelve presets are
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

Then test the brief at **two altitudes** before using it:

1. *Could someone guess this palette and layout from the product category
   alone?* (fintech → navy and a line chart; wellness → sage and soft
   cards). If yes, it is the first-order default.
2. *Could they guess it from the category plus your rejection of the
   obvious?* (fintech, not navy → dark terminal with amber). If yes, it is
   the second-order default, and it is just as generic. This skill's own
   worked example is the trap here: a warm dark terminal with a sodium accent
   is right for a market terminal and a reflex everywhere else.

A brief that survives both says something only this product could say: a
colour that already means something in it, a texture taken from its real
material, a layout borrowed from how the work is actually done.

For marketing pages, add a one-line **Motion:** plan under the brief line,
naming the beat for each of first screen, scroll, interaction and close, and
the still version — the beat sheet in
[references/motion-routes.md](references/motion-routes.md#the-beat-sheet).

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

All other motion takes the **cheapest route that does the job**: CSS
transitions, then native scroll-driven animation, then View Transitions and
WAAPI, then Canvas 2D. GSAP and WebGL are not used in this skill. Content must
survive removal: with every animation and all JavaScript stripped, the page
is complete and legible. The route ladder, an effect-to-route lookup, the
beat sheet and the motion slop to avoid:
[references/motion-routes.md](references/motion-routes.md).

**Imagery is part of the system.** Proof is live; atmosphere is *generated
from the tokens* by `scripts/gen_atmosphere.py`, never chosen from stock, and
never shows UI, text, people, logos or fake data. Plates follow
[the plate rule](references/ai-atmosphere.md#the-plate-rule): static,
`aria-hidden`, ≤30 KB, never behind data — and visible: a plate the reader
cannot see is a failure, not a safe default. Every page's imagery decision is
the brief line's imagery clause. **Every imagery claim cites a measured
number** — each slot's visibility and worst text ratio from
`scripts/plate-check.js` on the composited page — never "reads correctly"
from the raw file.

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
6. **Atmosphere band** — full-bleed section over a token plate under a
   token scrim carrying the accountability/credibility content. Its big-type
   stats are the plate rule's one carve-out: scrim plus a passing real-pixel
   gate ([ai-atmosphere.md](references/ai-atmosphere.md#the-plate-rule)).
   The hero backdrop and section dividers may take plates too — three
   rasters per page at most
7. **Interactive toggle section** — one real state switch (markets, plans,
   platforms) with proper ARIA tabs, proving the page is an application
8. **Principles trio** — the "why trust us" values, stated plainly
9. **Final CTA + honest fine print**

This sequence is **one skeleton, for a product landing page**, not a
template. Run it unchanged on every page and every page looks the same. Two
rules keep it from converging:

- **Count layout families.** A band's family is its structure: split
  copy/visual, full-bleed atmosphere, asymmetric bento, list rows, single
  centred statement, table, timeline, tabs. A page of eight bands uses at
  least four families and no family more than twice; the nine bands above
  already use six. Swap a band's family before adding a new band.
- **Ration the eyebrows.** Mono accent eyebrows are a primitive, not a
  default: on a marketing page at most `ceil(bands / 3)` of them, on the
  bands that need a label to be found. (Product panels keep theirs; the
  eyebrow is the panel head's anatomy.)

Other page kinds have their own skeleton:

- **Portfolio or personal site** — the work comes before the words. Lead
  with one piece shown deeply (the problem, the move, the result, with the
  real artefact), then the rest as **list rows** (`64px 1fr auto 90px`:
  index, title + one line, year, thumbnail), not six identical cards. No
  skill bars, no percentage meters, no "passionate about" paragraph. One
  deep project beats six shallow ones.
- **Agency or studio** — the capability is the product. At most three or
  four services, and each band must be structurally different from the
  others (a case table, a process timeline, a before/after), because four
  matching cards say the services are interchangeable. Name clients and
  numbers only when they are real and cleared.
- **Lookbook or collection** — photography-led; use the visual-reference
  procedure ([references/visual-reference-analysis.md](references/visual-reference-analysis.md))
  and a content-led preset, since this skill's live-proof hero has nothing to
  run.

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
- Any raster asset ≤ 30 KB WebP (the generator enforces it); decorative
  imagery static and `aria-hidden`
- Motion on compositor properties only (`transform`, `opacity`); scroll work
  via IntersectionObserver or native scroll-driven CSS, never scroll handlers
  doing layout reads
- Explicit dimensions on media; hero canvas gets width/height attributes
- The **mobile floor** holds: wrappers use `overflow-x: clip` (never
  `hidden`, which silently kills the sticky nav), image tracks are
  `minmax(0, 1fr)`, buttons never wrap at 320 px, display words can break,
  one sticky owns `top: 0`, uppercase leading ≥ 1.0 —
  [css-architecture.md](references/css-architecture.md#mobile-floor)

**Accessibility**
- Every animation (canvas, reveals, marquee, pulse) gated behind
  `prefers-reduced-motion` — reveals appear instantly, canvas draws one frame
- Nothing is hidden in plain CSS waiting for a script: a reveal's start state
  is armed by the script that will finish it, so the page reads complete with
  JavaScript off
- Zoom is never blocked: no `user-scalable=no` or `maximum-scale=1`
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

**Decide the kind before the density.** A surface built around a batch of
business objects (orders, tickets, holdings) is a **back-office**: neutral,
dense, tables and bulk actions. A surface built around one thing the user
does over and over is a **workbench**: one focal surface, more character, and
the repeated action made nearly free. Ask when the brief is just "dashboard"
or "工作台". When an agent does the work, the run-console layer in
[agent-console.md](references/agent-console.md) stacks on either: a run
stream instead of a chart, nine run states each with its action, a stop
control that never leaves the screen, approval cards inside the stream, and
cost as a receipt. Charts follow [data-charts.md](references/data-charts.md).

**Imagery in-product:** one plate per route at most, never behind data; every
panel and subpanel inherits it in its empty and first-run states, through the
shared empty-state primitive —
[the plate rule](references/ai-atmosphere.md#the-plate-rule).

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
  a11y pass, an imagery slot check per route and per panel state (plate-check
  numbers, empty-state audit), and a persistent ledger file
  that survives session boundaries
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

## After delivery — iterate, don't rebuild

One complaint never justifies a rebuild. Map it to the one lever that
answers it, change that, and show the before and after:

| The user says | Pull this lever |
|---|---|
| "Too plain", "boring" | Add a proof artefact (sparkline, mini-table, live readout) to the flattest band, or put the route's plate in its slot. Not more colour. |
| "Cluttered", "busy" | De-emphasise around the important thing ([ui-mechanics.md](references/ui-mechanics.md) §1); remove before resizing. |
| "Generic", "looks AI-made" | Run the two-altitude check on the brief, then swap the most repeated layout family and the most generic element (usually palette or skeleton). |
| "Wrong colours" | Re-run the preset gates or rewrite the brief's colour clause; fix tokens, never instances. |
| "Too much motion" / "too static" | Move one beat on the beat sheet; never add a beat that does not show a state or the product. |
| "Broken on my phone" | The mobile floor, M1 to M6, at 320 and 375 px. |
| "I don't like it" (no reason) | Offer the two named forks from the announcement, rendered. |

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

- [ ] **Promise kept**: paste the brief line (and the Motion line) back in
      and check it clause by clause against the built page; any clause that
      could not be built is said aloud at delivery, not quietly dropped
- [ ] **It actually renders**: `node scripts/lint-surface.mjs --strict <files>`
      has run and reports zero P0 (dead local references, the sticky-killing
      `overflow-x: hidden`, zoom blocked, motion with no reduced-motion path
      anywhere); every P1 fixed or explained; root-relative paths checked by
      hand. A check that did not run is not a pass
- [ ] JavaScript-off reload: every section present and readable
- [ ] Mobile floor M1–M6 checked at 320 and 375 px
      ([css-architecture.md](references/css-architecture.md#mobile-floor))
- [ ] DESIGN.md, if the project has one: `design_md.py drift` clean, or every
      remaining mismatch kept by the user's explicit choice; never rewritten
      without an explicit request and a shown diff
- [ ] One accent color; semantic colors appear only with their meaning
- [ ] No webfonts, no new dependencies, assets ≤ 30 KB each
- [ ] Imagery plan executed, or its absence justified in the brief line
- [ ] Every raster ≤ 30 KB WebP, `aria-hidden`, explicit dimensions, static;
      every asset (`plate`, `ai`, `compress`, `svg`) has an imagery-ledger line
- [ ] Every plate slot measured with `scripts/plate-check.js` at 1440 and
      375 px behind a stale-CSS sentinel (`expect`): ≥8% ≥1.1:1 and ≥1%
      ≥1.3:1 against the page, raw and after the structure blur (grain is
      not a motif), text ≥4.5:1 (3:1 large); numbers cited
- [ ] Every panel/subpanel empty and first-run state inherits the route's
      plate (or svg texture); populated panels carry none; plated branches
      audited — explicit `kind`, no error path falls through to empty copy
- [ ] Consumer tests copied from `templates/tests/` and passing
- [ ] Hero shows the product *running*, not a picture of it
- [ ] `prefers-reduced-motion`: every animation has a static path (verify by
      toggling the OS setting or DevTools emulation)
- [ ] Keyboard pass: skip link, visible focus rings, tabs operable
- [ ] Responsive pass at every width in the breakpoint list
      ([css-architecture.md](references/css-architecture.md#mobile-floor)) —
      bento collapses cleanly, no horizontal overflow
- [ ] Tab-hidden pass: canvas RAF actually stops (check via Performance panel)
- [ ] Copy pass: numbers concrete and either sourced or labelled as
      sample data, fine print honest, zero hype words (the list is
      `lint-surface.mjs --rules`, `copy-buzzword`; "revolutionary",
      "powerful" and "seamless" are the classic three), no em-dash
      flourishes in prose,
      no run of "X. Not Y." rebuttal lines, buttons say verb + object, one
      label per action (the same CTA is not "Get started" here and "Try it"
      there), no lorem ipsum or "John Doe"
- [ ] **Accessibility phase completed**: token contrast matrix validated,
      axe-core (wcag2a/wcag2aa/wcag22aa tags) at zero critical/serious
      *violations*, every *incomplete* node measured and recorded, zero bare
      `opacity-*` on text, keyboard + screen-reader + reduced-motion + reflow
      manual passes done, findings fixed and re-audited (see
      references/wcag-audit.md)

Additional gates when the work touched product surfaces:

- [ ] No hex/rgb literals outside the token file (grep proves it; token
      `color-mix(` scrims and tints pass)
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
- [ ] Nothing on the "must not change" list moved without the user's yes
      (sections, primary font, accent meaning, navigation)
- [ ] Agent, workflow, component, chart and phone surfaces pass the `## Gate`
      in their own reference file

## References

- [references/theme-presets.md](references/theme-presets.md) — twelve named
  directions (Coastal Editorial, Blueprint Mono, Marigold Report, Atelier Warm,
  Terracotta Commerce, Midnight Showroom, Broadcast Light, Studio Kinetic,
  Campus Bright, Charter Navy, Dispatch Yellow, Gallery White): contrast-validated
  tokens, grammar, imagery, signal table. Read at Step 0a, before writing a brief.
- [references/design-md.md](references/design-md.md) — a project's DESIGN.md:
  find, read, drift (ask on every mismatch), create on a yes, replace only on
  an explicit request. Read at Step 0a, gate 0.
- [references/gallery-modules.md](references/gallery-modules.md) — Preset L's
  kit: tone bands, glass nav, studio-lit product stage, bento tiles. Read with L.
- [references/visual-reference-analysis.md](references/visual-reference-analysis.md)
  — image/typography analysis, observed vs. inferred. Read at Step 0b.
- [references/ai-atmosphere.md](references/ai-atmosphere.md) — the canonical
  plate rule, tool order, procedure, `batch` manifests, text and visibility
  gates. Read when writing the imagery clause and before any asset.
- [references/plate-slots.md](references/plate-slots.md) — named scrim + fit
  slots with exact CSS and `score` calls. Read before placing a plate.
- [references/ai-motifs.md](references/ai-motifs.md) — domain → motif, the
  `ai` prompt recipe, consent and cost. Read before any `ai` call.
- [references/css-architecture.md](references/css-architecture.md) — token
  system, scoping, primitives, responsive patterns. Read when writing the stylesheet.
- [references/ui-mechanics.md](references/ui-mechanics.md) — hierarchy, spacing,
  type/line-height, HSL construction, depth, empty states, forms, AI-default
  checklist (*Refactoring UI*, dark-ground inversions marked ↯). Read when a
  surface looks off but the palette and structure are right.
- [references/canvas-hero.md](references/canvas-hero.md) — live canvas hero,
  sparklines, scroll reveal, lifecycle. Read when building any canvas or reveal.
- [references/product-surfaces.md](references/product-surfaces.md) — retrofit
  procedure, back-office vs workbench, panel anatomy, nesting, states. Read
  whenever modifying in-product UI.
- [references/agent-console.md](references/agent-console.md) — run stream,
  nine run states, stop control, approval cards, cost receipt, phone form.
  Read for any surface an agent works in.
- [references/workflow-surfaces.md](references/workflow-surfaces.md) — one
  page or steps, field kit, pre-submit check, derived totals, commit, review
  queues, commerce flows. Read for forms, wizards, settings, checkout.
- [references/component-states.md](references/component-states.md) — the
  one-component route: eight states, geometry, preview file. Read when the
  brief is one element.
- [references/data-charts.md](references/data-charts.md) — chart by question,
  accessibility grades, bars, tooltips, chart colour under one accent. Read
  before drawing any chart.
- [references/motion-routes.md](references/motion-routes.md) — route ladder,
  effect lookup, beat sheet, motion slop, procedural motion. Read before any
  motion beyond the canvas hero.
- [references/phone-surfaces.md](references/phone-surfaces.md) — phone frame,
  safe areas, thumb zone, touch, native furniture. Read for phone-only screens.
- [references/recursive-polish.md](references/recursive-polish.md) — whole-app
  sweep with ledger and loop-until-dry. Read when the scope is every surface.
- [references/wcag-audit.md](references/wcag-audit.md) — contrast matrix,
  opacity rule, axe `violations` vs `incomplete`, checker validation, manual
  passes, text over imagery, fix patterns, guards. Read when entering the
  accessibility phase or on any a11y/WCAG request.
- `scripts/verify-preset.mjs` + `scripts/preset-gates.json` — runnable gates for
  all twelve presets; not density or "reads as the direction". Read "Verifying
  an applied preset" in theme-presets.md before running it.
- `scripts/gen_atmosphere.py` — `tokens`, `plate`, `svg`, `ai`, `compress`,
  `score`, `batch`; ≤30 KB, a ledger line per asset; `plate --page` exits 1
  `page_mismatch`, a too-faint slot exits 4. Run it per ai-atmosphere.md §4.
- `scripts/lint-surface.mjs` — static check of HTML/CSS/JSX for dead local
  refs, the sticky-killing overflow, blocked zoom, missing reduced motion,
  text opacity, colour literals outside tokens, AI-default palettes, copy
  tells. Exit 0 unless `--strict`; prints what it cannot judge. A deliberate
  exception carries `/* lint-surface-allow: <rule> — <reason> */` (or the
  `//` / `<!-- -->` form) on or above the line; suppressions are reported,
  and one without a reason is itself a finding. `--rules` lists every rule;
  `--token-selector` / `--token-file` widen where literal colours are allowed.
- `scripts/plate-check.js` — browser check of every plate host: visibility,
  text, stale-CSS sentinel. `templates/tests/` — consumer tests to copy.
  `evals/plate-visibility/` — fixture app and offline run for the tools.

### Consolidated interaction references

Bundled so the former standalone frameworks need no second skill:

- [Design foundations](references/design-everyday-things/) — affordances,
  signifiers, mappings, constraints, feedback, conceptual models, human error,
  the two gulfs, and the seven stages of action.
- [Krug and Nielsen heuristics](references/ux-heuristics/) — heuristic detail
  tables, audit template, severity guidance, cultural UX, dark-pattern
  recognition, conflict resolution, and accessibility checklists.
