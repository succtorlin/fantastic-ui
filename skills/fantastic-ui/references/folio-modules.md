# Folio modules — the layout kit and the showcase lane for Preset M

Preset M ("Folio Split", [theme-presets.md](theme-presets.md#preset-m--folio-split))
is an index of work: a white page, two columns of equal pale-grey tiles, words
top-left on every tile and one large, sharp picture of the work under them,
running off the tile's edge. This file is its kit: the header, the hero, the
grid, the tile, the four picture compositions, the **showcase lane** that lets
those pictures be large, and what the gates check.

It is a direction *like* a designer's portfolio, not a copy of one: no names,
marks, copy or project imagery from the reference. Bring the user's own work.

Every rule below is scoped under `.page` and uses only the preset's tokens.
The CSS is the CSS of a page that passed the exam (six tiles of real product
captures; contrast 35/35, lowest 5.23:1; largest picture scale 0.94× at
1440 px @2× and 0.73× at 390 px @3×; first screen 239 KB). The `full` tile
in §5 passed the exam in an earlier build of that page and was then replaced
by an `upright` window, because the owner had no photograph to put in it.

## 1. What the reference showed, and what was changed

Kept apart, as [visual-reference-analysis.md](visual-reference-analysis.md) asks.

| | |
|---|---|
| **Observed** | White page, ~34 px side margin. Monogram left, centred pill nav with a soft shadow and a grey inner pill on the active item, small round links right. Left-aligned h1 (~56 px, very heavy) over one grey line. Two equal columns of pale-grey tiles (~14:15), 24 px gap. Per tile: title, one sentence, white tag pills, an outlined arrow ring top-right, sometimes a grey status note; then one picture filling the lower ~60% and cropped by the tile. Pictures: a phone at an isometric angle, a fan of flat screens at that angle, upright phones, one full-bleed photograph. No colour in the chrome. |
| **Inferred** | The whole tile is the link and the arrow is its signifier. Tags classify and are not links. Hover and focus states: a still image shows none. |
| **Changed** | The greys (`~#9aa0a6`, 2.64:1) became `--muted` (5.70:1). Round social links became one inverted action. The picture box stays inside the tile and the crop is baked into the export, so nothing leaves the viewport. The photograph tile keeps the tile tone under its words. States and motion in §7 are additions. |

## 2. Header — mark, pill nav, one action

```html
<header class="wrap top">
  <a class="mark" href="/" aria-label="Brand, home">KJ</a>
  <nav class="pillnav" aria-label="Sections">
    <a href="/work" aria-current="page">Work</a><a href="/about">About</a>
  </nav>
  <a class="open" href="/contact">Get in touch</a>
</header>
```

```css
.wrap { max-width: var(--maxw); margin-inline: auto; padding-inline: var(--gutter); }
.top  { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px 16px; padding-block: 26px; }
.mark { justify-self: start; display: inline-flex; align-items: center; min-height: 44px;
        font: 800 22px/1 var(--display); letter-spacing: -0.04em; color: var(--ink); text-decoration: none; }
.pillnav   { display: flex; gap: 4px; padding: 5px; border-radius: var(--r-pill); background: var(--panel); box-shadow: var(--nav-shadow); }
.pillnav a { display: inline-flex; align-items: center; min-height: 36px; padding-inline: 20px; border-radius: var(--r-pill);
             font: 600 15px/1 var(--sans); color: var(--muted); text-decoration: none; }
.pillnav a:hover { color: var(--ink); }
.pillnav a[aria-current] { background: var(--ground-3); color: var(--ink); }
.open { justify-self: end; display: inline-flex; align-items: center; min-height: 40px; padding-inline: 18px; border-radius: var(--r-pill);
        background: var(--invert); color: var(--ink-on-invert); font: 600 15px/1 var(--sans); text-decoration: none; white-space: nowrap; }
.page a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
```

The nav pill is the page's **one shadow**. It is white on white, so there is
no tone step to separate it; the tiles have one and take neither shadow nor
border. `--muted` on the active item's `--ground-3` is 4.91:1; the active
label is `--ink` anyway. The right slot holds at most one inverted action, or
nothing: three round icon links read as decoration and cost three tab stops.

## 3. Hero — left-aligned, no button

```css
.hero    { padding-block: clamp(36px, 6.4vw, 92px) clamp(28px, 3.6vw, 50px); }
.hero h1 { margin: 0; max-width: 18ch; font: 800 clamp(40px, 4.6vw, 64px)/1.05 var(--display);
           letter-spacing: -0.03em; text-wrap: balance; }
.hero p  { margin: 14px 0 0; max-width: 44ch; text-wrap: balance; font: 400 clamp(18px, 1.9vw, 24px)/1.35 var(--sans); color: var(--muted); }
```

Who or what this is, then one line of context. No call to action: the grid
is the action, and at 1280×800 the first row's words are above the fold. Left
alignment is the point: a centred headline over a left-aligned grid is two
layouts on one page.

## 4. The grid and the tile

```html
<ul class="tiles">
  <li><article class="tile">
    <div class="tile__text">
      <h2 class="tile__title"><a href="/work/stake">Project name</a></h2>
      <p class="tile__desc">One sentence: what it is and what was done.</p>
      <ul class="tags"><li>Fintech</li><li>Startup</li></ul>
      <p class="tile__note">Case study coming soon</p>          <!-- optional -->
    </div>
    <span class="tile__go" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9h11M10 4.5 14.5 9 10 13.5"/></svg></span>
    <div class="tile__art"><img data-showcase …></div>            <!-- §6 -->
  </article></li>
</ul>
```

```css
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); margin: 0; padding: 0; list-style: none; }
.tile  { position: relative; isolation: isolate;
         display: grid; grid-template-rows: auto minmax(180px, 1fr);     /* words, then art */
         aspect-ratio: var(--tile-ratio); overflow: clip;
         border-radius: var(--r-card); background: var(--ground-2); }
.tile:has(a:focus-visible) { outline: 2px solid var(--ink); outline-offset: 3px; }

.tile__text  { padding: var(--pad) calc(var(--pad) + 56px) 22px var(--pad); }   /* --pad: clamp(18px, 2.1vw, 30px) */
.tile__title { margin: 0; font: 800 clamp(20px, 1.9vw, 26px)/1.25 var(--display); letter-spacing: -0.02em; }
.tile__title a { display: inline-block; color: inherit; text-decoration: none; }
.tile__title a::after { content: ""; position: absolute; inset: 0; z-index: 2; }   /* the tile is the link */
.tile__desc  { margin: 8px 0 0; max-width: 34ch; text-wrap: pretty; font: 400 clamp(15px, 1.25vw, 17px)/1.45 var(--sans); color: var(--ink); }
.tags    { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.tags li { padding: 7px 14px; border-radius: var(--r-pill); background: var(--panel); font: 600 12px/1 var(--sans); color: var(--muted); }
.tile__note { margin: 14px 0 0; font: 400 14px/1.4 var(--sans); color: var(--muted); }

.tile__go { position: absolute; top: calc(var(--pad) - 6px); right: calc(var(--pad) - 6px); z-index: 1;
            display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
            box-shadow: inset 0 0 0 1px var(--hair); color: var(--control); }

.tile__art     { position: relative; min-height: 0; margin-left: 8%; }
.tile__art img { position: absolute; inset: 0; display: block; width: 100%; height: 100%;
                 object-fit: cover; object-position: left top; transform-origin: left top; }
```

Four decisions carry the tile:

- **Two rows, not an overlay.** The words are row one and the art is row two,
  so the art cannot slide under the words when a title wraps (trap
  `art-never-over-the-words`). A picture placed absolutely at "38% from the
  top" would sit over the tags once a narrow tile's words wrap.
- **`overflow: clip`, not `hidden`.** With `clip` an aspect-ratio box still
  grows to fit its content, so a three-line sentence at 320 px makes the tile
  taller instead of cutting the art row to nothing. `hidden` fixes the height
  and clips the words.
- **The picture box never leaves the tile.** The "running off the edge" look
  comes from `object-fit: cover` anchored top-left and from a crop baked into
  the export. A box pushed past the tile with a negative inset can poke out of
  the viewport on a phone, which the exam treats as cut-off content.
- **One tab stop per tile.** The title is the link, stretched by `::after`;
  the arrow ring is `aria-hidden`. Keep `.tile__text` and the title
  unpositioned, or the stretched link shrinks to the text block. The link is
  `inline-block` with a 1.25 line height so its own box clears 24 px (2.5.8).

## 5. The four compositions

Variety lives in the art, so name the composition per tile and never repeat
one beside or below itself. In a two-column grid of six this works:
`angle · fan` / `upright · angle` / `fan · full`.

| Composition | What it is | Export |
|---|---|---|
| `angle` | one device or window at an isometric angle (`rotateX(55deg) rotateZ(-38deg)`, no perspective), leaving by the right and bottom edges | transparent, 6:5 |
| `fan` | two to four flat screens at the same angle, stepped up and to the right | transparent, 6:5 |
| `upright` | one or two devices square-on, a few degrees of roll, cut by the bottom edge | transparent, 6:5 |
| `full` | a photograph, or a close crop of the work, filling the whole tile | opaque, the tile's own ratio |

Rules a fresh review added, each from a defect it found on the first build:

- **Only the tile's own edge cuts a picture.** Leave the composition clear
  of the canvas top and let it leave by the right and bottom. Art that
  reaches the top of its canvas is sliced by the flat top of the art box, a
  straight line under the tags that no tile edge explains.
- **Never the same screen in two tiles.** Two tiles showing one screen at
  one angle make the whole grid read as repeats.
- **No notch over a capture.** A device frame's notch pill sits on top of
  the page's own text unless the app reserves a safe area. Draw the frame
  without one.
- **`full` is for a photograph.** A flat screenshot filling the tile swaps
  the tile's grey for the screenshot's own ground and chops its words at
  both sides; two reviewers flagged it. Show a screen `upright`, as a window
  on the tile tone, and keep `full` for a picture that has no edges.
- **The index is the page.** No band under the grid about how the page was
  made: it reads as template notes.

At most one `full` tile in four. On it the words keep the tile tone under
them and the tone fades out over the picture below:

```css
.tile--full .tile__text { grid-area: 1 / 1; background: var(--ground-2); }
.tile--full::before { content: ""; grid-area: 1 / 1; align-self: end; z-index: -1; height: 64px; transform: translateY(100%);
  background: linear-gradient(to bottom, var(--ground-2), color-mix(in oklab, var(--ground-2) 0%, transparent)); }
.tile--full .tile__art { grid-area: 1 / 1 / -1 / -1; z-index: -2; margin: 0; }
```

The ground under the words is a **solid colour**, with the gradient in a
separate layer below them. A gradient as the text block's own background
measured fine but left axe unable to decide the contrast (`incomplete`), which
the exam reports as a failure. So every tile's words sit on the same
`--ground-2`, at the same ratios, whatever the picture is.

Angled art is made from the real thing: compose the captures in an HTML page
(device frame as a rounded dark box, the capture as its `<img>`, thickness as
a stack of 1 px box-shadows, one soft cast shadow) and screenshot that page
with a transparent background. Where the product runs in the page itself, a
live element under the same transform is better still: sharp at every density
and no bytes.

## 6. The showcase lane

Everywhere else in this skill a raster is decoration: static, `aria-hidden`,
≤30 KB. Here the pictures are the content, and a 30 KB picture of an interface
is a smear. A preset opts in by declaring `"showcase"` in
`scripts/preset-gates.json`; an image opts in with `data-showcase`. Marked
images in a declaring preset leave the 30 KB gate and meet three others.
Anything unmarked, and every image on any other preset, stays under 30 KB.

```html
<img data-showcase
     src="art/run-1440.webp"
     srcset="art/run-720.webp 720w, art/run-1080.webp 1080w, art/run-1440.webp 1440w, art/run-1920.webp 1920w"
     sizes="(min-width: 768px) 50vw, 100vw"
     width="1920" height="1600"
     alt="The run page on a phone, seen at an angle: paper not accepted, 1 h 20 min, $6.65."
     loading="lazy" decoding="async">      <!-- first row: no loading attribute, fetchpriority="high" on the first -->
```

| Gate | Fails when |
|---|---|
| `showcase-markup` | no `alt` text, `aria-hidden`, no `width`/`height`, no `srcset`; `loading="lazy"` inside the first screen, or not lazy more than two screens down; or the page shows no work at all: no showcase image and no live art |
| `showcase-sharpness` | at 1440×900 @2× or 390×844 @3×, the file the browser chose has to be enlarged: rendered scale × pixel density over 1.02 |
| `showcase-weight` | at 1440 px @2×, a delivered file is over 200 KB, or the first screen's showcase files total over 600 KB; or a size cannot be measured |

**Live art.** Inside a product, the best picture of the work is the work
itself drawn small: a tile's art built in the page from the item's own data
(a run's verdict, figures and steps as a miniature of its page). Mark the art
box `data-showcase-live`. There is no file, so sharpness and weight have
nothing to measure; the mark only tells the gate the page is not empty, and
an empty marked box does not count. Keep the tile's sentence saying what the
picture shows, and hide the picture from assistive technology.

**Draw live art on a canvas, not with page elements.** A miniature built
from elements, then rotated and cut by the tile, passed every gate here and
still failed the exam: axe could not decide the contrast of about 100 pieces
of text inside it (`bgOverlap`, and `shortTextContent` for one-character
values), because rotated and clipped text is overlapped by its neighbours as
far as hit-testing can tell. A picture is a picture: paint the sheet on a
`<canvas>` from the item's data, with colours and faces read from the
tokens, sized to its box times the device pixel ratio (a still picture can
use a phone's full 3×), and repainted on resize and on a light/dark switch.
Measure the text colours once against the paper they are painted on, since
no checker will see them afterwards.

Marking a decorative image does not buy it the exemption: without real `alt`
text it stays in the 30 KB gate **and** fails `showcase-markup`.

**Sizing the export.** The picture's box is about half the viewport on desktop
and all of it on a phone. The widest box is at the `--maxw` cap (~700 px), so
1440 px wide covers @2× everywhere and @3× on a phone; 1920 px is for wider
or denser screens. Four rungs — 720, 1080, 1440, 1920 — let a 1× laptop take
a 50 KB file. `sizes` may overstate the box (50vw for a box that is 46vw); it
must never understate it, or the browser picks a file that is too small.

```bash
# 1. Capture the real screens. Phone at 3x, desktop at 2x.
#    page = browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
#    page.screenshot({ path: "captures/phone-run.png" })
# 2. Compose (§5) and screenshot the composition, transparent, 960x800 at 2x = 1920x1600:
#    page.locator(".stage").screenshot({ path: "art/run.png", omitBackground: true })
# 3. Export the rungs.
for w in 1920 1440 1080 720; do
  cwebp -quiet -q 80 -alpha_q 90 -m 6 -resize $w 0 art/run.png -o public/art/run-$w.webp
done
```

Measured on the sample: transparent compositions of interface captures at
1440 px wide came out at 77–171 KB (three dense phone screens were the
heaviest); an opaque full-tile crop of the same interface was 89 KB. AVIF is
optional: add a `<source type="image/avif">` inside a `<picture>` and the
gates measure whichever file the browser picked.

**What the gate cannot see.** A CSS transform on the image: a rotated or
zoomed raster is resampled by the compositor and the gate still reads the
untransformed box. Bake angles into the export, and keep hover zoom small
(§7 uses 1.025).

**A measuring trap, caught by the gate's own mutation test.** With a
`w`-descriptor `srcset`, `img.naturalWidth` is density-corrected: it reports
the `sizes` width, not the file's. A 1200 px file in a 300 px slot reported
300 and failed as "upscaled 2×"; a too-small file can pass the same way. The
gate loads the chosen file again on its own and reads its real pixels.

## 7. States and motion — additions, not observations

```css
.tile__go, .pillnav a, .open { transition: background-color 180ms cubic-bezier(.2,.7,.2,1), color 180ms cubic-bezier(.2,.7,.2,1); }
.tile__go svg  { display: block; transition: transform 180ms cubic-bezier(.2,.7,.2,1); }
.tile__art img { transition: transform 520ms cubic-bezier(.2,.7,.2,1); }

.tile:hover .tile__go, .tile:has(a:focus-visible) .tile__go { background: var(--invert); color: var(--ink-on-invert); box-shadow: inset 0 0 0 1px var(--invert); }
.tile:hover .tile__go svg, .tile:has(a:focus-visible) .tile__go svg { transform: translateX(2px); }
.tile:hover .tile__art img { transform: scale(1.025); }
.tile:active .tile__go { background: var(--ink-2); }

@media (prefers-reduced-motion: reduce) {
  .page *, .page *::before, .page *::after { transition: none; }
  .tile:hover .tile__art img, .tile:hover .tile__go svg, .tile:has(a:focus-visible) .tile__go svg { transform: none; }
}
```

The arrow ring fills with ink: the page's one inversion, spent on "this
opens". The picture moves toward the reader by 2.5%, from its anchored
corner. Keyboard focus gets the same ring fill plus a 2 px ink outline around
the whole tile. Nothing reveals on scroll and nothing loops: the page is
complete with JavaScript off, and needs none.

## 8. Tablet and phone

```css
@media (max-width: 1023px) {
  .tile    { aspect-ratio: 4 / 5; }      /* a narrow tile's words take more of it, so it gets taller */
}
@media (max-width: 767px) {
  .top     { grid-template-columns: minmax(0, 1fr) auto; padding-block: 16px; }
  .pillnav { grid-row: 2; grid-column: 1 / -1; justify-self: stretch; max-width: 420px; }
  .pillnav a { flex: 1 1 auto; justify-content: center; padding-inline: 8px; }   /* four short items share a 320 px row */
  .tiles   { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
```

Below 1024 px the tile goes from 14:15 to 4:5, so the art keeps about half of
it; below 768 px the grid is one column and the nav pill drops to its own row
under the mark and its items share the row. Four short items fit a 320 px
screen that way; with their desktop 20 px padding the same four overflowed
it by 46 px. Measured on the sample: at 768 px a 350 px tile gives the art
227 of its 437 px; at 390 px, 238 of 448; at 320 px the words wrap to 231 px
and the tile grows to 411 px to keep the art's 180 px minimum.

## 9. What the gates check for Preset M

`node scripts/verify-preset.mjs --url … --preset M` adds to the universal gates:

| Gate | Fails when |
|---|---|
| `separation-strategy` (tone) | any section, article, card or panel carries a box-shadow or a border |
| `accent-absent` | reported, not measured: the preset declares no accent |
| `trap:art-never-over-the-words` | a `.tile__art` overlaps a title, sentence, tag or note in a tile that is not `.tile--full` |
| `showcase-markup` · `showcase-sharpness` · `showcase-weight` | see §6 |
| `asset-weight` | any image that is **not** a showcase image is over 30 KB |

Each was mutation-tested in a browser (`scripts/showcase-gate.test.mjs`): a
blurry file, a heavy file, an unmarked heavy image, a decorative image wearing
the mark, a page with no pictures, art pulled over the words, and the same
marked page under Preset L, where the mark must change nothing.

Not gated: that neighbouring tiles differ in composition, that the pictures
are of real work, and whether the page *reads* as the direction. A green run
means no rule was broken.
