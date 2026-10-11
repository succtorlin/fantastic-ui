# Consumer test templates

Two tests to copy into a project that ships plates. They keep a plate from going
invisible again after it has been measured and approved. Edit the `CONFIG`
block at the top of each file and leave the rest alone.

| File | Guards | Fails when |
|---|---|---|
| `tests/plateVisibility.test.ts` | the plate **files** | a plate has fewer than 8% of pixels at ≥1.1:1 against the page, or fewer than 1% at ≥1.3:1; or a token plate has more than 20% of its pixels darker than the page (its base was a darker well) |
| `tests/plateScrim.test.ts` | the plate **CSS** | a header or state scrim loses its clear band (fewer than two `transparent` stops); the scrim is listed under the image; the phone block loses the header strip; or a scrim uses literal colours or `opacity` |

Neither test replaces the browser check. `scripts/plate-check.js` measures what
a slot actually shows (fit, scrim, real text). These tests make sure the files
and the CSS you measured are still the ones that ship.

## Evidence

The visibility test is a generalised copy of one that caught a real failure.
In that app, every pre-fix plate failed it:

| Plate | `ge_1_1` | `ge_1_3` | darker than page (beyond 1.02:1) |
|---|---|---|---|
| route plate `crowding` | 1.12% | 0.18% | 68% |
| desk plate `team` | 0.67% | 0.06% | 77% |
| desk plate `today` | 4.82% | 1.46% | 56% |
| desk plate `ops` | 1.03% | 0.25% | 69% |

The re-rendered plates, made on the page ground, passed. The scrim test failed
a full-width scrim (no `transparent` stops) and a phone header with no strip
padding. It passed the CSS in `references/plate-slots.md` and the app's real
stylesheet.

## Copy and adapt

1. Copy both files into your test directory, for example `src/__tests__/` or `tests/`.
2. In `plateVisibility.test.ts`, set these:
   - `PAGE`: the colour the plates sit on, as `#rrggbb`. This is the palette's
     **first** ground (`tokens.json` → `page`).
   - `PLATES`: paths or globs (`*`, `**`, `?`), relative to `ROOT` (the cwd,
     which is the project root by default).
   - `TOKEN_PLATES`: empty by default. List only the plates rendered by
     `gen_atmosphere.py plate`, never AI rasters, whose dark areas are
     legitimate. A pixel counts as darker than the page only beyond 1.02:1
     (`FLOORS.darkerMargin`, the same margin `gen_atmosphere` uses), so codec
     jitter around the base doesn't count.
   - `PAGE_SENTINEL` (optional): `{ file, includes }`. It fails when the
     stylesheet no longer defines the page colour you measured against.
3. In `plateScrim.test.ts`, set `CSS_FILE`, the `BANDED` layer selectors, the
   `IMAGE` layer (`var(--plate)`), and `PHONE`: the media query, the strip
   rule, the header host and the strip variable. The defaults match
   `references/plate-slots.md`.
4. Install `sharp` if it is missing (`npm i -D sharp`). Without it, the
   visibility test fails and tells you to install it.
5. Run the tests. Then break a plate on purpose, for example by pointing
   `PAGE` at a lighter colour, and confirm the test fails.

## Runners

- **Vitest**: works with or without `globals: true`, with no config change.
  When globals are off, the files read Vitest's API from
  `globalThis.__vitest_index__` (the object behind `import.meta.vitest`).
- **Jest**: uses Jest's injected globals. TypeScript needs a transform
  (`ts-jest` or `babel-jest` with the TypeScript preset) and
  `testEnvironment: "node"`. `sharp` is loaded with a dynamic `import()`, so
  CommonJS builds work.
- Failures print as a list of reasons, such as
  `ge_1_1 1.12% < 8%` or `.plate--header: 0 transparent stop(s)`. Assertions use
  only `toEqual`, so the message is the same in both runners.

## When a test fails

- **Visibility**: re-render the plate on the page ground
  (`gen_atmosphere.py plate --page '#hex'` exits 1 on a mismatch), raise
  `--intensity` or `--weight`, or pick a better seed (`--seeds 1-8 --pick best`).
  Never fix a dim plate in CSS.
- **Darker than the page**: the palette listed a darker well first. Fix the
  token map (`tokens --page-role ground`) and re-render.
- **Scrim**: restore the band from `references/plate-slots.md`. If you meant to
  change the stops, that is a new profile. Score it with
  `gen_atmosphere.py score --scrim-json …` and re-measure with `plate-check.js`
  before you update the test.
