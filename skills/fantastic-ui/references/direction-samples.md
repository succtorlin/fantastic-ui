# Direction samples — show the candidate looks before building

When the direction is not already decided, the person choosing should see
it, not read about it. This file is the procedure: pick the two or three
strongest directions, render each as a small real page with the project's own
words and numbers, put them side by side at desktop and phone width, recommend
one, and build the full surface only after the pick. A sentence like "warm
cream, serif display, terracotta accent" is easy to agree with and hard to
picture; a rendered first screen settles it in seconds.

## When to show samples

Show samples whenever **Step 0a in SKILL.md ends without a fixed direction**:

| Situation | Samples? |
|---|---|
| A web page (landing, marketing site, launch page, storefront, portfolio) with no DESIGN.md, no existing token system and no look named | **Yes**, the default path |
| A document, deck, in-app screen or phone-only app | No: the sample template is a web page and would misrepresent them. Announce in one line with named forks (SKILL.md Step 0a) |
| One preset matches on ≥2 signals with no disqualifier | **Yes**: the match is the recommended sample, beside the next one or two (a confident pick still deserves a look at the alternative) |
| The user explicitly asks to explore or redesign an existing look | **Yes**, and the current look is one of the samples, labelled "current" |
| A DESIGN.md exists and the user did not ask to replace it | No: follow the file (Step 0a gate 0) |
| The codebase already has a token system | No: extend it (gate 2); a second look inside one product is the costume party Shift 1 forbids |
| The user named a preset or described a look | No: build it; their words win |
| One component, a copy edit, a bug fix, an accessibility pass | No |
| The user says "just build it" or "skip the samples" | No: announce the recommendation and build |

The user can always ask for samples in a "No" row; then show them.

## Pick the candidates

- **Two or three, never more.** Four options is a menu, not a recommendation.
- **Score with the signal table** in [theme-presets.md](theme-presets.md#selecting-a-preset--the-signal-table),
  apply every disqualifier, and take the top scorers. A fresh direction
  (written per Step 0, with its own token block) counts as a candidate and is
  often the strongest one; data-dense and instrument surfaces usually need it.
- **Each pair differs on at least two axes**: ground (light, cream, dark),
  accent behaviour, type voice (serif display, grotesk, mono-led), layout
  (split hero, statement, editorial stack), separation (hairline, shadow,
  tone). Two candidates that differ only in accent hue are one candidate.
- **Run the two-altitude check** on each (SKILL.md Step 0). If every
  candidate is the obvious look for the category, replace one with a fresh
  direction that is not.
- **Name each with one concrete noun or the preset name** ("Field Notes",
  "Coastal Editorial"), plus one line of why it fits and one line of what it
  gives up.
- **Recommend one**, with the reason in a sentence. The samples are evidence
  for a recommendation, not a quiz.

## Build the samples

Each sample is one static HTML page: nav, first screen, and **one real
section** of the product (the bento, the pricing table, a list of
listings, a dashboard strip: whatever this product's second screen would be),
then a footer line. It uses:

- the **project's real content**: product name, actual headline, real
  numbers and nouns from the brief or the repo. Never lorem ipsum: a sample
  with fake copy is judged on its fake copy.
- the candidate's **real tokens** (the preset's block from theme-presets.md,
  or the fresh brief's block), its face trio, radii and separation;
- an **imagery slot** filled with a real plate rendered by
  `gen_atmosphere.py` from the candidate's own palette (≤30 KB, through the
  generator's visibility gate; on light pages `warp` is too soft, so it falls
  back to `contour` or `studio`). The caption says which plate is shown and
  what it stands in for ("contour plate from the tokens · stands in for: your
  product shots"). Never a CSS gradient blob: if no plate passes, the slot is a
  plain labelled panel.

No canvas, no motion and no webfonts in samples: they compare direction, and
render in seconds.

Generate them with the bundled script from a manifest:

```bash
node ~/.claude/skills/fantastic-ui/scripts/direction-samples.mjs design-samples.json
```

```json
{
  "title": "Bramble · bakery pre-orders",
  "out": "design-samples",
  "recommended": "field-notes",
  "content": {
    "brand": "Bramble",
    "nav": ["Menu", "How it works", "Pick-up times"],
    "eyebrow": "Saturday pre-orders",
    "headline": "Bread that is still warm when you get there.",
    "sub": "Order by Thursday 6 pm, collect between 8 and 11 on Saturday.",
    "cta": "Order for Saturday",
    "secondary": "See this week's bake",
    "stats": [["212", "loaves last Saturday"], ["11", "bakes this week"], ["0", "left after 10:40"]],
    "section": {
      "kind": "table",
      "title": "This week's bake",
      "rows": [["Country sourdough", "£5.20", "38 left"], ["Rye & caraway", "£4.80", "12 left"]]
    },
    "footer": "Bramble Bakery · 14 Mill Lane · orders close Thursday 6 pm"
  },
  "directions": [
    { "id": "field-notes", "name": "Field Notes", "tokensCss": ".page { --ground: … }",
      "hero": "stack", "proof": "image", "imagery": "ai: flour-dusted bench, morning light",
      "why": "Warm and specific to a small bakery", "tradeoff": "Less room for the menu above the fold" },
    { "id": "D", "name": "Atelier Warm", "preset": "D", "hero": "split", "proof": "stats",
      "why": "Editorial cream and serif", "tradeoff": "Its photo slots need real bakes" },
    { "id": "E", "name": "Terracotta Commerce", "preset": "E", "hero": "split", "proof": "image",
      "section": "cards", "why": "Built for ordering", "tradeoff": "Reads like any shop" }
  ]
}
```

- `preset` pulls that preset's token block from theme-presets.md; `tokensCss`
  (or `tokensFile`) supplies a fresh direction's block: one flat rule of custom
  properties (only the first rule is read; a dark-theme block after it is
  ignored, and the script says so). It needs `--ground`, `--ground-2`,
  `--panel`, `--hair`, `--ink`, `--ink-2`, `--display`, `--sans` and `--mono`;
  `--accent` (or `--accent-fill`), `--hair-lit`, `--panel-2`, radii and
  `--maxw` are optional. Colours may be hex, `rgb()`, `hsl()` or `oklch()`.
- `recommended` is required, ids are file names (case-insensitive; `index`,
  `sample` and `shots` are reserved), and unknown `hero`, `proof`, `section`
  or `separation` values are refused.
- `hero`: `split` (copy beside a proof panel), `statement` (oversized
  left-aligned headline over a wide imagery band), `stack` (editorial: eyebrow,
  headline, then the imagery band and stats beneath).
- `proof`: `stats` (big mono numbers) or `image` (the labelled imagery slot).
- `section` (per direction, overriding the content's `kind`): `table`,
  `cards` (asymmetric bento), or `list` (index rows).
- `separation`: `hairline`, `shadow` or `tone`; inferred from the tokens
  (`--lift*` means shadow, Preset L means tone) when omitted.

The script writes `<id>.html` per candidate and an `index.html` comparison
sheet. When Playwright is available (resolved from the project, or
`--playwright <dir>` pointing at a `node_modules` that has it) it also
renders each sample into `shots/`: the first screen at 1440×900, the full
page at 1440, and the full page at 390; the sheet shows the first screens
side by side with the recommendation first and links the full pages.
Without Playwright (or if Chromium fails to launch) the sheet embeds the
live pages instead. It prints the contrast of every text pair the sample
paints (body, secondary, section and card text, button, eyebrow) and flags
any pair under 4.5:1 or not measurable. Fix a flagged pair in the
direction's tokens before showing it.

## Check them against the gates

Samples are held to the same gates as a shipped page: `check-samples.mjs` is
the skill's exam (`scripts/exam.mjs`, SKILL.md "The exam") run over the
sample folder. Run it and show nothing until it reports every page passing:

```bash
node ~/.claude/skills/fantastic-ui/scripts/check-samples.mjs design-samples
```

Per page it runs axe-core with the WCAG 2.0/2.1/2.2 A and AA tags at 1440 and
390 px (violations fail; `incomplete` nodes are reported, never passed),
checks reflow at 320/375/390/768/1024/1440 (no overflow, no content cut off),
every link and button ≥24×24 px, no wrapping button labels, the skip link,
landmarks, one `h1`, a visible `:focus-visible` ring ≥2 px and ≥3:1 on every
focusable, runs `verify-preset.mjs` on every preset sample (contrast, zero
webfonts, asset weight, focus ring, reduced-motion path, token roles, accent
restraint, separation strategy and the preset's own traps, including white
never partnering the accent), and `lint-surface.mjs --strict` over the
folder. Results go to `checks.json` and onto each card in the sheet. It needs
`playwright` and `@axe-core/playwright` (the same tools `verify-preset.mjs`
uses), from the project or `--modules <node_modules>`. A failing sample is
fixed in its tokens or replaced; it is never shown with a note.

The generator already builds for these gates: a measured focus colour (≥3:1
on the surface), 44 px nav targets, a skip link, a reduced-motion block,
`--ink-2` for small text, number-only mono columns, and the white-on-accent
rule (when only white reads on an accent, the button takes the preset's
inverted fill unless its gates declare the pairing, as Preset L does).

## Show them

1. **Look at every screenshot yourself first** (desktop and phone). A
   sample that looks broken, cramped or generic is fixed or replaced before
   the user sees it; never ship a weak option to make the recommended one
   look good.
2. **Present the sheet**: open `index.html` (or the screenshots) where the
   user can see it, in the browser pane or as image files.
3. **Say it in four lines**: the recommendation and why, then each other
   candidate in one line with what it trades away, then the question.
   > I recommend **Field Notes**: it is the only one that looks like a small
   > bakery rather than a shop. **Atelier Warm** is calmer but needs real
   > photos to work. **Terracotta Commerce** is the most order-focused and
   > the most generic. Which one should I build?
4. **Build only after the pick.** The chosen sample's direction becomes the
   brief line (with its imagery clause) and, on a yes, the project's
   DESIGN.md (`design_md.py export`). Samples are disposable: delete the
   folder, or keep it out of the build (`design-samples/` in `.gitignore`).

If the user mixes ("Field Notes, but with Atelier's type"), make the mixed
version a new sample and show it once more before building.

## Gate

| Check | How to measure |
|---|---|
| Samples shown only when Step 0a left the direction open (table above) | the decision row is named in the reply |
| Two or three candidates, each pair differing on ≥2 axes | list the axes per pair in the reply |
| Real content, no placeholder copy | grep the generated HTML for `lorem`, `John Doe`, `Your headline` |
| Token pairs readable | the script's contrast table: every listed pair passes (4.5:1 text, 3:1 focus ring), none "not measurable" |
| Every sample passes the gates | `check-samples.mjs` exits 0: all pages PASS in `checks.json`, each card in the sheet says "all pass" |
| Phone view checked | a 390 px screenshot per candidate exists and was looked at |
| One recommendation with a reason | the reply names it before the question |
| Nothing built before the pick | no edits to the product's real files until the user chooses |
