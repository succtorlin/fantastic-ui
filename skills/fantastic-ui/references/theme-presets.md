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
  a local addition. The one optional role the presets leave out is `--warn`
  (partial, stale, needs attention): add it only when the product has those
  states, pick it ≥40° of OKLCH hue from the accent, `--up` and `--down` where
  the palette allows, run it through the contrast matrix, and in every case
  pair warn states with an icon and a word
  ([wcag-audit.md](wcag-audit.md#the-accent-must-not-impersonate-a-semantic)).

Sixteen of the eighteen presets are **light-ground** and two are dark. That mix
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

Two presets declare the pairing instead: **L · Gallery White**, whose deep blue
carries white at 5.93:1, and **O · Olive Outfitter**, whose dark olive carries
it at 7.11:1. The rule is a contrast rule, so a preset may declare
white-on-accent when it measures ≥4.5:1, and the gate then measures it rather
than banning it.

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
  --muted:     #666d75;  /* 4.6:1 on every text ground; AA as text */

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

**Imagery.** Soft daylight interiors and destinations via `ai` (no identifiable people), the user's library via `compress`; else warm `plate --style warp` from the sea-grey ground and periwinkle.

### Component grammar

- **Sheet-on-backdrop.** The page is a `--panel` sheet at `--r-sheet`, inset
  ~24px inside a `--ground` backdrop. This single device does most of the work;
  without it the direction reads as a generic white page.
- **Occluded display type.** Hero headline in `--display` at `clamp(48px, 9vw,
  92px)`, weight 700, tracking `-0.02em`, white, with the photo's subject
  masked *over* the lower third of the letterforms. The interruption is the
  idea — flat type on a photo is the template version of this.
- **Photo card.** `--r-card`, image fills, label block bottom-left over a
  `linear-gradient(to top, color-mix(in oklab, var(--ink) 65%, transparent),
  transparent 55%)` scrim, and an optional frosted price chip top-right
  (`background: color-mix(in oklab, var(--panel) 85%, transparent);
  backdrop-filter: blur(8px)`). Both keep the original 65% and 85% alpha.
  Title 14px/600, then a rating and a location line at 11px.
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
  --ink-2:     #6b6b6b;  /* 5.33:1 on --panel, 4.51:1 on --ground */
  --muted:     #686868;  /* 4.72:1 on --ground, the darkest ground; AA as text */
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #a8a8a8;  /* 7.75:1 on --invert             */

  /* No accent. Emphasis is inversion, not color. Semantics are the only
     hues permitted, and only when they carry meaning. */
  --up:   #2d7730;  /* 4.69:1 on --ground */
  --down: #b3261e;  /* 5.53:1 on --ground */

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

Every text colour above clears AA on all four grounds. The margin is thin on
`--ground` (`--ink-2` 4.51:1, `--up` 4.69:1, `--muted` 4.72:1), so do not
lighten these three. On that ground `--ink-2` and `--muted` are the same tone
to the eye: tell secondary text from muted text by size, weight and case. This
direction's larger risk is not contrast, it is monotony. Guard against it with
scale contrast and the light/dark alternation below, never by sneaking in a
color.

**Imagery.** Specimen plates: the user's project photos via `compress`, desaturated; else `ai` greyscale material close-ups (concrete, steel, drafting paper) or `plate --style contour`. No accent, so map the plate's `accent` role to `--hair-lit`.

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
  --muted:     #5d5d5d;  /* 4.6:1 on every text ground; AA as text */

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

**Imagery.** Greyscale workplace and material photography via `compress` or `ai`; covers and dividers as `plate --style grain`. Marigold lives in the bleed blocks, never in a plate — map `accent` to `--hair-lit`.

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
all; warmth comes from the ground itself. The direction needs its photo slots
filled; `ai` material close-ups qualify.

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
  --muted:     #746455;  /* 4.6:1 on every text ground; AA as text */
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

**The trap.** The reference's muted taupe (`#8a7a6a`, 3.35:1 on the cream
ground) was a material tone used for tiny annotation labels, which fails. This
preset's `--muted` is deepened to clear 4.5:1 so labels may use it; rules,
dividers and swatch borders take `--hair` / `--hair-lit`, never a text token.

**Imagery.** Material close-ups (linen, oak, plaster, stone) in soft oat light via `ai`, the user's work via `compress`; moodboard gaps take `plate --style grain` swatches. Every photo slot is filled — empty frames are the failure mode.

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
  --muted:     #726863;  /* 4.6:1 on every text ground; AA as text */

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

**Imagery.** Product shots are the user's own via `compress` (a generated product is fake data); lifestyle rooms and the timber band via `ai`; else `plate --style warp` in warm white and terracotta.

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
  --muted:     #898989;  /* 4.6:1 on every text ground; AA as text */

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

**Imagery.** Cut-out products are the user's own via `compress`, never generated; behind the content column, `plate --style warp` in near-black and amber at `--intensity` ≤ 0.25 (text spans the plate), and it still passes the visibility gate ([ai-atmosphere.md](ai-atmosphere.md) §7).

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
  --muted:     #666d78;  /* 4.6:1 on every text ground; AA as text */
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

**The trap.** The comp's grey (`#7b838e`, 3.39:1) reads fine on a mock and
fails in audit. `--muted` here is deepened to clear 4.5:1, so episode
metadata, durations and dates may take it; separators take `--hair`.

**Imagery.** Thumbnails are the user's own via `compress`; the hero photo via `ai` mood photography (studio, equipment, no people), else `plate --style warp` in cool greys under the uniform wash.

### Component grammar

- **Straddling platform bar.** A white `--r-pill` bar carrying "listen on"
  logos, positioned to overlap the hero's lower edge by roughly half its
  height. It is the page's most recognisable object and the reason the hero
  doesn't read as a stock banner.
- **Hero scrim.** Full-bleed photograph under a
  `linear-gradient(color-mix(in oklab, var(--invert) 55%, transparent),
  color-mix(in oklab, var(--invert) 72%, transparent))` wash with centred
  white display type. It keeps the original 55% and 72% alpha. The wash is uniform rather than bottom-weighted, because
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
> graph-paper white, pill tags, cut-out people, and process cards tilted
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
  --muted:     #6f6f6f;  /* 4.6:1 on every text ground; AA as text */
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

**The trap.** `--grid` at 1.18:1 looks usable in a comp and is texture only:
never text, never an icon. `--muted` is deepened to clear 4.5:1 (the comp's
`#8a8a8a` was 3.45:1), so it may carry secondary copy.

**Imagery.** Cut-out people must be the user's own team photos via `compress` — never generated people; with none, drop the device and let `svg --style grid` (the graph-paper ground) and the tilted path carry the page.

### Component grammar

- **Tilted process path.** Numbered cards at `--r-card` with `--lift`, each
  rotated between −4° and +4°, joined by a dashed 1px `--hair-lit` path with
  small filled pin dots at the joints. This is the direction's whole
  personality. Two rules keep it from becoming noise: rotation never exceeds
  4°, and the reading order must survive the scatter — set them in DOM order
  and let CSS do the tilting, so a screen reader gets 01→04 regardless.
- **Pill tags.** Facts set as `--r-pill` outline chips — 1px `--hair` border,
  `--ink-2`, sentence case: a service, a city, a duration on a card. Never a
  section opener ("About us", "How we work" above a heading fails the deletion
  test, SKILL.md § Kickers); sections open with their headings.
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
  --muted:     #6d7177;  /* 4.6:1 on every text ground; AA as text */
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

**Imagery.** Course thumbnails are the user's own via `compress`; a missing one gets `plate --style grain` seeded by the course id — same palette, distinct texture, never a stock classroom.

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

> Corporate aviation: deep navy grounds carrying white content cards, navy
> action buttons, a single red reserved for the marks that matter, and
> photography of the aircraft and the people flying in it.

Formal and premium without warmth. Suits aviation, marine, logistics,
insurance, private banking — categories where the buyer needs to feel the
operator is serious. The navy does the reassuring and the acting; the red
marks what to look at.

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
  --muted:     #647280;  /* 4.6:1 on every text ground; AA as text */
  --ink-on-invert:   #ffffff;
  --ink-2-on-invert: #9fb3c8;  /* 6.89:1 on --invert                     */

  /* Red MARKS and never carries text: metric fills, rules, chip outlines,
     and red TEXT on white (4.86:1; the obvious #e23b34 gives 4.28:1 and
     fails). White is never the accent's partner, so this preset defines
     no on-accent ink: actions are navy, --invert with --ink-on-invert
     (14.83:1). */
  --accent:     #d92b24;  /* 4.86:1 as text on white                     */
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

**Three traps, all easy to walk into.** First, `#e23b34` — the shade the eye
reaches for — measures 4.28:1 against white and fails; `--accent` above is
tuned to clear it. Second, red on the navy ground is **3.47:1**: never set red
type or red icons on a navy section (gated: `red-type-on-navy`). Third, a
red-filled button needs white text, and white is never the accent's partner:
the primary action is a **navy** button (`--invert` fill, `--ink-on-invert`
label) on white, and a **white** button (`--panel` fill, `--ink` label) inside
navy bands. Red stays a mark.

**Imagery.** Aircraft and cabin photography from the operator's library via `compress`; sky, cloud and material mood plates via `ai` (no livery, no people); else `plate --style warp` in navy for the band.

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
- **Dated article card.** Thumbnail with a small date chip in the top-left
  corner: `--panel` fill, 1px `--accent` outline, `--accent` text (4.86:1 on
  white), never white on red. Title in `--ink`, one line of `--ink-2`. Three
  across.

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
  --muted:     #6f6f6f;  /* 4.6:1 on every text ground; AA as text */
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

**Imagery.** Flat blocks replace photography; vehicle shots are the user's own via `compress`; texture, if any, is `svg --style grain` on the black band. "None — flat-colour direction" is a valid stated reason here.

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

## Preset L — "Gallery White"

> Product-gallery minimalism: white and near-white bands, one deep blue for
> links and the single buy action, the system's own sans at display size,
> and products presented on seamless studio light — one idea per screen,
> with nothing on the page that isn't the product or the sentence about it.

Light, airy and product-led, with dark "stage" bands for the products that
want drama. Suits hardware, consumer devices, premium apps and software
launches — any page where one object or one capability is the hero and the
page's job is to let it breathe. It is Apple-*like* in its principles
(restraint, scale contrast, tone separation, studio-lit product) and owes the
company nothing else: no names, marks, product imagery or exact brand values
belong in it.

**Not Midnight Showroom.** Both sell objects. F is near-black, all-caps,
hard-edged and amber; L is white-first, sentence-case, soft-cornered and blue,
and it drops to black only for a stage band.

```css
.page {
  /* light: 17.20 / 9.53 / 5.37 on --ground; 15.66 / 8.68 / 4.89 on --ground-2 */
  --ground:    #ffffff;
  --ground-2:  #f4f4f6;   /* alternate bands and tiles — tone, not a border   */
  --panel:     #fbfbfd;
  --hair:      #d5d5da;   /* 1.46:1 — dividers inside nav/footer only        */
  --hair-lit:  #e6e6ea;

  --ink:       #1b1b1d;   /* 17.20:1 on --ground                            */
  --ink-2:     #45454a;   /* 9.53:1                                         */
  --muted:     #6a6a70;   /* 5.37:1 on white, 4.89:1 on --ground-2 — never on glass */

  --accent:      #0062c4; /* text: 5.93:1 on white, 5.39:1 on --ground-2   */
  --accent-fill: #0062c4;
  --on-accent:   #ffffff; /* 5.93:1 — the one declared white partner, see below */

  /* stage: dark bands and tiles                                            */
  --stage:        #000000;
  --stage-2:      #141416;
  --stage-ink:    #f4f4f6; /* 19.12:1 on --stage, 16.75:1 on --stage-2      */
  --stage-ink-2:  #a6a6ad; /* 8.68 / 7.60                                   */
  --stage-muted:  #86868d; /* 5.81 / 5.09                                   */
  --stage-accent: #3d9bff; /* links on the stage: 7.33 / 6.42              */

  --up:   #1a8047;   /* 4.97 on white, 4.53 on --ground-2 (was #1d8a4e: 4.38, a fail) */
  --down: #c8322a;

  /* The platform's own UI face — local only, zero downloads. On Apple
     hardware this resolves to the system SF faces; elsewhere to Segoe UI
     or Roboto. Never ship a licensed system font as a webfont.            */
  --sans:    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;
  --r-panel: 18px;
  --r-card:  28px;   /* tiles: large and soft — the corner is part of the voice */
  --r-pill:  980px;  /* buttons and chips are full pills                     */
  --maxw:    980px;  /* the reading column; tiles may run to 1260px          */
  --nav-h:   48px;
}
```

**The declared exception — white on the accent.** Every other preset here
forbids white on its accent, because every accent measured so far failed with
white (2.07–3.80:1). The rule was always about contrast, not the colour:
this blue carries white at **5.93:1**, and the white-on-blue pill *is* the
direction's buy action. L declares the pairing (`"whiteOnAccent": "declared"`
in preset-gates.json); the gate then measures it and fails anything under
4.5:1 instead of banning it. The margin is narrower than it looks: at
`#0b72e0` white is 4.67:1 and at `#1677e6` it is 4.36:1, a fail — so measure
before you lighten the accent.

**The trap is the glass.** The sticky nav is translucent with a backdrop blur.
At 72% white over a black stage band, `--muted` falls to **2.71:1**; at 80% it
is 3.35:1 and `--ink` holds at 10.71:1. So: the nav background is never under
80% opacity, carries only `--ink`, and switches to the dark glass
(`--stage` at 80%) over stage bands. Test it scrolled over the darkest band
on the page — never only at the top.

**Imagery.** Products are the user's own, knocked out or shot on seamless,
via `compress`; never generated. Behind them, the `studio` plate — seamless
studio light from the page's own tokens (`plate --style studio`, light or dark
palette) — only under the product, never behind the headline or copy. Lifestyle
or "atmosphere" `ai` images do not belong here: the studio light *is* the
atmosphere. Module recipes, CSS and the gates in
[gallery-modules.md](gallery-modules.md).

### Component grammar

- **One idea per band.** Every section is a full-width band in one tone
  (`--ground`, `--ground-2` or `--stage`), with one headline, one sentence,
  one or two actions and one product view. Bands alternate tone; nothing
  separates them but the tone change — no rules, no shadows.
- **Centred display headline, sentence case.** `--display`, weight 600,
  tracking `-0.03em`, `clamp(40px, 6vw, 80px)`, line-height 1.05, `--ink`,
  centred. Two short lines beat one long one. The centred hero is this
  preset's whole point — do not apply it to dense or analytical surfaces.
- **Pill plus chevron.** The primary action is a `--accent-fill` pill with
  `--on-accent` text; the secondary is a text link in `--accent` with a
  trailing chevron (›), never a second pill. At most one pill per band.
- **Tiles separate by tone.** Bento tiles are `--ground-2` on `--ground` (or
  `--stage-2` on `--stage`), radius `--r-card`, no border, no shadow, with the
  product bleeding off the tile's bottom edge.
- **Glass nav and a chapter strip.** A 48px translucent sticky nav, plus a
  second sticky strip for the product's own sections with a small buy pill at
  its right.
- **Spec numerals.** Large `--display` numbers at weight 600 above a small
  `--ink-2` caption, three or four across, no dividers.
- **Bad at:** data-dense screens, dashboards, tables, anything operator-facing
  — the scale and whitespace that make a product page calm make a working
  surface slow. Use it for marketing and launch pages, not inside the app.

---

## Preset M — "Folio Split"

> A white page that is an index of work: two columns of equal pale-grey
> tiles, each with a title, one sentence, tags and an arrow in the same
> top-left position, and one large, sharp image of the work filling the rest
> and running off the tile's edge — no accent colour anywhere, because all
> the colour on the page arrives in the work.

Light, airy and image-led. Suits portfolios, case-study indexes, product and
app galleries, and the home or index screen of an app whose items are visual.
It was derived from a designer's portfolio and owes that page nothing but its
structure: no names, marks, copy or project imagery belong in it.

**Not Gallery White.** Both are white, tone-separated and product-led. L gives
one object a whole full-width band, centres its type and spends a blue pill
on one buy action. M puts many things of equal standing on one screen,
aligns everything left, has no bands, no accent and no buy action: the tile
*is* the action.

```css
.page {
  /* ink 18.43 / ink-2 9.66 / muted 5.70 on --ground;
     ink 16.89 / ink-2 8.85 / muted 5.23 on --ground-2 (the tile)          */
  --ground:    #ffffff;
  --ground-2:  #f4f5f7;   /* the tile: 1.09:1 against the page — tone, not a border */
  --panel:     #ffffff;   /* tag pills on a tile, the nav pill              */
  --ground-3:  #eceef2;   /* the active nav item, pressed states            */
  --hair:      #d8dbe1;   /* 1.39:1 — the arrow ring and footer rule only   */
  --hair-lit:  #e8eaee;

  --ink:       #0e1420;   /* near-black navy: 18.43:1 on --ground           */
  --ink-2:     #3d4553;   /* 9.66:1 on white, 8.85:1 on the tile            */
  --muted:     #5f6775;   /* 5.70:1 on white, 5.23:1 on the tile, 4.91:1 on --ground-3 */
  --control:   #868d99;   /* 3.34 / 3.06 — icon strokes only (1.4.11), never text */

  /* No accent. Actions invert: ink fill, white text (18.43:1).            */
  --invert:        #0e1420;
  --ink-on-invert: #ffffff;

  --up:   #1a8047;   /* 4.97 on white, 4.56 on the tile; 4.28 on --ground-3: never there */
  --down: #c8322a;   /* 5.32 on white, 4.88 on the tile                    */

  /* The platform's own UI face at weight 800 — local only, zero downloads. */
  --sans:    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;
  --r-panel: 10px;
  --r-card:  10px;    /* tiles: a small, quiet corner — the art is the voice */
  --r-pill:  999px;   /* nav, tags, the arrow ring                          */
  --maxw:    1520px;  /* the grid's cap: past it the tiles outgrow their art */
  --gutter:  clamp(16px, 2.9vw, 34px);
  --gap:     24px;
  --tile-ratio: 14 / 15;   /* slightly taller than wide                     */
  --nav-shadow: 0 6px 24px color-mix(in oklab, var(--ink) 9%, transparent);
}
```

**The greys in the reference fail, so they were darkened.** Its subtitle, tag
labels and status note sit near `#9aa0a6`: **2.64:1** on white and 2.42:1 on
the tile. `--muted` here is the lightest grey that clears 4.5:1 on white, on
the tile *and* on the active nav item (4.91:1). The hierarchy survives because
it was never carried by faintness: weight 800 against 400 does the work. Never
set text in `--control` or `--hair`.

**The trap is the picture.** This preset's images are content, and the
skill's ≤30 KB raster rule would turn each into a smear. M therefore declares
the **showcase lane** (`"showcase"` in preset-gates.json): images marked
`data-showcase` are exempt from the 30 KB cap and held to their own gates
instead — real `alt` text, explicit dimensions, a `srcset`, no browser
upscaling at 1440 px @2× or 390 px @3×, and a weight budget per file and for
the first screen. Everything not marked stays under 30 KB. Contract, markup
and export recipe: [folio-modules.md](folio-modules.md#6-the-showcase-lane).

**Imagery.** The user's own work, never stock and never generated: captured
product screens (Playwright at `deviceScaleFactor: 3`), device shots on a
transparent ground, or photographs. Angled mockups are allowed here, and only
here, because the thing in the frame is real — a tilted frame around an
invented dashboard is still the failure SKILL.md names. Where the product
runs, prefer live HTML under a CSS 3D transform to a raster: it is sharp at
every density and weighs nothing. No atmosphere plates: the tile tone is the
backdrop.

### Component grammar

- **A split grid of equal tiles.** Two columns from 768 px, one below, a 24 px
  gap both ways, every tile `--tile-ratio`. Equal size is the statement: the
  page is an index and no entry outranks another, so the reader compares the
  work, not the frames. This is the one place the skill's ban on uniform card
  grids is lifted, and the next rule is what pays for it.
- **Variety lives in the art, never the frame.** Four compositions: a device
  at an isometric angle, a fan of flat screens at the same angle, devices
  square-on, and a full-bleed photograph or close crop. No two neighbouring
  tiles (side by side or stacked) share one, and at most one tile in four is
  full-bleed. Identical frames around
  identical thumbnails is the template this rule exists to prevent.
- **Words top-left, art below, in the same place on every tile.** Title
  (`--display`, 800, `clamp(20px, 1.9vw, 26px)`), one sentence in `--ink`
  capped near 34ch and two lines, then tags. A fixed text block lets the eye
  learn one position and then read only pictures.
- **The art runs off the tile.** It fills the lower ~60% and is cropped by at
  least one edge (the crop is baked into the export; the box stays inside the
  tile). The cropped edge says there
  is more behind it; an image floating whole inside the tile reads as a
  thumbnail in a card.
- **The tile is one link; the arrow is its signifier.** The title is the
  `<a>`, stretched over the tile with `::after`; the 40 px outlined ring with
  an arrow top-right is `aria-hidden` and answers hover and focus. One tab
  stop per tile, and a name ("Stake") a screen reader can list.
- **Tags are white pills on the tile tone.** `--panel` on `--ground-2`,
  `--muted` text at 12 px/600. They classify; they are not links unless the
  page really filters.
- **The chrome has no colour.** Navy ink, three greys, white. A status note
  ("Case study coming soon") is `--muted` text, not a badge. Anything coloured
  on the page is therefore the work.
- **A centred pill nav, the page's only shadow.** White on white has no tone
  to separate by, so the nav pill alone takes `--nav-shadow`; the active item
  is a `--ground-3` inner pill. Tiles never take a shadow or a border
  (`"separation": "tone"`).
- **A left-aligned hero with no button.** h1 at `--display` 800,
  `clamp(40px, 4.6vw, 64px)`, tracking `-0.03em`; one `--muted` line under it.
  The grid is the call to action, so the first row of tiles starts above the
  1280×800 fold.
- **Bad at:** anything whose items are not visual (articles, tables, settings),
  dense or operator-facing screens, pages that must argue a case in prose, and
  any project without sharp imagery of the work at twice the tile's width. With
  fewer than four tiles the grid reads as empty, and with blurry or invented
  art it reads as a template — use L for one hero product, G for a list.

---

## Preset N — "Sprint Stage"

> Sportswear storefront: a black first screen with a slanted, heavy headline
> and one product standing on its own reflection, then a white catalogue of
> pale-grey product tiles broken by rounded black banners — no accent colour,
> because the only colour on the page is the product.

Fast, loud and product-led. Suits sportswear, footwear, sports equipment and
any shop whose products are bright and photographed as cut-outs. It was
derived from a sports-shoe storefront and owes that page nothing but its
structure: no names, marks, slogans or product imagery belong in it.

**Not Midnight Showroom, and not Gallery White.** F is dark from top to
bottom, hard-edged and amber. L drops to black for a band but is centred,
sentence-case and calm. N is black for one screen only, then a white shop;
its type leans and shouts, and it has no accent at all.

```css
.page {
  /* light: ink 19.67 / ink-2 10.47 / muted 5.70 on --ground;
     17.59 / 9.36 / 5.10 on --ground-2 (the product tile)                   */
  --ground:    #ffffff;
  --ground-2:  #f2f2f3;   /* product tiles: 1.12:1 against the page — tone, not a border */
  --panel:     #ffffff;
  --ground-3:  #e6e6e8;   /* pressed tiles                                   */
  --hair:      #dcdcdf;   /* 1.37:1 — the footer rule and the outlined pill only */
  --hair-lit:  #ebebed;

  --ink:       #0b0b0c;
  --ink-2:     #3f3f44;
  --muted:     #66666c;   /* 5.70 on white, 5.10 on the tile, 4.58 on --ground-3 */
  --control:   #8a8a90;   /* 3.43 / 3.07 — icon strokes only (1.4.11), never text */

  /* the stage: the black first screen and the rounded black banners         */
  --stage:        #050506;
  --stage-2:      #161618;   /* a card standing on the stage                 */
  --stage-ink:    #ffffff;   /* 20.37 on --stage, 18.07 on --stage-2         */
  --stage-ink-2:  #b9b9be;   /* 10.42 / 9.25 — and 1.95:1 on white: never off the stage */
  --stage-muted:  #8f8f96;   /* 6.34 / 5.63                                  */

  /* No accent. An action takes the opposite of its ground: a white pill on
     the stage (ink text, 19.67:1), an ink pill on white (white text).       */
  --invert:        #0b0b0c;
  --ink-on-invert: #ffffff;

  --up:   #157540;   /* 5.75 on white, 5.14 on the tile                      */
  --down: #c12e26;   /* 5.70 / 5.09 — a marked-down price, always with the word */

  /* Local faces only. The display voice is weight 900, italic, uppercase:
     the system face has a true black italic (Helvetica Neue stops at bold).  */
  --sans:    "Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif;
  --display: system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", "Helvetica Neue", sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;
  --r-panel: 16px;    /* the black banner                                    */
  --r-card:  6px;     /* product tiles and photo cards: nearly square        */
  --r-pill:  999px;
  --maxw:    1180px;
  --gap:     20px;
}
```

**The trap is the grey that belongs to the stage.** `--stage-ink-2` is the
right secondary text on black (10.42:1) and is **1.95:1** on white. The page
changes ground twice in one scroll, so a class reused from the hero in a white
section fails without anyone choosing it. Stage tokens are used only on the
two black surfaces, `.stage` and `.banner`; the gate looks for that grey on
white.

**The second trap is the product over the headline.** At phone width the
product wants to slide under the type. Text over a photograph cannot be
measured, so the product box never overlaps the hero's heading, sentence or
button: below 768 px it moves under them.

**Imagery.** Cut-out products are the user's own, shot or rendered on black
for the stage and on a plain ground for the tiles; never generated. The hero
product is a showcase image (`data-showcase`, see the showcase lane below):
it is the largest thing on the page and a 30 KB file would smear it. Category
photographs (people, movement, coloured light) are the user's own or `ai`
scenes via `compress`. No atmosphere plate: the black is the atmosphere.

### Component grammar

- **A black first screen.** `.stage` is full-bleed `--stage` under a white
  nav: headline, one sentence and one pill on the left, one product on the
  right, lit from above. One product, not a carousel: on black, the product
  is the brightest thing on the screen, and a second one halves it.
- **Slanted caps for display only.** `--display`, weight 900, italic,
  uppercase, tracking `-0.02em`, `clamp(40px, 6.4vw, 84px)`, line-height
  1, as two short sentences with full stops (never under 1: capitals have no
  descenders to spare, and wrapped lines collide). The slant is the motion cue.
  It is for the h1, section titles (22–26 px) and banner titles; body text,
  captions and buttons stay upright, because slanted small type slows reading.
- **The reflection.** A second, flipped copy of the product under the first,
  faded out with a mask within 40% of its height, `aria-hidden`. It is what
  makes the product stand on a floor instead of floating in a void. It never
  reaches the copy column.
- **Rows of four tone tiles.** `--ground-2` tiles at `--r-card`, the product
  centred on the tile, the caption *under* the tile: name 13 px/700 caps, one
  `--muted` line. Four across from 1024 px, two below. The caption sits
  outside the tile so every product gets the same clean field.
- **Cut-outs and photographs alternate by row.** One row is studio cut-outs
  on tiles, the next is full-bleed photographs at the same size and radius.
  The switch between object and scene is the page's rhythm; two cut-out rows
  in a row read as a spreadsheet of shoes.
- **The rounded black banner.** A `--stage` panel at `--r-panel` inside the
  content column, not full-bleed: slanted title left, three or four products
  in a line right. It repeats the opening at small scale and breaks the white
  scroll. At most two per page.
- **A pill that answers its ground.** White pill with `--ink` text on the
  stage and banners; `--invert` pill on white. Height 44 px. Section headers
  carry one outlined "see all" pill at the right, `--hair` outline, `--ink`
  text.
- **Bad at:** quiet, formal or luxury-restrained brands, services, long
  reading, B2B, and any shop without cut-out product photography. Without a
  strong hero product the stage is an empty black box — use L for a calm
  single product and K for a brand with no photography at all.

---

## Preset O — "Olive Outfitter"

> Outdoor-lifestyle shop laid out on one rounded warm-white sheet: a hero
> panel whose photograph dissolves in from the right, small fact cards
> stacked on the picture's edge, dark-olive pills for every action, and
> rounded shapes nested inside rounded shapes all the way down the page.

Soft, warm and organised. Suits outdoor and lifestyle apparel, footwear, home
goods and wellness — shops that sell a way of living as much as an object and
have lifestyle photography to prove it. It was derived from a trainer shop
and owes that page nothing but its structure: no names, marks, copy or
imagery belong in it.

**Not Terracotta Commerce.** Both are warm retail. E floats shadowed cards
over a full-bleed photograph, sets a serif headline and anchors the page with
a dark band. O has no shadows and no dark band: it is one pale sheet of
nested rounded panels with hairline outlines, caps sans headlines, and an
olive that is dark enough to carry white.

```css
.page {
  /* ink 15.64 / ink-2 8.08 / muted 5.51 on --panel (the sheet);
     14.22 / 7.34 / 5.01 on --ground-2; 12.99 / 6.71 / 4.58 on --ground      */
  --ground:    #eceae3;   /* the desk the sheet lies on                      */
  --ground-2:  #f6f4ee;   /* hero panel, category tiles, the club band       */
  --panel:     #ffffff;   /* the sheet, product cards, fact cards            */
  --panel-2:   #efece4;   /* chips, the secondary pill (ink 13.25:1)         */
  --hair:      #e3dfd4;   /* 1.33:1 on the sheet — card and tile outlines    */
  --hair-lit:  #cfc9ba;   /* 1.65:1 — rules inside the footer                */

  --ink:       #23241e;
  --ink-2:     #4f5147;
  --muted:     #686a5e;
  --control:   #84867a;   /* 3.70 on the sheet, 3.37 on --ground-2 — input outlines and icons */

  --accent:      #565b3a;  /* olive. As text: 7.11 on the sheet, 6.47 on --ground-2 */
  --accent-fill: #565b3a;
  --on-accent:   #ffffff;  /* 7.11:1 — declared, see below                   */
  --accent-deep: #3f4329;  /* hover and pressed: white 10.26:1               */
  --accent-dim:  #e6e8d6;  /* the selected filter pill: olive text 5.72:1    */

  --up:       #3f6b3a;   /* 6.22 on the sheet, 5.66 on --ground-2            */
  --down:     #9f3526;   /* 6.97 on the sheet, 6.34 on --ground-2: a discount, as text */

  --sans:    "Avenir Next", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif;
  --display: "Avenir Next", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 28px;   /* the page itself                                      */
  --r-panel: 20px;   /* hero, category tiles, bands                          */
  --r-card:  16px;   /* product cards, fact cards                            */
  --r-pill:  999px;
  --maxw:    1240px;
  --gap:     16px;
}
```

**The declared exception — white on the olive.** Like L's blue, this accent
is dark enough to carry white: **7.11:1**. O declares the pairing
(`"whiteOnAccent": "declared"`), so the gate measures it instead of banning
it. The margin is real but not unlimited: lightened to `#6b7048` white is
5.20:1, and at `#7a7f58` it is 4.20:1, a fail. A sage or khaki that looks
"the same but fresher" is the usual way this breaks.

**The trap is words on the photograph.** The reference sets its headline on
the pale side of the hero photo and its fact cards on translucent glass. Text
whose background is a picture cannot be measured, and an automated check
reports it as undecided, which this skill counts as a failure. So the copy
column is solid `--ground-2`, the photograph is a separate box that starts
where the copy ends, and its near edge is masked to transparent so it still
seems to dissolve into the panel. Fact cards are fully opaque `--panel`.

**Imagery.** Lifestyle photographs (a person moving, pale architecture, soft
daylight) are the user's own or `ai` scenes; products are the user's own,
never generated. The hero photograph and category photographs may be showcase
images. Decorative gaps take `plate --style contour` in the sheet's own
tones.

### Component grammar

- **A sheet on a desk.** The whole page is one `--panel` sheet at
  `--r-sheet`, with a margin of `--ground` showing around it from 768 px and
  flush to the screen below. Everything inside steps the radius down: 28 →
  20 → 16 → pill. The nesting is the direction; a square corner anywhere
  inside the sheet breaks it.
- **Photo hero panel.** A `--ground-2` panel at `--r-panel`. Copy fills the
  left 46%; the photograph fills the rest and is masked at its left edge
  (`mask-image: linear-gradient(to right, transparent, var(--ink) 28%)`:
  a mask reads only alpha, and a token keeps colour literals out of the
  stylesheet). Below 768 px the photograph moves above the copy.
- **Two-tone caps headline.** `--display`, weight 700, uppercase, tracking
  `-0.01em`, `clamp(30px, 4.2vw, 56px)`, line-height 1.02. The first line is
  `--ink`, the rest `--ink-2` (8.08:1). The step in tone lets a four-line
  headline be read as a name and then a promise.
- **Fact cards on the picture's edge.** Three small opaque `--panel` cards
  stacked at the photograph's right edge, each a line icon and two lines
  (delivery, try before paying, guarantee). They answer what a buyer checks
  before buying, at the point where the eye leaves the picture. One proof
  chip (rating and count) sits bottom-right.
- **Olive pill, pale pill.** Primary: `--accent-fill` with `--on-accent` and
  a trailing arrow. Secondary: `--panel-2` pill with `--ink`. Height 44 px.
  One olive pill per panel.
- **Search with a filter rail.** A rounded search field with a round olive
  submit, and beside it one row of outlined category pills, each with a line
  icon. The rail scrolls sideways on a phone and never wraps to two rows; it is
  marked `data-fui-scroll`, and each pill has its own `--panel` fill so a
  half-scrolled pill is still a measurable surface.
- **Product cards in a row of five.** `--panel` with a 1 px `--hair` outline
  at `--r-card`: the product on a `--ground-2` plate, a 44 px heart button
  top-right, a label top-left set as coloured text and never as a filled
  chip ("New" in `--accent`, a discount in `--down` with its figure: a tinted
  pill on every other card is a halo of badges), name 12 px/700 caps, price
  15 px/700 with the old price struck in `--muted`, a rating as a star plus
  the number, and the size range. Five across at full width, a scrolling row
  below 1024 px (marked `data-fui-scroll`).
- **Category tiles, two by two.** `--ground-2` at `--r-panel` with a `--hair`
  outline: caps title, two lines, a text link with an arrow on the left; the
  photograph enters from the right behind the same mask as the hero.
- **Icon feature strip.** Six small outlined cards in one row: line icon,
  caps label, two lines. It names the product's technologies; it is not a
  place for marketing adjectives.
- **The club band.** A wide `--ground-2` panel: a tilted membership card
  drawn in CSS on the left (live art, not a raster), the offer in the middle,
  one olive pill on the right.
- **Bad at:** data-dense or analytical work, formal and regulated subjects,
  dark or aggressive brands, and shops with no lifestyle photography. The
  softness that sells a walking shoe reads as vagueness on a pricing table.

---

## Preset P — "Chamfer Spec"

> Hardware launch page in white, silver and black: wide uppercase display
> type, corners cut at 45° instead of rounded, a ruled strip of
> specifications, and the product rendered large on a pale technical
> backdrop — every claim on the page is a number with a unit.

Precise, cold and engineered. Suits gaming hardware, audio, peripherals,
components and tools — products bought on measurable performance. It was
derived from an earbuds product page and owes that page nothing but its
structure: no names, marks, copy or renders belong in it.

**Not Gallery White.** Both are white pages for one device. L is soft,
centred, sentence-case and spends a blue pill. P has no curve anywhere, sets
its type wide and in capitals, has no accent, and organises the page around
a specification table instead of around whitespace.

```css
.page {
  /* ink 19.79 / ink-2 11.17 / muted 5.82 on --ground;
     17.97 / 10.15 / 5.28 on --ground-2                                     */
  --ground:    #ffffff;
  --ground-2:  #f3f4f5;   /* feature cells, the render's backdrop            */
  --panel:     #ffffff;
  --panel-2:   #f8f8f9;
  --hair:      #d9dadd;   /* 1.40:1 — dividers between cells                 */
  --hair-lit:  #b9bbc1;   /* 1.92:1 — the spec strip's outline               */

  --ink:       #0a0a0b;
  --ink-2:     #3a3b40;
  --muted:     #63656c;
  --control:   #84868d;   /* 3.64 / 3.30 — icon strokes and input outlines, never text */

  /* No accent. Black does the work: buttons, the spec label, the angled band. */
  --invert:           #0a0a0b;
  --ink-on-invert:    #ffffff;   /* 19.79:1                                  */
  --ink-2-on-invert:  #b4b6bc;   /* 9.76:1                                   */
  --muted-on-invert:  #8e9097;   /* 6.21:1                                   */

  --up:   #1a8047;   /* 4.97 on white, 4.52 on --ground-2                    */
  --down: #c8322a;   /* 5.32 / 4.83                                          */

  /* Local faces only. Where an extended face is installed it is used; the
     system face is widened with font-stretch and a little tracking.        */
  --sans:    system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --display: "Eurostile Extended", "Eurostile", "Microgramma", "Bank Gothic", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --display-stretch: 125%;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;    /* nothing on this page is rounded                      */
  --r-panel: 0px;
  --r-card:  0px;
  --r-pill:  0px;
  --cut:     14px;   /* the chamfer: one corner cut at 45°                   */
  --maxw:    1200px;
}
```

**The trap is that the cut removes the focus ring.** The obvious way to cut
a corner is `clip-path` on the button, and `clip-path` clips the element's
own outline: the keyboard focus ring vanishes and nothing reports it. The
cut is therefore painted by a `::before` layer behind the label, and the
control itself keeps `clip-path: none`. The gate reads that property on
every link, button and field. The control also states the fill as its own
`background-color`, held inside its content box: a fill that exists only on
a pseudo-element cannot be measured, and the label's contrast then reads as
1:1. Recipe: [storefront-modules.md](storefront-modules.md#6-chamfer-spec-p).

**The second trap is the render behind the words.** The reference lets a
large numeral run across the product's technical rings. Text over a picture
cannot be measured, so renders and their ring graphics never overlap a
heading, paragraph, list item, link or button; a callout sits beside the
render.

**Imagery.** Product renders are the user's own, on a transparent or pale
ground, and are showcase images: a render this large is the page's proof.
Never generated. Behind a render, thin concentric rings and tick marks drawn
in SVG from `--hair` (`aria-hidden`) stand for a measuring instrument; they
replace atmosphere plates.

### Component grammar

- **Corners are cut, never rounded.** One corner per shape: bottom-right on
  buttons, top-right on labels, both right corners on the angled band. The
  cut is `--cut` on a `::before` layer (`clip-path: polygon(...)`); an
  outlined shape is two layers, `--ink` under `--ground` inset by 1 px. One
  corner language across the page is what makes it read as machined.
- **Wide caps display.** `--display`, weight 800, uppercase,
  `font-stretch: var(--display-stretch)`, tracking `0.02em`,
  `clamp(34px, 5.2vw, 68px)`, line-height 1. Two or three words per line.
  It is for headings and the callout numeral only: wide capitals are slow
  to read past a few words, so sentences and labels over three words use
  `--sans`.
- **Icon facts under the action.** Four line icons in a row under the hero
  button, each with a two-line caps label that contains a value ("40 ms",
  "35 hours"). They are the first proof, so each one is a number.
- **The spec strip.** A full-width strip outlined in `--hair-lit`: a black
  cut label on the left, then five columns of a `<dl>`: a `--muted` caps
  caption (11 px), the value in `--ink` (16 px/600), a `--muted` note.
  Columns are divided by `--hair`. Two columns on a phone. It sits directly
  under the first screen: the buyer's next question after "what is it" is
  "what are the numbers".
- **Callout numeral.** One very large wide numeral with its unit, beside a
  render, with a caps caption. One per page.
- **Cells, not cards.** Feature rows are four cells divided by `--hair`,
  with no gap, no fill and no shadow: a render or icon, a caps title,
  two or three lines. Dividers make it a table of parts.
- **The angled band.** An `--invert` block whose right edge is cut on a
  slope, carrying a caps title, a short paragraph and a tick list in
  `--ink-on-invert`; beside it, three tall renders cut on the same slope.
  One per page, low on the page.
- **Bad at:** warmth, lifestyle and soft consumer brands, long-form reading,
  and products with nothing to measure. With no real specifications the
  strip fills with adjectives and the direction turns into costume — use L.

---

## Preset Q — "Market Shelf"

> Multi-category marketplace: a pale blue-grey page of white product cards
> arranged as shelves that page sideways, the price as the heaviest text on
> every card, a hero whose neighbouring slides show at both edges, and one
> midnight band for the deals that end today.

Dense, plain and built for scanning. Suits electronics retailers, department
stores, marketplaces and any catalogue with many categories and hundreds of
products. It was derived from a general-merchandise shop and owes that page
nothing but its structure: no names, marks, copy or product imagery belong
in it.

**Not Campus Bright, and not Terracotta Commerce.** I is a dense catalogue
too, but of courses, with a yellow accent and alternating bands. E sells a
few objects with atmosphere and shadows. Q sells many objects with none: no
accent, no shadow, no lifestyle photography, and the same card forty times.

```css
.page {
  /* ink 14.57 / ink-2 7.56 / muted 5.15 on --ground (the aisle);
     16.17 / 8.39 / 5.72 on --panel (a card)                                */
  --ground:    #f1f3f8;   /* the aisle: pale blue-grey                       */
  --ground-2:  #e7eaf2;   /* picture plates, pressed states (muted 4.75)     */
  --panel:     #ffffff;   /* product cards, the search field: 1.11:1 on the aisle — tone */
  --panel-2:   #f7f8fb;
  --hair:      #dfe3ec;   /* 1.29:1 on a card — the rule inside a card, footer rules */
  --hair-lit:  #c8cedc;

  --ink:       #1c2030;
  --ink-2:     #474d61;
  --muted:     #5f667b;
  --control:   #77809a;   /* 3.54 on the aisle, 3.93 on a card — input outlines and arrow rings */

  /* No accent. One midnight band per page, and the same midnight for buttons. */
  --invert:           #0d1030;
  --invert-2:         #171b45;   /* a raised surface on the band             */
  --ink-on-invert:    #ffffff;   /* 18.52 / 16.42                            */
  --ink-2-on-invert:  #b3b8d0;   /* 9.42 / 8.35                              */

  --rating:           #a86500;   /* star marks on light: 4.64 on a card, 4.18 on the aisle */
  --rating-on-invert: #f5b400;   /* 10.06 on the band — and 1.84 on a card: band only */

  --up:   #17703d;   /* 6.14 on a card, 5.53 on the aisle                    */
  --down: #bd2f28;   /* 5.83 / 5.25                                          */

  --sans:    "Avenir Next", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif;
  --display: "Avenir Next", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;
  --r-panel: 8px;    /* the hero slide, promo tiles                          */
  --r-card:  6px;    /* product cards, buttons                               */
  --r-pill:  999px;  /* arrow rings only                                     */
  --maxw:    1320px;
  --gap:     16px;
}
```

**The trap is the star.** The reference's rating stars are a bright yellow
that measures **1.84:1** on a white card: on a page where a rating is one of
three facts per product, a third of the information is close to invisible.
On light grounds stars take `--rating` (4.64:1) and are always followed by
the number as text; the bright yellow is allowed on the midnight band only
(10.06:1).

**The second trap is a shelf that cannot be reached.** A sideways row built
with `overflow: hidden` and script-driven arrows shows nothing past the
fifth card when the script fails, on touch, or from the keyboard. A shelf's
track is `overflow-x: auto` with scroll snapping; the arrows only scroll it.
The gate reads that property. The track is also marked
`data-fui-scroll="<shelf name>"`: the exam otherwise reports its off-screen
cards as content cut off, and with the mark it checks instead that the track
scrolls by itself, can be reached from the keyboard, and holds no card wider
than the screen.

**Imagery.** Product shots are the user's own, many and small, on white, via
`compress` (each fits the 30 KB cap at card size). The hero slide's picture
may be a showcase image. No atmosphere plates and no lifestyle scenes: the
products are the decoration.

### Component grammar

- **Shelves, not grids.** Each category is one row of equal cards: five
  across from 1280 px, four at 1024, and on a phone two and a third, so the
  cut-off card says the row scrolls. A shelf keeps every category one row
  tall, so twelve categories fit in the scroll that a grid spends on two.
- **Arrows beside the shelf's title.** The previous and next rings sit at
  the top right of each shelf, level with its title — not below the row as
  in the shared grammar. A shelf holds more cards than fit on one screen
  (eight to twelve); a shelf whose cards all fit shows no rings. A shopper decides whether to page a shelf when they
  read its name, before they have scanned its cards.
- **The card is a price tag.** `--panel` at `--r-card`, with no border and
  no shadow: a fixed 4:3 picture area, the name (14 px/500), one `--muted`
  spec line clamped to two lines, then a foot ruled with `--hair`: rating on
  the left, price on the right at 15 px/700 (name the foot `item__foot`, not
  `card__foot`: the separation gate reads a border on any class containing
  "card" as a card outline). The price is the heaviest text
  on the card, because it is the fact the shopper compares across a shelf.
- **Search-first nav.** The wordmark, then a wide search field that takes
  the middle of the bar, then account links. With this many products the
  search field is the page's main control and is sized like it.
- **A hero that shows its neighbours.** One slide at `--r-panel`, no wider
  than `--maxw`, with up to 80 px of the previous and next slides visible at
  the edges; on a screen too narrow for both, the slide gives up width, not
  the neighbours. The copy sits on a solid half of the slide, the picture on the
  other. Neighbouring slides are `inert`; 44 px white rings on the slide's
  edges page it.
- **The midnight band.** One full-bleed `--invert` band: a title and a
  countdown on the left, a shelf of white cards on the right. The countdown
  is `--mono`, is not a live region, and the end time is also written as
  words ("Ends today at 18:00"), so the deadline survives without script.
- **Promo trio.** Three tiles of unequal width (1 : 1 : 1.4), each one
  product on a flat panel with at most one button. The wide one is the only
  place a product gets more room than a card.
- **Square buttons.** `--invert` fill, white label, `--r-card`, height
  40 px. Pills are for the arrow rings only.
- **Bad at:** brands that sell on story, luxury, anything airy, and small
  catalogues: with fewer than about fifteen products the shelves are half
  empty and the density has nothing to organise — use E or R.

---

## Preset R — "Mono Catalogue"

> Monochrome gadget shop: a white page, pale-grey tiles with very large
> corners, light-weight headlines, and every product desaturated to
> greyscale and cut out so it leans off the corner of its tile — the
> catalogue has no colour at all, including in the pictures.

Quiet, even and object-led. Suits gadgets, accessories, design objects and
small considered catalogues where shape and material are the difference
between one product and the next. It was derived from a tech-accessories
shop and owes that page nothing but its structure: no names, marks, copy or
product imagery belong in it.

**Not Folio Split, and not Gallery White.** M is an index of work with equal
tiles, heavy titles and no price. L gives one product a whole screen and
spends a blue pill. R is a shop, with prices and a filter row; its
tiles are staggered, its type is light, and it removes colour from the
pictures as well as the chrome.

```css
.page {
  /* ink 18.88 / ink-2 9.59 / muted 5.74 on --ground;
     17.32 / 8.79 / 5.27 on --ground-2 (the tile)                           */
  --ground:    #ffffff;
  --ground-2:  #f5f5f5;   /* tiles: 1.09:1 against the page — tone, not a border */
  --panel:     #ffffff;
  --ground-3:  #ebebeb;   /* pressed tiles (ink 15.84, muted 4.82)           */
  --hair:      #dcdcdc;   /* 1.37:1 — the rule under the filter row, footer rules */
  --hair-lit:  #ececec;

  --ink:       #111111;
  --ink-2:     #454545;
  --muted:     #666666;
  --control:   #888888;   /* 3.54 / 3.25 — icon strokes and the search rule, never text */

  /* No accent, and no colour in the pictures either. Actions invert.        */
  --invert:           #111111;
  --ink-on-invert:    #ffffff;   /* 18.88:1                                  */
  --ink-2-on-invert:  #b5b5b5;   /* 9.21:1                                   */

  --up:   #1a8047;   /* 4.97 on white, 4.56 on the tile                      */
  --down: #c8322a;   /* 5.32 / 4.88                                          */

  /* Local faces only, at weight 400: the voice is the lightness.            */
  --sans:    "Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif;
  --display: "Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif;
  --mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --r-sheet: 0px;
  --r-panel: 20px;   /* product tiles                                        */
  --r-card:  32px;   /* category tiles: the large corner is the voice        */
  --r-pill:  999px;
  --maxw:    1160px;
  --gap:     20px;
}
```

**The greys in the reference fail, so they were darkened.** Its body copy
and category labels sit near `#9b9b9b`: **2.78:1** on white and 2.55:1 on a
tile. `--muted` here is 5.74:1 and 5.27:1. The page stays quiet because the
quiet was never in the faintness: it is in weight 400, generous space and
the absence of colour.

**The trap is one coloured picture.** On a page with no accent, the first
product photograph left in colour becomes the accent by accident, and the
eye goes to whichever product happens to be red. Every art box carries
`filter: grayscale(1)` in CSS, even when the export is already grey: it
costs nothing and it catches the picture someone adds next year. The gate
reads the filter.

**Imagery.** Cut-out products are the user's own, on a transparent ground,
never generated, and may be showcase images. Behind the hero product, a
field of thin vertical lines drawn in SVG from `--hair` stands for fluted
glass (`aria-hidden`). No atmosphere plates and no photographs of people.

### Component grammar

- **No colour, including the pictures.** With every product grey, form is
  the only difference between two of them, which is what a catalogue of
  objects wants the shopper to compare. A sale is the word "Sale" and a
  struck price in `--muted`, not a red badge.
- **Light-weight headlines.** `--display`, weight 400, tracking `-0.02em`,
  `clamp(30px, 3.6vw, 48px)`, line-height 1.1, left-aligned, sentence case,
  two lines. Hierarchy comes from size alone; a bold headline here reads as
  shouting in a library.
- **Hero: words left, one product right.** Headline, two lines of `--ink-2`,
  then an ink pill and an outlined pill. The product stands on a pale field
  on the right with the fluted lines beside it.
- **Ink pill, outlined pill.** Primary: `--invert` with white text.
  Secondary: transparent with a 1 px `--ink` outline. Height 44 px. Never
  two ink pills side by side.
- **Staggered category tiles.** Two columns of `--ground-2` tiles at
  `--r-card`, where the left column's first tile is taller than the right's
  and the second pair reverses it. Title (22 px/400), two `--muted` lines
  and an underlined text link with an arrow sit top-left; the cut-out
  product sits bottom-right and is cropped by the tile's right and bottom
  edges. The stagger is what separates this from a grid of equal boxes.
- **Slash filter row.** Filter links separated by slashes ("All / Audio /
  Gear"), the current one in `--ink` with `aria-current`, the rest
  `--muted`; a search field with only a bottom rule at the right; one
  full-width `--hair` rule under the row. Slashes are quieter than tabs or
  chips and keep the row a line of text.
- **Product grid, three across.** A square `--ground-2` tile at `--r-panel`
  with the product centred; under it a caps category label (11 px, tracking
  `0.04em`, `--muted`), the name (18 px/400) and the price (13 px, `--ink`).
  Three across from 900 px, two below.
- **Bad at:** products sold on colour (fashion, food, cosmetics, paint),
  dense marketplaces, urgency and promotions, and long copy. If the brand
  owns a colour, this preset throws it away — use N or O.

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
| **Domain** | travel & hospitality · trades & engineering · professional services · interiors, fashion, craft, food · retail & catalogue · portfolios & case studies · data & analytics |
| **Imagery** | rich lifestyle · product shots · the user's own work at 2× · material/texture · greyscale or stock · none supplied → generate (`plate`, or `ai` for photo slots) |
| **Density** | airy · medium · dense |

### Scoring

| Preset | Medium | Domain | Imagery | Density | **Disqualified when** |
|---|---|---|---|---|---|
| **A · Coastal Editorial** | marketing | travel, hospitality, listings | rich lifestyle | airy | the surface is data-dense or operator-facing |
| **B · Blueprint Mono** | marketing, in-app | trades, engineering, pro services | specimen, greyscale, none supplied | dense | the brand needs warmth or playfulness |
| **C · Marigold Report** | document/PDF | any business subject | greyscale | dense | the output is an interactive screen |
| **D · Atelier Warm** | deck, marketing | interiors, fashion, craft, food | material/texture | medium | its photo slots can't be filled (`ai` material close-ups qualify) |
| **E · Terracotta Commerce** | storefront, marketing | retail, catalogue | product shots | medium | the work is analytical or precision-critical |
| **F · Midnight Showroom** | marketing, storefront | vehicles, luxury goods, hire | cut-out product on black | medium | the page reports numbers rather than sells objects |
| **G · Broadcast Light** | marketing, in-app index | podcasts, publishing, courses | episode thumbnails | medium | the page must argue a position, not list content |
| **H · Studio Kinetic** | marketing | studios, agencies, consultancies | cut-out people | medium | the subject is formal, regulated or safety-critical |
| **I · Campus Bright** | marketing, catalogue | courses, bootcamps, membership | course thumbnails | dense | the brand is luxury, restrained or B2B-formal |
| **J · Charter Navy** | marketing, booking | aviation, marine, logistics, finance | corporate, aircraft, people | medium | the brand wants warmth or a consumer-casual voice |
| **K · Dispatch Yellow** | marketing, booking | taxi, courier, trades, plant hire | minimal or none supplied | medium | the work is premium, understated or editorial |
| **L · Gallery White** | marketing, launch page | hardware, devices, premium apps, software launches | the user's own product shots | airy | the surface is data-dense, operator-facing, or has no product to show |
| **M · Folio Split** | marketing, portfolio, in-app index | design and product studios, freelancers, case studies, app galleries | the user's own work at 2× (screens, device shots, photographs) | airy | there is no sharp imagery of the work, the items are not visual, or there are fewer than four |
| **N · Sprint Stage** | storefront, launch page | sportswear, footwear, sports equipment | cut-out product on black, action photographs | medium | the brand is quiet, formal or restrained, or there is no cut-out product photography |
| **O · Olive Outfitter** | storefront, marketing | outdoor and lifestyle apparel, footwear, home goods, wellness | rich lifestyle plus product shots | medium | the work is analytical, or the brand is dark, loud or technical |
| **P · Chamfer Spec** | launch page, product page | gaming hardware, audio, peripherals, components, tools | the user's own product renders | medium | the product has no measurable specifications, or the brand wants warmth |
| **Q · Market Shelf** | storefront, marketplace home | multi-category retail, electronics, department stores | many small product shots on white | dense | the catalogue has fewer than about fifteen products, or the brand sells on story |
| **R · Mono Catalogue** | storefront, marketing | gadgets, accessories, design objects | cut-out product shots, desaturated | airy | colour is what the product sells (fashion, food, cosmetics), or the surface is dense |

Two signals is the recommendation threshold. One signal is a coincidence:
render it beside a stronger candidate rather than assume. "No imagery supplied" is never a disqualifier by itself:
the slots get generated per [ai-atmosphere.md](ai-atmosphere.md). Two things
generation cannot supply are the user's own products and people — E, F, H and
the five shop presets N to R need those from the user or lose that device. **M is the one preset where
missing imagery does disqualify:** its tiles are windows onto real work, and a
generated picture of work that does not exist is a fabricated proof.

### Worked calls

Each call names what Step 0a does next: render a sample set for a web page ([direction-samples.md](direction-samples.md)), or announce in one line for a document, deck or in-app screen. A user who names a preset skips both.

- *"Landing page for a boutique hotel group, we have a photo library"* →
  marketing + hospitality + rich lifestyle = **A**, three signals, no
  disqualifier. **A** is the recommended sample, rendered beside the next
  best (G or a fresh direction).
- *"Investor-ready business plan we'll send as a PDF"* → document + business +
  dense = **C**. A document, not a web page, so no samples: announce C in
  one line with a named fork.
- *"Marketing site for a structural engineering firm"* → marketing +
  engineering = **B**, two signals. Recommended sample, beside a fresh
  direction (B has no accent, so show one that does).
- *"Site for a furniture brand, quite editorial, lots of styled room shots"* →
  retail pulls **E**, material photography pulls **D**. Render both, and
  recommend by the differentiator — E if the job is selling individual
  products, D if it is presenting a point of view.
- *"Portfolio for a product designer: six case studies, device mockups and
  screens for each"* → portfolio + case studies + own work at 2× + airy =
  **M**, four signals, no disqualifier. Recommended sample, beside **L** (if
  one project deserves the whole first screen) or **G** (if the entries are
  better listed than shown).
- *"Online shop for our running-shoe brand: forty models, studio cut-outs of
  every one"* → storefront + footwear + cut-out product = **N**, three
  signals. Recommended sample, beside **O** (if the brand is calm and has
  lifestyle photography) or **R** (if it would rather be quiet than loud).
- *"Homepage for an electronics retailer with nine departments"* →
  storefront + multi-category retail + many small shots + dense = **Q**, four
  signals, no disqualifier. Recommended sample, beside **E** only if the
  range is really a few dozen products.
- *"Launch page for our new gaming headset, we have the renders and the full
  spec sheet"* → launch page + gaming hardware + own renders = **P**, three
  signals. Recommended sample, beside **L** (the calm version of the same
  job).
- *"Dashboard for our logistics platform"* → in-app + dense, and A, C and E are
  all disqualified. B survives on density but has no accent to encode state.
  **No preset**: an in-app screen, so no samples: announce a fresh brief,
  dark instrument direction, with a named fork.
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

### Eight of these sell products. Picking between them

E, F, L, N, O, P, Q and R are all shops or product pages, and five of them
are white. The number of products and the voice separate them:

| | Ground | Voice | The picture | Reach for it when |
|---|---|---|---|---|
| **E · Terracotta** | Warm white + timber band | Serif, soft shadows | Lifestyle rooms, products on cards | A small range sold with atmosphere |
| **F · Midnight** | Near-black throughout | Caps, hard edges, amber | Cut-outs floating on the dark | One luxury object category |
| **L · Gallery White** | White + black stage bands | Centred, sentence case, blue pill | One product on studio light | One product, one idea per screen |
| **N · Sprint Stage** | Black first screen, then white | Slanted heavy caps, no accent | Bright cut-outs on tiles and on black | A sports range that should feel fast |
| **O · Olive Outfitter** | Warm sheet of nested panels | Caps sans, olive pills | Lifestyle photographs fading into panels | A lifestyle range sold calmly |
| **P · Chamfer Spec** | White and silver | Wide caps, cut corners, no accent | Large renders beside numbers | One device bought on its specifications |
| **Q · Market Shelf** | Pale blue-grey aisle | Plain, dense, no accent | Many small shots on white cards | Hundreds of products in many categories |
| **R · Mono Catalogue** | White + grey tiles | Light weight, no colour anywhere | Greyscale cut-outs leaning off tiles | A small range of objects compared by form |

Count the products first. One → L or P (calm or technical). A few dozen → E,
N, O or R. Hundreds → Q. Then ask whether the brand's colour matters: if it
does, R is out; if the brand is loud, N; if it is warm, E or O.

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
| **D · Atelier Warm** | Oat cream | None | Hairline | Medium | Moodboard | Interiors, fashion, craft, food | Unfilled photo slots |
| **E · Terracotta Commerce** | Warm white | Terracotta | **Shadow** | Medium | Product | E-commerce, catalogues | Analytical work |
| **F · Midnight Showroom** | Near-black | Amber | Hairline | Medium | Cut-out product | Vehicles, watches, spirits, hire | Data reporting |
| **G · Broadcast Light** | Cool white | None | Hairline | Medium | Thumbnails | Podcasts, publishers, catalogues | Argument-led pages |
| **H · Studio Kinetic** | Graph white | None | **Shadow** | Medium | Cut-out people | Studios, agencies, consultancies | Formal or regulated tone |
| **I · Campus Bright** | Alternating | Soft yellow | Hairline | Dense | Thumbnails | Courses, bootcamps, membership | Restrained or luxury tone |
| **J · Charter Navy** | Navy + white | Red | Hairline | Medium | Corporate | Aviation, marine, logistics, finance | Warmth, informality |
| **K · Dispatch Yellow** | White + black | Safety yellow | Flat block | Medium | Minimal | Taxi, courier, trades, hire | Premium or understated work |
| **L · Gallery White** | White + black stage | Deep blue | **Tone** | Airy | Product on studio light | Devices, premium apps, launches | Dense or operator screens |
| **M · Folio Split** | White + grey tiles | None | **Tone** | Airy | The work itself, large and sharp | Portfolios, case-study indexes, app galleries | Text-led or data-dense content |
| **N · Sprint Stage** | Black stage, then white | None | **Tone** | Medium | Cut-out product, action photographs | Sportswear, footwear, sports equipment | Quiet or formal brands |
| **O · Olive Outfitter** | Warm sheet on a desk | Dark olive | Hairline | Medium | Lifestyle plus product | Outdoor, lifestyle apparel, home goods | Analytical or aggressive work |
| **P · Chamfer Spec** | White + silver | None | Hairline | Medium | Product renders | Gaming hardware, audio, components | Warmth, products with no numbers |
| **Q · Market Shelf** | Pale blue-grey aisle | None | **Tone** | Dense | Many small product shots | Marketplaces, electronics, department stores | Small ranges, brand storytelling |
| **R · Mono Catalogue** | White + grey tiles | None | **Tone** | Airy | Greyscale cut-outs | Gadgets, accessories, design objects | Products sold on colour |

Presets L, M, N, Q and R separate by **tone** alone: tiles, cards and bands
are a step lighter or darker than their ground, with neither borders nor
shadows on them. (M's nav pill is its one shadow: white on white has no tone
step to use.)

**L or M?** Both are white and product-led. One thing to show, given a whole
screen → L. Many things of equal standing, compared at a glance → M.

Presets E and H use shadows for separation rather than hairlines. Both are
considered exceptions: retail wants objects that look liftable, and Studio
Kinetic's tilted cards need a cast shadow to sit above the grid. Everything
else here separates with a 1px hairline. Do not mix the two strategies inside
one application.

If neither fits, write a fresh Step 0 brief rather than bending one of these —
a preset stretched past its intent produces exactly the template output the
Anti-Template Policy exists to prevent.


## Verifying an applied preset

`scripts/verify-preset.mjs` runs a preset's gates against a live page.
`scripts/preset-gates.json` holds the declaration for all eighteen — accent and
radii transcribed from each token block, separation from the comparison table,
traps from each direction's own trap paragraph. Change a preset here, change it
there.

```bash
node ~/.claude/skills/fantastic-ui/scripts/verify-preset.mjs \
  --url http://localhost:3000 --preset F
# with themes:  --theme-key app-theme --themes dark,light
# scoped:       --scope "#main"
```

Run it from a project that has `playwright` and `@axe-core/playwright`
installed; the script resolves them from the working directory.

**Seven universal gates** (from the disciplines, identical for every preset):
contrast in every declared theme · zero webfonts · assets ≤30 KB · reflow
320→1920 · a `:focus-visible` outline rule for every interactive element · a
`prefers-reduced-motion` block · every required token role defined.

**One advisory, never a failure:** a count of decorative imagery (`aria-hidden`
or `alt=""` images, CSS `url()` layers, `aria-hidden` SVG outside controls). At
zero it warns "state the reason in the brief" — zero is allowed with a reason;
the ≤30 KB asset gate stays hard.

**The showcase lane, for a preset that declares it (M, and N to R):** images
marked `data-showcase` leave the 30 KB gate and meet three of their own —
`showcase-markup` (real `alt`, `width`/`height`, a `srcset`, never
`aria-hidden`, lazy below the first screen), `showcase-sharpness` (no browser
upscaling at 1440 px @2× and 390 px @3×) and `showcase-weight` (per file and
for the first screen). **M requires the lane:** a Folio Split page with no
showcase image fails, because the lane is the preset. **N, O, P, Q and R
allow it** (`"required": false`): their large product photographs and renders
are content too and may be marked, while a page whose photographs have not
arrived yet still passes. On any other preset `data-showcase` changes nothing
and the 30 KB cap applies. Contract:
[folio-modules.md](folio-modules.md#6-the-showcase-lane); the shop modules
that use it: [storefront-modules.md](storefront-modules.md).

**Per-preset gates:** the accent (or, for B/D/G/H/M/N/P/Q/R, its declared absence) ·
the separation strategy — E and H separate with shadows, everything else does
not, and the file already forbids mixing the two · each direction's stated
trap, including the universal *white is never the accent's partner*. A trap
is one of four kinds: a forbidden colour pairing, a geometry rule (one thing
must not overlap another), a minimum background opacity, or a computed style
that must hold on every matching element (P: no `clip-path` on a control;
Q: a shelf's `overflow-x`; R: the greyscale filter).

**Deviations are handled.** The accent gate resolves `--accent-fill`/`--accent`
from the page and falls back to the published hex, so a stated deviation (say,
swapping F's amber for a product's own accent) is still checked — against the
colour actually used. The report prints which accent it tested and whether the
page deviates.

### What it deliberately does not check

Density and "does this read as the direction" are **not gated**. Both are
composition judgements, and a gate on either would hand back false confidence.
A green run means no gate was violated; it is not a verdict on the design.

### Gates must be mutation-tested

A gate that never fires is worse than no gate, because it reads as coverage.
When adding one, reintroduce the bug it targets and confirm it fails.

The accent gate failed exactly this test on first write: it compared against
the preset's *published* hex while the page under test used a deviating accent,
so it passed a page rendering white-on-accent at 1.52:1. Resolving the live
token fixed it. Two of three gates fired correctly on the first attempt; the
third looked correct, passed its clean run, and was silently inert.

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
