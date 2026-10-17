# Gallery modules — the background and layout kit for Preset L

Preset L ("Gallery White", [theme-presets.md](theme-presets.md#preset-l--gallery-white))
is product-gallery minimalism: white and near-white bands, a black stage for
drama, one deep blue, the platform's own sans at display size, and products
on seamless studio light. This file is its kit: the bands, the glass, the
stage, the tiles and the light — copy-paste CSS on the preset's tokens, the
plate commands for the studio light, and what the gates check.

It is a direction *like* a well-known product site, not a copy of one: no
names, logos, product photographs, icons or exact brand values. Bring the
user's own products.

Every rule below is scoped under `.page` and uses only the preset's tokens.
Translucency is `color-mix(... transparent)`, never `rgba()` or `opacity`.

## 1. Band rhythm — the page is a stack of tones

The page is a column of full-width bands, one idea each. Bands separate by
tone alone: `--ground`, `--ground-2`, `--stage`. Never a rule, never a shadow.

```css
.band            { padding-block: clamp(80px, 10vw, 160px); background: var(--ground); color: var(--ink); }
.band--alt       { background: var(--ground-2); }
.band--stage     { background: var(--stage); color: var(--stage-ink); }
.band--stage .sub { color: var(--stage-ink-2); }
.band--stage a   { color: var(--stage-accent); }
.band__col       { max-width: var(--maxw); margin-inline: auto; padding-inline: 22px; text-align: center; }
```

Rhythm that reads as composed rather than stacked: open on `--ground`,
alternate `--ground` / `--ground-2`, and spend `--stage` on at most two bands
— the hero of the most premium product and one feature that needs drama. A
page of all-stage bands is Midnight Showroom, not this preset.

## 2. Display type — scale does the hierarchy

```css
.eyebrow  { font: 600 clamp(17px, 1.6vw, 21px)/1.2 var(--display); color: var(--accent); letter-spacing: -0.01em; }
.band--stage .eyebrow { color: var(--stage-accent); }
.headline { font: 600 clamp(40px, 6vw, 80px)/1.05 var(--display); letter-spacing: -0.03em;
            text-wrap: balance; margin: 8px 0 0; }
.sub      { font: 400 clamp(19px, 1.9vw, 24px)/1.35 var(--sans); color: var(--ink-2);
            max-width: 34ch; margin: 14px auto 0; text-wrap: pretty; }
```

Sentence case, never caps. Two short headline lines beat one long one. The
eyebrow is the product name, not a category label.

## 3. Pill and chevron — one primary per band

```css
.actions  { display: flex; gap: 28px; justify-content: center; align-items: center; margin-top: 24px; flex-wrap: wrap; }
.pill     { font: 400 17px/1 var(--sans); padding: 12px 22px; border-radius: var(--r-pill);
            background: var(--accent-fill); color: var(--on-accent); text-decoration: none; }
.pill:hover { background: color-mix(in oklab, var(--accent-fill) 88%, var(--ink)); }
.chev     { font: 400 17px/1 var(--sans); color: var(--accent); text-decoration: none; }
.chev::after { content: " ›"; }
.chev:hover  { text-decoration: underline; text-underline-offset: 3px; }
.pill:focus-visible, .chev:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
```

White on this blue is the preset's one declared pairing (5.93:1), measured
by the gate, not assumed. One pill per band; the second action is always a
chevron link.

## 4. Glass nav and chapter strip — the trap lives here

```css
.nav {
  position: sticky; top: 0; z-index: 50; height: var(--nav-h);
  display: flex; align-items: center; justify-content: center; gap: 36px;
  font: 400 12px/1 var(--sans); color: var(--ink);
  background: color-mix(in oklab, var(--ground) 80%, transparent);   /* never under 80% */
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
.nav[data-over="stage"], .chapter[data-over="stage"] { color: var(--stage-ink);
  background: color-mix(in oklab, var(--stage) 80%, transparent);
  border-bottom-color: transparent; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .nav, .chapter { background: var(--ground); }
  .nav[data-over="stage"], .chapter[data-over="stage"] { background: var(--stage); }
}
.chapter { position: sticky; top: var(--nav-h); z-index: 49; height: 52px;
  display: flex; align-items: center; justify-content: space-between;
  padding-inline: max(22px, calc((100% - var(--maxw)) / 2));
  background: color-mix(in oklab, var(--ground) 80%, transparent);
  backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--hair); }
.chapter .pill { padding: 6px 12px; font-size: 12px; }
```

Both bars flip together. Flip only the nav and the chapter strip stays light
glass over black, which composites to a flat grey bar: the demo shipped that
way until a screenshot caught it.

```js
// Flip the nav AND the chapter strip to dark glass over a stage band.
const nav = document.querySelector(".nav");
const bars = document.querySelectorAll(".nav, .chapter");
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) {
    const over = e.target.classList.contains("band--stage") ? "stage" : "";
    bars.forEach((b) => { b.dataset.over = over; });
  }
}, { rootMargin: `-${parseInt(getComputedStyle(nav).height)}px 0px -95% 0px` });
document.querySelectorAll(".band").forEach((b) => io.observe(b));
```

Measured: `--muted` on 72% white glass over the stage falls to **2.71:1**;
at 80% it is 3.35:1, and `--ink` holds at 10.71:1. Hence: ≥80% opacity, only
`--ink` on the glass, and dark glass over stage bands. Verify scrolled over
the darkest band, not only at the top of the page.

## 5. Hero stage — product on studio light

The hero is a band whose lower part is a **stage**: the studio plate sits
there, behind the product only. The words sit above it on clean ground.

```html
<section class="band band--stage hero" aria-labelledby="hero-h">
  <div class="band__col">
    <p class="eyebrow">Product name</p>
    <h1 class="headline" id="hero-h">A thesis in five words.</h1>
    <p class="sub">One sentence that says what changed.</p>
    <div class="actions"><a class="pill" href="#buy">Buy</a><a class="chev" href="#more">Learn more</a></div>
  </div>
  <div class="stage">
    <div class="stage-light" aria-hidden="true"></div>
    <img class="stage-product" src="product.webp" alt="Product name, front view" width="960" height="540">
  </div>
</section>
```

```css
.hero          { padding-bottom: 0; overflow: hidden; }
.stage         { position: relative; isolation: isolate; margin-top: clamp(32px, 5vw, 64px); }
.stage-light   { position: absolute; inset: 0; z-index: -1; pointer-events: none;
                 background: var(--stage-plate) center bottom / cover no-repeat; }
.stage-product { display: block; width: min(960px, 92vw); height: auto; margin: 0 auto; }
.hero:not(.band--stage) .stage-light { background-image: var(--ground-plate); }
```

The light is the stage, not a backdrop for words: the gate fails a page where
`.stage-light` overlaps any heading, paragraph or action (trap
`stage-light-never-behind-copy`). Text over imagery is the one thing this
direction never does — the scale of the type is what carries the page.

## 6. Tiles — bento by tone

```css
.tiles       { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
               max-width: 1260px; margin-inline: auto; padding-inline: 12px; }
.tile        { position: relative; isolation: isolate; overflow: hidden; border-radius: var(--r-card);
               background: var(--ground-2); color: var(--ink); text-align: center;
               padding: 44px 32px 0; min-height: 580px; display: flex; flex-direction: column; }
.band--alt .tile:not(.tile--stage) { background: var(--ground); }   /* :not() — see below */
.tile--stage { background: var(--stage-2); color: var(--stage-ink); }
.tile--stage .sub { color: var(--stage-ink-2); }
.tile--stage .eyebrow, .tile--stage .chev { color: var(--stage-accent); }
.tile--wide  { grid-column: span 2; }
.tile .headline { font-size: clamp(28px, 3.4vw, 48px); }
.tile figure { margin: auto 0 0; }                       /* product bleeds off the bottom */
.tile figure img { display: block; width: 100%; height: auto; }
@media (max-width: 767px) { .tiles { grid-template-columns: 1fr; } .tile--wide { grid-column: auto; } }
```

No border, no shadow — the tile is a tone step and a big corner.

**Specificity trap, caught by the gate on the first demo:** a plain
`.band--alt .tile { background: var(--ground) }` (two classes) outranks
`.tile--stage` (one class), so a dark tile inside a light band rendered on
**white** with its near-white stage ink — the headline measured **1.10:1**.
Scope the band rule with `:not(.tile--stage)` (above), and give stage tiles
their own text colours rather than inheriting the band's. A tile may
carry the studio light behind its product the same way as the stage (a
`.stage-light` inside the figure), never behind its words.

## 7. Spec numerals

```css
.specs   { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 40px 24px;
           max-width: var(--maxw); margin: 48px auto 0; text-align: center; }
.spec b  { display: block; font: 600 clamp(40px, 5vw, 64px)/1 var(--display); letter-spacing: -0.03em;
           font-variant-numeric: tabular-nums; }
.spec span { display: block; margin-top: 8px; font: 400 15px/1.35 var(--sans); color: var(--ink-2); }
.band--stage .spec span { color: var(--stage-ink-2); }
```

Real numbers only: the product's own figures with their units.

## 8. Motion — quiet, and gone under reduced motion

```css
/* hidden only after the script arms it: with JS off, everything shows */
.reveal-ready [data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity 600ms cubic-bezier(.2,.7,.2,1), transform 600ms cubic-bezier(.2,.7,.2,1); }
.reveal-ready [data-reveal].in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal-ready [data-reveal] { opacity: 1; transform: none; transition: none; } }
```

One IntersectionObserver adds `.in` once; nothing scroll-jacks, nothing
loops. The script adds `reveal-ready` to `<html>` just before it starts
observing, and skips that under reduced motion, so a visitor without JS (or
with motion off) never meets a hidden section. The reveal pattern and its lifecycle are in [canvas-hero.md](canvas-hero.md).

## 9. The studio light — generating it

`plate --style studio` renders seamless studio light from the page's own
tokens: a soft cyclorama sweep, an elliptical spotlight pool at `--focus`,
and a faint floor reflection. It is smooth by construction — no lines, no
grain — so it passes the structure gate on its shape, not on noise. Light and
dark palettes both work: on black the pool lifts out of the dark; on white
the pool stays at the page and the surroundings fall off a few steps of grey,
because nothing on a white page can be brighter than the page.

```bash
GEN=~/.claude/skills/fantastic-ui/scripts/gen_atmosphere.py
# Stage (dark): page = --stage
python3 $GEN plate --palette '#000000,#141416,#2a2a2e,#0062c4,#3d9bff' --page '#000000' \
  --style studio --seed 1 --size 1600x900 --focus 0.5,0.62 --intensity 1.0 --max-kb 30 \
  --slot 1440x620 --scrim none --fit cover --out public/plates/stage.webp --ledger design/imagery/plates.jsonl
# Light: page = --ground
python3 $GEN plate --palette '#ffffff,#f4f4f6,#d5d5da,#0062c4,#3d9bff' --page '#ffffff' \
  --style studio --seed 1 --size 1600x900 --focus 0.5,0.62 --intensity 1.0 --max-kb 30 \
  --slot 1440x620 --scrim none --fit cover --out public/plates/ground.webp --ledger design/imagery/plates.jsonl
```

```css
.page { --stage-plate: url("/plates/stage.webp"); --ground-plate: url("/plates/ground.webp"); }
```

Keep `--intensity` at 1.0, or pass `--slot`, which defaults it to 1.0. Without
either, `plate` defaults to 0.6 and studio fails the gate. Calibrated floors
(seeds 1–5, hero and tile slots): 0.78 on a dark page, 0.80 on a light one.
Smooth light has nothing to spare: there is no grain to fall back on.

Then measure on the composited page with
[`scripts/plate-check.js`](../scripts/plate-check.js) (host `.stage`, layer
`:scope > .stage-light`), at 1440 and 375 px, and cite the numbers. The slot is
`none`: nothing is written over the light, so there is no scrim — and so the
text gate has nothing to measure there, which is the point.

## 10. What the gates check for Preset L

`node scripts/verify-preset.mjs --url … --preset L` adds to the universal gates:

| Gate | Fails when |
|---|---|
| `separation-strategy` (tone) | any section, card or tile carries a box-shadow or a border |
| `trap:white-never-partners-accent` (declared) | white on the accent fill measures under 4.5:1 |
| `trap:glass-nav-opacity` | the nav's background alpha is under 0.80 |
| `trap:stage-light-never-behind-copy` | a `.stage-light` overlaps a heading, paragraph, link or button |
| `token-roles` | a required role (`--ground`, `--ink`, `--ink-2`, `--muted`, `--hair`) is missing |

Not gated: whether it *reads* as the direction. A green run means no rule was
broken; the restraint is still a judgement.
