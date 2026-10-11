# plate-visibility eval

This eval guards against one failure: a decorative plate that ships **invisible** while
passing every text-contrast check.

In the session that prompted it, plates covered only 0.1–0.4% of a header strip. Four
things went wrong:

- The plate's base colour was a recessed "well" token that is darker than the page.
- A full-width scrim, stepping from 94% to 35%, buried what was left.
- Hairline styles were below 1.3:1 at strip size.
- Nobody measured the composited page. The author looked at the raw file and wrote
  "reads correctly".

The eval has two halves:

| Half | What it checks | Needs |
|---|---|---|
| **Offline** (`run_offline.sh`) | The tools refuse the trap, the visibility gate is real, and `batch` is atomic, sized and ledgered. | python3 with numpy and Pillow. node is optional. |
| **LLM** (`prompt.md` + `score_page.mjs`) | An agent running `/fantastic-ui` on the fixture picks the page as the ground, uses banded and strip scrims, plates only the right state, and proves it with composited-page numbers. | An agent, plus Playwright for the scorer. |

## Files

```
fixture/tokens.css   the trap: --well (#040302) listed FIRST and darker than the page --ground (#0a0907)
fixture/index.html   a static dark instrument screen: header strip (title left, meta right),
                     a populated positions table, a centred empty state, a filtered
                     "no matches" state, and a fetch-failed error state; system fonts only
manifest.json        plate entries for `gen_atmosphere.py batch` (header band, phone strip,
                     centred band), page-first token map; paths relative to the repo root;
                     slots are the fixture's measured boxes (header 1424x96 at 1440,
                     375x116 at 375, empty state 892x340). The centred band clears only
                     the outer ~15% of each side, so the empty plate puts its focus at the
                     edge (0.12) and picks the best of 8 seeds
run_offline.sh       the mechanical eval (below)
score_page.mjs       optional Playwright runner around scripts/plate-check.js
prompt.md            the task prompt for the agent and the 100-point grading rubric
```

Don't "fix" the fixture. The well-first token order and the shared `.state` primitive
across the empty, filtered and error states are deliberate.

## Run the offline half

Run it from the repo root. The script refuses, with exit 2, to run from anywhere else.

```bash
bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh
PYTHON=/opt/homebrew/bin/python3 bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh
```

It prints one `PASS` / `FAIL` / `SKIP` line per step and exits non-zero if any step fails.

1. **The trap is refused.** The script runs `tokens` with the naive map
   (`ground=--well,…`), then runs `plate --page '#0a0907'`. The plate must exit 1 with
   `{"error":"page_mismatch"}` and write no file. The same check runs through
   `--palette`. As a control, a page-first palette with the same `--page` must exit 0.
2. **The gate measures the slot.** A plate rendered on the well-first palette is scored
   with `score --slot 1424x96 --scrim header-band --fit cover` and must exit 4. As a
   control, the page-first plate must pass that slot. The page-first plate must also
   *fail* under the old `full` scrim.
3. **`batch` is safe.** The fixture and manifest are copied into a temp project. In that
   copy the script runs `batch --dry-run`, which must exit 0 and write nothing. It then
   runs a real batch, which must exit 0 and produce:
   - one ledger row per plate;
   - rows sorted by `out`, with no `ts`, `argv` or `raw` keys;
   - a sha256 for each file that matches the file;
   - each file at 30 KB or less;
   - `slotVisibility` at or above the 8/1 floor.

   A second run must leave the ledger byte-identical.
4. **The browser checker's unit tests pass.** The script runs
   `node --test skills/fantastic-ui/scripts/plate-check.test.mjs`. This step is skipped
   when node is not installed.

Nothing is written into the repo. All output goes to a `mktemp -d` directory, which is
removed on exit. If you run `batch` by hand against `manifest.json` from the repo root,
its output lands in `evals/plate-visibility/.out/`, which git ignores.

## Run the browser scorer

`score_page.mjs` serves a folder (default `fixture/`), or opens a URL. It loads
`scripts/plate-check.js` and runs `window.plateCheck()` at 1440px and 375px. It then
prints, per plate host, the visibility (% of pixels ≥1.1:1 and ≥1.3:1 against the
page) and the worst text ratio. On top of that it adds two policy checks: a plate host
must not wrap a table or grid ("plate behind data"), and it must not wrap a
`role=alert` / `data-kind=error|filtered|loading` state.

```bash
node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --dir /path/to/agents/copy
node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --url http://localhost:3000/ --widths 1440,768,375
node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --dir out/ --expect '.route-head|background-image|positions-head' --json
```

The script exits with one of three codes:

- **0**: every width passes.
- **1**: something failed. That is an invisible plate, text under its floor, a policy
  violation, no plate hosts at all, or stale CSS (an `--expect` sentinel did not match).
- **2**: Playwright or Chromium is missing, or the arguments were wrong.

Playwright is not a dependency of this repo. To install it where you run the scorer:
`npm i -D playwright && npx playwright install chromium`.

A reference plating was used to check the scorer. It used the manifest's three plates,
`header-band` with the right dense band moved in to 0.76, a phone strip, and a centred
band. It passed at both widths:

| Slot | Width | ≥1.1:1 | ≥1.3:1 | Worst text |
|---|---|---|---|---|
| Header | 1440 | 12.5% | 4.1% | 5.01:1 |
| Phone strip | 375 | 11.8% | 4.0% | 5.14:1 |
| Empty band | 1440 | 10.2% | 2.9% | 5.13:1 |

These match the offline `score` within 0.1 points. With the stock `header-band`, the
header's meta text measured 4.09:1 on the page, a failure that the offline text gate
does not see. `prompt.md` explains this trap.

Run against the untouched fixture, the scorer exits 1 with "no plate hosts found". That
is expected, because the fixture has no plates until an agent adds them.

## Run the LLM eval by hand

The installed skill ships this folder, rubric included, so a curious agent can
read it. The eval grades behaviour on the page, not secrecy: an agent that
reads the rubric still has to produce visible plates and cite real numbers.

1. Copy the fixture to a scratch folder, for example
   `cp -R skills/fantastic-ui/evals/plate-visibility/fixture /tmp/ledgerline`.
2. Start a fresh agent session in that folder with the fantastic-ui skill installed.
   Give it the **Task prompt** from `prompt.md`, word for word, starting with
   `/fantastic-ui`. Don't add hints about which token is the page, or which states should
   stay plain.
3. When it finishes, collect three things: its final report, the diff against the
   original fixture, and its ledger (`*.jsonl`).
4. Score the composited page:
   `node skills/fantastic-ui/evals/plate-visibility/score_page.mjs --dir /tmp/ledgerline --json > score.json`.
   If Playwright is unavailable, paste `scripts/plate-check.js` into DevTools at 1440px
   and at 375px, and run `await plateCheck()`.
5. Grade with the rubric in `prompt.md`:
   - Award the G, S and M lines.
   - Cross-check every number the agent cited against `score.json` (M3).
   - Apply the penalties. The −30 "invisible plate" and −25 "plate behind data"
     penalties come straight from the scorer's FAIL lines.
6. Record the score, the skill commit, and the model. If the score is below 60, or any
   invisible-plate penalty applied, that is a regression in the skill. File it with the
   agent's report attached.
