# UI mechanics — hierarchy, scale, depth

The five disciplines in SKILL.md decide **direction**. This file decides **mechanics**:
the hierarchy, spacing, type and depth decisions that make a surface read as considered
rather than assembled. Direction without mechanics looks like a good idea executed badly.

Derived from *Refactoring UI* (Adam Wathan & Steve Schoger) and from the open-source skills
built on it — see Provenance at the end. Rules are restated here **adapted to this skill's
dark, single-accent, hairline ground**; several of the book's defaults invert in that
context, and those inversions are marked **↯**.

---

## 1. Hierarchy is the whole game

If a surface feels cluttered, the problem is almost never "too much on screen" — it is that
everything is competing at the same volume.

### Three dials, in this order

1. **Color** — reach for the ink scale first. `--ink` / `--ink-2` / `--muted` already encode
   primary / secondary / tertiary. Most hierarchy problems are solved by demoting something
   to `--muted`, not by enlarging the thing you want noticed.
2. **Weight** — two weights is usually enough. Normal and one step up.
3. **Size** — last, and least. Size is the dial people reach for first and it is the bluntest.

### De-emphasise to emphasise
When something must stand out and enlarging it looks shouty, **push everything around it
down** instead. A hero number reads as huge because its label is `--muted` and small, not
because the number is 72px.

### Labels are a last resort
`Email: hello@x.com` wastes a line on a word the user can infer. Drop the label when the
value is self-evident (an email, a price, a date). Keep it when the value is ambiguous
(`Settled: 2026-10-04`). When you must keep both, the **label is the secondary element** —
label `--muted` and small, value in `--ink`. Never the reverse.

### Document hierarchy ≠ visual hierarchy
An `<h2>` does not have to look bigger than the `<h3>` under it. Choose the tag for the
outline, choose the size for the eye. A section heading that exists only for structure can
be a small uppercase mono eyebrow and still be an `<h2>`.

### Don't put grey text on a colored background ↯
Grey works on white because it blends toward the background. On a colored or tinted panel
it just looks dirty. For secondary text on a tinted surface, pick a **hue-shifted tint of
the panel's own color** — same family, lower contrast. See §4's hue-rotation move.

---

## 2. Spacing and sizing — pick a scale, then obey it

### The scale
Ad-hoc values (`13px`, `17px`, `23px`) are what makes a surface feel built by accretion.
Use a constrained scale where **adjacent steps are obviously different** — a factor around
1.5 at the small end, flattening as values grow:

```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192 · 256
```

If two values are so close you'd have to measure to tell them apart, you have one value too
many. Same rule for widths and heights.

### Start with too much white space, then remove
Designing tight-then-loosening never happens; you ship the tight version. Start deliberately
airy and take space away until it looks right. Dense is a *destination*, not a starting point
— and note this is in tension with the dense page rhythm in discipline 4: get there by
subtraction, not by starting cramped.

### Ambiguous spacing is a real bug
When a label sits midway between the field above and the field below, the eye cannot tell
what it belongs to. **Proximity is grouping.** The gap *inside* a group must be clearly
smaller than the gap *between* groups — not slightly smaller. This single fix repairs more
broken forms than any amount of restyling.

### You don't have to fill the screen
A wide viewport is not an instruction. Let a narrow column stay narrow and sit in space.
Giving a small element a huge canvas and stretching it to fit is how dashboards end up with
tables whose columns are 400px apart.

---

## 3. Type scale and text mechanics

### Hand-pick the scale
Don't generate sizes with a modular ratio and don't use `em` for the scale — nested `em`
compounds into values you never chose. Define a fixed set in `px`/`rem`:

```
12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48 · 60 · 72
```

### Line length and line height are coupled
- **Line length**: 45–75 characters for prose. Set it with `max-width` in `ch`
  (`max-width: 65ch`), not by guessing a pixel width.
- **Line height is proportional to length, not fixed.** Narrow column → tighter leading.
  Long line → looser, so the eye can find the next line. Large display type → tighter
  (1.1–1.2); small body text → looser (1.5–1.7). One global `line-height: 1.5` is wrong at
  both ends.

### Letter-spacing has exactly two jobs
- **Tighten** display sizes. Type designed for body copy is too loose when scaled up.
- **Loosen** uppercase. Caps were never spaced for setting in runs — this is why the mono
  eyebrow in discipline 2 carries ~0.22em tracking.

Otherwise leave it alone. Tracking body copy is a tell.

### Baseline, not center ↯
When two different sizes share a line — a panel title and its "View all" action — centering
them misaligns the baselines the eye is actually reading from. Use `align-items: baseline`.

### Align for readability
Centered text is for short runs only — a hero line, a card caption. Anything over ~3 lines
goes left-aligned (in LTR), because centering destroys the stable left edge the eye returns
to. Right-align numeric columns so digits line up by place value — with
`font-variant-numeric: tabular-nums`, already required by discipline 2.

---

## 4. Building the color scale in HSL

Discipline 1 says *what* to define. This is *how to pick the numbers*.

### Why HSL
Hue (degrees), saturation (%), lightness (%) are the terms your eye already uses. Two shades
of one color share a hue in HSL and look unrelated in hex. (Design tools often show **HSB**;
browsers take HSL. They are not the same — HSB S100/B100 is HSL S100/L50.)

### Build from three anchors
1. **Base** — the shade that works as a **button background**: dark enough to carry
   `--ink` text, light enough not to read as black. There is no universal lightness value;
   every hue behaves differently.
2. **Darkest** — whatever you want the darkest text of that hue to be.
3. **Lightest** — a background tint. Design a single alert panel (dark text on pale tint)
   and read both ends off it.

Fill the midpoints as visual compromises. Nine steps divides cleanly. Then nudge by eye —
and **do not add shades outside the scale later**. That is the moment the system stops being
one.

### Raise saturation at the extremes
HSL saturation weakens as lightness approaches 0% or 100%. The same S that looks vivid at
L50 looks washed at L90. **Increase saturation as lightness moves away from 50%, in both
directions.** Applies to tinted greys too — otherwise your palest and darkest greys drift
back to neutral, which is exactly what discipline 1's tinted ground is trying to avoid.

### Hue rotation: the second brightness dial
Perceived brightness is uneven across the wheel:

```
perceived = sqrt(0.299·r² + 0.587·g² + 0.114·b²) / 255
```

Local maxima at **60° (yellow), 180° (cyan), 300° (magenta)**; minima at **0° (red),
120° (green), 240° (blue)**.

- **To lighten** — rotate toward the nearest of 60 / 180 / 300.
- **To darken** — rotate toward the nearest of 0 / 120 / 240.
- **Cap total rotation at 20–30°.** Past that it reads as a different color.

This is the fix for scales built on light hues: a yellow darkened by lightness alone goes
muddy olive; rotated gradually toward orange it goes warm and rich. This is also the
mechanism behind the sodium accent's `--accent` → `--accent-hi` relationship.

### Tinted greys
True grey is S0%. Good UI greys are visibly tinted:
- **Cool** — hue ~207–210, S ~12–21%
- **Warm** — hue ~39–41, S ~12–21%

Discipline 1's "tinted toward the accent's warmth" is this rule; these are the numbers.

### Two escape hatches for contrast
- **Flip it.** White-on-color needs a very dark background to clear 4.5:1, and a page of
  dark saturated badges demands attention those elements haven't earned. Invert: **dark
  colored text on a pale tint of the same hue.** Default treatment for pills, tags, badges.
- **Rotate toward a brighter hue.** For colored text on a colored panel, raising lightness
  drives you to near-white and collapses the primary/secondary distinction. Rotate the
  text's hue toward cyan/magenta/yellow instead — you gain contrast and keep it visibly
  colored and visibly secondary.

**Thresholds:** 4.5:1 normal text. The 3:1 allowance is for **large text only** — 24px
regular or 18.66px bold. 18px regular is *normal* text and needs 4.5:1.

---

## 5. Depth — and why this skill mostly doesn't use shadows ↯

The book's depth chapter assumes a light ground. On this skill's dark ground most of it
inverts. **Read this section as the reason discipline 1 says "hairlines, not shadows,"
not as permission to add shadows.**

### What actually carries depth on a dark ground
Shadows barely register against near-black — there is no light for them to block. So:

1. **Lightness steps.** Raised = lighter. Base `--bg` → panel → raised panel, each a step up
   the ground scale. This is the primary cue.
2. **Hairlines.** Adjacent steps on a dark ramp are a *thin* cue — often under 1.3:1 — so a
   raised dark surface usually needs a 1px `--hair-lit` border to read as raised at all.
   Lightness + hairline together, not lightness alone.
3. **Overlap.** The strongest depth cue in any mode, and it costs nothing: offset a card so
   it straddles a section boundary (`margin-bottom: -60px`), or let an element break out of
   its parent on both sides. When overlapping images, give them a border in the **page
   background color** so they never clash.

**Don't push the surface further up the ramp to force the cue.** Every step up squeezes the
text sitting on it, and `--muted` is the first thing to fail contrast.

### If you are on a light ground (preset-dependent)
The light-source mechanics do apply, and they are worth knowing:

- Light comes from **above**, and people look slightly *down* at screens — so a raised
  element shows its **top** edge lit, an inset element shows its **bottom** lip lit.
- Each needs **both** halves — lit edge *and* blocked light — in one comma-separated
  `box-shadow`. Two separate `box-shadow` declarations do not combine; the second discards
  the first.
- **Two-part shadows**: a large soft *cast* shadow plus a tight *contact* shadow. They must
  differ ~3× in offset and blur or the effect is invisible. As elevation rises the contact
  shadow **fades out** — at rest it is the darker of the two; at the top of the scale it is
  gone. Keep all alphas within `.05–.25`.
- **Hand-pick the lit color** rather than overlaying semi-transparent white — white overlays
  drain saturation from the hue underneath. (On neutral grey or near-black there is no
  saturation to lose, so `hsla(0,0%,100%,.15)` is fine.)
- An inset lip must be **lighter than the element's own face**. Copying dark-surface values
  onto a near-white input paints a dark line along the bottom that reads as a stray border.
- Keep blur radii tiny. These edges are sharp in the real world.
- **Solid shadows** — vertical offset, zero blur (`0 3px 0 <ground-step>`) — lift an element
  without breaking a flat aesthetic.

---

## 6. Empty states are a designed surface, not a fallback

An empty table is the first thing many users see, and the default — a blank panel, or worse
a bare "No data" — reads as broken. Treat it as a real state with real copy:

- **Say what will appear here**, in the product's own vocabulary.
- **Give the one action** that fills it, as the primary CTA.
- **Don't reach for an illustration** to soften it. On an instrument surface, a diagram of
  the empty structure (ghosted column headers, a flat axis) is more honest and more useful.
- Distinguish **empty** (nothing yet) from **filtered to nothing** (your query excluded
  everything) from **failed** (we couldn't load it). Three different states, three different
  messages. Collapsing them is a common and expensive bug.

---

## 7. Form mechanics

- **Label above the field.** Side labels break down at narrow widths and force ragged
  alignment.
- **Group by proximity**, per §2 — related fields tighter, groups further apart.
- **Errors sit with the field**, not in a banner at the top. A banner means the user has to
  carry the error down the page and match it up themselves.
- **Never color alone.** A red border is invisible to a large minority of users — pair it
  with an icon and text.
- **The focus ring is designed, not default.** Discipline 5 already requires
  `:focus-visible` with `outline: 2px solid var(--accent); outline-offset: 3px`.
- **Inputs are inset** where the preset uses depth; on the dark ground, inset reads as a
  slightly darker face plus a `--hair` border.

---

## 8. Breaking the AI defaults

An LLM writing UI converges on the statistical average of its training data, which is
SaaS-marketing Tailwind. These are the tells, and they are the fastest way to spot a
generated surface. Discipline-level fixes already cover most; this is the checklist form.

| Default | Why it happens | Replacement |
|---|---|---|
| Purple/violet gradient backgrounds | Overrepresented in training data | Solid ground from the scale. Gradients only as a small accent, never a section |
| `rounded-2xl` / `rounded-full` everywhere | No radius decision was made | Match radius to personality: formal/technical 4–6px, consumer 8–12px. Full rounding only for avatars and pills |
| Three identical feature cards | Template reflex | Ask what the content *is*. Features may be a list; pricing a comparison table; testimonials one rotating quote. Discipline 4's bento is asymmetric for this reason |
| `shadow-lg` on everything | Elevation never decided | If everything floats, nothing is elevated. See §5 — on a dark ground, hairlines |
| Indigo as the default accent | Safe choice, no decision | Pick the hue from what the product communicates. Discipline 1: one accent, chosen |
| Hero → features → testimonials → CTA on every project | Landing-page template | A dashboard needs no hero; an internal tool needs no testimonials |
| Uniform section spacing | No rhythm decided | Vary by content relationship: related 48px, major shift 96px. The most important section gets the most room |
| Icon-per-feature-card | Icon libraries are easy | Discipline 4: every card carries a *proof artifact* — sparkline, pill row, mini-table — never a decorative icon |

**The gut check, before shipping any surface:** *if you showed this to a developer, would
they guess it was generated?* If yes, the most generic element is nearly always the color
scheme or the layout skeleton. Fix that one first.

---

## Provenance

Mechanics in §§1–5 derive from ***Refactoring UI*** by **Adam Wathan & Steve Schoger**
(refactoringui.com) — a paid book, not reproduced here. Rules are restated in this skill's
own terms and adapted to its dark single-accent ground; no text is copied.

Open-source skills consulted while compiling this, all crediting the same book:
- `s0xDk/refactoring-ui-skill` — the HSL construction, hue-rotation brightness, two-part
  shadow and dark-mode ramp material is closest to this one's treatment
- `jaywilburn/refactoring-ui-skill` (MIT) — the AI-defaults framing in §8
- `gnurio/refactoring-ui-plugin`, `edisonmbli/refactoring-ui-skill` — topic decomposition
- `erikuus/good-ui` — chapter summary

**None of this replaces the book.** If you work on UI regularly, buy it — it is one of the
few design resources written for developers in tactics rather than theory.

**↯ marks a rule that inverts on this skill's dark ground.** Where this file and the five
disciplines disagree, the disciplines win: they are the direction, this is the mechanism.
