# Imagery — token-driven plates, texture and AI atmosphere

Imagery is part of the system, not an extra. Every page gets an **imagery
decision**, stated as the imagery clause of **the brief line** (SKILL.md
Step 0). By default the image is a **plate**,
rendered from the page's own tokens. It is the ground scale with texture, in
the same way that a hairline is the ground scale with an edge. A plate is never
stock and never clip-art, and it never sits behind data ([the plate
rule](#the-plate-rule)). Its only job is atmosphere and texture behind real
content. It carries no information.

The generator is `scripts/gen_atmosphere.py` in this skill (Python 3.9,
numpy + Pillow). Below, `$GEN` stands for its installed path, for example
`~/.claude/skills/fantastic-ui/scripts/gen_atmosphere.py` (or the Codex
equivalent under `~/.codex/skills/`).

## 1. Decision rule — when, where, how many

| Surface | Slots | Max rasters |
|---|---|---|
| Marketing page | atmosphere band · hero backdrop (behind the copy column, never behind the live canvas) · section dividers | 3 |
| App route | route header strip **or** one state surface: empty, first-run, onboarding, auth, paywall, 404, report cover | 1 plate per route |
| Preset | the preset's own photo slots (its **Imagery** line in [theme-presets.md](theme-presets.md)) | the preset's slot count |
| Document / deck | cover, section dividers | one per divider |

### The plate rule

This is the canonical statement. SKILL.md and
[product-surfaces.md](product-surfaces.md) summarise it in one line and link
here.

1. **Decoration only, but visible.** A plate is static, `aria-hidden`,
   ≤30 KB, and removing it loses no information. It must also be *seen*: a
   plate that clears the text gate but not the visibility gate (§7) is dead
   weight, not a safe result.
2. **Never behind data.** Data panels, tables and charts are never over a
   plate, in a product or on a marketing page. No plate goes inside a data
   panel body.
3. **One carve-out: big-type marketing stats.** On a marketing surface, such
   as the atmosphere band or a hero stat row, large display numerals that
   state a claim ("5,000+ tickers") may sit over a plate. They need the token
   scrim (§6), and the real-pixel gate (§7) must pass for every element over
   the plate: 3:1 for the numerals and 4.5:1 for their captions. A stat that
   updates, sorts or compares is data, so rule 2 applies to it.
4. **In the product,** each route gets at most one plate *file*, in the route
   header strip or on a state surface (empty, first-run, onboarding, auth,
   paywall, 404, report cover). A dense data route can keep its one plate in
   the header strip, or it can skip imagery with a stated reason.
5. **Panels and subpanels inherit it in their empty and first-run states.**
   Such a state holds no data, so every one of them — at every nesting
   level — carries the route's plate (the same file: no second download, still
   one plate per route), or `svg` texture on a route without a plate. It
   leaves with the state when the first row renders. Only true empty and
   first-run states: a filtered-to-nothing, failed, loading, stale or alarm
   state stays plain. A populated panel or subpanel never carries imagery.
   The mechanism is [the recipe below](#recipe-hand-the-plate-down).

- **"None" is a decision, not a default.** It is valid only with its reason in
  the brief line. For example: "Imagery: none — single dense table route, a
  plate would sit behind numbers." "No API key" is not a reason, because
  `plate` needs no key.
- **Retrofits and existing token systems:** no preset applies, but the
  recovered brief line still ends with an imagery clause: a slot per route, or
  `none: <reason>`. A plate is a new asset, not a new token, and it introduces
  no colour that the token file lacks.

### Recipe: hand the plate down

Build it once, in the shared empty-state primitive, so every panel and
subpanel inherits it — including ones written later. Never hand-place a plate
in one panel.

**Which states.** Empty and first-run only. A *filtered* state is an answer
to the user's own filter and carries its reset action; a *failed* state
belongs to semantic red; *loading* is a skeleton; *stale* is a warning; an
*alarm* empty (an accent rule, "the office is off") must not compete with its
own signal. All of those stay plain.

**A — CSS only (any framework; the default).** The route root names its plate
once as a custom property; the shared empty-state class paints it from a
pseudo-element, which is outside the accessibility tree by construction.
Outside a route the variable is unset and nothing is drawn.

```css
.route-today { --route-plate: url("/plates/today.webp"); }   /* one per route */

.state-empty { position: relative; isolation: isolate; overflow: hidden;
  padding: var(--sp-5) var(--sp-4); border-radius: var(--radius); }
.state-empty::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  /* Heavier than a header scrim: the state's sentence can sit anywhere. */
  background-image:
    linear-gradient(90deg,
      color-mix(in oklab, var(--ground) 95%, transparent) 0%,
      color-mix(in oklab, var(--ground) 86%, transparent) 50%,
      color-mix(in oklab, var(--ground) 50%, transparent) 100%),
    var(--route-plate, none);
  background-size: cover; background-position: right center;
}
@media (max-width: 767px) {   /* the sentence runs the full width */
  .state-empty::before { background-image:
    linear-gradient(90deg,
      color-mix(in oklab, var(--ground) 94%, transparent),
      color-mix(in oklab, var(--ground) 88%, transparent)),
    var(--route-plate, none); }
}
```

On a route without a plate, put an `svg --format css` texture token in
`--route-plate` instead (§8).

**B — component context (when the empty state is a component that renders
its own layer).** Each route wraps its content in a provider naming its
plate; the shared empty-state component reads it and draws
`<div aria-hidden="true" class="plate plate--state" style="--plate: url(…)">`
only for a true empty, non-alarm state. A route that stays mounted while
hidden (`display: none`) downloads nothing.

**Gate.** Measure text over every inherited plate on real pixels (§7), at
desktop and phone widths, per distinct empty state — not once per route — and
measure the plate's visibility in the same pass. The state scrim above is
heavier than a header's; if the plate fails visibility under it, lower the
100% stop before anything else.
Worked example: RRGPy's `/agents` desk (`DeskPlateProvider` → `StateBlock`'s
empty branch) — 75+ empty states across seven routes inherit their route's
plate; the faintest text over one measured ~7.9:1.

## 2. Order of tools

1. **`plate`** — the default. It is local, keyless and deterministic, and it
   uses only palette colours. Use it for atmosphere bands, header strips, state
   surfaces and covers. It measures itself against the page ground and exits
   **4** (`{"error":"too_faint"}`, nothing written) when fewer than 8% of its
   pixels reach 1.1:1 or fewer than 1% reach 1.3:1 (`--min-visible 8,1`;
   `--allow-faint` skips the gate but still reports the measure).

   **Product route headers: render two candidates when an image key exists.**
   Render an `ai` candidate (prompt recipe in §11, `--page` set to the page
   ground) and a `plate` candidate for the same slot. Place each under the
   masked scrim, score both on the text gate and the visibility gate (§7), and
   ship the better one. Record the winner's prompt in the ledger (`ai` does
   this itself). With no key, `ai` exits 3; ship the `plate`. Measured on one
   dark app's headers, `ai` reached 24–31% ≥1.1:1 and 9–19% ≥1.3:1, against
   16–18% and 3–4% for the best `warp` plate, with grey text still ≥4.5:1.
2. **`svg`** — zero-byte texture (grain, grid, rings) as an inline
   `<svg aria-hidden="true">` (HTML or JSX) with `currentColor` strokes. Use
   it for small slots, as a second texture on a page that already ships a
   raster, or when the slot sits under type-dense copy.
3. **`ai`** — for photographic or material looks that a preset slot needs
   (daylight interiors, timber, stone, fabric close-ups), and as the second
   candidate for a product route header (above). It wraps the installed
   `baoyu-image-gen` skill and appends "no text/logos/people/UI". It reports
   visibility against `--page '#hex'` but does not gate; you do, in §7.
   **Exit 3 with `{"error":"ai_unavailable"}` means fall back to `plate`.**
4. **`compress`** — for images the user supplies, such as their photo library
   or product shots. It brings them to ≤30 KB WebP at the slot's size, and
   reports visibility against `--page` like `ai`.

There is always an image or a stated reason. Never substitute stock photos,
icon libraries or illustration packs.

Plate styles, matched to character:

| `--style` | Reads as | Reach for it on |
|---|---|---|
| `warp` | light raking across silk folds of the ground scale — lit folds, not an aura or a glow | atmosphere bands, hero backdrops, warm or editorial presets |
| `grain` | fine palette noise, paper or film | empty and auth states, print-leaning presets |
| `contour` | topographic linework | technical and engineering directions, report covers |
| `rings` | concentric instrument face | tall header bands of instrument products, covers |

**Strips under ~200 px tall use `warp` or `ai`.** `contour` and `rings` are
hairlines (0.75–0.85 px). Scaled into a short strip they reach 1.1:1 on about
15% of the slot but 1.3:1 on under 1%, so they fail the visibility gate; give
them slots of 300 px and more. Every style concentrates its energy within a
height or two of `--focus`, so a very wide strip (beyond ~6:1) is mostly calm
ground: render it at ≤4:1 and let `background-size: cover` crop it, or use
`ai`.

## 3. What imagery may show

**Allowed:** atmosphere, texture, abstract editorial plates, material
close-ups, and mood photography with no identifiable people or brands.

**Still banned:** UI, text or glyph-like marks, fake screenshots, fake data,
real or identifiable people, logos, and charts pretending to be data.
Discipline 3 still holds: the hero proof is the product running, never a
picture of it.

These bans govern **generated** imagery (`plate`, `svg`, `ai`). Photos the
user supplies through `compress` are their content: their own team, products
or aircraft may appear, with real alt text wherever the photo carries meaning.
A generated person or a generated product is never acceptable, because it is
fake data.

**A plate is not clip-art.** Clip-art is an outside image imported to add
charm. A plate is computed from the page's own tokens. The bans on
"illustration clip-art" in [product-surfaces.md](product-surfaces.md) and
[ui-mechanics.md](ui-mechanics.md) still apply to clip-art. They do not apply
to plates.

**Semantic colours never appear in a plate.** Up and down, pass and fail
carry meaning, and a plate carries none (discipline 1). The plate palette is
ground, ground2, ground3, accent and accentHi, and nothing else.

## 4. The procedure

```bash
# 1. Extract tokens. This resolves var() chains and converts hex/rgb/hsl/oklch to sRGB.
#    `ground` is the PAGE background - the surface the plate sits on - never a darker well.
python3 $GEN tokens --css app/globals.css --selector ':root' \
  --map ground=--ground,ground2=--ground-2,ground3=--panel,accent=--accent,accentHi=--accent-hi \
  --out design/imagery/tokens.json

# 2. Render with a seed. It is deterministic, it never writes a file over --max-kb,
#    and it never writes one too faint to see (exit 4, see §2).
python3 $GEN plate --tokens design/imagery/tokens.json --style warp --seed 7 \
  --size 1200x240 --intensity 0.9 --focus 0.8,0.5 --max-kb 30 \
  --out public/img/plate-header.webp --ledger design/imagery/ledger.jsonl
```

1. **Extract tokens** from the file that owns them. `--map` is positional.
   **The first ground is the surface the plate sits on** — usually the page
   background, keyed `ground` — **never a darker well, inset or recessed
   token.** Then list the lighter grounds (raised, panel, hairline), then the
   accent, with the accent highlight last. On a light page the order flips:
   the cream page first, then darker grounds. Why: the first ground is the
   plate's base, so every pixel the plate does not decorate *is* that colour.
   Base it on a well darker than the page and most of the plate lands below
   the page — invisible on a dark theme (one shipped app measured 80–84% of
   each plate darker than its page and 0.1–0.4% perceptible). The generator
   refuses a palette whose other grounds sit on the wrong side of the first.
   Map the roles to the project's actual names, such as `--sodium` and
   `--sodium-hi` for the worked example, or `--ground-0`… for an app shell.
2. **Render** at the slot's displayed CSS size. Low-frequency plates do not
   need 2× pixels. Place `--focus` (x,y as fractions) **away from** the copy,
   so the energy sits where the text does not. **Header strips and state
   slots use `--intensity` 0.8–1.0** with the masked scrim (§6): the scrim,
   not a timid plate, protects the text column. Low intensity (0.2–0.4) is
   only for a plate that text runs across from edge to edge.
3. **View the result.** Read the WebP; if your viewer cannot open WebP, look at
   a PNG preview and never ship the preview. Reject the plate and re-roll the
   seed or move `--focus` when it shows:
   - text-like marks or letterform-ish shapes;
   - hues outside the palette (rainbow fringes);
   - busy high-frequency texture where text will sit;
   - a centred glow, aura, blob or mesh-gradient look. This is the banned
     gradient-blob hero (SKILL.md, core idea) arriving as a raster;
   - for `ai`, anything resembling a face, a logo, UI or a chart.

   `warp` is light raking across folds, not an aura. Its energy sits at
   `--focus`, away from the copy, and the text areas stay calm. A plate whose
   brightest region is a soft centred bloom has failed, even when its colours
   pass. Never fix a bad plate in CSS.
4. **Place it** per the markup contract (§5).
5. **Measure on real pixels, both ways** (§7), in every theme and at 320 px
   and 1440 px, because `cover` crops differently at each width: text over
   the plate keeps its contrast, and the plate stays visible after the scrim.
6. **Commit** the generator command, the tokens snapshot (`tokens.json`), the
   ledger and the shipped WebP. **Every asset gets a ledger line**: `plate`,
   `ai`, `compress` and `svg` all take `--ledger` (only `tokens` does not).
   `compress` records the source filename and both hashes. `svg` records its
   style, seed, colour, format and the sha256 of the emitted markup.
   **Never commit a source PNG.** It is a build intermediate, and the ledger
   line is the provenance record. When the tokens change, re-run the ledger's
   commands and the plates re-derive. The same seed gives byte-identical
   output **per environment**. Other libwebp, Pillow or numpy versions can
   encode differently. Then the ledger's sha256 no longer matches, which makes
   the drift visible instead of silent.

## 5. Markup contract

A plate is a **decorative layer**. Removing it must lose no information.

```tsx
<header className={s.routeHead}>
  <div className={s.plate} aria-hidden="true" />
  <div className={s.headInner}>…eyebrow, title, actions…</div>
</header>
```

```css
.routeHead { position: relative; isolation: isolate; min-height: 168px; }
.plate {
  position: absolute; inset: 0; z-index: -1;
  background:
    var(--scrim-head),                        /* §6: masked to the text column */
    url(/img/plate-header.webp) center / cover no-repeat;
}
```

Or, as an element:

```html
<img class="plate" src="/img/plate-empty.webp" alt="" aria-hidden="true"
     width="640" height="360" decoding="async" loading="lazy">
```

- **Fixed-size box.** The slot has its size before the image loads (explicit
  `width`/`height`, `aspect-ratio`, or a `min-height` container), so there is
  no layout shift.
- **Static.** No parallax, no `background-attachment: fixed`, no animation and
  no filter transitions. Because nothing moves, reduced motion is satisfied by
  construction, and there is nothing to gate.
- **Loading.** Use `loading="lazy"` below the fold. Use
  `fetchpriority="high"` only for an above-the-fold hero plate. A CSS
  background behind the fold needs neither.
- **Accessibility.** `aria-hidden="true"` and `alt=""`. A plate never needs an
  `srOnly` equivalent, because it says nothing.

## 6. The token scrim

A scrim is a token-mixed gradient between the plate and the text. **It
covers the text column only.** Text sits on the left of a header; a scrim
that runs the full width erases the plate everywhere else. On one shipped
app, a page-based `warp` plate measured 0.4% perceptible under a full-width
scrim and 16–19% under the same scrim masked to the text column.

The banded header profile:

```css
:root {
  --scrim-head: linear-gradient(90deg,
    color-mix(in oklab, var(--ground) 94%, transparent) 0%,    /* under the title */
    color-mix(in oklab, var(--ground) 86%, transparent) 40%,   /* end of the copy */
    transparent 58%,                                           /* the plate shows */
    transparent 82%,
    color-mix(in oklab, var(--ground) 75%, transparent) 100%); /* under the actions */
  --scrim-full: linear-gradient(90deg,
    color-mix(in oklab, var(--ground) 94%, transparent),
    color-mix(in oklab, var(--ground) 80%, transparent),
    color-mix(in oklab, var(--ground) 35%, transparent));
}
@media (max-width: 767px) { :root { --scrim-head: var(--scrim-full); } }
```

- **Fit the bands to the layout.** The stops follow where the copy and the
  actions end at desktop width; move them with the layout, then re-measure.
  The right-hand band exists only when actions sit there.
- **Keep the full-width profile** (`--scrim-full`) for phones, where the
  title runs the full width, and for any slot whose text spans it.
- **No `rgba(`, no CSS `opacity`.** The scrim is `color-mix()` over the
  ground token, so it needs no hex literal outside the token file, and the
  hex/rgb greps, the opacity rule in [wcag-audit.md](wcag-audit.md) and
  project guards that ban `rgba(` or `opacity: 0.x` all pass.
- **Tune brightness at generation time** with `--intensity` and `--focus`.
  Never tune it with CSS opacity on the plate or the text.
- **Move a stop only as far as both gates in §7 allow.** Raising a mix to
  rescue text makes the plate fainter; the visibility gate catches it.
- **Light grounds** use the same formula with their own `--ground`.

## 7. Real-pixel contrast and visibility check

A plate can fail in two directions, and both are failures:

- **Text gate** — text over the plate is unreadable. Gate on the 10th
  percentile: 4.5:1 for body text, 3:1 for large text.
- **Visibility gate** — the plate is invisible. After the scrim, at least
  **8% of the slot's pixels must be ≥1.1:1** against the page ground, and at
  least **1% must be ≥1.3:1**. A plate that fails visibility is as much a
  failure as one that fails text contrast; it costs bytes and says nothing.

`plate` applies the visibility gate to the bare plate before writing it.
That is necessary, not sufficient: the scrim only removes visibility, so
measure again in the page. A text-over-ground contrast checker composites the
gradient and ignores the `url()` layer, so it cannot see the plate. To
measure what the reader actually gets:

1. Hide the text paint.
2. Take a screenshot.
3. Sample the pixels inside each glyph box.
4. Compute WCAG contrast against the text colour.

The technique is borrowed from HyperFrames' `contrast-report.mjs` in
`hyperframes-creative/scripts/` (if installed; the snippet below stands
alone), which samples the composited background inside each element's own
box once its glyphs are hidden. Playwright:

```js
const SLOT = ".routeHead";                              // the plate's slot
const SEL = `${SLOT} :is(h1,h2,p,span,a,button)`;      // text that sits over the plate
await page.locator(SLOT).scrollIntoViewIfNeeded();
// 1. Record each element's ink BEFORE hiding it; afterwards it reads as transparent.
const inks = await page.$$eval(SEL, els => els.map(el => getComputedStyle(el).color));
// 2. Hide the glyph paint (layout-neutral) and capture the real composited pixels.
await page.addStyleTag({ content: `${SEL}{color:transparent!important;
  -webkit-text-fill-color:transparent!important;text-shadow:none!important}` });
const shot = (await page.screenshot()).toString("base64");
// 3. Sample each element's own box and score every sampled pixel against its ink.
const report = await page.evaluate(async ({ shot, sel, slot, inks }) => {
  const img = new Image(); img.src = "data:image/png;base64," + shot; await img.decode();
  const x = new OffscreenCanvas(img.width, img.height).getContext("2d"); x.drawImage(img, 0, 0);
  const k = img.width / innerWidth;                                   // device pixel ratio
  const p = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  const rgb = (c) => { p.clearRect(0, 0, 1, 1); p.fillStyle = c; p.fillRect(0, 0, 1, 1);
    return [...p.getImageData(0, 0, 1, 1).data].slice(0, 3); };     // any colour syntax
  const lum = (c) => { const s = c.map(v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * s[0] + .7152 * s[1] + .0722 * s[2]; };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((m, n) => n - m); return (h + .05) / (l + .05); };
  const text = [...document.querySelectorAll(sel)].map((el, i) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return null;
    const d = x.getImageData(r.x * k, r.y * k, r.width * k, r.height * k).data;
    const ink = rgb(inks[i]), rs = [];
    for (let j = 0; j < d.length; j += 4 * 7) rs.push(ratio(ink, [d[j], d[j + 1], d[j + 2]]));
    rs.sort((m, n) => m - n);
    return { el: el.tagName, text: el.textContent.trim().slice(0, 24), p10: +rs[Math.floor(rs.length * .1)].toFixed(2) };
  }).filter(Boolean);
  // 4. Visibility: the whole slot, after the scrim, against the page ground.
  const root = getComputedStyle(document.documentElement);
  const ground = rgb(root.getPropertyValue("--ground").trim() || getComputedStyle(document.body).backgroundColor);
  const s = document.querySelector(slot).getBoundingClientRect();
  const v = x.getImageData(s.x * k, s.y * k, s.width * k, s.height * k).data;
  let n = 0, a = 0, b = 0;
  for (let j = 0; j < v.length; j += 4 * 3) {
    const q = ratio(ground, [v[j], v[j + 1], v[j + 2]]); n++; a += q >= 1.1; b += q >= 1.3; }
  const visible = { ge_1_1: +(100 * a / n).toFixed(1), ge_1_3: +(100 * b / n).toFixed(1) };
  return { text, visible, pass: visible.ge_1_1 >= 8 && visible.ge_1_3 >= 1 };
}, { shot, sel: SEL, slot: SLOT, inks });
```

- **Record the ink before hiding it** (step 1). Once the text is hidden, its
  computed colour reads as transparent. Only elements in the viewport are
  measured, so scroll each plate slot into view and repeat.
- **Gate on the 10th-percentile ratio, not the median.** A plate is not
  uniform, and the median hides the one bright patch under one word. Use
  4.5:1 for body text and 3:1 for large text.
- **Visibility is measured on the slot with the text hidden.** Controls with
  their own fill (a filled button, a badge) count as visible pixels; when
  they are large, sample the slot minus their boxes.
- **When the text gate fails,** move `--focus` away from the copy, or widen
  or deepen the scrim's text band. Never lighten the text past its token.
- **When the visibility gate fails,** in this order: base the plate on the
  page ground (§4 step 1); raise `--intensity` toward 1.0; mask the scrim to
  the text column (§6); switch from `contour`/`rings` to `warp`, or render
  the `ai` candidate (§2).
- Record both results with the slot in the ledger or the polish table.

## 8. SVG texture

```bash
# React / TSX
python3 $GEN svg --style grain --color 'var(--accent)' --opacity 0.05 --seed 7 --format jsx \
  --ledger design/imagery/ledger.jsonl
# plain HTML
python3 $GEN svg --style grain --color 'var(--accent)' --opacity 0.05 --seed 7 --format inline
python3 $GEN svg --style grid --color '#26231d' --opacity 0.5 --format css   # literal colour only
```

`svg` produces zero raster bytes. Its output uses `currentColor` and its
faintness is an SVG `opacity` attribute, not CSS. With `--opacity 1` the
attribute is left out entirely.

- **Pick the format for the file.** Use `--format jsx` for React/TSX. It
  emits camelCase attributes (`strokeWidth`, `floodColor`, `vectorEffect`)
  and `style={{ color: "…" }}`, because React throws on a string `style`.
  Use `--format inline` for plain HTML. Both print an
  `<svg aria-hidden="true">` that keeps `var()`, so the texture follows the
  theme.
- **Grain is a fixed 256 px tile.** Inline and JSX repeat it with a
  `userSpaceOnUse` pattern, so the grain never stretches with its box. With
  `--format css`, apply the printed `backgroundSize` (`256px 256px`) and
  `backgroundRepeat` (`repeat`) next to the `url()`.
- **`--format css` only takes a literal colour.** A data-URI cannot read CSS
  variables, and the script refuses `var(`. Take the hex from `tokens.json`,
  and put the resulting `url("data:…")` **in the token file** as its own token,
  for example `--texture-grid`. The literal then stays where literals live, and
  it follows a theme only if you define one token per theme.
- **Opacity guards.** If a project guard bans any `opacity=`, even inside
  SVG, pass a pre-mixed colour with `--opacity 1`, which emits no opacity
  attribute: `--color 'color-mix(in oklab, var(--accent) 6%, transparent)'`
  (inline or jsx; a data-URI cannot read `var()`).
- **Placement.** Grid and grain are texture, so the
  never-under-body-copy rule for watermarks applies to them too.

## 9. What not to import from video skills

Video tooling (HyperFrames, Remotion, media-use; each only if installed) is
good at rendering images and wrong about pages. Do not import:

- **Ambient animated decoratives.** HyperFrames' house style holds that
  "static decoratives feel dead". On a page, that contradicts reduced motion
  and zero libraries. Here a decorative layer is static, and every moving
  pixel encodes data.
- **Webfont frame presets.** The page uses system stacks only.
- **Multi-hue or two-ink palettes.** The plate palette is the token palette.
- **Stock or icon lookups**, and runtime players of any kind.

## 10. Optional build-time generators

These are for when a slot wants a look the generator lacks, and each one
applies **only if it is already installed**. Render once at build time, run
the output through `compress --ledger`, and ship only the WebP. The tool
itself never ships to the page.

`npx` downloads and runs remote code. Prefer the local generator, and use
`npx` only for a package the user already trusts and has pinned.

- **HyperFrames (if installed):** an FBM shader still via
  `npx hyperframes snapshot`, with
  `HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1`.
- **media-use `dither.mjs` (if installed):** palette-limited print texture.
  Pass the token hexes as `--palette`.
- **Remotion (if installed):** a `<Still>` with `@remotion/effects`.

`compress --ledger` records the shipped WebP and its source. Add the tool,
its command and the source palette to the ledger by hand.

## 11. Worked example — the /landing atmosphere band

The finance-terminal landing page (see SKILL.md) carries its
accountability content in band 6, over a full-bleed atmospheric image. Its
big-type stats sit there under the plate rule's carve-out. It shipped as an
11 KB WebP under the token scrim. The image came from an AI prompt that
followed this structure, which is still the recipe for `ai`:

1. **Register:** "ultra-minimal, very dark abstract background for a premium
   [domain] [product-type]".
2. **Motif:** sparse points, lines or arcs in the accent hue ("a faint
   constellation").
3. **Negative space, stated explicitly:** "mostly deep [ground colour]
   near-black negative space, so overlaid text stays readable".
4. **Finish:** "gentle depth-of-field, subtle film grain, restrained,
   editorial".
5. **Hard negatives:** "no text, no words, no logos, no chart axes". `ai`
   appends its own as well.

Rebuilt today, the band is `plate --style warp` from the page's tokens:
keyless, reproducible and within budget. With an image key, this prompt
(register, motif, negative space in the page ground, finish, hard
negatives) also makes the `ai` candidate for a product route header (§2):
render both, run both gates, ship the better one.
