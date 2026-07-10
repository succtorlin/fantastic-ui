# Product surfaces — retrofitting pages, panels, and subpanels

How to apply the fantastic-ui disciplines *inside* the product: existing app
pages, dashboards, panels, and every level of subpanel. The five disciplines
from SKILL.md are unchanged; this file covers the procedure and the anatomy.

## Why product surfaces are different

A marketing page is read once, top to bottom, by a stranger. A product
surface is operated hundreds of times by someone who already trusts you.
Consequences:

- **Consistency beats novelty.** One screen with its own palette destroys
  the instrument feel of all the others. The unit of design is the app.
- **Attention beats rhythm.** Nothing needs to seduce a scroller; everything
  needs to answer "what matters right now, and where do I act?"
- **Density is a feature.** Operators want more per screen, not whitespace
  theater — but density only works when hierarchy is doing the sorting.
- **States are most of the UI.** Empty, loading, error, and stale states are
  seen constantly in real use and designed never. Design them first-class.

## Phase 1 — Audit (do this before any opinion)

1. Inventory every route/page, and within each, every panel and subpanel.
   A simple tree is enough:

   ```
   /dashboard
     ├─ portfolio-summary (panel)
     │    ├─ holdings-table (subpanel)
     │    └─ allocation-donut (subpanel)
     ├─ alerts (panel)
     └─ activity-feed (panel)
   ```

2. Screenshot every screen *before touching anything* (these become the
   before/after evidence and catch regressions).
3. Extract the current vocabulary: every color literal, font stack, radius,
   shadow, spacing value in use. Grep for `#[0-9a-fA-F]`, `rgb(`, `hsl(`,
   `box-shadow`, `font-family`. Typical finding: 30+ greys, 3 competing
   accents, 5 radii. Write the count down — it's the baseline you report
   improvement against.
4. Identify colors that already *mean something* to users (status greens,
   error reds, chart up/down). These become the semantic set and must keep
   their meaning through the migration.
5. Rank screens by traffic/importance. Migration order comes from this
   list, not from what's easiest.

## Phase 2 — One brief, app-level tokens

Write the one-sentence brief for the **whole application** (Step 0 in
SKILL.md), tested against the two or three most important screens. Then
install the token block from `css-architecture.md` at the app shell —
`:root` or the app's root class — instead of a page class. Two additions
for app work:

```css
:root {
  /* ground scale gains named DEPTH steps for panel nesting */
  --ground-0: #0b0b0a;   /* page background          */
  --ground-1: #121110;   /* panel                    */
  --ground-2: #181613;   /* subpanel                 */
  --ground-3: #1f1c17;   /* sub-subpanel / input wells */
  --hair:     #26231d;   /* 1px separators everywhere */
  --hair-lit: #35301f;   /* hover/active hairline     */

  /* density scale — spacing comes from here, not ad-hoc values */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px;
}
```

Rules that make the token commit safe and mechanical:

- Map old values to nearest tokens **without redesigning** — same screens,
  same layout, values swapped. Review as a no-visual-change-intended PR
  (screenshots will show minor unification; that's the point).
- Delete a mapped literal at its source; never leave both.
- Page-local color definitions are forbidden from this commit forward. If a
  screen "needs" a new color, that's a design conversation about the token
  set, not a local override.

## Phase 3 — Shared primitives

Build once, from tokens, before migrating any screen:

- `.panel` — `background: var(--ground-1); border: 1px solid var(--hair);`
  radius from the single app radius token. No shadow.
- `.panelHead` — the panel header (anatomy below).
- `.stat` — big mono number + small muted label, `tabular-nums`.
- `.dataTable` — hairline row separators, mono numerals right-aligned,
  header row in eyebrow style.
- `.state` — shared empty/loading/error presentation (below).
- `.focusable`, `.eyebrow`, `.mono`, `.srOnly` — same as the marketing set.

## Panel anatomy

Every panel, at every nesting level, has the same skeleton so the eye never
re-learns a screen:

```
┌──────────────────────────────────────────────┐
│ — EYEBROW LABEL          meta · actions  ⋯  │  ← head: mono eyebrow left,
│ Panel Title (only if eyebrow isn't enough)   │    quiet meta/actions right,
├──────────────────────────────────────────────┤    hairline below
│  body — data at panel density                │
│  ┌────────────────────────────────────────┐  │
│  │ — SUBPANEL EYEBROW                     │  │  ← subpanel: ground-2,
│  │  denser body                           │  │    same anatomy, one
│  └────────────────────────────────────────┘  │    ground step lighter
└──────────────────────────────────────────────┘
```

- **Head**: eyebrow (mono, uppercase, tracked, accent or muted — accent only
  if this panel is the screen's primary), optional title in the display
  face only for top-level panels; actions right-aligned, icon-quiet.
- **Separation** is always a hairline (`--hair`), never a shadow, never a
  background jump of more than one ground step.
- **Primary panel** on a screen is marked by *position and span* (top-left,
  widest column) and may use the accent in its eyebrow. Sibling panels use
  muted eyebrows. Never mark primacy with a different background color.
- **Actions**: one primary action per screen gets the accent button; panel-
  level actions are ghost/hairline buttons. If every panel has an accent
  button, none of them matters.

## Subpanel nesting and depth

- Depth is encoded **only** by the ground scale: page `--ground-0`, panel
  `--ground-1`, subpanel `--ground-2`, one more level at `--ground-3`.
- **Maximum three nested levels.** Needing a fourth means the screen should
  split (drawer, dedicated subpage/route, or progressive disclosure).
- Type steps down with depth: panel body 14px → subpanel 13px → data 12.5px
  mono (tune to the app's scale, but the direction is fixed: deeper =
  denser).
- Radius steps down or stays equal with depth — a subpanel is never rounder
  than its parent.
- A subpanel that becomes a full page (drill-down navigation) keeps its
  eyebrow text as the page's breadcrumb/eyebrow — vocabulary continuity is
  what makes drill-downs feel instrumented.

## States (design these before the happy path)

All three states render *inside the panel body*, keeping the head visible so
the user never loses the map:

- **Loading** — skeleton bars on the ground scale (`--ground-2` pulsing to
  `--ground-3`), matching the real content's layout. Pulse is gated behind
  `prefers-reduced-motion` (static bars otherwise). Never a full-screen
  spinner for a panel-level fetch.
- **Empty** — one muted sentence stating what will appear here and the one
  action that fills it ("No alerts configured — Add your first rule").
  No illustration clip-art. Mono microcopy is fine; jokes are not.
- **Error** — semantic red appears *here and only here* (plus real
  destructive actions): one line of what failed, one retry action, error
  detail behind a disclosure. The panel border may take a red hairline;
  the background never floods red.
- **Stale/degraded** (data apps) — timestamp in the panel head goes warn-
  colored with a mono "as of 14:02:11Z" label. Never silently show old data
  as fresh; candor is a premium signal inside the product too.

## Live proof, in-app version

The marketing hero's "live canvas" discipline maps to: **real data, rendered
with the same care.** Sparklines in stat rows, mini-charts in table cells,
event pulses in feeds — all drawn from palette tokens, DPR-aware, RAF paused
on `visibilitychange`, one static frame under `prefers-reduced-motion` (the
lifecycle rules in `canvas-hero.md` apply verbatim). Decorative animation has
no place in-product; every moving pixel must encode a data change.

## Migration order and PR discipline

- One screen (or one panel family) per PR. Each PR: before/after
  screenshots, information preserved exactly, presentation rebuilt from
  primitives, and the accessibility phase run on the migrated screen —
  axe sweep in every designed state plus the keyboard pass, findings table
  included in the PR (see `wcag-audit.md`).
- Highest-traffic screen first — it forces the primitives to be right and
  pays back immediately. Settings and admin screens last.
- Mid-migration inconsistency is expected; a `docs/ui-migration.md` tracker
  (screen → status) keeps it honest and finite.
- Never fork a token or primitive locally to bridge "just this screen".
  If a screen genuinely can't use a primitive, the primitive is wrong —
  fix it centrally, in its own commit.

## Cross-screen consistency gate (final pass)

Run after the last screen migrates; these are pass/fail:

- [ ] `grep -rn "#[0-9a-fA-F]\{3,8\}" src/ --include='*.css' --include='*.tsx'`
      finds colors only in the token file
- [ ] The accent means the same thing on every screen (primary action /
      current selection / focus), and appears in ≤ ~5% of any screen's pixels
- [ ] Semantic colors audit: every red is an error or a loss; every green is
      success or a gain; none are decoration
- [ ] Focus ring identical everywhere; full keyboard traversal of the two
      most complex screens
- [ ] Panel anatomy identical everywhere (eyebrow, hairline, actions-right)
- [ ] Nesting depth ≤ 3 on every screen; no shadows encoding depth
- [ ] Every panel has designed empty/loading/error states (throttle the
      network and kill the API to verify, don't assume)
- [ ] Responsive pass per screen at 320/768/1024/1440 — panels reflow to a
      single column without horizontal overflow
- [ ] Accessibility phase exit criteria met app-wide (`wcag-audit.md`
      Step 6): axe clean incl. wcag22aa, token contrast matrix recorded,
      manual passes done on the two most complex screens
- [ ] Before/after screenshot pairs archived for every screen
