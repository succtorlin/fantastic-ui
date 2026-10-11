# Eval: plate visibility (fixture: Ledgerline · Book)

## Task prompt (give this to the agent verbatim, with `/fantastic-ui` loaded)

> /fantastic-ui
>
> The app in `fixture/` (open `fixture/index.html`; tokens are in `fixture/tokens.css`) is a
> dark trading-book screen that feels flat. Add decorative imagery to it: a plate behind
> the route header, and imagery on any state that would benefit from it. Generate the
> plates from the app's own tokens, wire them in with CSS, and make it work on phones too.
> Do not touch the data or the copy. When you are done, report what you shipped and how
> you know it is visible and readable.

Run it in a scratch copy of `fixture/` so the original stays the trap. Don't add hints.
In particular, don't tell the agent which token is the page, that `--well` is darker, or
which states should stay plain. Noticing those things is what this eval tests.

## What the fixture hides

- `tokens.css` lists `--well` (#040302) **first**, and it is darker than the page.
  The page is `--ground` (#0a0907), which `body` paints. If an author takes the first or
  darkest token as the plate base, the plate comes out mostly darker than the page and
  reads as nothing. This is the failure seen in the original session.
- `.state` is one shared primitive used by three branches: `data-kind="empty"` (the
  watchlist, centred and tall), `data-kind="filtered"` (the screener: "No matches"), and
  `data-kind="error"` (alerts fetch failed, `role="alert"`). A rule written against
  `.state` alone plates all three.
- The header strip is about 96px tall, with the title on the left and the meta on the
  right, so a full-width scrim strong enough for the text hides the plate. At 375px the
  header stacks, so there is no clear band beside the words.
- At 1440px the meta block is about 20% of the header's width. The stock `header-band`
  covers only the last 12% densely, so the meta text sits partly over clear plate.
  The offline `score`/`batch` text gate assumes the profile's text regions
  (x 0.88–1.0) and passes at about 5.1:1. The composited page measures that meta
  text at about 4.1:1, which fails. Only an agent that measures the composited page
  catches this. The fix is to move the right dense band in to about 0.76 (check it
  with `score --scrim-json`) or to narrow the meta. A reference solution with the band
  at `.52→0, .66→0, .76→.85` measures 12.5/4.1 % visible and 5.01:1 worst text at
  1440px.
- Every surface the plates sit on is the page (`--ground`); the panels are hairline
  frames with no fill. So "the page" in every measurement is #0a0907.
- The positions table is data. Nothing decorative belongs behind it.

## Grading rubric (100 points)

To grade, read the agent's diff, its report, and the ledger. Then run
`score_page.mjs --dir <agent's copy>`, or measure by hand with `scripts/plate-check.js`.
Award each line all or nothing, unless the line says otherwise.

### Ground and generation (25)

| # | Points | Criterion |
|---|---|---|
| G1 | 10 | **The first ground is the page.** The palette or token map passed to the generator starts with `--ground` / #0a0907, either through `--map ground=--ground,…` or a palette that begins with #0a0907. Score 0 if `--well` or #040302 is the base, even if the plates were later "fixed" by brightening them. |
| G2 | 5 | The page colour is declared to the generator: `--page '#0a0907'`, `--page-role`, or a manifest `"page"`. This lets the `page_mismatch` guard fire. |
| G3 | 5 | Plates are produced by `gen_atmosphere.py` `batch --manifest` or `plate`. Each is at most 30 KB, and each `out` file's sha256 matches its ledger row. |
| G4 | 5 | **There is a ledger with one entry per shipped asset.** Every plate file referenced from CSS has a row, and no row lacks a file. AI rasters, if any were used, record their prompt, provider and sha. |

### Slots and scrims (35)

| # | Points | Criterion |
|---|---|---|
| S1 | 12 | **The header uses a banded scrim, not a full-width one.** Its gradient has a clear band (two `transparent` stops) between a dense band under the title and a dense band under the meta. This is `header-band` or an equivalent. Score 0 for a single full-width gradient, however soft. |
| S2 | 10 | **There is a phone strip.** At ≤720px the header shows the plate as a strip above the words: a `phone-strip` profile, a strip fit anchored to the top, and the text pushed below the strip. The rule is scoped to the header host, not to every plate. Award 5 if phones get some visible plate but not a strip, and 0 if the plate is simply hidden on phones without saying so in the report. |
| S3 | 8 | **The centred empty state is plated**, using a centred band (`center-band`, band fit) and not `cover` over the whole 340px box. |
| S4 | 5 | **The filtered and error states stay plain.** The selector targets `[data-kind="empty"]` or an explicit kind prop, not `.state`. The agent says in its report why the filtered and error states get no plate. |

### Measured, not asserted (40)

| # | Points | Criterion |
|---|---|---|
| M1 | 12 | **The report cites visibility numbers for every plated slot**: the percentage of plate pixels at ≥1.1:1 and at ≥1.3:1 against the page. These must be measured on the composited page (plate, scrim and fit as the browser shows them) at desktop and at phone width. A raw-file number alone gets half credit. |
| M2 | 10 | **The report cites the worst-text ratio for every plated slot.** This is the p90 background under the lightest text, against the 4.5 floor for body text or 3 for large text. It is measured on the composited page. |
| M3 | 8 | The cited numbers match a re-measurement (`score_page.mjs` or `plate-check.js`) within ±3 points of visibility and ±0.3 of ratio. If the agent edited CSS after measuring, it used a stale-CSS sentinel (`expect`) or re-measured. |
| M4 | 10 | **No unmeasured claims.** Score 0 if the report says "reads correctly", "subtle but visible", "looks good" or similar about the imagery without numbers next to the claim. Score 0 if visibility was judged by opening the raw image file. |

### Penalties (applied after the sum, floor 0)

| Penalty | Trigger |
|---|---|
| −30 | **An invisible plate.** Any shipped plate measures below the floor on the composited page (ge_1_1 < 8 % or ge_1_3 < 1 %) at a width where it is displayed. This is applied once per plate, up to −60. |
| −25 | **A plate behind data.** A plate host wraps the positions table or any other data grid. `score_page.mjs` reports this as "plate behind data". |
| −15 | A plate on the filtered or the error state. `score_page.mjs` reports this as "plate on an error/filtered/loading state". This replaces S4's 0, so do not count it twice. |
| −15 | Any text in a plated slot falls under its floor (4.5 for body, 3 for large) on the composited page. |
| −10 | The data or the copy was changed, or a web font was imported. |
| −10 | The fixture trap was "fixed" by editing `tokens.css` (reordering or recolouring `--well`) instead of mapping the page correctly. |

### Reading the score

- **85–100**: ship. The skill handled the trap and proved it with numbers.
- **60–84**: the plates work, but the evidence or the state discipline is weak.
- **< 60**, or any "invisible plate" penalty: this is the original failure. File it
  against the skill.

## Grader checklist (mechanical parts)

```bash
# offline gates the skill's tools must keep (no LLM, no browser)
bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh

# composited-page numbers for the agent's copy (needs Playwright)
node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --dir /path/to/agents/copy
node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --dir /path/to/agents/copy --json > score.json

# per-plate numbers straight from the generator, for M3 cross-checks
python3 skills/fantastic-ui/scripts/gen_atmosphere.py score --plate <file.webp> --page '#0a0907' \
  --slot 1424x96 --scrim header-band --fit cover --text '#84817e'
```
