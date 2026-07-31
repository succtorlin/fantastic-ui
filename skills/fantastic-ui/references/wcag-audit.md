# The accessibility phase — WCAG 2.2 AA check and fix

The complete procedure for auditing and remediating fantastic-ui surfaces
(marketing pages and product panels alike). Target: **WCAG 2.2 Level AA**.
Automation catches roughly a third of real failures; this phase is
automated sweep + four manual passes + on-system fixes + re-audit.

## Step 1 — Token contrast matrix (run before styling anything)

Contrast is a *system* property. Validate the token pairs once and every
screen inherits compliance; skip this and you'll fix the same failure on
every screen forever.

Required ratios (WCAG 1.4.3, 1.4.11):

| Pair | Minimum |
|---|---|
| Body text × any ground it sits on | **4.5:1** |
| Large text (≥ 24px, or ≥ 18.66px bold) × ground | **3:1** |
| UI component boundaries, chart strokes, focus rings × adjacent color | **3:1** |
| Disabled text, decorative hairlines | exempt (but keep hairlines ≥ 1.3:1 for sighted usability) |

Runnable checker — paste tokens, run with `node contrast.mjs`:

```js
// contrast.mjs — WCAG relative luminance + contrast for the token matrix
const tokens = {
  grounds: { g0: '#0b0b0a', g1: '#121110', g2: '#181613', g3: '#1f1c17' },
  inks:    { ink: '#efeadf', ink2: '#cfc8b8', muted: '#98917f' },
  accent:  { sodium: '#f2a83c', sodiumHi: '#ffc164' },
  semantic:{ up: '#3fb98b', down: '#e05b4c', warn: '#d8b36a' },
};
const lum = hex => {
  const [r, g, b] = hex.match(/\w\w/g).map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const [gn, g] of Object.entries(tokens.grounds))
  for (const group of ['inks', 'accent', 'semantic'])
    for (const [tn, t] of Object.entries(tokens[group])) {
      const r = ratio(t, g);
      const verdict = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/UI only' : 'FAIL';
      console.log(`${tn} on ${gn}: ${r.toFixed(2)}  ${verdict}`);
    }
```

Reading the results, dark-UI edition:

- `--muted` is the usual offender — it must clear 4.5:1 on **every** ground
  step it appears on, including the lightest subpanel step (`--ground-3`),
  not just the page background. If it fails on ground-3 only, lighten the
  token until it passes there; the change is invisible on darker grounds.
- Semantic red on dark ground frequently lands at 3.5–4:1 — fine for large
  numerals and chart strokes, **not** for body-size error copy. Keep a
  `--down-text` variant tuned to pass 4.5:1 for prose, and let the chart
  stroke keep the saturated version.
- The accent used as *text* (eyebrows) needs 4.5:1 unless the eyebrow
  qualifies as large text; used as a *focus ring or border* it needs 3:1
  against what's adjacent. Verify both roles separately.
- Record the passing matrix as a comment block above the tokens, with the
  date. A token change without a matrix re-run is a regression waiting.

### Every semantic tint is another ground

The matrix above covers the ground scale. It is not enough. Any surface that
sits on a **semantic tint** — a success/warning/error wash behind a row, a
badge, a hovered slot — is a ground too, and your muted ink has to clear 4.5:1
on all of them. Measured on a real app: `--muted` read **4.26:1** on a
`success/20` row tint (and worse on `error/30`), while passing comfortably on
every step of the neutral ground scale.

Extend the matrix with every `semantic × alpha` combination the components
actually use, then either lighten the ink or promote tinted-row text to the
primary ink and carry hierarchy with size and face instead.

### Opacity is part of the contrast calculation — and it compounds

**Never dim text with `opacity-*`.** This is the single highest-yield rule in
this document, because the failure is invisible in code review: the classes
all reference valid, matrix-approved tokens, and the contrast still fails.

Opacity multiplies down the tree. Real measurements from one panel:

| Element | Cumulative alpha | Measured | Required |
|---|---|---|---|
| counter inside a dimmed chip | 0.60 × 0.70 = **0.42** | **1.83:1** | 4.5 |
| glyph inside a dimmed chip | 0.48 | 2.01:1 | 4.5 |
| label on an `opacity-60` container | 0.60 | 2.48:1 | 4.5 |
| a lone `opacity-80` | 0.80 | 4.20:1 | 4.5 |

Note the last row: even a single, innocuous-looking `opacity-80` costs roughly
1.1 of ratio and can push a passing token under the line on its own.

It is doubly damaging, because **opacity also destroys your ability to verify**:
an element with `opacity < 1` creates a stacking context that axe cannot see
through, so those nodes come back as unresolvable "incomplete" rather than as a
clean pass or an honest failure (see Step 2). The dimming hides the bug it
causes.

Dim with an ink token instead. Legitimate uses of opacity that stay allowed:

- `disabled:opacity-*` — WCAG 1.4.3 exempts inactive UI components
- `hover:` / `focus:` / `group-hover:` variants — transient; the base state is
  what gets audited
- transient pointer states (a drag ghost) — though check whether `rotate`,
  `scale` and `shadow` already carry the "lifted" meaning, which usually makes
  the opacity redundant
- `transition-opacity` — declares the property, sets no value

## Step 2 — Automated sweep

Run against every route/state, not just the homepage:

```bash
# axe-core CLI — WCAG 2.0/2.1/2.2 AA rule tags
npx @axe-core/cli http://localhost:3000 \
  --tags wcag2a,wcag2aa,wcag21aa,wcag22aa --exit

# Or in Playwright (preferred for panel states — you can open the drawer,
# trigger the error state, then scan):
# const results = await new AxeBuilder({ page })
#   .withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();

# Lighthouse accessibility category as a second opinion
npx lighthouse http://localhost:3000 --only-categories=accessibility --quiet
```

For product surfaces, scan each screen **in each designed state** — a panel's
error state ships as often as its happy path and is scanned approximately
never. Drive the app to loading/empty/error, then run axe on the live DOM.

Severity policy (triage, don't drown):

- axe **critical / serious** → ship blockers, fix now
- **moderate** → fix now or document the exception with a reason and owner
- **minor** / best-practice → backlog, tracked, not blocking

### `incomplete` is neither a pass nor a violation — measure it

axe returns two result arrays. `violations` are failures it proved.
**`incomplete` are checks it could not compute** and is handing to you. They
are not interchangeable, and mixing them up burns time in both directions.

This matters more than it sounds, because **the axe DevTools extension renders
`incomplete` with the same red SERIOUS card as a violation**, with the same
"Elements must meet minimum color contrast ratio thresholds" wording. A
stakeholder screenshotting that card will report a violation the API never
reported. On one audit, axe returned **0 violations and 14 incomplete** — and
the tool was right both times.

Both failure modes are real:

- **Dismissing it.** "Incomplete just means axe got confused." On that same
  audit, **9 of the 14 had genuine AA failures underneath**, the worst at
  1.83:1. `incomplete` is often exactly where the bugs hide, because whatever
  blinded axe (opacity, a pseudo-element, a stacking context) is frequently
  the thing causing the failure.
- **Accepting it as a failure.** Chasing a clean zero can make you restyle
  perfectly compliant UI to satisfy a tool that simply could not see through a
  decorative pseudo-element.

The only correct response is to compute the value yourself, per node:

| `messageKey` | What blinded axe | Usual reality |
|---|---|---|
| `bgOverlap` | an ancestor stacking context, usually `opacity < 1` | **often a real failure** — measure first |
| `pseudoContent` | a `::before`/`::after` over the background | usually fine; verify once |
| `nonBmp` | element content is only symbol glyphs | fine if decorative and `aria-hidden` |
| `elmPartiallyObscured` | overlapping geometry | verify; check it is not genuinely covered |

Record the verdict and the measured ratio for each one. A reviewed `incomplete`
with a number next to it is a finished item; suppressing the rule is not. Expect
a residue of `incomplete` on any real app — decorative glyphs and
pseudo-element backdrops never resolve — so **"axe incomplete = 0" is the wrong
exit criterion**. The right one is: every `incomplete` node measured, and every
measurement passing.

## Step 2b — Validate the instrument before you trust the reading

Step 2 tells you to measure the `incomplete` nodes yourself. A hand-rolled
contrast checker is itself a piece of software, and a wrong one is worse than
none — it produces confident numbers that send you to restyle compliant UI or
to sign off on failing UI. Every one of these has been shipped and then caught:

| Bug | Symptom | Why |
|---|---|---|
| Parsing modern color syntax as RGB | fake 1.33:1 on a fine button | `getComputedStyle` returns `oklab(…)`/`oklch(…)`; naive regex reads the numbers as sRGB |
| 1×1 canvas readback at low alpha | 10 %-tint badge reads 2.07:1 when it is ~8:1 | canvas stores premultiplied alpha; precision collapses as alpha → 0 |
| Ignoring `background-image` | gradient button reads as text-on-transparent | `backgroundColor` is `transparent` when a gradient paints the surface |
| Walking past the first opaque layer | a scrim'd caption reads 1.01:1 when it is 5.74:1 | compositing must stop at the first fully opaque ancestor, and sibling scrims are invisible to an ancestor walk |

Two techniques make the reading trustworthy.

**Resolve any CSS color exactly, via two backdrops.** Paint the color over
black and over white; both draws are opaque, so no premultiplication precision
is lost, and the pair determines color *and* alpha regardless of the input
syntax — `oklch`, `color-mix`, `rgba`, anything the engine accepts:

```js
// Cw - Cb = 255 * (1 - a)  =>  a, then C = Cb / a
function resolve(css, ctx) {
  const out = [];
  for (const back of ['#000000', '#ffffff']) {
    ctx.fillStyle = back;  ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = css;   ctx.fillRect(0, 0, 8, 8);
    const d = ctx.getImageData(4, 4, 1, 1).data;
    out.push([d[0], d[1], d[2]]);
  }
  const [Cb, Cw] = out;
  const a = 1 - ([0, 1, 2].reduce((s, i) => s + (Cw[i] - Cb[i]), 0) / 3) / 255;
  if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: Cb[0] / a, g: Cb[1] / a, b: Cb[2] / a, a };
}
```

**Composite the real stack, including inherited opacity.** Walk root → element
accumulating a running opaque background, multiplying each ancestor's `opacity`
into a cumulative factor, and apply that factor to both the tints you composite
and the final text color. Report the cumulative opacity alongside the ratio —
any value below 1.0 is a finding in its own right (see Step 1).

Sanity-check the checker against a pair you already know from the token matrix
before believing anything it says about a node you don't.

## Step 2c — Audit the surface that actually renders

An audit of the wrong DOM is worse than no audit, because it produces a
findings table that looks complete. Three traps, all encountered on one screen:

- **The surface was in an error or empty state.** A page whose data fetch
  failed renders a one-line error, so the audit reports "zero headings, no
  landmarks, no grid semantics" — all true of the error state, none of it true
  of the screen. **Confirm the surface is rendering its real content before
  recording a single finding.** If a local auth or data gate is what's blocking
  it, fix that path first; auditing an empty shell is wasted work.
- **The files were not the ones the route mounts.** Grepping component names
  audited two files the live route never rendered, while the component that was
  actually on screen went unexamined. **Resolve the tree from the running page**
  (what is in the DOM, what the route imports), not from plausible filenames.
- **One of them was dead code.** A component with zero consumers absorbed real
  remediation effort. Before fixing a component, confirm something imports it.

State coverage is part of this: scan each surface in **each designed state** —
loading, empty, error, and any state-dependent styling (approved/locked/
disabled variants). Those ship as often as the happy path and are scanned
approximately never.

## Step 3 — The four manual passes

### 3a. Keyboard pass

Unplug the mouse. Traverse the entire page/screen with Tab / Shift-Tab /
Enter / Space / Arrows / Escape:

- Skip link is the first tab stop and works (2.4.1)
- Tab order matches visual order; no positive `tabindex` anywhere (2.4.3)
- Focus visible on **every** stop — the shared `.focusable` ring, never
  `outline: none` without replacement (2.4.7)
- Focus never hidden behind the sticky nav — give scroll targets
  `scroll-margin-top` equal to nav height + 8px (2.4.11, new in 2.2)
- Tabs/toggles: roving tabindex, arrow-key movement, `aria-selected` follows
  focus or activation consistently
- Modals/drawers trap focus while open, restore it on close, close on
  Escape; nothing else on the page is reachable while open
- No keyboard traps anywhere (2.1.2) — you can always Tab out

### 3b. Screen-reader pass (VoiceOver Cmd-F5 / NVDA)

- Landmarks: one `main`, labeled `nav`s, `header`/`footer`; navigate by
  landmark and by heading — the outline should read like a table of
  contents with no skipped levels (1.3.1, 2.4.6)
- Every interactive element announces **name, role, value** — icon-only
  buttons have `aria-label`; the panel's "⋯" menu is not announced as
  "button" alone (4.1.2)
- Decorative canvases and sparklines: `aria-hidden="true"` + an `srOnly`
  text summary or data table carrying the same information (1.1.1) — the
  live hero gets one sentence stating what it shows
- Marquee/ticker content duplicated in a visually-hidden static list;
  the moving copy `aria-hidden`
- Async panel updates: `aria-busy` during load; `aria-live="polite"` on
  regions whose data refreshes (status changes announced, not silent);
  errors announced via `role="alert"` — sparingly, one per failure
- Data tables: real `<th scope>`, a `<caption>` or `aria-label`; never a
  div-grid pretending (1.3.1)
- Forms: every input has a real `<label>`; errors are text linked via
  `aria-describedby`, not color alone (3.3.1, 3.3.2)

### 3c. Motion pass

- Toggle `prefers-reduced-motion` (OS setting or DevTools rendering
  emulation): every canvas draws one static frame, reveals appear
  instantly, marquee stands still, pulses stop (2.3.3)
- Anything auto-moving longer than 5 s has a pause control (2.2.2) — the
  reduced-motion path does not substitute for this on the default view
- Nothing flashes more than 3 times/second (2.3.1)

### 3d. Reflow and zoom pass

- 320 px viewport: single column, no horizontal scroll, nothing clipped
  (1.4.10)
- 200 % browser zoom at 1280 px: all content and functions still available
  (1.4.4)
- Text-spacing override (1.4.12): bump `line-height: 1.5em; letter-spacing:
  0.12em; word-spacing: 0.16em` via DevTools — no clipped or overlapping
  text (watch mono stat tiles and eyebrows; give them room, don't `ch`-lock
  widths)

## Step 4 — WCAG 2.2 additions (easy to miss, all AA)

- **2.4.11 Focus Not Obscured (Minimum)** — sticky nav/footers must not
  cover the focused element; `scroll-margin` fixes most cases
- **2.5.7 Dragging Movements** — anything draggable (sliders, sortable
  panels) has a single-pointer alternative (buttons, input field)
- **2.5.8 Target Size (Minimum)** — every target ≥ 24×24 CSS px or has
  equivalent spacing; audit icon buttons in panel heads and table row
  actions, the usual offenders in dense UIs (pad the hit area, not the
  glyph)
- **3.2.6 Consistent Help** — if help/contact exists, same relative
  position on every page
- **3.3.7 Redundant Entry** — flows never ask users to re-type what they
  already entered (auto-fill or carry forward)
- **3.3.8 Accessible Authentication (Minimum)** — no cognitive test to log
  in; allow paste in password fields, support autofill/passkeys

## Step 5 — Fix patterns, keyed to the system

Fix at the highest level possible: **token > primitive > component >
instance**. Common findings and their on-system fixes:

| Finding | On-system fix |
|---|---|
| Muted text fails 4.5:1 on subpanel grounds | Lighten `--muted` globally; re-run matrix. Never a local color override |
| Accent eyebrow fails as small text | Raise eyebrow size/weight into large-text territory, or use `--accent-hi` for text and keep base accent for borders |
| Semantic red body copy fails | Add `--down-text` (lightened) for prose; saturated `--down` stays for strokes/large numerals |
| Focus ring invisible on accent buttons | Two-layer ring: `outline: 2px solid var(--ground-0); box-shadow: 0 0 0 4px var(--accent)` — passes 3:1 on any ground |
| Meaning carried by color alone (up/down) | Add a second channel: ▲/▼ glyph or +/− sign in the mono face — it also sharpens the instrument feel |
| Icon-only panel actions unnamed | `aria-label` on the button, not `title`; tooltip text duplicated there |
| Canvas has no text alternative | `aria-hidden` the canvas; add `.srOnly` summary (one sentence + key numbers), or a collapsed `<details>` data table for charts |
| Tab targets under 24 px in dense tables | Padding on the interactive element (hit area), glyph size unchanged |
| Panel updates silently | `aria-live="polite"` on the panel body, `aria-busy` while loading |
| Heading levels skip (h2 → h4) | Fix the outline; style with classes, not heading levels |
| Focus lands under sticky nav | `scroll-margin-top: calc(var(--nav-h) + 8px)` on `[id]` targets |
| Text dimmed with `opacity-*` | Replace with an ink token. Never keep opacity "but lighter" — it compounds and it blinds the auditor (Step 1) |
| Muted ink on a semantic tint row | Promote that text to the primary ink; carry hierarchy with size and face, not ink |
| Bar/meter conveys a value by width + fill color | `role="progressbar"` with `aria-valuenow`/`min`/`max` and a human `aria-valuetext`; hide the now-duplicated visible label from AT |
| Transposed grid (column-major DOM) | Do **not** apply `role="grid"` — see below |
| Decorative glyph announced as an unnamed graphic | `aria-hidden` the glyph; ensure the meaning is in adjacent text |

### Never fake a structure the DOM does not have

A `role="grid"` requires rows containing cells. If the DOM is column-major — a
sticky header column, then one column per day — the visual rows are not DOM
rows, and applying grid roles makes a screen reader announce **wrong
coordinates**. That is worse than no roles at all: it is confidently incorrect.

Three honest options, in order of preference:

1. **Restructure to row-major** if it is genuinely a data grid. Row wrappers
   with `display: contents` supply the required structure while leaving a CSS
   grid layout untouched — verify the computed `grid-template-columns` is
   unchanged afterwards.
2. **Make each cell self-describing.** Put the coordinates into each item's
   accessible name ("CHEM 1230 §001, Mon 08:00, Overman 210, 19 of 30 seats"),
   and use `role="group"` with a name per column. Truthful grouping, no false
   geometry.
3. Leave it unmarked rather than mislabelled.

Option 2 is usually right for a retrofit, because option 1 is a structural
rewrite and therefore not a presentation-only diff.

### Removing a dimming that encodes state

When the opacity you are deleting means something — *unapproved*, *locked*,
*inactive* — deleting it removes information. Do not trade an accessibility bug
for an information bug. Work in this order:

1. **Name the state** the dimming encodes.
2. **Look for a channel that already carries it.** Very often one exists and
   the dimming was pure redundancy: a checkbox, a "(locked)" suffix, a lock
   reason badge, a distinct border. In that case just delete the opacity.
3. **Otherwise add a channel that survives being read aloud** — an accent
   border or ring for selection, a text suffix, a glyph plus label. Reuse the
   app's existing selection convention rather than inventing one.
4. **Re-measure the new combination on every ground it can land on**, including
   each semantic tint.

Step 4 is not optional: on one such fix the new styling was fine, but measuring
it surfaced a *pre-existing* 4.26:1 failure on the tinted row underneath that
the old dimming had been masking.

### Lock the fix in with a guard, then attack the guard

A contrast class of bug recurs the moment someone reaches for the obvious
utility again. Encode it as a test over the files you actually measured — a
regex over the source is enough — and:

- **Allow the legitimate variants** (`disabled:`, `hover:`, `transition-`), or
  the guard gets disabled the first time it cries wolf.
- **Strip comments before matching**, or the guard's own rationale trips it.
- **Mutation-test it**: reintroduce the exact bug and confirm the guard goes
  red. A guard that has never failed has never been shown to work. One such
  guard, on its first run, caught a straggler the manual sweep had missed.

## Step 6 — Report and re-audit

Produce a short findings table — one row per finding: **WCAG SC · severity ·
location · fix applied**. Then re-run Step 2 and re-do any manual pass that
had failures. Exit criteria:

- [ ] axe: zero critical, zero serious **violations** (all tags incl. `wcag22aa`)
- [ ] Every axe **`incomplete`** node measured by hand, with the ratio recorded
      next to it — not suppressed, and not counted as a violation. A residue of
      `incomplete` is normal; unmeasured `incomplete` is not
- [ ] Zero bare `opacity-*` on text, verified by grep, not by eye — and the
      measured cumulative opacity of every audited node is 1.0
- [ ] Token contrast matrix passes and is recorded in the token file, including
      every semantic tint used as a ground
- [ ] The measuring tool itself sanity-checked against a known token pair
- [ ] Each surface audited in its real rendered state (not an error/empty
      shell), from the tree the route actually mounts, with dead components
      excluded
- [ ] All four manual passes clean, including per-state scans on product
      panels (loading / empty / error)
- [ ] WCAG 2.2 additions verified (focus-not-obscured, target size,
      dragging alternative, consistent help, redundant entry, auth)
- [ ] Moderate findings fixed or documented with reason + owner
- [ ] For retrofits: the findings table is part of each screen's PR,
      alongside the before/after screenshots

An audit that ends at the report is theater; the phase ends at the clean
re-run.
