# Data charts — choosing, building and colouring charts in product

Charts where the data is the content: dashboards, panels, report pages. This
file decides which chart answers the question, how accessible that chart type
is before any work, how bars and tooltips are built without a chart library,
and the one extra palette fantastic-ui allows. Live-proof and canvas lifecycle
rules come from [canvas-hero.md](canvas-hero.md); in-product rules from
[product-surfaces.md](product-surfaces.md).

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## Pick the chart by the question

Choose by what the reader needs to learn, never by what looks striking.

| Question | Chart | Reach past it when |
|---|---|---|
| Which is bigger? (comparison) | bar | more than ~12 categories: sorted horizontal bar or a table |
| How did it change? (time) | line | fewer than 4 points: a stat with a delta; more than 6 series: small multiples |
| What share of the whole? (few parts) | stacked bar (100%) | never a pie as the primary view |
| How is it spread? (distribution) | histogram, box plot | fewer than ~20 points per group: show the points |
| Do these move together? (relationship) | scatter | variables are categorical: grouped bar |
| What ranks first? (ranking) | sorted bar | the ranking is the only content: a numbered list |
| One number against a target | stat with bullet bar | there is no target: the stat alone |

**Render by volume.** SVG below about 1,000 marks, where every mark is a
reachable DOM node; canvas above it, following the DPR, resize and
`visibilitychange` rules in [canvas-hero.md](canvas-hero.md). Past about 10,000
points, aggregate (bin, downsample, hexbin) before drawing anything.

**Real data only, in product** (the sparkline rule in
[canvas-hero.md](canvas-hero.md#card-sparklines) applies to every chart). No div-based fake charts with fixed widths standing in for
data that does not exist.

## Accessibility grades

A grade for the chart **type**, before any work. Contrast still meets the
[wcag-audit.md](wcag-audit.md) floors separately (chart strokes 3:1 against
their ground).

| Grade | Meaning | Examples |
|---|---|---|
| **Robust** | readable once labelled | bar, line, box plot, bullet, funnel with % per stage |
| **Conditional** | needs one specific mitigation | scatter (shape per group), heat map (value on focus plus a table), multi-series line (dash per series), streaming line (pause control) |
| **Fragile** | structurally hard | pie, donut, treemap, sankey, sunburst, word cloud |
| **Never primary** | cannot be the only view | network graph, 3D anything |

- **Fragile and Never-primary charts ship a data table** alongside, as a
  `<table>` in a `<details>` or a view toggle. The table is the primary view
  for assistive technology, not an afterthought.
- **Never colour alone.** Every series, status or legend distinction gets a
  second channel: shape, dash pattern, or a direct label. This holds for
  colour-safe palettes too.
- A **static** chart gets `role="img"` and an accessible name that states the
  takeaway ("Revenue up 12% since June"), or the SVG is `aria-hidden` and a
  `.srOnly` sentence carries the meaning. An **interactive** chart (focusable
  marks, tooltips) must not use `role="img"`: it makes every child
  presentational and hides the focusable marks from assistive tech. Use a
  `<figure>` (or `role="group"`) with `aria-label` for the takeaway, and give
  each focusable mark its own accessible name ("June, 41,200").

## Building charts without a library

fantastic-ui uses no chart or animation libraries: SVG, canvas 2D, CSS, WAAPI
and `requestAnimationFrame` cover every common chart.

**Bars carry their value in their height.**

- **Height is `value / max` from a zero baseline**, computed before any
  animation. `max` is a round number at or above the largest value. Never
  `(value − min) / (max − min)`: a bar's length encodes the number, so its
  baseline is zero. That min-subtracting mapping belongs to lines and scatter
  only.
- **At most about 12 columns, each labelled** on the axis. More, or bars
  thinner than their gaps, means a line or a sorted horizontal bar.
- **A broken baseline is a ship blocker**: every bar the same height, bars all
  touching the top, bars that do not start at zero, or a missing axis label.
  Each traces to the value never reaching the geometry.
- **Trends over time use a line**, not bars.
- Value labels are visible by default where space allows; hover-only values
  downgrade a bar chart from Robust.

```js
const max = niceCeil(Math.max(...values));          // e.g. 1,500
bars.forEach((el, i) => {
  el.style.blockSize = `${(values[i] / max) * 100}%`; // zero baseline
  el.dataset.value = fmt(values[i]);
});
```

**Tooltips** are positioned relative to the chart's own container, never the
viewport:

```js
const r = mark.getBoundingClientRect(), c = chart.getBoundingClientRect();
tip.style.left = `${r.left - c.left}px`;
tip.style.top = `${r.top - c.top}px`;
```

Viewport coordinates misplace the tooltip as soon as the chart is not at the
page origin. Every mark that has a tooltip is **reachable by keyboard**
(`tabindex="0"` or arrow keys across a roving focus), and the tooltip opens on
focus too. **A tooltip is never the only place a value lives**: the same
number is in a label, the table, or the accessible name.

**Motion.** Every entrance animation is paired with its reduced-motion end
state in the same block, and the authored state is the final one (content
survives with motion stripped).

| Motion | Animated | Reduced-motion end state |
|---|---|---|
| line draw-in | `stroke-dashoffset` from length to 0 | `stroke-dashoffset: 0` |
| bar grow | `scale` on the Y axis from 0 to 1, with `transform-origin: bottom` (SVG: also `transform-box: fill-box`) | final scale set directly |
| ring grow | dash offset from full to `C × (1 − pct)` | final offset set directly |
| counter | value tweened, formatted per frame | final text written once |

```js
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
// CSS: .bar { transform-origin: bottom; transform-box: fill-box; } or bars grow from the middle
if (!RM) bars.forEach((el, i) =>
  el.animate([{ scale: "1 0" }, { scale: "1 1" }],
    { duration: 600, delay: i * 40, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" }));
```

**User-driven updates are instant.** Sliders, filters and range pickers set
the new geometry directly on `input`; no tween on every drag frame. The
entrance animation is for first paint only. Streaming charts get a visible
pause control and freeze to their last frame under reduced motion.

## Chart colour

fantastic-ui allows exactly one palette beyond the single accent, and it lives
**only inside charts**. It never appears on a button, a badge or a section.

- **Categorical series** rotate from the accent's hue at **constant
  lightness and chroma**, so no series reads as more important than another.
  Reason in OKLCH; define them once as tokens. One series uses the accent
  itself; at most six series, else small multiples.

```css
:root {
  --series-1: var(--accent);
  --series-2: oklch(from var(--accent) l c calc(h + 60));
  --series-3: oklch(from var(--accent) l c calc(h + 120));
  --series-4: oklch(from var(--accent) l c calc(h + 180));
  --series-5: oklch(from var(--accent) l c calc(h + 240));
}
```

  Check each generated series against the semantic colours: skip any rotation
  step that lands near `--up` or `--down` in hue.
- **Sequential scales** (heat maps, intensity) are one hue in five to seven
  lightness steps, built with `color-mix(in oklab, var(--accent) N%,
  var(--ground-1))`.
- **Diverging scales run `--down` … neutral … `--up`** and never use the accent.
  A diverging scale means something; the accent means "what matters".
- **`--up` and `--down` are never categorical series colours.** If green means
  "growth" in a KPI chip and "Region B" in the bar beside it, the page is
  lying.
- **Accent and semantic collision.** A green accent fights `--up`; a red,
  brick or coral accent fights `--down`. The measure (≥40° OKLCH hue), the
  presets that share a hue on purpose, and the non-colour channel that is
  required either way are in
  [wcag-audit.md](wcag-audit.md#the-accent-must-not-impersonate-a-semantic).
  In a chart that means every delta carries its sign or arrow, never colour alone.
- **Numbers are mono with `tabular-nums`**, right-aligned in tables and axis
  labels.
- **Data ink over chrome.** Gridlines are hairlines from the ground scale
  (`--hair`), horizontal only unless the vertical axis is read precisely.
  **Direct labels at line ends beat a legend**; use a legend only when labels
  would collide. No chart borders, no drop shadows, no 3D.

## Gate

- [ ] Each chart's type is justified by a row of the question table, written
      next to it in the PR or ledger.
- [ ] No hardcoded data arrays in product charts or sparklines (grep the
      component for numeric array literals; marketing pages excepted).
- [ ] Mark count per chart below ~1,000 for SVG, or the chart is canvas with
      the [canvas-hero.md](canvas-hero.md) lifecycle (count nodes in devtools).
- [ ] Every Fragile or Never-primary chart has a data `<table>` in the DOM
      (`querySelector("table")` inside the panel).
- [ ] Greyscale screenshot: every series, status and legend item is still
      distinguishable.
- [ ] Bars: computed height ratio of two bars equals their value ratio within
      1px (browser measurement); baseline at zero; ≤12 columns, each labelled.
- [ ] Tooltips: with the chart scrolled away from the page origin, the tooltip
      sits on its mark; every mark is reachable by Tab or arrows and opens the
      tooltip on focus.
- [ ] Reduced motion on: every chart renders in its final state on first
      paint (screenshot with emulation on).
- [ ] Dragging a slider triggers no animation (`document.getAnimations()`
      stays empty during input).
- [ ] Series colours are tokens; `--up`, `--down` and `--warn` appear only in
      diverging scales and semantic marks (grep chart code for them).
- [ ] Accent against `--up` and `--down`: OKLCH hue distance ≥40° recorded
      beside the contrast matrix, or the preset's shared hue noted; either way
      every delta and status in the chart carries a sign, arrow or word
      (greyscale screenshot: still readable).
- [ ] Chart strokes measure ≥3:1 against their ground; axis and label text
      ≥4.5:1; axe clean on the panel in loaded, empty and failed states.
