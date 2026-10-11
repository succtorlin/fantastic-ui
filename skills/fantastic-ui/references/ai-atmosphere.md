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
equivalent under `~/.codex/skills/`). The other imagery tools:

| File | What it is for |
|---|---|
| [plate-slots.md](plate-slots.md) | the named scrim + fit slots (`header-band`, `state-band`, `center-band`, `phone-strip`, `full`, `none`), their exact CSS and `score` calls |
| [ai-motifs.md](ai-motifs.md) | domain → motif table, the five-part `ai` prompt, consent and cost rules |
| `scripts/plate-check.js` | measures visibility and text over every plate on the live page (§7) |
| `templates/tests/` | consumer tests to copy into the project: plate visibility vs the page, banded scrims in the CSS |
| `evals/plate-visibility/` | a fixture app and an offline run that proves the tools catch the failures below |

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
- **Every imagery claim cites a measured number.** "The plates are visible"
  or "text is readable" is a claim; it ships with each slot's `ge_1_1` /
  `ge_1_3` and its worst text ratio, measured on the composited page (§7).
  Never "reads correctly" from viewing the raw file: one app's plates looked
  fine as files and measured 0.1–0.4% visible in their headers.
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
own signal. All of those stay plain. Decide this from an explicit `kind`
prop on the primitive, never from its label, and trace every branch that
reaches it first: an error that falls through to the empty copy gets the
plate too, which makes the bug look designed
([product-surfaces.md](product-surfaces.md#audit-before-you-plate)).

**A — CSS variable (any framework; the default).** The route root names its
plate once; the shared primitive renders the host class and one empty
`aria-hidden` layer for `kind` empty or first-run. With no var() fallback,
a route without a plate paints nothing.

```css
.route-today { --plate: url("/plates/today.webp"); --plate-aspect: 5; }  /* one per route */
```

```html
<div class="state plate-host plate-host--state">
  <div class="plate plate--center" aria-hidden="true"></div>   <!-- empty / first-run only -->
  <p>No trades yet — run the screen to propose one.</p>
</div>
```

Use `plate--state` for left-aligned words and `plate--center` for centred
words in a tall box; the CSS for both, and their phone rules, is in
[plate-slots.md](plate-slots.md#3-the-css). On a route without a plate, put
an `svg --format css` texture token in `--plate` instead (§8).

**B — component context (when the plate URL lives in code).** Each route
wraps its content in a provider naming its plate; the shared empty-state
component reads it and draws
`<div aria-hidden="true" class="plate plate--state" style="--plate: url(…)">`
only for `kind` empty or first-run. A route that stays mounted while hidden
(`display: none`) downloads nothing.

**Gate.** Measure every inherited plate on the page (§7), at desktop and
phone widths, per distinct empty state — not once per route. Worked example:
RRGPy's `/agents` desk (`DeskPlateProvider` → `StateBlock`'s empty branch) —
75+ empty states across seven routes inherit their route's plate; the
faintest text over one measured ~7.9:1, and a centred band measured 10.3% /
3.1% visible.

## 2. Order of tools

1. **`plate`** — the default. It is local, keyless and deterministic, and it
   uses only palette colours. Use it for atmosphere bands, header strips, state
   surfaces and covers. It gates itself: with `--slot WxH --scrim NAME --fit
   cover|band|strip` it measures what that slot will show; without them, the
   whole file. It exits **4** (`{"error":"too_faint"}`, nothing written) when
   fewer than 8% of the measured pixels reach 1.1:1 against the page or fewer
   than 1% reach 1.3:1 (`--min-visible 8,1`; `--allow-faint` skips the gate
   but still reports the measure). `--seeds 1-8 --pick best` renders each
   seed, scores each on the slot, and writes the best one that passes (exit 4
   if none does); the ledger lists every candidate. `--page '#hex'` names the
   page colour and exits **1** with `{"error":"page_mismatch"}` when the
   palette's first ground is a different colour (§4).

   **Product route headers: render two candidates when an image key exists.**
   An `ai` candidate (motif and prompt from [ai-motifs.md](ai-motifs.md)) and
   a `plate` candidate for the same slot. Score both with `score` on the same
   slot and scrim, ship the better one, and keep the winner's ledger row. With
   no key, `ai` exits 3; ship the `plate`. Measured on one dark app under
   `header-band`: AI rasters 19–31% ≥1.1:1 and 8–17% ≥1.3:1, token `warp`
   14–25% and 3–14%, text still ≥4.5:1.
2. **`svg`** — zero-byte texture (grain, grid, rings) as an inline
   `<svg aria-hidden="true">` (HTML or JSX) with `currentColor` strokes. Use
   it for small slots, as a second texture on a page that already ships a
   raster, or when the slot sits under type-dense copy.
3. **`ai`** — for photographic or material looks that a preset slot needs
   (daylight interiors, timber, stone, fabric close-ups), and as the second
   candidate for a product route header (above). It wraps the installed
   `baoyu-image-gen` skill and appends "no text/logos/people/UI". It reports
   visibility against `--page '#hex'` but does not gate; `score` does.
   **Exit 3 means any failure** (no key, provider error, network, unusable
   image): fall back to `plate` for a new slot, and never overwrite an
   approved image (consent and cost rules: [ai-motifs.md §4](ai-motifs.md#4-consent-and-cost)).
4. **`compress`** — for images the user supplies, such as their photo library
   or product shots. It brings them to ≤30 KB WebP at the slot's size, and
   reports visibility against `--page` like `ai`.
5. **`score`** — scores any WebP (a plate, an `ai` render, a user photo) on a
   named slot, offline, with numpy and Pillow: `--plate FILE --page '#hex'
   --slot WxH --scrim NAME --fit cover|band|strip [--strip PX] [--text '#hex']`.
   It prints `{"visibility":{"ge_1_1","ge_1_3"},"text":{…},"pass",
   "reasons"}` and exits 0 on pass, 4 on a failed gate, 1 or 2 on an error.
   It predicts the browser numbers; the page measurement (§7) confirms them.
6. **`batch`** — renders, scores and swaps a whole project's plates from one
   manifest (§4a). It replaces per-project shell scripts.

There is always an image or a stated reason. Never substitute stock photos,
icon libraries or illustration packs.

Plate styles, matched to character:

| `--style` | Reads as | Reach for it on |
|---|---|---|
| `warp` | light raking across silk folds of the ground scale — lit folds, not an aura or a glow | atmosphere bands, hero backdrops, header strips, warm or editorial presets |
| `grain` | fine palette noise, paper or film | empty and auth states, print-leaning presets |
| `contour` | topographic linework | technical and engineering directions, report covers |
| `rings` | concentric instrument face | tall header bands of instrument products, covers |

**Strips under ~200 px tall use `warp` or `ai`,** or `contour`/`rings` with
`--weight`. `contour` and `rings` are hairlines (0.75–0.85 px). Scaled into a
short strip they reach 1.1:1 on about 15% of the slot but 1.3:1 on under 1%,
so they fail the visibility gate. `--weight W` (0.5–4, default 1) scales the
hairline width and mix; render with `--slot` so the gate decides, or give
them slots of 300 px and more. Every style concentrates its energy within a
height or two of `--focus`, so a very wide strip (beyond ~6:1) is mostly calm
ground: render it at ≤5:1 and let the slot's fit crop it, or use `ai`.

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
#    The first ground is the PAGE; --page-role names it and tokens.json records "page".
python3 $GEN tokens --css app/globals.css --selector ':root' \
  --map ground=--ground,ground2=--ground-2,ground3=--panel,accent=--accent,accentHi=--accent-hi \
  --page-role ground --out design/imagery/tokens.json

# 2. Render for the slot it will sit in, best of eight seeds. Deterministic, never over
#    --max-kb, never too faint for that slot (exit 4). Pass --page = the RENDERED page colour
#    (getComputedStyle(document.body).backgroundColor), not tokens.json's mapped ground.
python3 $GEN plate --tokens design/imagery/tokens.json --style warp --seeds 1-8 --pick best \
  --size 1600x320 --intensity 0.9 --focus 0.70,0.45 --max-kb 30 --page '#0a0907' \
  --slot 1170x90 --scrim header-band --fit cover \
  --out public/plates/today.webp --ledger design/imagery/plates.jsonl

# 3. Score it (or an ai render, or a user photo) on every slot it will appear in.
python3 $GEN score --plate public/plates/today.webp --page '#0a0907' \
  --slot 375x150 --scrim phone-strip --fit strip --strip 64 --text '#84817e'
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
   each plate darker than its page and 0.1–0.4% perceptible). Two guards
   catch it: the generator refuses a palette whose other grounds sit on the
   wrong side of the first, and `plate --page '#hex'` exits 1 `page_mismatch`
   when the first ground is not the page. **Take `--page` from the rendered
   page, never from the token map:** read `getComputedStyle(document.body)
   .backgroundColor` (or the surface the plate sits on) and pass that hex on
   every render, and set `page` explicitly in a batch manifest. tokens.json's
   `page` is only the role you mapped as `ground`; if the map labels the
   darker well as `ground`, tokens.json vouches for the wrong colour and the
   guard never fires. The visibility floor is not a substitute — on some
   seeds a bright accent alone lifts a well-based plate past 8% / 1%. Map the roles to the project's actual
   names, such as `--sodium` and `--sodium-hi`, or `--ground-0`… for an app
   shell.
2. **Render** at the slot's displayed CSS size or its aspect (1600x320 for a
   5:1 header). Low-frequency plates do not need 2× pixels. Place `--focus`
   (x,y as fractions) **away from** the copy and inside the slot's clear band
   (58–78% across under `header-band`). **Header strips and state slots use
   `--intensity` 0.8–1.0** with a banded scrim (§6): the scrim, not a timid
   plate, protects the text column. Low intensity (0.2–0.4) is only for a
   plate that text runs across from edge to edge. Always pass `--slot`,
   `--scrim` and `--fit`: a plate that passes as a file can still vanish in
   its slot.
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
   pass. Never fix a bad plate in CSS. Viewing is for taste only; it is not a
   visibility measurement.
4. **Place it** per the markup contract (§5) and a named slot from
   [plate-slots.md](plate-slots.md).
5. **Measure on the page** (§7) with `scripts/plate-check.js`, in every
   theme, at 1440 px and at 375 and 320 px, because each fit crops
   differently at each width.
6. **Commit** the manifest or generator command, the tokens snapshot
   (`tokens.json`), the ledger and the shipped WebP. **Every asset gets a
   ledger line**: `plate`, `ai`, `compress` and `svg` all take `--ledger`
   (only `tokens` does not). `plate` records the slot, scrim, slot visibility
   and, with `--seeds`, every candidate and the chosen seed. `compress`
   records the source filename and both hashes. `svg` records its style,
   seed, colour, format and the sha256 of the emitted markup. **Never commit
   a source PNG.** It is a build intermediate, and the ledger line is the
   provenance record. When the tokens change, re-run and the plates
   re-derive. The same seed gives byte-identical output **per environment**.
   Other libwebp, Pillow or numpy versions can encode differently. Then the
   ledger's sha256 no longer matches, which makes the drift visible instead
   of silent.

### 4a. Many plates: `batch --manifest`

A project with a plate per route keeps one manifest instead of a shell
script per area. Run it **from the project root**; every path in it is
relative to the current working directory.

```json
{
  "tokens": {"css": "web/app/globals.css", "selector": ":root",
             "map": "ground=--color-bg,ground2=--color-surface-raised,ground3=--color-sodium-soft,accent=--color-sodium,accentHi=--color-sodium-strong",
             "out": "docs/imagery/tokens.json"},
  "page": "#0a0907",
  "text": "#84817e",
  "out_dir": "web/public/plates",
  "ledger": "docs/imagery/plates.jsonl",
  "defaults": {"size": "1600x320", "intensity": 1.0, "focus": "0.70,0.45", "max_kb": 30,
               "slot": "1170x90", "scrim": "header-band", "fit": "cover"},
  "plates": [
    {"name": "today", "style": "warp", "seed": 11},
    {"name": "trades", "style": "warp", "seeds": "1-8", "pick": "best"},
    {"name": "crowding", "ai": {"provider": "openai", "prompt": "..."},
     "fallback": {"style": "warp", "seed": 131}}
  ]
}
```

```bash
python3 $GEN batch --manifest docs/imagery/plates.json --dry-run   # score and print a table, write nothing
python3 $GEN batch --manifest docs/imagery/plates.json             # render, score, then swap
```

- Every entry renders in memory first; nothing is written until all pass.
  `plate` entries render deterministically on every run.
- `ai` entries are **not** re-rendered unless `--reroll-ai`. The shipped
  file must match its ledger row's sha256, or the run exits 1
  `ledger_mismatch`.
- Under `--reroll-ai`, an `ai` failure aborts with nothing changed (exit 3)
  unless `--fallback`, which renders that entry's `fallback` plate instead
  and says so. `--fallback` has no effect without `--reroll-ai`.
- Tests and CI can stand in for the image provider with `$FUI_AI_CMD`: a
  command (no shell; split like a shell would) that receives the same `ai`
  arguments. Never point it at anything you have not read.
- Every entry is scored on its slot, scrim and fit (and against `text`, when
  given). If any fails, the run exits 4 and nothing changes.
- Only then are the files swapped into `out_dir` and the ledger written
  atomically: one row per plate, sorted by `out`, paths relative, sha256
  verified, no timestamps or argv, so a re-run with nothing changed leaves
  the ledger byte-identical.
- The ledger keeps every row that is not one of this manifest's plates
  (`ai`, `compress`, `svg`, hand-run rows) byte for byte; `--prune` drops
  them and lists what went.
- `--only NAME[,NAME]` runs the named entries; the rest must still verify
  against their ledger rows and are left untouched.
- A plate on a raised panel carries its own `page` (and its own `palette`
  or token `map`) in its entry; the manifest `page` is the default and is
  always required.
- Under `--reroll-ai`, an existing file the ledger cannot verify is refused
  (`ledger_mismatch`) before any credit is spent. If the run aborts after
  generating images, they are kept in `<out_dir>/.rejected/<timestamp>/`
  with a note per image — paid work is never discarded silently.
- Paths (`out_dir`, `ledger`, `tokens.css`, `tokens.out`) must sit inside the
  project (exit 1 `path_outside_project`) unless `--allow-outside`. Treat a
  manifest from another repo like a script: read it before running it.
- Files are staged and their sha256 checked, then swapped; a failed rename
  restores the originals (`swap_failed`) and leaves the ledger untouched.
- `--intensity` defaults to 1.0 for an entry with a slot (0.6 without).
- Exit codes: **0** ok, **1** error, **2** usage, **3** AI failed (no
  `--fallback`), **4** a gate failed.

## 5. Markup contract

A plate is a **decorative layer**. Removing it must lose no information.

```html
<header class="plate-host plate-host--header">
  <div class="plate plate--header" aria-hidden="true"></div>
  <div class="head-inner">…eyebrow, title, actions…</div>
</header>
```

The host carries the padding and the text; the layer is its first child and
paints the scrim over `var(--plate)`. The CSS for each slot is in
[plate-slots.md §3](plate-slots.md#3-the-css). `scripts/plate-check.js` finds
this pair by default. Or, as an element in a slot with no text over it:

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
that runs the full width erases the plate everywhere else. One shipped app's
header plates measured 0.1–0.4% visible under a full-width 94% → 35% scrim;
under the banded `header-band` profile, its token plates measured 14–25%
≥1.1:1.

Use a named profile from [plate-slots.md](plate-slots.md), not a hand-tuned
gradient: `header-band` for header strips, `state-band` or `center-band` for
empty states, `phone-strip` for headers under 768 px, `full` where text spans
the slot, `none` where no text sits over the plate. The generator, `score`,
`batch` and `plate-check.js` all know these names, so the CSS and the
measurement describe the same thing.

- **Fit the bands to the layout.** The stops follow where the copy and the
  actions end at desktop width; move them with the layout, then re-measure.
  A moved stop is a custom profile: score it with `--scrim-json`.
- **Phones get a strip above the words,** not a full-width scrim over a side
  band (measured 0–6% visible on one app's headers). `phone-strip` keeps the
  top 64 px clear and scrims the text below it.
- **No `rgba(`, no CSS `opacity`.** The scrim is `color-mix()` over the
  ground token, so it needs no hex literal outside the token file, and the
  hex/rgb greps, the opacity rule in [wcag-audit.md](wcag-audit.md) and
  project guards that ban `rgba(` or `opacity: 0.x` all pass.
- **Tune brightness at generation time** with `--intensity`, `--focus` and
  `--weight`. Never tune it with CSS opacity on the plate or the text.
- **Move a stop only as far as both gates in §7 allow.** Raising a mix to
  rescue text makes the plate fainter; the visibility gate catches it.
- **Light grounds** use the same profiles with their own `--ground`.

## 7. Real-pixel contrast and visibility check

A plate can fail in two directions, and both are failures:

- **Text gate** — text over the plate is unreadable. Take the composited
  background under each text region and gate on its 90th-percentile
  luminance for light text on a dark page (10th percentile for dark text on
  a light page): 4.5:1 for body text, 3:1 for large text (≥24 px, or
  ≥18.66 px bold).
- **Visibility gate** — the plate is invisible. Over the pixels the plate
  image covers inside the slot, after the scrim is composited over the page
  colour, at least **8% must be ≥1.1:1** against the page (`ge_1_1`) and at
  least **1% must be ≥1.3:1** (`ge_1_3`). Under `band` that is the rows the
  image covers; under `strip`, the strip. A plate that fails visibility is as
  much a failure as one that fails text contrast; it costs bytes and says
  nothing.

axe and token-pair checkers composite the gradient and ignore the `url()`
layer, so they cannot see the plate. Measure in two places:

1. **Offline, before it ships:** `plate --slot` and `score` model the slot
   (fit, crop, named scrim) with numpy. They predict the browser numbers
   closely and run in CI.
2. **On the page, after it ships:** `scripts/plate-check.js` reads each
   host's computed geometry (background-size, position, the scrim's stops),
   decodes the plate, composites the scrim over the page colour, and measures
   both gates on every text node in the host. Load it in DevTools (paste the
   file), with Playwright `page.addScriptTag({ path })`, or by `eval` of the
   file text, then:

```js
// The sentinel names a value the CURRENT width's rule produces: the desktop
// header band has a 58% stop; the phone strip has a 48px stop (strip − 16).
const wide = innerWidth >= 768;
const report = await plateCheck({
  expect: [{ selector: ".plate-host--header > .plate", property: "background-image",
             includes: wide ? "58%" : "48px" }],
});
if (report.stale) throw new Error("stale CSS: the edit is not loaded");
console.log(JSON.stringify(report.hosts.map(h => [h.box, h.visibility, h.worstText, h.visible && h.textPass])));
```

   Run it at 1440 px and at 375 px, in every theme, with each plated empty
   state on screen. `report.pass` is false when any host fails either gate.
   Read the report honestly:
   - `hosts[].measured: "partial"` (with `unsupportedLayers` or
     `unmodelled`) means a radial/angled gradient, layer opacity, mask,
     filter or blend sits on the plate and the numbers cannot be vouched
     for; the host fails until you remove it or measure with the shot mode.
   - A layer set to `display: none` is `{ skipped: "layer_hidden" }` and
     listed in `skippedHosts`; a page where every host is skipped fails with
     `all_skipped` unless you pass `allowAllSkipped: true` on purpose.
   - `image_unreadable` (cross-origin, timeout after `imageTimeoutMs`,
     default 10 s) is a failure, never a pass.
   `scripts/plate-check-shot.mjs` (needs Playwright; exits 2 with a message
   without it) does the same from screenshots with the text made
   transparent, for a pixel-true second opinion.

- **Use the stale-CSS sentinel.** `expect` names a computed value your last
  edit must have produced (a new stop such as `58%`). When any value lacks
  it, plate-check returns `{stale: true}` and measures nothing. **Numbers
  unchanged after a CSS edit are stale until proven otherwise**: in one
  session a dev server served the old stylesheet twice, and the
  measurements came back unchanged both times, which looked like "the edit
  did nothing" instead of "the edit is not loaded". Restart the server or
  clear its cache, reload, and re-run with the sentinel. Two traps, both
  hit while proving the checker: Chrome **drops a default `180deg`**
  (`linear-gradient(rgba(…) 0px, …)`), so match a stop such as `48px`,
  never the angle; and every element the selector matches must contain the
  string, so **scope the selector to one layer kind**
  (`.plate-host--header > .plate`, not `.plate`) or state layers with other
  stops read as stale.
- **Cite the numbers.** Every claim about imagery in a report or PR carries
  each slot's `ge_1_1` / `ge_1_3` and its worst text ratio, measured here.
  Never "reads correctly" from viewing the raw file.
- **Controls with their own fill** (a filled button, a badge) are skipped as
  text over the plate; they still sit in the slot.
- **When the text gate fails,** move `--focus` away from the copy, or widen
  or deepen the scrim's text band (then re-score it as a custom profile).
  Never lighten the text past its token.
- **When the visibility gate fails,** in this order: base the plate on the
  page (§4 step 1, `--page`); raise `--intensity` toward 1.0; use a banded
  profile instead of `full` (§6); `--seeds 1-8 --pick best`; raise
  `--weight` or switch from `contour`/`rings` to `warp`; render the `ai`
  candidate (§2).
- Record both results with the slot in the ledger or the polish table.
- Copy the consumer tests from `templates/tests/` into the project:
  `plateVisibility.test.ts` decodes each shipped plate and fails below the
  floors against the page; `plateScrim.test.ts` fails when a header or state
  rule loses its banded scrim or the phone strip rule disappears.

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
the output through `compress --ledger`, score it on its slot, and ship only
the WebP. The tool itself never ships to the page.

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
11 KB WebP under the token scrim. The image came from an AI prompt with five
parts — register, motif, negative space in the page ground, finish, hard
negatives — which is still the recipe for `ai`
([ai-motifs.md §2](ai-motifs.md#2-the-prompt-recipe)).

Rebuilt today, the band is `plate --style warp` from the page's tokens:
keyless, reproducible and within budget, scored with `--scrim full` because
its stats span the band. With an image key, the same recipe makes the `ai`
candidate for a product route header (§2): render both, score both on the
slot, ship the better one.
