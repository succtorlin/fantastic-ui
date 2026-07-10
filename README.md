# fantastic-ui

**An agent skill that teaches Claude to build instrument-grade UI — landing pages that read like the product itself, and product surfaces (app pages, dashboards, panels, subpanels) held to the same discipline.**

<p align="center">
  <img src="assets/showcase.png" alt="A landing page built with this skill: dark warm-charcoal ground, serif display headline, single amber accent, and a live canvas visualization of sectors rotating through four quadrants" width="900" />
</p>

<p align="center"><em>Built with this skill: zero webfonts, zero UI libraries, one accent color, and a hero that is the product actually running on a &lt;canvas&gt;.</em></p>

---

## Why this exists

Ask an AI for a landing page and you usually get the same page everyone gets: centered headline, gradient blob, three feature cards with icons, `#6366f1`. It looks like a template because it *is* one — the statistical average of every landing page ever shipped.

This skill was distilled from a real redesign that went the other way: a marketing page for a quantitative finance terminal that feels like **holding the instrument**. The methodology generalizes to any product with real data or real behavior to show — dev tools, analytics, infra, fintech, monitoring.

It's not a component library and not a theme. It's the **decision discipline**, with working code for the hard parts.

## The five disciplines

1. **Single-accent color system** — one accent, ground/hairline/ink scales tinted toward it, and semantic colors (up-teal, down-red) that *only ever* appear with their meaning. Color is information, not decoration.
2. **Three-face typography, zero webfonts** — humanist serif display + monospace data face + system sans body, all system stacks. The serif/mono contrast does the work webfonts get hired for, at zero performance cost.
3. **Live proof over screenshots** — the hero is the product running on a `<canvas>`: DPR-aware, pauses when the tab hides, renders one static frame under `prefers-reduced-motion`, cleans up completely.
4. **Page rhythm** — alternating texture bands: stat tape, thesis explainer, asymmetric bento with painted sparklines, an AI-generated atmosphere band (≤30 KB webp), an interactive ARIA-correct toggle, honest fine print.
5. **Performance and accessibility as gates, not polish** — a pass/fail ship checklist: reduced-motion paths for every animation, skip link, designed focus rings, no horizontal overflow at 320px, RAF verified stopped when the tab hides.

## Beyond the landing page: product surfaces

The same five disciplines apply *inside* the product. The skill includes a dedicated workflow for modifying existing app pages, panels, and subpanels:

- **App-level brief and tokens** — one one-sentence direction and one token block on the app shell; page-local colors are forbidden, so every screen draws from the same ground scale and single accent.
- **A six-step retrofit procedure** — audit (inventory + color-literal grep baseline) → brief → mechanical tokens-first commit → shared primitives → screen-by-screen migration (one PR each, highest-traffic first) → a cross-screen consistency gate.
- **Panel anatomy and nesting rules** — a uniform panel skeleton (mono eyebrow head, hairline separation, actions right), depth encoded by ground-scale steps instead of shadows, maximum three nesting levels.
- **States as first-class design** — skeleton loading on the ground scale, honest empty states, error red confined to actual errors, stale-data timestamps.

## Install

**Claude Code (recommended):**

```bash
git clone https://github.com/succtorlin/fantastic-ui.git
cp -r fantastic-ui/skills/fantastic-ui ~/.claude/skills/
```

Or, if you use the `skills` CLI:

```bash
npx skills add succtorlin/fantastic-ui
```

Project-local install works too — copy into `<repo>/.claude/skills/` instead.

## Use

Once installed, Claude picks it up automatically when you ask for things like:

- *"Build a landing page for my API monitoring tool"*
- *"Redesign our homepage, it looks like a template"*
- *"Make this page feel premium"*
- *"Restyle the dashboard panels to match the landing page"*
- *"Apply the same style across all the app's pages and subpanels"*

Or invoke it explicitly: `/fantastic-ui`.

## What's inside

```
skills/fantastic-ui/
├── SKILL.md                        # the methodology + ship checklist
└── references/
    ├── css-architecture.md         # full token system, scoped CSS-module rules, shared primitives
    ├── canvas-hero.md              # annotated live-canvas hero, sparklines, scroll reveals —
    │                               #   with the complete lifecycle contract (DPR / visibility / reduced-motion / cleanup)
    ├── ai-atmosphere.md            # prompt recipe + pipeline for ≤30 KB AI atmosphere backgrounds
    └── product-surfaces.md         # retrofit procedure for app pages/panels/subpanels: audit → tokens →
                                    #   primitives → migration, panel anatomy, nesting depth, state design
```

The skill is framework-light: the worked code is React + CSS modules, but the disciplines (and most of the CSS) transfer directly to Vue, Svelte, or plain HTML.

## License

MIT — see [LICENSE](LICENSE).
