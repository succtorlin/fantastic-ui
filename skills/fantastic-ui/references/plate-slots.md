# Plate slots — the scrim and fit catalogue

A plate's visibility is decided by the **slot**, not the file. The same WebP
is visible under one scrim and gone under another. One shipped app measured
its header plates at **0.1–0.4%** of the strip visible: every text-contrast
check passed, and nobody could see the plates. Three things caused it: the
plate's base was a darker "recessed well" token, a full-width scrim ran from
94% to 35% across the whole strip, and the `contour`/`rings` hairlines sat
below 1.3:1 at strip size. Nothing measured visibility, and the author
claimed the plates "read correctly" after viewing the raw files.

This file names the slots that fixed it. Each one is a pair: a **scrim
profile** (a token gradient between the plate and the text) and a **fit**
(how the image sits in the box). The same names are used by
`gen_atmosphere.py plate --scrim/--fit`, `gen_atmosphere.py score`,
`batch` manifests, and `scripts/plate-check.js`. **The CSS below must keep
these numbers.** If you change a stop, score it with `--scrim-json` (below)
and record the profile you shipped.

The metrics and floors are defined in
[ai-atmosphere.md §7](ai-atmosphere.md#7-real-pixel-contrast-and-visibility-check).
In short: over the pixels the plate image covers inside the slot, after the
scrim, `ge_1_1` (% of pixels ≥1.1:1 against the page) must be **≥ 8** and
`ge_1_3` (% ≥1.3:1) **≥ 1**. Text uses the p90 composited background (p10 on a
light page) and needs 4.5:1, or 3:1 for large text.

## 1. Pick the slot

| Surface | Desktop slot | Phone slot (< 768 px) |
|---|---|---|
| Route or area header strip, title left, meta or actions right | `header-band` + `cover` | `phone-strip` + `strip` |
| Empty / first-run state, words left-aligned | `state-band` + `cover` | strip (as headers) or `display: none` |
| Empty / first-run state, words centred, tall box | `center-band` + `band` | strip (as headers) or `display: none` |
| Text runs edge to edge (marketing band, cover) | `full` + `cover`, scored first | `full` + `cover`, scored first |
| No text over the plate (divider, decorative strip) | `none` + `cover` | `none` + `cover` |

## 2. The profiles

All alphas are "page colour at N%", written
`color-mix(in oklab, var(--plate-ground) N%, transparent)`. A `transparent`
stop is alpha 0.

| Name | Direction | Stops (position → alpha) | Fit | Text region for the text gate |
|---|---|---|---|---|
| `header-band` | 90deg (x) | 0→.94, .40→.86, .58→0, .78→0, .90→.85, 1→.88 | `cover`, right center | x 0–0.50 and x 0.88–1.0 |
| `state-band` | 90deg | 0→.95, .50→.90, .66→0, .80→0, .92→.88, 1→.90 | `cover`, right center | x 0–0.60 |
| `center-band` | 90deg | 0→0, .08→0, .22→.90, .50→.94, .78→.90, .92→0, 1→0 | `band`: image at `100% auto`, centred vertically | x 0.22–0.78 |
| `phone-strip` | 180deg (y), px | 0px→0, (strip−16)px→0, strip px→.92, 100%→.92; strip = 64 px | `strip`: image width `max(100%, strip × aspect)`, height auto, anchored right top | y ≥ strip |
| `full` | 90deg | 0→.92, 1→.84 | `cover` | whole slot |
| `none` | — | alpha 0 | `cover` | whole slot |

Visibility under `band` counts only the rows the image covers. Under `strip`
it counts only y < strip.

## 3. The CSS

One host/layer pair. The host carries the text and the padding; the layer is
one empty `aria-hidden` element, its first child, painting the scrim over the
plate. `scripts/plate-check.js` finds this pair by default (`.plate-host` →
`:scope > .plate`, or `[data-plate-host]` → `[data-plate]`).

```html
<header class="plate-host plate-host--header">
  <div class="plate plate--header" aria-hidden="true"></div>
  <h1>Trades</h1> <p class="meta">…</p>
</header>
```

### Base

```css
:root { --plate-strip: 64px; }               /* phone strip height */

/* A route names its plate once. No var() fallback below: on a route without
   one, the background-image declaration is invalid at computed-value time and
   falls back to none, so the shared primitive paints nothing. */
.route-trades { --plate: url("/plates/trades.webp"); --plate-aspect: 5; } /* 1600x320 */

.plate-host {
  --plate-ground: var(--ground);              /* the surface the layer sits on */
  position: relative;
  isolation: isolate;
  border-radius: var(--radius);
}
.plate-host--raised { --plate-ground: var(--panel); }   /* a state on a raised panel */
.plate-host--header { padding: 16px 16px 12px; }
.plate-host--state  { padding: 24px 16px; }

.plate {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border-radius: inherit;        /* the layer rounds itself; the host keeps its overflow */
  background-repeat: no-repeat;
}
```

### `header-band`

Text column on the left, meta or actions on the right, the plate in the clear
band between 58% and 78%.

```css
.plate--header {
  background-image:
    linear-gradient(90deg,
      color-mix(in oklab, var(--plate-ground) 94%, transparent) 0%,
      color-mix(in oklab, var(--plate-ground) 86%, transparent) 40%,
      transparent 58%,
      transparent 78%,
      color-mix(in oklab, var(--plate-ground) 85%, transparent) 90%,
      color-mix(in oklab, var(--plate-ground) 88%, transparent) 100%),
    var(--plate);
  background-size: cover;
  background-position: right center;
}
```

```bash
python3 $GEN score --plate public/plates/trades.webp --page '#0a0907' \
  --slot 1170x90 --scrim header-band --fit cover --text '#84817e'
```

### `state-band`

A panel's empty or first-run state with left-aligned words. The text column is
wider than a header's (to 66%), so the clear band moves right.

```css
.plate--state {
  background-image:
    linear-gradient(90deg,
      color-mix(in oklab, var(--plate-ground) 95%, transparent) 0%,
      color-mix(in oklab, var(--plate-ground) 90%, transparent) 50%,
      transparent 66%,
      transparent 80%,
      color-mix(in oklab, var(--plate-ground) 88%, transparent) 92%,
      color-mix(in oklab, var(--plate-ground) 90%, transparent) 100%),
    var(--plate);
  background-size: cover;
  background-position: right center;
}
```

```bash
python3 $GEN score --plate public/plates/trades.webp --page '#0a0907' \
  --slot 900x160 --scrim state-band --fit cover --text '#84817e'   # the state's real box
```

### `center-band`

A shared empty state that centres its words in a tall box. The middle is
scrimmed and the edges show. The image is sized `100% auto` so it crosses the
box as a band at its own aspect instead of being magnified by `cover`.

```css
.plate--center {
  background-image:
    linear-gradient(90deg,
      transparent 0%,
      transparent 8%,
      color-mix(in oklab, var(--plate-ground) 90%, transparent) 22%,
      color-mix(in oklab, var(--plate-ground) 94%, transparent) 50%,
      color-mix(in oklab, var(--plate-ground) 90%, transparent) 78%,
      transparent 92%,
      transparent 100%),
    var(--plate);
  background-size: 100% 100%, 100% auto;
  background-position: center, center;
}
```

```bash
python3 $GEN score --plate public/plates/trades.webp --page '#0a0907' \
  --slot 900x420 --scrim center-band --fit band --text '#84817e'
```

### Phones: `phone-strip` for headers, strip or hide for states

Below 768 px the words span the full width, so a side band has nowhere to go.
Header hosts reserve a strip **above** the words: unscrimmed through the top
`--plate-strip`, fading over 16 px into the full scrim under the text.

States must not take the `full` scrim and stay "plated": measured on a real
app, state plates under `full` on phones were **0.0% visible** — an image
that downloads and shows nothing, which fails the visibility gate. Give a
phone state the same strip (scope it to state hosts the same way), or hide
its layer with `display: none` — the browser then fetches nothing, and
`plate-check.js` reports the host `{ skipped: "layer_hidden" }` rather than
failing it. An invisible image is worse than none.

```css
@media (max-width: 767px) {
  /* States: no plate on phones (or copy the header strip rule below to them). */
  .plate--state,
  .plate--center { display: none; }
  /* Header hosts only: the child selector keeps state plates on their own sizing. */
  .plate-host--header { padding-top: calc(var(--plate-strip) + 12px); }
  .plate-host--header > .plate {
    background-image:
      linear-gradient(180deg,
        transparent 0px,
        transparent calc(var(--plate-strip) - 16px),
        color-mix(in oklab, var(--plate-ground) 92%, transparent) var(--plate-strip),
        color-mix(in oklab, var(--plate-ground) 92%, transparent) 100%),
      var(--plate);
    background-size: 100% 100%, max(100%, calc(var(--plate-strip) * var(--plate-aspect, 5))) auto;
    background-position: 0 0, right top;
  }
}
```

```bash
python3 $GEN score --plate public/plates/trades.webp --page '#0a0907' \
  --slot 375x150 --scrim phone-strip --fit strip --strip 64 --text '#84817e'
```

`full` stays in the profile table for one case only: text that truly spans a
tall plate where no strip fits (a marketing band). Its CSS is the base layer
with `linear-gradient(90deg, color-mix(in oklab, var(--plate-ground) 92%,
transparent) 0%, color-mix(in oklab, var(--plate-ground) 84%, transparent)
100%), var(--plate)` and `background-size: cover`. Score it before using it — it usually fails
visibility (a page-based warp plate measured 0.03% / 0% under `full`).

### A custom profile

Any change to a stop is a new profile. Score it before it ships:

```bash
python3 $GEN score --plate public/plates/trades.webp --page '#0a0907' --slot 1170x90 --fit cover \
  --scrim-json '{"dir":"x","stops":[[0,0.94],[0.4,0.86],[0.6,0],[0.8,0],[0.9,0.85],[1,0.88]],"units":"frac"}'
```

`score` exits **0** on pass, **4** when a gate fails, **1** or **2** on an
error. Its JSON names the reasons.

## 4. Measured on one app

RRGPy, dark ground, 2026-10-11, measured in the browser on the composited
page. These are one app's numbers, quoted as a sanity range, not as targets.

| Slot | Plate | `ge_1_1` | `ge_1_3` |
|---|---|---|---|
| Header, old full-width scrim (94% → 35%) | token plates | 0.1–0.4% visible | — |
| `header-band`, desktop | token `warp` | 14–25% | 3–14% |
| `header-band`, desktop | AI raster | 19–31% | 8–17% |
| `phone-strip`, 375 and 320 px | header plates | 13–41% | 3.5–26% |
| `center-band`, tall empty state | route plate | 10.3% | 3.1% |

Text stayed above its gate in every row; with the phone strip, header text
started at 75 px and its worst ratio did not change.

## 5. Pitfalls

- **`cover` magnifies a strip in a tall state.** A 5:1 plate under `cover`
  in a tall empty state is scaled 2–3× and turns to blur. Use `center-band`
  (`100% auto`) for tall states, or render a plate at the state's own aspect.
- **Hairline styles need weight or height.** `contour` and `rings` are
  hairlines. In a strip under ~200 px they reach 1.1:1 on about 15% of the
  slot but 1.3:1 on under 1%. Render them with `--weight` (0.5–4) and let
  `plate --slot` gate the result, or give them slots 300 px and taller.
- **Scope the phone strip to header hosts with a child selector**
  (`.plate-host--header > .plate`). A descendant or bare `.plate` rule also
  restyles every state plate inside the header's route.
- **The page is the base.** Score against the colour the layer actually sits
  on (`--plate-ground`). A state on a raised panel is scored with
  `--page` = that panel's colour, and its plate is rendered from a palette
  whose first ground is that colour. Reusing the page-based route plate
  inside a raised panel is a measured failure: `plate-check.js` scored such
  a state 5.0% / 2.4% against its panel, below the 8% floor, while the same
  plate's header passed at 14.3% / 3.0%. The inverse holds for a recessed
  panel darker than the page: scrim and measure it in the recessed colour
  (a `--recessed` host modifier setting `--plate-ground`); a page-based plate
  measured 15.0–15.1% there.
- **One layer, first child.** `plate-check.js` measures the first `url()`
  layer of the host's `:scope > .plate` child, and treats gradients listed
  above it as the scrim. A pseudo-element plate, or a scrim listed below the
  image, is not measured.
- **Fit the bands to the layout.** The stops follow where the copy and the
  actions end at desktop width. When the layout moves, re-measure; when you
  move a stop, it is a custom profile.
- **`--page` comes from the rendered page.** `page_mismatch` only fires when
  `--page` differs from the palette's first ground. Read the page colour from
  the browser and pass it (or set `page` in the manifest); taking it from
  tokens.json trusts the same map that may have put the darker well first.
- **`center-band` clears only the outer edges.** It leaves about the outer
  15% of each side unscrimmed, so the plate's detail must sit there: a warp
  plate with `--focus 0.70` scored about 0% in a tall centred state; `--focus
  0.12` with `--seeds 1-8 --pick best` reached 10.2% / 2.9%.
- **The offline text gate assumes the text regions.** `score` gates text in
  the profile's fixed regions (`header-band`: x 0–0.50 and 0.88–1.0). Right-
  aligned meta wider than ~12% of the strip reaches into the clear band:
  offline passed at 5.13:1 while `plate-check.js` measured 4.09:1 on the
  page. Pull the right-hand dense stop in (e.g. 85% from 0.76) and treat
  `plate-check.js` as the authority for text; `score` is the pre-screen.
- **`band` and `strip` are aspect-sensitive.** Set `--plate-aspect` to the
  rendered plate's width ÷ height (5 for 1600x320). A wrong aspect leaves a
  gap at the strip's left edge or crops the motif.
