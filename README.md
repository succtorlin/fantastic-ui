# fantastic-ui

**An agent skill for Codex and Claude Code that combines instrument-grade visual design with understandable interactions — from landing pages to app pages, dashboards, panels, and subpanels.**

<p align="center">
  <img src="assets/showcase.png" alt="A landing page built with this skill: dark warm-charcoal ground, serif display headline, single amber accent, and a live canvas visualization of sectors rotating through four quadrants" width="900" />
</p>

<p align="center"><em>Built with this skill: zero webfonts, zero UI libraries, one accent color, and a hero that is the product actually running on a &lt;canvas&gt;.</em></p>

---

## Why this exists

Ask an AI for a landing page and you usually get the same page everyone gets: centered headline, gradient blob, three feature cards with icons, `#6366f1`. It looks like a template because it *is* one — the statistical average of every landing page ever shipped.

This skill was distilled from a real redesign that went the other way: a marketing page for a quantitative finance terminal that feels like **holding the instrument**. The methodology generalizes to any product with real data or real behavior to show — dev tools, analytics, infra, fintech, monitoring.

It's not a component library and not a theme. It's the **decision discipline**, with working code for the hard parts.

## Usability and visual-reference analysis

The updated skill treats visual quality, interaction quality, and accessibility as one system. It bundles the interaction references directly, so these workflows do not require separate design-foundation or heuristic skills.

- **Norman's interaction foundations:** affordances, signifiers, natural mapping, constraints, feedback, conceptual models, and recovery from human error. Trace a task through the seven stages of action to locate a gulf of execution or evaluation.
- **Krug's usability rules:** make the purpose and primary action self-evident, support scanning and recognition, and use the Trunk Test to check whether users can orient themselves.
- **Nielsen heuristic audits:** inspect the states a task actually traverses, report severity **0–4**, propose a fix, and name how it will be verified. Major task failures, keyboard blockers, inaccessible controls, and dark patterns block shipping.
- **Two separate audit scores:** an interaction-foundation score and a heuristic-readiness score, each **0–10**, with evidence and failed rows. They are diagnostic summaries, not substitutes for observing users or proof of accessibility compliance.
- **Reference-driven design:** analyze composition, hierarchy, typography geometry, color roles, and responsive constraints. Keep **Observed**, **Inferred**, and **Proposed adaptation** separate; a screenshot does not reveal its exact font, prompt, hidden settings, or working behavior.
- **Implementation that preserves the product:** translate references into existing tokens, native text, shared components, and explicit constraints. Keep the chosen direction, meaningful interactions, performance budget, and accessibility gates intact.

Choose the smallest workflow that fits:

| Request | Starting point | Expected output |
| --- | --- | --- |
| Build or redesign a surface | Existing token system or preset check, then a one-sentence brief | Implemented surface and verified states |
| Review usability | Critical tasks and heuristic audit | Severity-ranked findings, separate scores, fixes and verification methods |
| Explain why a flow is confusing | Seven stages of action and the two gulfs | Evidence of where the task breaks and a targeted correction |
| Review navigation or forms | Trunk Test, scanning rules, and Nielsen checks | Orientation, labels, feedback, recovery, and input recommendations |
| Work from screenshots or a mood reference | Visual-reference analysis | Observations, labeled inferences, and a concrete implementation brief |

Explore the bundled [design foundations](skills/fantastic-ui/references/design-everyday-things/), [usability heuristics](skills/fantastic-ui/references/ux-heuristics/), and [visual-reference analysis](skills/fantastic-ui/references/visual-reference-analysis.md).

## The five disciplines

1. **Single-accent color system** — one accent, ground/hairline/ink scales tinted toward it, and semantic colors (up-teal, down-red) that *only ever* appear with their meaning. Color is information, not decoration.
2. **Three-face typography, zero webfonts** — humanist serif display + monospace data face + system sans body, all system stacks. The serif/mono contrast does the work webfonts get hired for, at zero performance cost.
3. **Live proof over screenshots** — the hero is the product running on a `<canvas>`: DPR-aware, pauses when the tab hides, renders one static frame under `prefers-reduced-motion`, cleans up completely.
4. **Page rhythm** — alternating texture bands: stat tape, thesis explainer, asymmetric bento with painted sparklines, an AI-generated atmosphere band (≤30 KB webp), an interactive ARIA-correct toggle, honest fine print.
5. **Performance and accessibility as gates, not polish** — a pass/fail ship checklist: reduced-motion paths for every animation, skip link, designed focus rings, no horizontal overflow at 320px, RAF verified stopped when the tab hides.

## The mechanics layer

The five disciplines decide **direction**. They don't, on their own, stop a surface from looking amateur — a correct palette laid out with ad-hoc spacing and one global `line-height` still reads as assembled. The mechanics layer is where most "I can't say why this looks off" problems actually live:

- **Hierarchy runs on color first, weight second, size last.** Most clutter is fixed by demoting something to `--muted`, not by enlarging what you want seen. To emphasise, de-emphasise everything around it.
- **A spacing scale you actually obey**, and the ambiguous-spacing bug — a label equidistant from the field above and below — which breaks more forms than any amount of restyling.
- **Line-height proportional to length and size**, never one global value; prose capped at 45–75 characters.
- **HSL scale construction from three anchors**, with saturation *raised* at both extremes (or your tinted greys drift back to neutral) and **hue rotation** as a second brightness dial — toward 60/180/300 to lighten, 0/120/240 to darken, capped at 20–30°.
- **Depth on a dark ground is lightness + hairline, not shadow** — shadows have nothing to block against near-black. This is the mechanism behind discipline 1's "hairlines, not shadows", and the reason a raised dark surface usually needs both cues: adjacent ramp steps are often under 1.3:1.
- **Empty states are a designed surface**, with *empty*, *filtered to nothing* and *failed to load* kept as three distinct states.
- **The AI-default checklist** — purple gradients, uniform max radius, three identical cards, blanket shadows, default indigo, hero→features→testimonials on a product that isn't a landing page. Plus the gut check: *would a developer guess this was generated?*

This layer is adapted from [*Refactoring UI*](https://www.refactoringui.com/) by Adam Wathan & Steve Schoger. Several of the book's defaults **invert** on a dark ground, and those are marked `↯` in the reference rather than copied across. Where the mechanics and the disciplines disagree, the disciplines win: they are the direction, the mechanics are the mechanism.

## Eleven theme presets, with automatic selection

The five disciplines say *how* to design; a preset is a pre-committed answer to *what direction*. The skill ships eleven contrast-validated directions — from Coastal Editorial and Blueprint Mono to Midnight Showroom and Dispatch Yellow — each with a full token block, type pairing, and component grammar.

Selection is part of the workflow, not a menu you're shown: before writing a brief, the skill runs a preset check with three gates — the user named a direction → use it; the codebase already has a token system → **no preset** (recover and extend the existing brief instead of running a second design system); otherwise score the request against a signal table (medium, domain, imagery, density) and apply each preset's disqualifier. One confident match is adopted and announced in a line; near-ties get a short question; a half-fit is refused in favor of a fresh brief, because a stretched preset produces exactly the template output the skill exists to prevent. Data-dense analytics/finance surfaces are a stated gap — those route to the dark instrument direction, never to a preset because it happens to be dark.

## Beyond the landing page: product surfaces

The same five disciplines apply *inside* the product. The skill includes a dedicated workflow for modifying existing app pages, panels, and subpanels:

- **App-level brief and tokens** — one one-sentence direction and one token block on the app shell; page-local colors are forbidden, so every screen draws from the same ground scale and single accent.
- **A six-step retrofit procedure** — audit (inventory + color-literal grep baseline) → brief → mechanical tokens-first commit → shared primitives → screen-by-screen migration (one PR each, highest-traffic first) → a cross-screen consistency gate.
- **Panel anatomy and nesting rules** — a uniform panel skeleton (mono eyebrow head, hairline separation, actions right), depth encoded by ground-scale steps instead of shadows, maximum three nesting levels.
- **States as first-class design** — skeleton loading on the ground scale, honest empty states, error red confined to actual errors, stale-data timestamps.

## Whole-app recursive polish

When the scope is *every* surface — "polish every page, don't miss anything" — a per-screen procedure isn't enough. The skill includes a sweep mode that adds coverage mechanics on top of the retrofit workflow:

- **Inventory by recursive traversal** — walk every route's import tree from the code (modals, drawers, toasts, and command palettes included), deduplicating shared components into single work items; never trust a route-count estimate.
- **Prior-art reconciliation** — detect an existing token system, recover its brief instead of writing a competing one, and extend any existing style-guard tests rather than creating parallel ones. Dual-theme apps get one token vocabulary with light/dark values per token, contrast-validated in both.
- **Shared-primitives-first ordering**, then routes by traffic, with a stated fallback ranking when no analytics exist.
- **Batched migration** — 3–5 surfaces per batch (the batch is the PR unit in sweep mode), a presentation-only diff gate, per-batch a11y pass, and a persistent ledger file that survives session boundaries.
- **Loop-until-dry completion** — the job is done only when a *fresh* re-inventory finds zero unpolished surfaces and the mechanical proofs pass (zero color literals outside the token file, zero axe-core critical/serious). Early stops are recorded as explicitly deferred, never silently dropped.

## The accessibility phase

Accessibility isn't a checklist item here — it's a required **check-and-fix phase** targeting WCAG 2.2 AA, run at three moments:

1. **Token time** — a runnable contrast-matrix script validates every ink×ground and accent×ground pair once (4.5:1 text, 3:1 UI/focus), so every screen inherits compliance; failing pairs are fixed in the token, never locally.
2. **Build time** — landmarks, heading order, real ARIA, canvas/marquee text alternatives built in as you go.
3. **Pre-ship** — automated sweep (axe-core with `wcag22aa` tags + Lighthouse) plus four manual passes (keyboard, screen reader, reduced motion, 320 px / 200 % reflow), a severity triage where critical/serious findings block the ship, then fix and **re-audit to zero blockers**.

The reference includes fix patterns keyed to the design system (two-layer focus rings, semantic-color text variants, ≥24 px target sizes, `aria-live` on refreshing panels) and covers the new WCAG 2.2 criteria most audits miss.

The phase is hardened with lessons from real audits, where the tooling itself was the problem as often as the UI:

- **Never dim text with `opacity-*`** — it survives code review (every class references an approved token), fails contrast anyway, *compounds* through nesting (0.60 × 0.70 = 0.42 alpha → a measured 1.83:1), and creates a stacking context that blinds axe. Semantic tint backgrounds count as grounds in the contrast matrix too.
- **axe `incomplete` ≠ `violations`** — the DevTools extension paints both with the same red SERIOUS card. `incomplete` means "could not compute": each node gets measured by hand and recorded, because on one audit 0 violations + 14 incomplete concealed 9 genuine AA failures — and because chasing "incomplete = 0" makes you restyle compliant UI.
- **Validate the measuring instrument** — four documented bugs that make a hand-rolled contrast checker lie (oklab parsed as RGB, premultiplied-alpha precision loss, ignored gradients, walking past opaque layers), and a two-backdrop resolution technique that sidesteps all of them.
- **Audit the surface that actually renders** — not an error/empty shell, not a file the route never mounts, not dead code; every designed state (loading, empty, error, locked, approved) is a coverage item.
- **Never fake structure** — a column-major DOM gets self-describing cells, not a `role="grid"` that announces wrong coordinates; a dimming that *encodes state* gets a replacement channel before removal, then a re-measure (which is how a pre-existing failure hiding under one was found).
- **Guard every fixed bug class with a mutation-tested regression test** — a guard that has never gone red has never been shown to work.

## Install

The commands below are for a fresh installation. If you already have a `fantastic-ui` skill, preserve local edits before replacing it. Install the complete skill directory, including `references/` and `scripts/`, not just `SKILL.md`.

Clone the repository:

```bash
git clone https://github.com/succtorlin/fantastic-ui.git
```

**Codex** (global skill directory used by this package):

```bash
mkdir -p ~/.codex/skills
cp -R fantastic-ui/skills/fantastic-ui ~/.codex/skills/
```

**Claude Code:**

```bash
mkdir -p ~/.claude/skills
cp -R fantastic-ui/skills/fantastic-ui ~/.claude/skills/
```

Or, if you use the `skills` CLI:

```bash
npx skills add succtorlin/fantastic-ui
```

For a project-local Claude Code installation, copy into `<repo>/.claude/skills/` instead. After installation, start a new session if your client has already loaded its skill list.

## Use

Once installed and available in your client's skill list, ask for things like:

- *"Build a landing page for my API monitoring tool"*
- *"Redesign our homepage, it looks like a template"*
- *"Make this page feel premium"*
- *"Restyle the dashboard panels to match the landing page"*
- *"Apply the same style across all the app's pages and subpanels"*
- *"Polish every single surface of the app — make sure nothing is missed"*
- *"Run a WCAG audit on this page and fix what fails"*
- *"Make the app accessible / fix the contrast and keyboard issues"*
- *"Build the site in the Marigold Report style"* (or any preset — or let the skill pick one)
- *"Students cannot find the next step in this onboarding flow. Diagnose it and propose a fix."*
- *"Audit this dashboard using Norman, Krug, and Nielsen; show evidence, severity, and separate scores."*
- *"Use these screenshots to define the typography, composition, and responsive rules without replacing our existing design system."*

Invoke it explicitly with `$fantastic-ui` in Codex or `/fantastic-ui` in Claude Code. State whether you want analysis only or implementation; asking for an audit does not by itself request code changes.

**Want to see how a session actually goes?** [docs/USE-CASES.md](docs/USE-CASES.md) walks through six scenarios end to end — what to say, what the skill does, what it asks you, and what you get.

## What's inside

```
skills/fantastic-ui/
├── SKILL.md                        # the methodology + ship checklist
├── scripts/
│   ├── verify-preset.mjs            # runnable checks against a live page
│   └── preset-gates.json           # universal and per-preset gate declarations
└── references/
    ├── visual-reference-analysis.md # composition, typography geometry, observation vs. inference,
    │                               #   reusable briefs and responsive native UI translation
    ├── design-everyday-things/     # ten references: Norman's foundations, action stages,
    │                               #   execution/evaluation gulfs, human error and case studies
    ├── ux-heuristics/              # seven references: Krug, Nielsen, audit template,
    │                               #   conflicts, cultural UX, dark patterns and accessibility
    ├── css-architecture.md         # full token system, scoped CSS-module rules, shared primitives
    ├── canvas-hero.md              # annotated live-canvas hero, sparklines, scroll reveals —
    │                               #   with the complete lifecycle contract (DPR / visibility / reduced-motion / cleanup)
    ├── ai-atmosphere.md            # prompt recipe + pipeline for ≤30 KB AI atmosphere backgrounds
    ├── product-surfaces.md         # retrofit procedure for app pages/panels/subpanels: audit → tokens →
    │                               #   primitives → migration, panel anatomy, nesting depth, state design
    ├── theme-presets.md            # eleven named directions with contrast-validated token blocks and
    │                               #   component grammar, plus the signal table and gates for automatic
    │                               #   preset selection (and refusal)
    ├── wcag-audit.md               # WCAG 2.2 AA check-and-fix phase: contrast-matrix script (semantic
    │                               #   tints included), the opacity rule, axe sweep with violations-vs-
    │                               #   incomplete triage, validating your own checker, auditing the real
    │                               #   rendered surface, four manual passes, on-system fix patterns,
    │                               #   mutation-tested guards, re-audit loop
    ├── ui-mechanics.md             # the mechanics layer: hierarchy dials, spacing scale + ambiguous
    │                               #   spacing, type scale and line-length coupling, HSL construction
    │                               #   (saturation at the extremes, hue-rotation brightness, contrast
    │                               #   escape hatches), depth on dark vs. light-source/two-part shadows,
    │                               #   empty states, form mechanics, AI-default checklist
    └── recursive-polish.md         # whole-app sweep mode: recursive surface inventory (dead-code and
                                    #   running-app cross-checks, state variants as coverage items),
                                    #   prior-art reconciliation, batch loop with ledger, loop-until-dry
                                    #   completion with mechanical proofs
```

The skill is framework-light: the worked code is React + CSS modules, but the disciplines (and most of the CSS) transfer directly to Vue, Svelte, or plain HTML.

## Verification boundaries

The existing mechanics layer and all eleven preset declarations and verification tools remain included. Run the preset checker from a project with `playwright` and `@axe-core/playwright` installed; see [Verifying an applied preset](skills/fantastic-ui/references/theme-presets.md#verifying-an-applied-preset) for the command and coverage.

A passing automated check does not establish design quality, actual user comprehension, or full WCAG conformance. Manually verify keyboard and screen-reader behavior, reduced motion, reflow, and the relevant loading, error, permission, and recovery states. A visual reference establishes intent, not live data or proven interaction behavior.

## License

MIT — see [LICENSE](LICENSE).
