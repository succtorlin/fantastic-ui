# Theme presets — named directions with ready token blocks

A preset is **Step 0 already written down**: a one-sentence brief, a validated
token block, and the component grammar that makes the direction read. It is a
starting position, not a skin — you still adapt it to the product, and every
gate in SKILL.md still applies.

Two rules that keep presets from becoming the costume party Shift 1 forbids:

- **One preset per application.** Mixing two is how a product ends up looking
  assembled rather than designed. Marketing pages may diverge from the app;
  screens inside one app may not.
- **Presets are token sets, not component libraries.** They fill the *roles*
  from [css-architecture.md](css-architecture.md) — ground scale, hairlines,
  ink scale, one accent, semantics, three faces. If a preset seems to need a
  role that doesn't exist, that's a conversation about the role vocabulary, not
  a local addition.

Nine of the eleven presets are **light-ground** and two are dark. That mix
matters, because the accent rule inverts between them and the inversion is the
single most useful thing in this file.

**The rule, stated once:** *white is never the accent's partner.* Every preset
here was derived from a real template, and almost all of the references broke
this in one direction or the other.

- **On light ground**, the accent is a *fill* and fails as text. Measured:
  periwinkle 2.36:1, marigold 2.07:1, terracotta 2.69:1, taupe-on-coffee
  3.80:1 — all against white or as small text. Hence the `--accent` /
  `--accent-ink` split.
- **On dark ground** it flips. Amber on near-black reads at 9.11:1 and is the
  correct color for prices, links and eyebrows — but white *on* the amber fill
  is 2.13:1. Hence `--accent` / `--on-accent`.

Either way the failure is the same pairing. Expect to need one of the two
splits in any preset you derive from a design you admire.

The clearest proof is Preset K: black on safety-yellow measures **13.75:1**,
the strongest accent pairing in this file, and it earns that by never touching
white — where the same yellow collapses to 1.43:1. A saturated accent is not
unusable; it is unusable *with white*.

---

## Preset A — "Coastal Editorial"

> Soft daylight travel platform: near-white page floating on a pale sea-grey
> backdrop, one periwinkle accent, oversized display type interrupted by
> photography, everything on generous radii.

Photography-forward and airy. Suits consumer products where the imagery is the
product — travel, hospitality, food, real-estate listings. It is the wrong
choice for dense operator tooling: the whitespace that makes it feel calm makes
a data screen feel empty.

```css
.page {
  /* ground scale — light, cool, tinted toward the accent */
  --ground:    #c9d6da;  /* page backdrop, outside the sheet     */
  --ground-2:  #eef0f2;  /* section panel nested in the sheet    */
  --panel:     #ffffff;  /* the sheet itself; cards              */
  --panel-2:   #f7f8f9;  /* input wells, subtle fills            */

  --hair:      #e3e7ea;
  --hair-lit:  #cdd5da;

  /* ink scale — near-black with a blue cast, never pure #000 */
  --ink:       #16181d;
  --ink-2:     #5a6068;  /* 6.35:1 on --panel                    */
  --muted:     #868d96;  /* captions only; fails AA under ~16px  */

  /* one accent: periwinkle. --accent is a FILL; --accent-ink is the
     readable variant for text and icons on light ground. */
  --accent:     #9aa9c9;
  --accent-ink: #55658f;  /* 5.76:1 white-on; 4.6:1 on --panel   */
  --accent-dim: rgba(154, 169, 201, 0.16);

  --up:   #2f8f6b;
  --down: #c2453a;

  --sans:    "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --display: "Archivo", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 24px;
  --r-panel: 20px;
  --r-card:  16px;
  --r-tile:  10px;
  --r-pill:  999px;
  --maxw:    1100px;
}
```

**The contrast trap, stated plainly.** The reference design puts white text on
the pale periwinkle card at **2.36:1** — a real AA failure, and the most
copyable mistake in the whole direction. Two compliant routes, both keeping the
look:

- *Preferred* — keep the pale `--accent` card and set its text to `--ink`
  (7.52:1). Preserves the airiness the direction depends on.
- *Alternative* — if the card must carry white text, darken it to `--accent-ink`
  (5.76:1). You lose some softness; say so before choosing it.

Never ship the pale-card + white-text pairing.

### Component grammar

- **Sheet-on-backdrop.** The page is a `--panel` sheet at `--r-sheet`, inset
  ~24px inside a `--ground` backdrop. This single device does most of the work;
  without it the direction reads as a generic white page.
- **Occluded display type.** Hero headline in `--display` at `clamp(48px, 9vw,
  92px)`, weight 700, tracking `-0.02em`, white, with the photo's subject
  masked *over* the lower third of the letterforms. The interruption is the
  idea — flat type on a photo is the template version of this.
- **Photo card.** `--r-card`, image fills, label block bottom-left over a
  `linear-gradient(to top, rgba(0,0,0,.65), transparent 55%)` scrim, and an
  optional frosted price chip top-right (`background: rgba(255,255,255,.85);
  backdrop-filter: blur(8px)`). Title 14px/600, then a rating and a location
  line at 11px.
- **Feature card.** `--accent` fill, `--r-panel`, with a white `--r-tile` icon
  square at the left. Body copy at 11–12px in `--ink` (see the trap above).
- **Stat cluster.** Dark filled circle (36px) with a white glyph, big number at
  22px/700, two-line caption at 10px in `--muted`, centered.
- **Section panel.** A `--ground-2` block at `--r-panel` nested inside the
  sheet, holding a heading left and a one-sentence deck right. Page-in-page
  nesting is what gives the layout rhythm without dividers.
- **Pills.** All CTAs at `--r-pill`. Primary is `--ink` fill with `--panel`
  text; secondary is `--panel` fill with `--ink` text and a `--hair` border.

---

## Preset B — "Blueprint Mono"

> Architectural monochrome: near-black on paper white, oversized ghost
> lettering in the margins, alternating light and dark cards, photography as
> specimen plates.

High-contrast and technical. Suits construction, manufacturing, engineering,
professional services — anywhere authority matters more than warmth. It has no
accent hue at all, which is the point: with color removed, hierarchy has to
come from weight, scale and inversion. That makes it unforgiving of weak
layout, and excellent when the layout is strong.

```css
.page {
  /* ground scale — paper, no hue */
  --ground:    #ececec;  /* backdrop, carries the watermark      */
  --ground-2:  #f7f7f7;  /* nested panels                        */
  --panel:     #ffffff;
  --panel-2:   #fafafa;
  --invert:    #141414;  /* the dark card; 18.4:1 with white     */

  --hair:      #e0e0e0;
  --hair-lit:  #c9c9c9;

  --ink:       #0f0f0f;  /* 19.2:1 on --panel                    */
  --ink-2:     #6b6b6b;  /* 5.33:1 on --panel                    */
  --muted:     #9a9a9a;  /* decorative only — fails AA as text   */
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #a8a8a8;  /* 7.75:1 on --invert             */

  /* No accent. Emphasis is inversion, not color. Semantics are the only
     hues permitted, and only when they carry meaning. */
  --up:   #2f7d32;
  --down: #b3261e;

  --sans:    "Manrope", "Inter", system-ui, -apple-system, sans-serif;
  --display: "Manrope", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 28px;
  --r-panel: 24px;
  --r-card:  20px;
  --r-tile:  14px;
  --r-pill:  999px;
  --maxw:    1160px;
}
```

Every pair above clears AA by a wide margin — this direction's risk is not
contrast, it is monotony. Guard against it with scale contrast and the
light/dark alternation below, never by sneaking in a color.

### Component grammar

- **Margin watermark.** Oversized `--display` lettering, ~180px, weight 800, in
  `--hair` on `--ground`, bleeding off both page edges behind the sheet. Purely
  atmospheric — `aria-hidden`, and it must never sit under body copy.
- **Split hero.** Left `--ground-2` panel at `--r-sheet` carrying headline, deck
  and CTA; right a full-bleed photo at the same radius. Roughly 48/52. The
  seam between them is the composition.
- **Arrow pill.** Primary CTA: `--invert` fill, `--ink-on-invert` text, with a
  filled circle at the right end containing a `→`. The circle is what makes the
  button read as a control rather than a label.
- **Stat card.** White `--r-tile` square, a small circular avatar or icon chip
  overlapping the top edge, number at 28px/700, caption at 10px in `--ink-2`.
  Grouped three-up, overlapping the hero panel's lower edge.
- **Inverted feature card.** `--invert` fill, `--r-tile`, a small greyscale
  thumbnail left, title at 13px/600 in `--ink-on-invert`, description at 11px in
  `--ink-2-on-invert`.
- **Specimen card.** Photo at `--r-card` with a solid `--invert` label bar
  across the bottom holding title and price in mono. Photographs are treated as
  catalogue plates, not lifestyle shots — desaturate if the source is warm.
- **Alternating card row.** In any row of four, alternate `--panel` and
  `--invert`. This is the direction's signature rhythm and the main reason it
  doesn't read as a grey wireframe.

---

## Preset C — "Marigold Report"

> Print-grade business document: greyscale photography and near-black type on
> white pages, interrupted by solid marigold color-blocks that bleed to the
> trim edge. One accent, used structurally rather than decoratively.

A document direction, not a screen direction. Built for proposals, plans,
annual reports, pitch decks and anything that will be exported to PDF or
printed. Its rhythm comes from a strict page grid and thin rules, so it wants
real content — sparse pages expose the grid as emptiness.

```css
.page {
  --ground:    #d8d8d8;  /* the surface a page sits on (screen preview)  */
  --ground-2:  #f4f4f4;  /* tint block inside a page                     */
  --panel:     #ffffff;  /* the page                                     */
  --panel-2:   #fafafa;

  --hair:      #dcdcdc;  /* thin rules do the dividing; no shadows       */
  --hair-lit:  #b8b8b8;

  --ink:       #1a1a1a;  /* 8.42:1 on --accent, 16.1:1 on --panel        */
  --ink-2:     #4a4a4a;  /* 8.86:1 on --panel                            */
  --muted:     #8c8c8c;  /* captions, page furniture                     */

  --accent:     #f5a32a;  /* FILL ONLY — see the trap below              */
  --accent-ink: #9c5c10;  /* 5.31:1 white-on; use when white text is required */
  --accent-dim: rgba(245, 163, 42, 0.14);

  --up:   #2f7d32;
  --down: #b3261e;

  --sans:    "Poppins", "Montserrat", system-ui, -apple-system, sans-serif;
  --display: "Poppins", "Montserrat", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;   /* pages have square corners; this is print          */
  --r-panel: 0px;
  --r-card:  4px;
  --r-tile:  999px; /* icon discs                                        */
  --maxw:    794px; /* A4 at 96dpi                                       */
}
```

**The trap.** White text on `--accent` measures **2.07:1** — the reference does
this in its pull-quote panels and it is the worst pairing in the whole
direction. Marigold is a *fill*: put `--ink` on it (8.42:1). If a block truly
needs white type, drop to `--accent-ink` and accept the darker, less sunny
result.

### Component grammar

- **Bleed block.** Solid `--accent` panel running off the page edge, carrying a
  pull-quote or a section title in `--ink`. This is the direction's signature —
  color as architecture, never as a highlighter.
- **Outlined numeral.** Table-of-contents and step numbers set at ~44px in
  `--display`, weight 700, `-webkit-text-stroke: 1px var(--accent)` with
  transparent fill. Reads as a printed folio.
- **Caps section head.** ALL-CAPS, 13px, tracking `0.14em`, `--ink`, with a
  1px `--hair` rule beneath spanning the column.
- **Icon disc.** 34px `--r-tile` circle, `--ink` fill, white glyph. Used in
  service lists and stat rows; never more than one per row item.
- **Comparison table.** Header row in `--accent-dim`, hairline row separators,
  checkmarks in `--accent-ink`, and a single highlighted column at
  `--accent-dim` to mark "us".
- **Page furniture.** Every page carries a footer rule, a page number and a
  running title at 9px in `--muted`. Omitting it breaks the document illusion
  faster than any type choice.

---

## Preset D — "Atelier Warm"

> Interior-design studio deck: oat-cream ground, deep coffee ink, condensed
> display type at poster scale, and imagery arranged as a moodboard rather than
> illustrated.

Gallery-like and tactile. Suits interiors, architecture, fashion, craft, food —
work where material and texture *are* the argument. It has no bright accent at
all; warmth comes from the ground itself. The direction depends on good
photography and dies without it.

```css
.page {
  --ground:    #e6dccd;  /* deeper oat, section bands                    */
  --ground-2:  #efe6da;  /* the default slide ground                     */
  --panel:     #f7f2ea;  /* cards lifted off the ground                  */
  --panel-2:   #ffffff;  /* specimen tiles, swatch chips                 */
  --invert:    #473c33;  /* coffee — cover, bands, footers               */

  --hair:      #d9cdba;
  --hair-lit:  #c2b39c;

  --ink:       #473c33;  /* 8.66:1 on --ground-2                         */
  --ink-2:     #5c5046;  /* 6.32:1 on --ground-2                         */
  --muted:     #8a7a6a;  /* DECORATIVE ONLY — 3.35:1, never body copy    */
  --ink-on-invert:   #efe6da;  /* 8.66:1 on --invert                     */
  --ink-2-on-invert: #c9b9a6;  /* large text only on --invert            */

  --up:   #5c7a52;
  --down: #a85a4a;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Archivo Condensed", "Oswald", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 14px;
  --r-panel: 12px;
  --r-card:  8px;
  --r-tile:  4px;
  --r-pill:  999px;
  --maxw:    1280px;
}
```

**The trap.** `--muted` is a *material* tone, not a text tone: 3.35:1 on the
cream ground. The reference uses it for tiny annotation labels, which fails.
Body and label copy take `--ink-2`; reserve `--muted` for rules, dividers and
swatch borders.

### Component grammar

- **Split cover.** `--invert` panel left carrying condensed display type at
  `clamp(44px, 7vw, 88px)`, weight 700, tracking `-0.01em`, in
  `--ink-on-invert`; full-bleed photograph right. Roughly 55/45.
- **Micro-caps label.** 9px, tracking `0.18em`, uppercase, `--ink-2`. Every
  slide carries one top-left and a project name top-right. This repeated
  furniture is what makes a deck feel bound rather than assembled.
- **Swatch grid.** Flat color chips at `--r-tile` in a tight grid, each with a
  micro-caps name beneath. No shadows, no gradients — a swatch that looks lit
  stops reading as a material sample.
- **Moodboard collage.** Images at mixed sizes on a 12-column grid with
  deliberate gutters, some overlapping by 8–16px. Overlap is what separates a
  moodboard from a photo grid.
- **Annotated specimen.** Object photo with hairline leader lines to micro-caps
  labels. Lines are `--hair-lit`, 1px, never arrowed.
- **Product tile.** `--panel` card, object on flat ground, name at 11px in
  `--ink`, price at 10px in `--ink-2`. Tiles sit in rows of 3–5.

---

## Preset E — "Terracotta Commerce"

> Warm-white furniture storefront: soft-shadowed cards floating over lifestyle
> photography, terracotta calls-to-action, and a dark timber band anchoring the
> page.

The one direction here that uses **shadows instead of hairlines** — deliberately.
Retail wants objects that feel liftable, and a hairline card reads as a
specification while a shadowed card reads as merchandise. Suits e-commerce,
marketplaces and product catalogues. It is the wrong choice for anything
analytical, where the softness reads as imprecision.

```css
.page {
  --ground:    #faf7f4;  /* warm white page                              */
  --ground-2:  #f1ece7;  /* alternating section band                     */
  --panel:     #ffffff;  /* product and feature cards                    */
  --panel-2:   #f7f3ef;
  --invert:    #3b2a1e;  /* timber band                                  */

  --hair:      #e8e0d8;
  --hair-lit:  #d6cabd;

  --ink:       #2b2724;  /* 13.87:1 on --ground                          */
  --ink-2:     #6b625c;  /* 5.58:1 on --ground                           */
  --muted:     #9a908a;

  --accent:     #d98b5f;  /* FILL — see the trap                         */
  --accent-ink: #9c5329;  /* 5.70:1 white-on; the compliant CTA          */
  --accent-dim: rgba(217, 139, 95, 0.14);

  --up:   #4a7a52;
  --down: #b3453a;

  --sans:    "DM Sans", "Inter", system-ui, -apple-system, sans-serif;
  --display: "Fraunces", "DM Serif Display", Georgia, ui-serif, serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Shadows replace hairlines here. Warm-tinted, never neutral grey —
     a cool shadow on a warm ground looks like a rendering error. */
  --lift-1: 0 1px 2px rgba(59, 42, 30, 0.06), 0 4px 12px rgba(59, 42, 30, 0.05);
  --lift-2: 0 2px 4px rgba(59, 42, 30, 0.07), 0 12px 28px rgba(59, 42, 30, 0.09);

  --r-sheet: 0px;
  --r-panel: 12px;
  --r-card:  8px;
  --r-pill:  999px;
  --maxw:    1200px;
}
```

**The trap.** White on `--accent` is **2.69:1** — the reference's "Explore More"
and "Shop Now" buttons all fail. Either put `--ink` on the terracotta fill
(6.47:1), or use `--accent-ink` for a white-label button (5.70:1). The second
is usually right for a primary CTA, where white type carries more authority.

### Component grammar

- **Overlapping feature row.** Three `--panel` cards at `--r-panel` with
  `--lift-2`, pulled up ~64px so they straddle the hero's lower edge. The
  overlap is the device; sitting them below the hero loses the whole effect.
- **Serif display over photography.** Headline in `--display` at
  `clamp(34px, 5vw, 56px)`, weight 400–500, `--ink`, set on the light side of a
  lifestyle photo. The serif against a sans UI is what keeps it from reading as
  a generic template.
- **Product card.** `--panel`, `--r-card`, `--lift-1`, image on flat ground,
  title 14px/600 `--ink`, one-line description 12px `--ink-2`, and a
  full-width pill CTA at the base.
- **Timber band.** Full-bleed `--invert` section using a real wood or texture
  photograph at low luminance, carrying white cards. Anchors the page bottom and
  breaks an otherwise uniformly pale scroll.
- **Pill CTA.** `--r-pill`, `--accent-ink` fill with white label, or `--accent`
  fill with `--ink`. Height 40px, horizontal padding 20px.

---

## Preset F — "Midnight Showroom"

> Near-black luxury retail: one amber accent, all-caps display type, cut-out
> product photography floating on the dark, and oversized ghost lettering
> behind the content column.

Dark and product-led. Suits vehicles, watches, spirits, equipment hire — any
catalogue where the object is the hero and the ground exists to make it glow.

**Not to be confused with the worked example in SKILL.md**, which shares the
dark ground and the amber accent but is a *data* direction: monospace numerals,
live charts, semantic up/down. Midnight Showroom has no data grammar at all.
Pick this one when the page sells an object; pick the worked example when it
reports a number.

```css
.page {
  --ground:    #0d0d0d;
  --ground-2:  #141414;
  --panel:     #1a1a1a;
  --panel-2:   #212121;
  --watermark: #1c1c1c;  /* 1.14:1 — decorative ONLY, never behind copy */

  --hair:      #262626;
  --hair-lit:  #3a3a3a;

  --ink:       #ffffff;  /* 19.6:1 on --ground                          */
  --ink-2:     #b8b8b8;  /* 9.80:1                                      */
  --muted:     #7a7a7a;  /* 4.53:1 — passes, but only just; not <13px   */

  /* On a dark ground the accent IS a text color — 9.11:1. Its FILL still
     needs dark ink; white on amber is 2.13:1. See the inverted trap below. */
  --accent:      #f2a02d;
  --accent-fill: #f2a02d;
  --on-accent:   #141414;  /* 8.63:1 on the amber fill                  */
  --accent-dim:  rgba(242, 160, 45, 0.12);

  --up:   #4caf7d;
  --down: #e05a4a;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Archivo", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;   /* hard edges; the direction is not soft            */
  --r-panel: 0px;
  --r-card:  2px;
  --r-pill:  0px;
  --maxw:    1120px;
}
```

**The inverted trap.** Every light preset needed a *darker* accent variant to
carry text. Here it flips: amber on near-black reads at 9.11:1 and is the
correct color for prices, links and eyebrows. What fails is the **fill** —
white on amber is 2.13:1. Amber buttons take `--on-accent` (8.63:1). The
constant across every preset here is that **white is never the accent's
partner**, on any ground.

### Component grammar

- **Ghost wordmark.** Section-scale lettering (~150px, weight 800) in
  `--watermark`, sitting behind the content column and bleeding off both edges.
  At 1.14:1 it is texture, not type — `aria-hidden`, and never underneath body
  copy.
- **Cut-out product row.** Objects photographed on black and knocked out, so
  they float directly on `--ground` with no card behind them. Name, then price
  in `--accent`, then a text link with a trailing arrow. Cards would kill it —
  the absence of a container is the effect.
- **Caps display.** Headline in `--display`, uppercase, weight 800, tracking
  `-0.02em`, `clamp(34px, 6vw, 64px)`, `--ink`. Three short lines beat one long
  one in this direction.
- **Hairline button.** Primary CTA is a 1px `--accent` outline with `--accent`
  label on transparent — not a filled block. Filled amber is reserved for the
  single highest-intent action on the page (phone, submit).
- **Vertical rail.** Social or section marks in a fixed left column at 11px,
  `--muted`, one glyph per row. It frames the content column and is most of why
  the layout reads as composed rather than stacked.

---

## Preset G — "Broadcast Light"

> Media platform in daylight: white and cool-grey bands alternating with solid
> black, a floating platform bar straddling the hero, and four-up episode cards
> carrying real thumbnails.

Content-led and near-neutral — the photography supplies all the color. Suits
podcasts, publishers, video platforms, course catalogues: anywhere the page is
an index of episodes rather than an argument.

```css
.page {
  --ground:    #f5f6f8;
  --ground-2:  #eef1f7;  /* cool band, breaks long white stretches      */
  --panel:     #ffffff;
  --panel-2:   #fafbfc;
  --invert:    #111318;  /* 18.6:1 with white                           */

  --hair:      #e4e7ec;
  --hair-lit:  #cfd4dc;

  --ink:       #14161a;  /* 18.1:1 on --panel                           */
  --ink-2:     #4d545e;  /* 7.65:1 on --panel, 6.76 on --ground-2       */
  --muted:     #7b838e;  /* 3.83:1 — DECORATIVE ONLY, never body copy   */
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #a8afb8;  /* 8.40:1 on --invert                    */

  /* Deliberately no chromatic accent: thumbnails are the color. Emphasis is
     the black band. Adding a hue here makes every thumbnail fight it. */
  --up:   #2f7d52;
  --down: #b3453a;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Inter", system-ui, -apple-system, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 16px;
  --r-panel: 14px;
  --r-card:  12px;
  --r-pill:  999px;
  --maxw:    1180px;
}
```

**The trap.** `--muted` is 3.83:1 — it reads fine on a mock and fails in
audit. Episode metadata, durations and dates all take `--ink-2`. Reserve
`--muted` for separators and inactive icons.

### Component grammar

- **Straddling platform bar.** A white `--r-pill` bar carrying "listen on"
  logos, positioned to overlap the hero's lower edge by roughly half its
  height. It is the page's most recognisable object and the reason the hero
  doesn't read as a stock banner.
- **Hero scrim.** Full-bleed photograph under a
  `linear-gradient(rgba(10,12,16,.55), rgba(10,12,16,.72))` wash with centred
  white display type. The wash is uniform rather than bottom-weighted, because
  the type is centred rather than baseline-aligned.
- **Four-up episode card.** `--panel`, `--r-card`, 16:9 thumbnail, two-line
  title at 13px/600 `--ink`, then a play link with a leading triangle in
  `--ink-2`. Four across on desktop, two on tablet, one on mobile.
- **Band rhythm.** Sections alternate `--panel` → `--ground-2` → `--panel` →
  `--invert`. The single black band per page does the work an accent would; a
  second one halves its force.
- **Split stat.** A large number at 30px/700 beside a one-line label, paired
  with a small avatar stack. Used once, near the fold.

---

## Preset H — "Studio Kinetic"

> Agency monochrome with motion built into the layout: pure black on
> graph-paper white, pill eyebrows, cut-out people, and process cards tilted
> along a dashed path.

The playful sibling of Blueprint Mono. Same absence of color, opposite
temperament: where Blueprint is rigid and orthogonal, this one tilts, scatters
and connects. Suits design studios, creative agencies, small consultancies —
work sold on personality as much as capability.

```css
.page {
  --ground:    #ffffff;
  --ground-2:  #f4f4f4;
  --panel:     #ffffff;
  --panel-2:   #fafafa;
  --invert:    #0a0a0a;  /* 19.8:1 with white                           */

  --hair:      #e2e2e2;
  --hair-lit:  #c8c8c8;
  --grid:      #ececec;  /* 1.18:1 — graph-paper texture, never a border */

  --ink:       #0a0a0a;  /* 19.8:1 on --panel                           */
  --ink-2:     #5c5c5c;  /* 6.69:1                                      */
  --muted:     #8a8a8a;  /* 3.45:1 — DECORATIVE ONLY                    */
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #9e9e9e;  /* 7.39:1 on --invert                    */

  --up:   #2f7d32;
  --down: #b3261e;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Archivo", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --lift: 0 2px 6px rgba(10,10,10,.06), 0 14px 34px rgba(10,10,10,.10);

  --r-sheet: 20px;
  --r-panel: 18px;
  --r-card:  16px;
  --r-pill:  999px;
  --maxw:    1160px;
}
```

**The trap.** `--muted` at 3.45:1 and `--grid` at 1.18:1 are both below AA and
both look usable in a comp. Grid lines are texture; muted is for inactive
states. All copy takes `--ink` or `--ink-2`.

### Component grammar

- **Tilted process path.** Numbered cards at `--r-card` with `--lift`, each
  rotated between −4° and +4°, joined by a dashed 1px `--hair-lit` path with
  small filled pin dots at the joints. This is the direction's whole
  personality. Two rules keep it from becoming noise: rotation never exceeds
  4°, and the reading order must survive the scatter — set them in DOM order
  and let CSS do the tilting, so a screen reader gets 01→04 regardless.
- **Pill eyebrow.** Section labels as a `--r-pill` outline chip — 1px `--hair`
  border, 11px, `--ink-2`, e.g. "About us", "How we work". Every section gets
  one; it is the page's connective tissue.
- **Graph-paper ground.** A 24px `--grid` grid, `background-image` on
  `--ground`, faded out behind dense text with a radial mask. Texture only.
- **Cut-out people.** Subjects knocked out of their background and placed to
  overlap panel edges, with a hard drop shadow. Full-bleed photography would
  make this a different direction entirely.
- **Black capability grid.** A single `--invert` section holding a 3×2 grid of
  bordered tiles, each with a small glyph, title and two lines. One black block
  per page — it is the counterweight to all the white.
- **Asterisk mark.** A six-point star used sparingly beside headlines. One per
  section at most; it is punctuation, not decoration.

---

## Preset I — "Campus Bright"

> Course marketplace that alternates: white sections and near-black sections
> trading places down the page, a soft yellow used to highlight one word per
> headline and to fill every call-to-action.

Friendly and dense. Suits course marketplaces, bootcamps, membership sites,
community platforms — pages that must list a lot of items and stay warm doing
it. The band alternation is what carries a long page; a single-ground version
of this direction reads as an endless scroll.

```css
.page {
  --ground:    #ffffff;
  --ground-2:  #f7f7f8;
  --panel:     #ffffff;
  --panel-2:   #fbfbfc;
  --invert:    #141414;  /* the alternating dark band                    */

  --hair:      #e8e8ea;
  --hair-lit:  #d2d2d6;

  --ink:       #1c1c1c;  /* 15.9:1 on --panel, 10.26:1 on --accent       */
  --ink-2:     #55585e;  /* 7.13:1 on --panel                            */
  --muted:     #8b8f96;
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #b9bcc2;  /* 9.68:1 on --invert                     */

  /* Soft yellow. On light it is a FILL only (1.66:1 as text — unusable).
     On the dark band it becomes a text colour at 11.09:1. */
  --accent:      #f7c13b;
  --on-accent:   #1c1c1c;  /* 10.26:1 — every yellow pill takes this      */
  --accent-dim:  rgba(247, 193, 59, 0.16);

  --up:   #2f7d52;
  --down: #c33b30;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Poppins", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 18px;
  --r-panel: 16px;
  --r-card:  14px;
  --r-pill:  999px;
  --maxw:    1180px;
}
```

**The trap.** Yellow text on white is **1.66:1** — the single worst pairing
anywhere in this file, and tempting because the reference sets a highlighted
word in it. That highlight only works over the dark hero scrim (11.09:1). On a
white section, highlight by weight or by an `--accent-dim` marker-pen
background behind `--ink`, never by colouring the type.

### Component grammar

- **Highlight word.** One word per headline in `--accent`, and only on a dark
  or scrimmed ground. It is the direction's signature and its main hazard.
- **Band alternation.** White → dark → white → dark down the page, each band
  full-bleed. Roughly every third section is dark; more than that and the
  yellow stops registering.
- **Yellow pill.** Every CTA is `--accent` fill with `--on-accent` label at
  `--r-pill`. Consistency matters more than hierarchy here — learners scan for
  the yellow.
- **Course card.** `--panel`, `--r-card`, 16:9 thumbnail, category chip in
  `--accent-dim`, title at 13px/600, then a footer row with a price in `--ink`
  and a yellow pill. Three across.
- **Circular badge.** A ring-cropped photo with an `--accent` arc, overlapping
  the corner of a panel. Used once or twice per page, never in a grid.

---

## Preset J — "Charter Navy"

> Corporate aviation: deep navy grounds carrying white content cards, a single
> red reserved for action, and photography of the aircraft and the people
> flying in it.

Formal and premium without warmth. Suits aviation, marine, logistics,
insurance, private banking — categories where the buyer needs to feel the
operator is serious. The navy does the reassuring; the red does the asking.

```css
.page {
  --ground:    #ffffff;
  --ground-2:  #f4f7fa;
  --panel:     #ffffff;
  --panel-2:   #fbfcfd;
  --invert:    #0f2942;  /* navy band; 14.83:1 with white                */

  --hair:      #e2e8ef;
  --hair-lit:  #c7d2de;

  --ink:       #14283c;  /* 15.0:1 on --panel                            */
  --ink-2:     #5a6b7d;  /* 5.48:1 on --panel                            */
  --muted:     #8a99a8;
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #9fb3c8;  /* 6.89:1 on --invert                     */

  /* Red is the ACTION colour and nothing else. Note the value: the obvious
     #e23b34 gives 4.28:1 with white — just under AA. This one clears it. */
  --accent:     #d92b24;  /* 4.86:1 with white                           */
  --on-accent:  #ffffff;
  --accent-dim: rgba(217, 43, 36, 0.10);

  --up:   #1f7a4d;
  --down: #d92b24;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Inter", system-ui, -apple-system, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 8px;
  --r-panel: 8px;
  --r-card:  6px;
  --r-pill:  4px;   /* restrained corners; this is not a consumer app    */
  --maxw:    1200px;
}
```

**Two traps, both easy to walk into.** First, `#e23b34` — the shade the eye
reaches for — measures 4.28:1 against white and fails; `--accent` above is
tuned to clear it. Second, red on the navy ground is **3.47:1**: never set red
type or red icons on a navy section. Inside navy, action is a white or
red-filled button, never coloured text.

### Component grammar

- **Navy band with inset card.** A full-bleed `--invert` section holding one
  `--panel` card or one photograph, with generous navy showing on all sides.
  The margin is the luxury signal.
- **Filled-one-of-many.** In a row of benefit cards, exactly one is `--invert`
  filled and the rest are `--panel` with a `--hair` border. Marks the
  recommended option without a badge.
- **Metric bar.** Label, then a thin `--hair` track with an `--accent` fill and
  a percentage in `--ink`, right-aligned and tabular. Three or four per block.
- **Form over photograph.** Booking panel as a `--panel` card sitting on a
  darkened image, fields at `--r-card` with `--hair` borders. The only place
  the direction allows a drop shadow.
- **Dated article card.** Thumbnail with a small `--accent` date chip in the
  top-left corner, title in `--ink`, one line of `--ink-2`. Three across.

---

## Preset K — "Dispatch Yellow"

> High-visibility service brand: safety-yellow and pure black, a checkered
> stripe borrowed from the taxi rank, and blocks of flat colour doing the work
> that photography does elsewhere.

Loud, plain-spoken and utilitarian. Suits taxi and ride services, couriers,
trades, plant hire, roadside assistance — categories that read as competent
by being unmissable rather than refined.

**This preset is the proof of the rule the whole file turns on.** Black on
safety-yellow measures **13.75:1**, the strongest accent pairing anywhere here,
and it achieves that precisely by never touching white (1.43:1). A yellow this
saturated is not a decorative choice; it is a legibility choice borrowed from
signage.

```css
.page {
  --ground:    #ffffff;
  --ground-2:  #f5f5f5;
  --panel:     #ffffff;
  --panel-2:   #fafafa;
  --invert:    #0b0b0b;  /* 19.7:1 with white                            */

  --hair:      #e6e6e6;
  --hair-lit:  #cccccc;

  --ink:       #0b0b0b;
  --ink-2:     #4f4f4f;  /* 8.19:1 on --panel                            */
  --muted:     #8f8f8f;
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #a3a3a3;  /* 7.80:1 on --invert                     */

  --accent:     #ffd400;
  --on-accent:  #0b0b0b;  /* 13.75:1 — the strongest pair in this file   */
  --accent-dim: rgba(255, 212, 0, 0.18);

  --up:   #1f7a3d;
  --down: #c62828;

  --sans:    "Inter", system-ui, -apple-system, sans-serif;
  --display: "Archivo", "Inter", system-ui, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;   /* flat blocks, square corners                       */
  --r-panel: 0px;
  --r-card:  6px;
  --r-pill:  999px;
  --maxw:    1200px;
}
```

**The trap.** White on this yellow is **1.43:1** — effectively invisible, and
the worst measured pairing in the file. Yellow blocks take `--on-accent`
without exception. If a design calls for white type over yellow, the design is
wrong, not the token.

### Component grammar

- **Checker stripe.** A 16px-tall band of alternating `--accent` and `--invert`
  squares used as a section divider, drawn with `repeating-linear-gradient`.
  Borrowed directly from a taxi rank; use it twice per page at most or it turns
  into a novelty.
- **Flat colour block.** Full-bleed `--accent` sections carrying `--on-accent`
  type and a black pill button. These replace photography as the page's
  rhythm — the direction works with almost no imagery.
- **Black form band.** An `--invert` section holding input fields at
  `--panel-2` with an `--accent` submit. The highest-intent moment on the page
  and the only place both extremes meet.
- **Icon-disc stat.** Four-up row of `--panel` cards, each with a 44px
  `--accent` circle, a large tabular number in `--ink`, and a label in
  `--ink-2`.
- **Vehicle card.** `--panel`, `--r-card`, product shot on flat ground, model
  name, a small spec table with `--hair` row rules, and a full-width button.

---

## Shared grammar (recurs across the references, reusable beyond them)

These devices carry across directions — they're structural, not stylistic, and
are the most transferable part of the references:

- **Bracket step numerals.** Numbered process steps marked with corner brackets
  (`⌐ 1 ¬`) rather than filled circles. Reads as technical annotation and works
  on any ground.
- **Circular carousel arrows, bottom-right.** A pair of 34px circles below the
  card row, right-aligned: previous outlined, next filled. Bottom-right is
  load-bearing — it puts the control where the eye lands after scanning the row.
- **Overlaid photo labels.** Title and metadata inside the image over a scrim,
  never in a caption block beneath it. Keeps cards compact and makes a grid of
  photos read as one surface.
- **Page-in-page panels.** Sections rendered as tinted rounded panels nested in
  the page sheet, one ground step apart. Replaces horizontal rules entirely.
- **Frosted chips.** Small translucent pills over imagery for price, tag or
  status, with a real `backdrop-filter` blur.

---

## Selecting a preset — the signal table

Run this from Step 0a in SKILL.md. Read the four signals off the request, score
each preset, then apply the disqualifiers — **a disqualifier removes a preset
even when every other signal matches.**

### Signals

| Signal | Values to read off the request |
|---|---|
| **Medium** | marketing page · in-app screen · document/PDF · slide deck · storefront |
| **Domain** | travel & hospitality · trades & engineering · professional services · interiors, fashion, craft, food · retail & catalogue · data & analytics |
| **Imagery** | rich lifestyle · product shots · material/texture · greyscale or stock · none available |
| **Density** | airy · medium · dense |

### Scoring

| Preset | Medium | Domain | Imagery | Density | **Disqualified when** |
|---|---|---|---|---|---|
| **A · Coastal Editorial** | marketing | travel, hospitality, listings | rich lifestyle | airy | the surface is data-dense or operator-facing |
| **B · Blueprint Mono** | marketing, in-app | trades, engineering, pro services | specimen, greyscale, none | dense | the brand needs warmth or playfulness |
| **C · Marigold Report** | document/PDF | any business subject | greyscale | dense | the output is an interactive screen |
| **D · Atelier Warm** | deck, marketing | interiors, fashion, craft, food | material/texture | medium | there is no good photography to carry it |
| **E · Terracotta Commerce** | storefront, marketing | retail, catalogue | product shots | medium | the work is analytical or precision-critical |
| **F · Midnight Showroom** | marketing, storefront | vehicles, luxury goods, hire | cut-out product on black | medium | the page reports numbers rather than sells objects |
| **G · Broadcast Light** | marketing, in-app index | podcasts, publishing, courses | episode thumbnails | medium | the page must argue a position, not list content |
| **H · Studio Kinetic** | marketing | studios, agencies, consultancies | cut-out people | medium | the subject is formal, regulated or safety-critical |
| **I · Campus Bright** | marketing, catalogue | courses, bootcamps, membership | course thumbnails | dense | the brand is luxury, restrained or B2B-formal |
| **J · Charter Navy** | marketing, booking | aviation, marine, logistics, finance | corporate, aircraft, people | medium | the brand wants warmth or a consumer-casual voice |
| **K · Dispatch Yellow** | marketing, booking | taxi, courier, trades, plant hire | minimal or none | medium | the work is premium, understated or editorial |

Two signals is the adoption threshold. One signal is a coincidence — ask
rather than assume.

### Worked calls

- *"Landing page for a boutique hotel group, we have a photo library"* →
  marketing + hospitality + rich lifestyle = **A**, three signals, no
  disqualifier. Adopt and say so.
- *"Investor-ready business plan we'll send as a PDF"* → document + business +
  dense = **C**. Adopt.
- *"Marketing site for a structural engineering firm"* → marketing +
  engineering = **B**, two signals. Adopt.
- *"Site for a furniture brand, quite editorial, lots of styled room shots"* →
  retail pulls **E**, material photography pulls **D**. Two plausible: ask,
  and give the differentiator — E if the job is selling individual products,
  D if it is presenting a point of view.
- *"Dashboard for our logistics platform"* → in-app + dense, and A, C and E are
  all disqualified. B survives on density but has no accent to encode state.
  **No preset**: write a fresh brief, dark instrument direction.
- *"Make our admin panel less ugly"* → the codebase has tokens already. Gate 2
  stops the check before scoring: extend the existing system.

### Four of these are warm-yellow. Picking between them

C, F, I and K all read as "yellow" at a glance and are the easiest confusion in
this file. They are not interchangeable — the ground and the job separate them:

| | Ground | The yellow's job | Reach for it when |
|---|---|---|---|
| **C · Marigold** | White page | Structural blocks that bleed to trim | The output is a printed or exported document |
| **F · Amber** | Near-black | A *text* colour for prices and links | The page sells an object against darkness |
| **I · Soft yellow** | Alternating light/dark | Every CTA, plus one highlighted word | A long catalogue needs warmth and scanning cues |
| **K · Safety yellow** | White + black | Whole flat sections of colour | The brand must be unmissable, not refined |

Chroma is the fastest tell: C and I sit around 60–70% saturation and behave
like brand colour; K is near-maximum and behaves like signage. If the client
says "friendly", that is I. If they say "you can't miss us", that is K.

### If you find yourself arguing for a preset

Stop. Wanting a preset to fit is the tell that it doesn't. The cost of a fresh
brief is twenty minutes; the cost of a stretched preset is a product that looks
like a template wearing someone else's clothes, which is the failure this whole
skill exists to prevent.

## Choosing between them

| | Ground | Accent | Separation | Density | Imagery | Best for | Fails at |
|---|---|---|---|---|---|---|---|
| **A · Coastal Editorial** | Cool pale | Periwinkle | Hairline | Airy | Lifestyle | Travel, hospitality, listings | Dense operator screens |
| **B · Blueprint Mono** | Neutral paper | None | Hairline | Dense | Specimen | Trades, engineering, pro services | Warmth, playfulness |
| **C · Marigold Report** | White page | Marigold | Rule | Dense | Greyscale | Proposals, plans, reports, PDF | Interactive screens |
| **D · Atelier Warm** | Oat cream | None | Hairline | Medium | Moodboard | Interiors, fashion, craft, food | Weak photography |
| **E · Terracotta Commerce** | Warm white | Terracotta | **Shadow** | Medium | Product | E-commerce, catalogues | Analytical work |
| **F · Midnight Showroom** | Near-black | Amber | Hairline | Medium | Cut-out product | Vehicles, watches, spirits, hire | Data reporting |
| **G · Broadcast Light** | Cool white | None | Hairline | Medium | Thumbnails | Podcasts, publishers, catalogues | Argument-led pages |
| **H · Studio Kinetic** | Graph white | None | **Shadow** | Medium | Cut-out people | Studios, agencies, consultancies | Formal or regulated tone |
| **I · Campus Bright** | Alternating | Soft yellow | Hairline | Dense | Thumbnails | Courses, bootcamps, membership | Restrained or luxury tone |
| **J · Charter Navy** | Navy + white | Red | Hairline | Medium | Corporate | Aviation, marine, logistics, finance | Warmth, informality |
| **K · Dispatch Yellow** | White + black | Safety yellow | Flat block | Medium | Minimal | Taxi, courier, trades, hire | Premium or understated work |

Presets E and H use shadows for separation rather than hairlines. Both are
considered exceptions: retail wants objects that look liftable, and Studio
Kinetic's tilted cards need a cast shadow to sit above the grid. Everything
else here separates with a 1px hairline. Do not mix the two strategies inside
one application.

If neither fits, write a fresh Step 0 brief rather than bending one of these —
a preset stretched past its intent produces exactly the template output the
Anti-Template Policy exists to prevent.

## Adding a preset

1. Name the direction in one sentence, in the voice used above.
2. Fill every role in the token block. A missing role means an undesigned
   decision, which surfaces later as a one-off hex.
3. **Run the contrast matrix before writing any component spec** (script in
   [wcag-audit.md](wcag-audit.md)), in both themes if the preset ships dark and
   light. Record the passing numbers as comments beside the tokens, and state
   any pairing the direction must never use — as Preset A does.
4. Document the component grammar as *rules with reasons*, not screenshots.
   "Bottom-right because that's where the eye lands" survives a redesign;
   "arrows go here" does not.
5. Note what the direction is bad at. A preset without a stated failure mode
   will be applied somewhere it ruins.
