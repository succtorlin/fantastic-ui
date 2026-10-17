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

### Back-office or workbench? Decide before density

Ask what the surface revolves around, not how many people use it or what
screen it is on:

- **A batch of business objects** (orders, tickets, holdings, users,
  listings) makes it a **back-office**. It is neutral and dense: tables,
  filters, bulk actions, saved views. Character lives in precision, and the
  accent is spent almost entirely on state and the one primary action.
- **One thing the user does over and over** (a daily check-in, a writing
  desk, a trading blotter for one book, a run console for one agent) makes it
  a **workbench**. It can carry more character and a single focal surface,
  and must make the repeated action nearly free: one keystroke or one tap,
  no navigation, the last state remembered.

The answer changes density, the shell (sidebar list vs single focal column)
and how much of the brief's personality reaches the page. When the brief is
just the word ("make me a dashboard", "工作台"), ask that one question rather
than guessing. When an agent does the work inside either kind of surface, the
run-console layer in [agent-console.md](agent-console.md) stacks on top.
Forms, wizards, settings and review queues are in
[workflow-surfaces.md](workflow-surfaces.md); a brief for one component (a
button, an input, a card) skips this file and goes to
[component-states.md](component-states.md); charts are in
[data-charts.md](data-charts.md); phone-only product screens are in
[phone-surfaces.md](phone-surfaces.md).

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
6. **Write down what must not change**, before any edit: the information
   and controls on each screen, the navigation and IA, the primary font, the
   accent's meaning, and any copy the user has asked to keep. Removing a
   section, changing the primary font, changing the accent, or moving
   navigation needs the user's explicit yes, every time, even mid-sweep. Say
   each such change aloud; never let one ride inside a presentation diff.

## Phase 2 — One brief, app-level tokens

Write the brief line for the **whole application** (Step 0 in SKILL.md),
imagery clause included, tested against the two or three most important
screens. When the app already has a token system, recover its brief instead,
and it still gets an imagery clause. Then
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
  header row in eyebrow style. Sortable headers are real buttons with
  `aria-sort` on the `th`; the table states its count ("1,204 orders ·
  showing 1–50"); one row density is locked per table (compact 32–36 px,
  default 40–48 px, comfortable 56–64 px, never mixed); loading uses skeleton
  rows at the real row height so nothing jumps when data lands; a filtered
  table that returns nothing shows the filtered-to-nothing state with a
  clear-filters action, never the empty state.
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
  No illustration clip-art. Every empty and first-run state — every panel,
  every subpanel — inherits the route's plate, or svg texture on a route
  without one, from the shared empty-state primitive
  ([recipe](ai-atmosphere.md#recipe-hand-the-plate-down)), chosen by an
  explicit `kind` prop ([audit before you plate](#audit-before-you-plate));
  it leaves when the first row renders. Mono microcopy is fine; jokes are not.
- **Error** — semantic red appears *here and only here* (plus real
  destructive actions): one line of what failed, one retry action, error
  detail behind a disclosure. The panel border may take a red hairline;
  the background never floods red.
- **Stale/degraded** (data apps) — timestamp in the panel head goes warn-
  colored with a mono "as of 14:02:11Z" label. Never silently show old data
  as fresh; candor is a premium signal inside the product too.

### Audit before you plate

The plate makes an empty state look designed, so a wrong branch that lands
there looks designed too. Before the shared primitive paints a plate, trace
every branch that renders it and write down its precondition:

| Branch | Must be true before it renders | Plate |
|---|---|---|
| loading | the fetch is in flight | no — skeleton |
| error | the fetch failed, or the payload is unusable | no — semantic red, retry |
| filtered | data exists; the user's filter excluded all of it | no — reset action |
| empty | the fetch succeeded and returned nothing | yes |
| first-run | the user has never created the thing | yes |

- **Failures falling through to empty copy is a bug, and the plate makes it
  worse.** A typical shape: `if (error) return null` inside a child, or
  `rows ?? []` on a failed response, and the parent shows "No trades yet"
  over the route's plate. The user reads a confident, decorated "nothing
  here" when the truth is "we could not load it". A review of one app's
  plated states found error paths doing exactly this. Fix the branch first,
  then plate.
- **Give the shared primitive an explicit `kind` prop**:
  `kind: "empty" | "first-run" | "filtered" | "loading" | "error"`. The
  plate renders only for `empty` and `first-run`. Never decide by matching
  the label or the copy ("No …", "Nothing …"): a label changes with a copy
  edit, and an error message that starts with "No" gets a plate.
- Make `kind` required, so every call site states which branch it is, and
  grep the call sites once: every `kind="empty"` must sit behind a
  successful fetch.
- Test the failure path: kill the API or block the request, and confirm the
  panel shows its error state with no plate.

## Live proof, in-app version

The marketing hero's "live canvas" discipline maps to: **real data, rendered
with the same care.** Sparklines in stat rows, mini-charts in table cells,
event pulses in feeds — all drawn from palette tokens, DPR-aware, RAF paused
on `visibilitychange`, one static frame under `prefers-reduced-motion` (the
lifecycle rules in `canvas-hero.md` apply verbatim). Decorative animation has
no place in-product; every moving pixel must encode a data change.

The motion family that *does* belong in-product is the one most often
missing: **state transitions**. A row added to a list, a filtered set
re-sorting, a panel expanding to detail, a status flipping from running to
done. Use the cheap native routes (CSS transitions, View Transitions, WAAPI)
from [motion-routes.md](motion-routes.md) so the eye can follow what
changed, and make every one instant under reduced motion. A count that
animates up on page load, with nothing having changed, is the opposite: it
shows a wrong number for a second and encodes nothing.

## Imagery in-product

At most one plate per route (header strip or a state surface), generated
from the app tokens, static, and never behind data. A route without one
records why in the ledger. Every panel and subpanel inherits it in its empty
and first-run states — built once in the shared empty-state primitive, never
per panel; populated panels never carry imagery. A plate must be both
readable under text and visible on the page — the two gates in
[ai-atmosphere.md §7](ai-atmosphere.md#7-real-pixel-contrast-and-visibility-check),
measured with `scripts/plate-check.js` in the slots named in
[plate-slots.md](plate-slots.md).
The canonical rule is
[the plate rule in ai-atmosphere.md](ai-atmosphere.md#the-plate-rule), and the
procedure, tools and markup are there too.

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

- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/ --include='*.css' --include='*.tsx'`
      finds colors only in the token file. Translucency outside it is
      `color-mix(in oklab, var(--token) N%, transparent)` — plate scrims and
      tints included — which this grep correctly lets through. Canvas
      drawing code is the one exception: a canvas cannot read `var()`, so it
      reads the tokens at runtime with `getComputedStyle` (as
      [canvas-hero.md](canvas-hero.md) does). Its colour constants come from
      those tokens and are never invented
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
- [ ] Imagery: ≤ 1 plate per route, none inside a data panel, text over each
      plate measured on the page with `plate-check.js`, each plate visible
      after its scrim (≥8% ≥1.1:1 and ≥1% ≥1.3:1 against the page), the
      numbers cited, every asset (`plate`, `ai`, `compress`,
      `svg`) with a line in the imagery ledger (`--ledger`)
- [ ] Every panel and subpanel empty/first-run state inherits the route's
      plate (or svg texture) from the shared primitive; filtered, failed,
      loading, stale and alarm states stay plain
- [ ] Every plated branch audited: the primitive takes an explicit `kind`,
      and no error or fetch-failed path falls through to empty copy
- [ ] Before/after screenshot pairs archived for every screen
