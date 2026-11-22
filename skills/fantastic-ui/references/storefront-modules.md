# Storefront modules — the kit for the five shop presets N to R

Five presets in [theme-presets.md](theme-presets.md) are shops or product
pages derived from storefront references:

| | Preset | The page in one line |
|---|---|---|
| **N** | [Sprint Stage](theme-presets.md#preset-n--sprint-stage) | A black first screen with a slanted headline, then a white shop of grey tiles |
| **O** | [Olive Outfitter](theme-presets.md#preset-o--olive-outfitter) | One warm sheet of nested rounded panels, photographs fading in, olive pills |
| **P** | [Chamfer Spec](theme-presets.md#preset-p--chamfer-spec) | White and silver, wide capitals, cut corners, a strip of specifications |
| **Q** | [Market Shelf](theme-presets.md#preset-q--market-shelf) | A pale aisle of white cards on shelves that page sideways |
| **R** | [Mono Catalogue](theme-presets.md#preset-r--mono-catalogue) | A white shop with no colour anywhere, pictures included |

This file is their kit: what each reference showed and what was changed, the
one rule all five share, how their product pictures use the showcase lane,
the CSS for each preset's distinctive modules, and what the gates check.

They are directions *like* the references, not copies: no shop names, marks,
slogans, copy or product designs from them. Bring the user's own products.

Every rule below is scoped under `.page` and uses only the preset's tokens.
The CSS in §4 to §8 is taken from five proof pages that passed the exam, one
per preset; §9 records the numbers.

## 1. What the references showed, and what was changed

Kept apart, as [visual-reference-analysis.md](visual-reference-analysis.md) asks.

| Preset | Kept from the reference | Changed, and why |
|---|---|---|
| **N** | Black hero with a heavy italic caps headline and one lit product on a reflection; rows of four grey tiles; a rounded black banner mid-page; rows that alternate cut-outs and photographs | Secondary text on black was re-measured and confined to the stage (1.95:1 on white). The product no longer overlaps the headline on a phone. Captions moved under the tiles so no text sits on a picture |
| **O** | The rounded sheet, nested radii, hero panel with a photograph on the right and small cards on its edge, olive pills, filter rail, five-card row, 2×2 category tiles, icon strip, club band | The headline no longer sits on the photograph and the cards are no longer translucent: text over a picture cannot be measured. Shadows were dropped for hairlines so it cannot be confused with Preset E |
| **P** | White and silver ground, wide caps display, cut corners, icon facts under the button, the outlined spec strip with a black label, a big callout numeral, the angled black band | Every corner is now cut (the reference mixed cut and rounded). The cut moved from the control to a layer behind it, because `clip-path` removes the focus ring. The callout no longer runs across the render |
| **Q** | Pale blue-grey page, white cards in rows of five with arrows, price bottom-right, a hero with neighbouring slides showing, one dark band of timed deals, three promo tiles | Stars were darkened on light grounds (the yellow was 1.84:1) and always carry the number. Shelves scroll by themselves instead of depending on script. The hero's words moved off the photograph. The deadline is also written as words |
| **R** | White page, light-weight headline, ink and outlined pills, staggered grey tiles with large corners and a cut-out leaning off each, slash filter row, three-across grid, greyscale imagery | The greys were darkened (2.78:1 became 5.74:1). Greyscale is enforced in CSS, not left to the exports. The picture box no longer overlaps the tile's words |

## 2. The rule all five share: words never sit on a picture

Every one of these references sets text over a photograph or a render
somewhere: a headline on the pale side of a hero photo, a numeral across a
product's rings, a caption inside a tile. It looks fine in the mock-up and it
cannot be shipped by this skill, for one practical reason: **the contrast of
text over a picture cannot be measured.** axe-core reports it as
`incomplete` ("could not decide"), and the exam counts an undecided node as
a failure, because the next photograph dropped into the slot may be dark
where this one was light.

So in all five presets:

- **The words have their own box, on a solid tone.** The picture is a
  separate box that starts where the words end. The two boxes do not overlap
  at any width; on a phone the picture goes above or below the words.
- **A picture may still seem to run under the words.** Mask the picture's
  near edge to transparent (`mask-image: linear-gradient(...)`) so it
  dissolves into the panel tone. The pixels stop before the text; the eye
  does not see where.
- **Anything that floats on a picture is opaque.** A card on a photograph has
  an opaque background; a translucent or blurred one puts the picture back
  under its text.
- **Captions go under the picture box, not inside it.**

Each preset's geometry trap in `preset-gates.json` checks its own version of
this (N: `.stage__product`; O: `.hero__photo`, `.cat__photo`; P: `.render`;
R: `.tile__art`).

## 3. Product pictures and the showcase lane

A shop's pictures are its products, and they are the user's own. Two sizes
of picture appear in these presets, and they are treated differently.

**Small pictures stay under the 30 KB cap.** A product on a tile or a card
is shown at 170–280 px wide. One 560 px WebP of a cut-out on a plain ground
covers that box at @2× on a laptop and @3× on a phone and fits in 30 KB. Do
not mark these; export them with `gen_atmosphere.py compress`.

```html
<img src="art/road-3-coral-560.webp" width="560" height="420"
     alt="Tern Road 3 in coral, side view" loading="lazy" decoding="async">
```

**Large pictures use the showcase lane.** A hero product (N, P, R), a hero
or category photograph (O) and a hero slide (Q) are 500–700 px wide on a
desktop and the full width of a phone. At 30 KB they smear. All five presets
declare the lane as allowed (`"required": false`), so such a picture may be
marked `data-showcase` and is then held to the lane's own three gates
instead of the cap: real `alt` text, `width`/`height` and a `srcset`; no
browser upscaling at 1440 px @2× or 390 px @3×; at most 200 KB per file and
600 KB for the first screen. The contract and the export recipe are in
[folio-modules.md](folio-modules.md#6-the-showcase-lane).

```html
<img data-showcase
     src="art/road-3-hero-1280.webp"
     srcset="art/road-3-hero-640.webp 640w, art/road-3-hero-960.webp 960w,
             art/road-3-hero-1280.webp 1280w, art/road-3-hero-1600.webp 1600w"
     sizes="(min-width: 768px) 52vw, 100vw"
     width="1600" height="1100"
     alt="Tern Road 3 in coral, three-quarter view, lit from above"
     fetchpriority="high" decoding="async">
```

| Slot | Box on desktop | Rungs to export | Marked? |
|---|---|---|---|
| Hero product or render (N, P, R) | about half of `--maxw` | 640, 960, 1280, 1600 | `data-showcase` |
| Hero and category photographs (O) | 54% of a panel | 640, 960, 1280, 1600 | `data-showcase` |
| Hero slide picture (Q) | half of the slide | 640, 960, 1280 | `data-showcase` |
| Product on a tile or card (all five) | 170–280 px | one file, 560 px | no: under 30 KB |
| Banner products in a row (N) | 150–220 px each | one file, 480 px | no: under 30 KB |

Three rules that follow from the lane being *allowed* here and not
*required*, as it is for Preset M:

- **A page whose photographs have not arrived still passes.** It carries
  labelled stand-ins: a plain drawing or a plate, with one visible line
  saying what it stands in for. The proof pages for this kit do exactly
  that.
- **A stand-in is never dressed up as the product.** A generated photograph
  of a product that does not exist is fake data, in a shop most of all.
  Drawings are visibly drawings.
- **Marking a decorative image does not buy it the exemption.** Without real
  `alt` text it stays in the 30 KB gate and also fails `showcase-markup`.

## 4. Sprint Stage (N)

**The stage.** One black screen, two columns: the copy, and a product box
that never shares a pixel with it. Below 768 px the grid becomes one column
and the product box moves under the button.

```css
.stage { background: var(--stage); color: var(--stage-ink); }
.stage__in {
  display: grid; grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
  align-items: center; column-gap: var(--gap);
  min-height: clamp(480px, calc(100svh - var(--nav-h)), 740px); padding-block: 48px;
}
.stage h1 {
  margin: 0; font: italic 900 clamp(40px, 6.4vw, 84px)/1 var(--display);
  letter-spacing: -0.02em; text-transform: uppercase;
}
.stage h1 span { display: block; white-space: nowrap; }   /* one sentence per line */
.stage__line { max-width: 30ch; color: var(--stage-ink-2); }

.stage__product { position: relative; min-width: 0; }
.stage__product::before {            /* lit from above */
  content: ""; position: absolute; inset: -14% 0 30% 0; pointer-events: none;
  background: radial-gradient(closest-side,
    color-mix(in oklab, var(--stage-ink) 20%, transparent), transparent);
}
```

Two things the proof page found:

- **Line-height is 1, not less.** The skill's lint rejects uppercase text
  under 1.0, because capitals have no descenders and wrapped lines collide.
- **Helvetica Neue has no weight above bold.** A stack that starts with it
  renders "900" as 700 and the headline loses its weight. `--display` starts
  with `system-ui`, which has a true black italic on macOS, Windows and
  Android.

**The reflection.** A second copy of the product, flipped, at reduced
opacity, masked out within its own height, `aria-hidden`:

```css
.stage__mirror {
  display: block; width: 100%; height: auto; transform: scaleY(-1); opacity: 0.38;
  -webkit-mask-image: linear-gradient(to top, var(--stage-ink), transparent 94%);
          mask-image: linear-gradient(to top, var(--stage-ink), transparent 94%);
}
```

Cut the reflected part in the artwork itself (export only the bottom 40% of
the product, or draw only that part). Cropping it with `overflow: clip` or
an SVG overflow looks the same and makes axe report the text beside it as
undecided: hit-testing still sees the hidden part of the box.

**Tone tiles and photograph cards.** The same box twice: a `--ground-2`
field for a cut-out, or a full-bleed picture. The caption is a sibling under
the box.

```css
.row  { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px var(--gap); }
@media (min-width: 1024px) { .row { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.tile { display: grid; place-items: center; aspect-ratio: 1;
        border-radius: var(--r-card); background: var(--ground-2); overflow: hidden; }
.shot { position: relative; aspect-ratio: 1; border-radius: var(--r-card); overflow: hidden; }
.item__name { margin-top: 14px; font: 700 13px/1.3 var(--sans); letter-spacing: 0.02em; text-transform: uppercase; }
.item__meta { color: var(--muted); }
```

**The rounded black banner.** Inside the content column, never full-bleed.
It is the second place stage tokens are allowed.

```css
.banner {
  display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: center; gap: 28px 36px; padding: clamp(24px, 4vw, 44px);
  border-radius: var(--r-panel); background: var(--stage); color: var(--stage-ink);
}
.banner__line { color: var(--stage-ink-2); }
.lineup { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 14px; align-items: end; }
```

## 5. Olive Outfitter (O)

**The sheet.** One `--panel` box on the `--ground` desk. The outline and the
28 px corner appear from 768 px; below that the sheet is flush.

```css
.sheet { max-width: calc(var(--maxw) + 2 * var(--sheet-pad)); margin-inline: auto;
         padding: var(--sheet-pad); background: var(--panel); }
@media (min-width: 768px) { .sheet { border: 1px solid var(--hair); border-radius: var(--r-sheet); } }
```

**The photo hero panel.** Two grid columns. The copy is in the first; the
photograph and the fact cards share the second, so the cards sit on the
picture while the words never do.

```css
.hero {
  display: grid; grid-template-columns: 46% minmax(0, 1fr);
  min-height: clamp(430px, 39vw, 530px);
  border: 1px solid var(--hair); border-radius: var(--r-panel);
  background: var(--ground-2); overflow: clip;
}
.hero__copy { grid-area: 1 / 1; display: flex; flex-direction: column;
              align-items: flex-start; justify-content: center; min-width: 0; }
.hero h1 { font: 700 clamp(30px, 4.2vw, 56px)/1.02 var(--display);
           letter-spacing: -0.01em; text-transform: uppercase; color: var(--ink-2); }
.hero h1 span { display: block; }
.hero h1 span:first-child { color: var(--ink); }           /* the two-tone headline */

.hero__photo {
  grid-area: 1 / 2; position: relative; min-width: 0; min-height: 0;
  -webkit-mask-image: linear-gradient(to right, transparent, var(--ink) 28%);
          mask-image: linear-gradient(to right, transparent, var(--ink) 28%);
}
.hero__photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.hero__facts { grid-area: 1 / 2; z-index: 1; justify-self: end; align-self: start;
               display: grid; gap: 10px; width: 204px; margin: 20px; }
.fact { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 10px;
        padding: 12px; border: 1px solid var(--hair); border-radius: var(--r-card);
        background: var(--panel); }                         /* opaque: the gate checks alpha 1 */
```

The mask's colour stop is a token because a mask reads only alpha and the
lint forbids colour literals outside the token block. On a phone the mask
turns to fade the picture's bottom edge (`to top`), the picture goes above
the copy, and the fact cards move under the hero from below 1024 px.

**Category tiles.** The hero's structure at small scale: words in the first
46%, the photograph masked into the rest.

```css
.cats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }
.cat  { display: grid; grid-template-columns: minmax(0, 46%) minmax(0, 1fr); min-height: 236px;
        border: 1px solid var(--hair); border-radius: var(--r-panel);
        background: var(--ground-2); overflow: clip; }
.cat__photo { position: relative; min-width: 0;
  -webkit-mask-image: linear-gradient(to right, transparent, var(--ink) 28%);
          mask-image: linear-gradient(to right, transparent, var(--ink) 28%); }
```

**The filter rail and the product row scroll inside themselves.** Mark each
with `data-fui-scroll` ([control-geometry.md](control-geometry.md)); without
the mark the exam reports the off-screen pills and cards as content cut off.
Give each rail pill its own `--panel` fill: an outlined pill with no fill,
half scrolled out of view, makes axe report "partially obscured".

```html
<nav class="rail" aria-label="Shoe types" data-fui-scroll="Shoe types"> … </nav>
<ul class="products" data-fui-scroll="Best sellers"> … </ul>
```

```css
.rail { min-width: 0; padding: 6px; border: 1px solid var(--hair);
        border-radius: var(--r-pill); overflow-x: auto; }
.rail a { min-height: 44px; border: 1px solid var(--hair-lit); border-radius: var(--r-pill);
          background: var(--panel); white-space: nowrap; }
@media (max-width: 1023px) {
  .products { grid-template-columns: repeat(5, minmax(208px, 1fr));
              overflow-x: auto; scroll-snap-type: x proximity; }
}
```

**Labels on a card are coloured text.** "New" in `--accent`, a discount in
`--down` with its figure, 12 px/700 caps at the plate's top-left corner. A
filled chip there fails the lint's `tinted-pill` rule.

## 6. Chamfer Spec (P)

**The cut button.** Three constraints meet here and the recipe satisfies all
of them:

1. `clip-path` on the control would clip its focus ring, so the cut is on a
   `::before` layer and the control keeps `clip-path: none`.
2. A fill that exists only on a pseudo-element cannot be measured: the
   contrast gate and axe read `background-color` on the element and its
   ancestors, and white on a transparent anchor reads as 1:1. So the control
   carries the same fill as its own `background-color`, held inside its
   content box where the cut corner never reaches.
3. axe reports "could not decide" for text under an absolutely positioned
   layer that covers more than a quarter of it. So the layer is a grid item
   in a zero-height first row that hangs down over the label's row.

```css
.page {
  --cut-br: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%);
  --cut-tr: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, 0 100%);
}
.btn {
  --fill: var(--invert); --h: 52px; --pad: 28px;
  position: relative; isolation: isolate;
  display: inline-grid; grid-template-columns: auto auto;
  grid-template-rows: 0 calc(var(--h) - 6px); align-items: center;
  padding: 3px var(--pad);
  background-color: var(--fill); background-clip: content-box;   /* the measurable fill */
  color: var(--ink-on-invert);
  font: 700 13px/1 var(--sans); letter-spacing: 0.04em; text-transform: uppercase;
  text-decoration: none; white-space: nowrap;
}
.btn::before {                                                   /* the cut shape */
  content: ""; grid-area: 1 / 1 / 2 / -1; align-self: start; z-index: -1;
  height: var(--h); margin: -3px calc(-1 * var(--pad)) 0;
  background: var(--fill); clip-path: var(--cut-br);
}
/* Outlined: ink under ground inset by 1 px, same polygon. */
.btn--line { --fill: var(--ground); color: var(--ink); }
.btn--line::before { background: var(--ink); }
.btn--line::after {
  content: ""; grid-area: 1 / 1 / 2 / -1; align-self: start; z-index: -1;
  height: calc(var(--h) - 2px); margin: -2px calc(1px - var(--pad)) 0;
  background: var(--fill);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut) + 0.6px),
                     calc(100% - var(--cut) + 0.6px) 100%, 0 100%);
}
.page a:focus-visible, .page button:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.page .band a:focus-visible { outline-color: var(--ink-on-invert); }
```

The label is a single text node. The exam's wrap check counts the text boxes
inside any `.btn`, so a child `<span>` or an inline SVG arrow reads as a
wrapped label; draw the arrow as a `clip-path` shape on `::after` (which the
outlined variant cannot also have, since both its pseudo-elements are
layers).

**Mutation-tested.** With `clip-path` put on `.btn` itself, the exam fails
with `trap:cut-never-clips-the-focus-ring 13 element(s); clip-path must be
none`. The exam's own keyboard check passed that broken page: it reads the
outline's style, not whether it is clipped, so this trap is the only thing
that catches it.

**The spec strip.** A `<dl>` whose 1 px gaps are the dividers, with a black
label cut at its top-right corner. The label's text has its own
`background-color` for the same reason the button does.

```css
.spec__strip { display: grid; grid-template-columns: minmax(0, 250px) minmax(0, 1fr);
               background: var(--panel); border: 1px solid var(--hair-lit); }
.spec__label { display: grid; isolation: isolate; margin: -1px 0 -1px -1px; }
.spec__label::before { content: ""; grid-area: 1 / 1; z-index: -1;
                       background: var(--invert); clip-path: var(--cut-tr); }
.spec__label-in { grid-area: 1 / 1; align-self: center; margin: 20px 30px 20px 24px;
                  background-color: var(--invert); color: var(--ink-on-invert); }
.spec__list { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 1px; background: var(--hair); }           /* the gaps are the dividers */
.spec__item { padding: 20px 20px 22px; background: var(--panel); }
.spec dt { font: 600 11px/1.3 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.spec__value { font: 600 16px/1.3 var(--sans); }
.spec__note  { font-size: 13px; color: var(--muted); }
```

Tracking wider than 0.04em on capitals passes the lint only on a data label
(`dt`, a table head, a stat caption). The hero's product line above the h1
is the product's name, so its selector names it (`.hero__wordmark`), and it
stays out of the lint's "kicker" rule.

Do not pull the strip up over the hero with a negative margin: axe reports
its heading as "partially overlaps other elements". Continue the hero's pale
ground behind the strip's top half as the strip section's own background:

```css
.spec { background: linear-gradient(to bottom, var(--ground-2) var(--lap), var(--ground) var(--lap)); }
```

**The angled band.** The black block is a plain rectangle that holds the
text; the slope is a separate decorative element beside it, and each tall
render box is cut on the same slope. No text is ever inside a clipped box.

```css
.band__grid { display: grid; grid-template-columns: minmax(0, 0.36fr) minmax(0, 0.64fr); --slope: 88px; }
.band__text { position: relative; padding: 48px 40px; background: var(--invert); color: var(--ink-on-invert); }
.band__slope { position: absolute; left: calc(100% - 1px); top: 0; bottom: 0; width: var(--slope);
               background: var(--invert); clip-path: polygon(0 0, 100% 0, 1px 100%, 0 100%); }
.render--tall { clip-path: polygon(var(--slope) 0, 100% 0, calc(100% - var(--slope)) 100%, 0 100%); }
```

Below 768 px the slope turns to run along the block's bottom edge. Units set
in capitals read wrongly ("MS", "MM"): keep values and units in `--sans`
sentence case wherever they appear inside a wide-caps line.

## 7. Market Shelf (Q)

**The shelf.** The track is the list itself. It scrolls by itself (touch,
wheel, keyboard); the rings beside the title only jump it. The number of
cards per screen is a custom property, and a fraction leaves a cut-off card
on small screens as the hint that the row continues.

```html
<section class="shelf" aria-labelledby="popular-h">
  <div class="shelf__head">
    <h2 id="popular-h">Popular this week</h2>
    <div class="shelf__nav"> <!-- two 44 px rings: anchors to the first and last card --> </div>
  </div>
  <ul class="shelf__track" data-fui-scroll="Popular this week" tabindex="0" aria-labelledby="popular-h">
    <li class="shelf__cell" id="popular-1"><article class="card"> … </article></li>
  </ul>
</section>
```

```css
.shelf__track {
  --per: 2.3333; --gaps: 2;                       /* a phone: two cards and a third */
  display: flex; gap: var(--shelf-gap);
  overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory;
  scrollbar-width: thin; scrollbar-color: var(--hair-lit) transparent;
}
.shelf__cell {
  display: flex; flex: 0 0 calc((100% - var(--gaps) * var(--shelf-gap)) / var(--per));
  min-inline-size: 0; scroll-snap-align: start;
}
@media (min-width: 720px)  { .shelf__track { --per: 3.3333; --gaps: 3; } }
@media (min-width: 1024px) { .shelf__track { --per: 4; --gaps: 3; } }
@media (min-width: 1280px) { .shelf__track { --per: 5; --gaps: 4; } }
@media (prefers-reduced-motion: no-preference) { .shelf__track { scroll-behavior: smooth; } }
```

- `data-fui-scroll` goes on the element whose **direct children are the
  cards**: the exam measures those children against the screen width. Put it
  on the `<ul>`, not on a wrapper around it.
- `tabindex="0"` and a name (`aria-labelledby`) make the track reachable and
  scrollable with the arrow keys.
- With no script the rings are plain links to the first and last card's
  `id`. Give a shelf more cards than fit on one screen, or leave the rings
  out: at 1280 px five cards fit and the rings on the proof page do nothing.

**Mutation-tested.** With `overflow-x: hidden` on the track, the exam fails
three ways at once: the preset's `trap:shelf-scrolls-without-script`, the
exam's `scroller … overflow-x is hidden`, and `content cut off`.

**The card.** Tone only. The foot's rule is a border on an inner element
whose class does not contain "card", because the separation gate reads a
border on any `[class*=card]` as an outline.

```css
.card { position: relative; display: flex; flex-direction: column; inline-size: 100%;
        padding: var(--pad-item); border-radius: var(--r-card); background: var(--panel); }
.item__art  { inline-size: 100%; block-size: auto; aspect-ratio: 4 / 3; }
.item__name { font: 500 14px/1.4 var(--sans); }
.item__name a::after { content: ""; position: absolute; inset: 0; }   /* the whole card is the link */
.item__spec { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
              min-block-size: 2.9em; font: 400 12px/1.45 var(--sans); color: var(--muted); }
.item__foot { display: flex; align-items: flex-end; justify-content: space-between;
              margin-block-start: auto; padding-block-start: 9px; border-block-start: 1px solid var(--hair); }
.item__price { margin-inline-start: auto; font: 700 15px/1.2 var(--sans); font-variant-numeric: tabular-nums; }
.item__was   { font: 400 12px/1.3 var(--sans); color: var(--muted); text-decoration: line-through; }
```

**Stars.** An `aria-hidden` SVG in `--rating`, followed by the number as
visible text and a screen-reader phrase ("Rated 4.8 out of 5"). The filled
row is the empty row again, clipped to the score. A phone shows one star and
the number.

```css
.stars__row { fill: var(--hair-lit); }
.stars__row + .stars__row { fill: var(--rating); clip-path: inset(0 calc(100% - var(--fill, 100%)) 0 0); }
/* The bright yellow is for marks that sit on the midnight itself. A white
   card inside the band is still a light ground and keeps --rating. */
.band__rated svg, .band__rated b { fill: var(--rating-on-invert); color: var(--rating-on-invert); }
```

**The hero and its neighbours.** Three grid columns: a neighbour, the slide,
a neighbour. The neighbours are `inert` and `aria-hidden` and never wider
than `--peek`; the slide's copy is on a solid half and its picture on the
other.

```css
.hero__stage {
  display: grid; column-gap: var(--hero-gap);
  grid-template-columns: minmax(var(--peek), 1fr) minmax(0, var(--maxw)) minmax(var(--peek), 1fr);
  max-inline-size: calc(var(--maxw) + 2 * (var(--peek) + var(--hero-gap))); margin-inline: auto;
}
.slide { grid-column: 2; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
```

At 1440 px a 1320 px slide and two 80 px neighbours do not both fit: the
slide gives up width. Past about 1700 px the neighbours stop growing and sit
as two 80 px slivers; on very wide screens consider showing a second full
slide instead.

## 8. Mono Catalogue (R)

**Greyscale is a rule in the stylesheet.** Every art box carries the filter,
whatever the export looks like. The gate reads the computed value, which
must be exactly `grayscale(1)`.

```css
.hero__art, .tile__art, .product__art { filter: grayscale(1); }
```

The filter caused no trouble for the contrast checks on the proof page.
Removing it from `.product__art` fails the exam with
`trap:pictures-stay-greyscale`.

**Staggered tiles.** One grid of short rows; each tile spans five or six of
them, and the second column starts its second tile one row earlier, so the
two columns end level while every tile differs in height from its
neighbour.

```css
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
         grid-auto-rows: minmax(var(--row), auto); gap: var(--gap); }
.tiles > li { display: grid; }
.tiles > li:nth-child(1) { grid-area: 1 / 1 / span 6 / auto; }   /* tall  | short */
.tiles > li:nth-child(2) { grid-area: 1 / 2 / span 5 / auto; }
.tiles > li:nth-child(3) { grid-area: 7 / 1 / span 5 / auto; }   /* short | tall  */
.tiles > li:nth-child(4) { grid-area: 6 / 2 / span 6 / auto; }
@media (max-width: 559px) {
  .tiles { grid-template-columns: minmax(0, 1fr); grid-auto-rows: auto; }
  .tiles > li:nth-child(n) { grid-area: auto; }
}
```

**The tile.** Two rows: the words, then the picture box. The picture box is
flush with the tile's right and bottom edges, which crop it; it is in its
own row, so it can never reach the words.

```css
.tile { position: relative; display: grid; grid-template-rows: auto minmax(190px, 1fr);
        overflow: clip; border-radius: var(--r-card); background: var(--ground-2); }
.tile h3 { font: 400 22px/1.25 var(--display); letter-spacing: -0.01em; }
.tile p  { max-width: 23ch; color: var(--muted); }
.tile__link::after { content: ""; position: absolute; inset: 0; z-index: 1; }   /* the whole tile is the link */
.tile__art { justify-self: end; width: 88%; min-height: 0; filter: grayscale(1); }
```

Crop the cut-out in the artwork (export it already cut at the edge it leans
off), not only with the tile's `overflow`. On the proof page a drawing that
spilled past its tile and was merely clipped made axe report the text in the
tile below as "overlapped by another element" at 1280 px.

**The slash filter row.** A list of links with a slash drawn between items,
never typed into the text.

```css
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
           border-bottom: 1px solid var(--hair); }
.filters__list li + li::before { content: "/"; margin-inline: 9px; color: var(--muted); }
.filters__list a { display: inline-flex; align-items: center; min-height: 44px; color: var(--muted); text-decoration: none; }
.filters__list a[aria-current], .filters__list a:hover { color: var(--ink); }
```

The caps category label under a product is a data label: track it at
0.04em or less, or name its selector as one, or the lint reads it as a
decorative kicker.

## 9. What the gates check for presets N to R

Run the exam on the page; it runs `verify-preset.mjs` when the page carries
`<meta name="fui-preset" content="N">` (or O, P, Q, R). The exam's `--json`
lists problems only, so on a pass it is empty: to read the gate rows, run
`verify-preset.mjs --url … --preset N` directly.

| Preset | Separation | Its own traps |
|---|---|---|
| **N** | tone: 0 shadowed, 0 bordered surfaces | no text in `--stage-ink-2` on white; `.stage__product` overlaps no heading, sentence, link or button of the stage |
| **O** | hairline: 0 shadowed | white on the olive measures at least 4.5:1; `.fact` background alpha is 1; `.hero__photo` and `.cat__photo` overlap no words of their panel |
| **P** | hairline: 0 shadowed | `clip-path: none` on every link, button and field; `.render` overlaps no text |
| **Q** | tone: 0 shadowed, 0 bordered surfaces | no text in the bright star yellow on white; `overflow-x: auto` on every `.shelf__track` |
| **R** | tone: 0 shadowed, 0 bordered surfaces | `filter: grayscale(1)` on every art box; `.tile__art` overlaps no words of its tile |

All five also run the three showcase gates, which pass with nothing to
judge until a picture is marked `data-showcase`.

**Measured on the five proof pages** (one page per preset, drawings standing
in for photographs, each `exam: 1/1 pass`):

| Preset | Text pairs measured | Lowest contrast | Gates passed | axe undecided |
|---|---|---|---|---|
| N · Sprint Stage | 70 | 5.70:1 | 15 | 0 |
| O · Olive Outfitter | 117 | 5.01:1 | 16 | 0 |
| P · Chamfer Spec | 69 | 5.28:1 | 15 | 0 |
| Q · Market Shelf | 159 | 5.72:1 | 15 | 0 |
| R · Mono Catalogue | 62 | 5.27:1 | 15 | 0 |

**The optional lane, tested with a real file on Preset N** (a 1280 px, 89 KB
image): marked and shown 600 px wide, it passes all three showcase gates
(largest scale 0.94× at 1440 px @2×, 0.92× at 390 px @3×); marked and shown
full width, it fails `showcase-sharpness` at 2.25×; unmarked, it fails the
30 KB `asset-weight` gate.

**Three mutation tests, each failing the exam as intended:** `clip-path` on
a button (P), `overflow-x: hidden` on a shelf track (Q), the greyscale
filter removed from a product box (R). On a scratch copy of the N page, a
stage grey on white and a product under the headline each failed their trap.

**What these gates do not see.**

- **Phone-width overlap.** A geometry trap runs at one desktop width
  (1280 px). "The product moves under the copy below 768 px" is checked by
  the exam's general text-under-another-element pass at 390 px, not by the
  trap; look at the phone screenshot.
- **Text with child elements.** The colour-pairing traps and the contrast
  gate read elements whose text is their own; a coloured wrapper around
  child elements is skipped.
- **A bare `:focus-visible` rule.** The focus-ring gate wants element
  selectors (`.page a:focus-visible, .page button:focus-visible`), not
  `.page :focus-visible`.
- **Whether a picture is real.** Nothing here can tell a product photograph
  from a generated one. That rule is kept by the person building the page.
- **Radii and density.** Both are declared in `preset-gates.json` for
  reference and are not gated.
