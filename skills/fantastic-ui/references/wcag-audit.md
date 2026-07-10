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

## Step 6 — Report and re-audit

Produce a short findings table — one row per finding: **WCAG SC · severity ·
location · fix applied**. Then re-run Step 2 and re-do any manual pass that
had failures. Exit criteria:

- [ ] axe: zero critical, zero serious (all tags incl. `wcag22aa`)
- [ ] Token contrast matrix passes and is recorded in the token file
- [ ] All four manual passes clean, including per-state scans on product
      panels (loading / empty / error)
- [ ] WCAG 2.2 additions verified (focus-not-obscured, target size,
      dragging alternative, consistent help, redundant entry, auth)
- [ ] Moderate findings fixed or documented with reason + owner
- [ ] For retrofits: the findings table is part of each screen's PR,
      alongside the before/after screenshots

An audit that ends at the report is theater; the phase ends at the clean
re-run.
