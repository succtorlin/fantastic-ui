# AI motifs — prompts for route plates

A token `plate` is the default and needs no key. When an image key exists, a
product route header gets two candidates: a token plate and an `ai` raster,
scored side by side on the same slot and scrim (`score`, or
`scripts/plate-check.js` on the page). Ship the one with the better numbers.
On one dark app, AI rasters reached 19–31% ≥1.1:1 and 8–17% ≥1.3:1 under
`header-band`, against 14–25% and 3–14% for token `warp` plates
([plate-slots.md §4](plate-slots.md#4-measured-on-one-app)).

An AI raster earns its slot by carrying a **motif**: an abstract figure that
says what the route is about, in the page's own palette. It still carries no
information (the [plate rule](ai-atmosphere.md#the-plate-rule)): no data, no
UI, no text, no people.

## 1. Domain → motif

Pick the row closest to what the route does. A motif is a figure, not a
diagram: no axes, no labels, no legible structure.

| Route is about | Motif |
|---|---|
| Crowding, concentration | particle trails converging into a dense knot |
| Unwind, de-risking | radar rings, with two streams pulling apart |
| Momentum, trend | long streaks raking in one direction |
| Rotation, cycles | orbit arcs, partly drawn |
| Risk, volatility | interference fringes |
| Flows, liquidity | braided currents |
| Research, evidence | a constellation of points, one cluster brighter |
| Portfolio, allocation | nested arcs |
| Time series, history | layered horizon lines |
| Network, dependencies | a sparse web of nodes, most edges faint |
| Onboarding, first run | a path of points leading off the frame |
| Setups, breakouts, pre-signal | a compressed coil of fine lines, one bright streak lifting off it |
| Factors, long-short spreads | five thin strata of lines fanning apart, the top one lit |

Use one motif per route. Sibling routes share the register and finish (§2)
so the set reads as one system; only the motif changes.

## 2. The prompt recipe

Five parts, in this order:

1. **Register:** "ultra-minimal, very dark abstract background for a premium
   [domain] [product type]". On a light page: "very light, warm paper".
2. **Motif:** the row from §1, drawn in the accent hue ("in thin amber
   light").
3. **Negative space where the text sits,** named for the slot: under
   `header-band`, "the left half and the far right edge are empty deep
   [ground colour]; the figure sits in the right-centre third". Under
   `center-band`, "the centre is empty; the figure lives at both edges".
   Under `phone-strip`, "the figure fills the top band".
   **Keep the figure in the middle band of the frame.** A strip slot under
   `cover` shows only a horizontal slice: a 1170x90 header shows the middle
   ~38% of a 1600x320 image's height; a phone strip is anchored at the top
   and shows the top 85% at 375 px but only the top 53% at 600 px.
   Say "the whole figure sits in the vertical middle third" for header and
   state slots. On one route the coil the prompt asked for landed in the
   bottom fifth and was cropped out of the header entirely; only its streak
   showed. When a render puts the figure at the top or bottom, re-roll the
   one entry (`batch --reroll-ai --only NAME`) rather than ship a crop that
   lost the motif.
4. **Finish:** "gentle depth of field, very fine film grain, restrained,
   editorial". Keep grain fine: heavy grain over the whole frame lifts the
   raw visibility number without showing anything, which is why `score`
   also reports `structure` (visibility after a blur that averages grain
   away).
5. **Hard negatives:** "no text, no words, no letters, no numbers, no logos,
   no people, no faces, no UI, no chart axes, no grid lines". `ai` appends
   its own as well.

Example, for a crowding route under `header-band`:

> Ultra-minimal, very dark abstract background for a premium market-analytics
> terminal. Fine particle trails in thin amber light converge into one dense
> knot. The left half and the far right edge are empty deep warm near-black;
> the figure sits in the right-centre third. Gentle depth of field, subtle
> film grain, restrained, editorial. No text, no words, no letters, no
> numbers, no logos, no people, no faces, no UI, no chart axes, no grid
> lines.

Then view the result and reject it, as for any plate
([ai-atmosphere.md §4](ai-atmosphere.md#4-the-procedure) step 3), when it
shows a face, a logo, glyph-like marks, UI, a chart, or hues outside the
palette.

## 3. The brief line names the motif

The imagery clause says which slots are AI, which motif each carries, and
what replaces them without a key:

> Imagery: one plate per route header (`header-band`, phone strip), inherited
> by empty states; /crowding and /unwind are AI motifs (converging knot;
> rings pulling apart, openai), the rest token `warp`; without a key, all
> `warp`.

## 4. Consent and cost

- **Ask before spending credits.** Say how many images, which provider, and
  that each candidate costs a call. A user who has not said yes gets token
  plates.
- **Record every image.** `ai --ledger` writes the prompt, provider, size and
  sha256. A shipped AI plate without a ledger row cannot be re-rolled or
  verified.
- **`ai` exits 3 for any failure**: no key, a provider error, a network
  failure, an unusable image. Treat exit 3 as "no image", never as "retry
  until it works" in a loop that spends credits.
- **Never overwrite an approved image with a fallback.** A failed re-roll
  keeps the shipped file. A token plate replaces an AI plate only when the
  user chooses it.
- **Re-rolls are opt-in.** In a manifest, `ai` entries are not re-rendered
  unless the run passes `batch --reroll-ai`. Without it, the shipped file
  must still match its ledger row's sha256 (otherwise exit 1,
  `ledger_mismatch`). With it, an AI failure aborts the whole batch with
  nothing changed (exit 3) unless `--fallback` is also passed, which renders
  the entry's `fallback` plate instead and says so.
- **Score before swap.** `batch` scores every entry on its slot first and
  changes nothing when any entry fails (exit 4). A new AI image that is
  prettier but scores lower does not ship.
- **Re-roll one, not all.** `batch --reroll-ai --only crowding` spends
  credits on the named entry only; every other entry must still verify
  against its ledger row.
- **Paid images are never thrown away.** If a batch aborts after
  generating images, they are kept in `<out_dir>/.rejected/<timestamp>/`
  with a note each (prompt, sha256, why it was rejected). Show them to the
  user before re-rolling again.
