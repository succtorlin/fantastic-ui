# Recursive whole-app polish — sweep every surface until dry

Use this mode when the ask is "polish **every** page/surface", "apply this across
the whole app", or any job whose scope is *the application*, not a named screen.
It wraps the retrofit procedure from
[product-surfaces.md](product-surfaces.md) in a traversal + ledger + batch loop
so that nothing is missed, progress survives session boundaries, and the job has
a provable end. The five disciplines and all ship gates still apply per surface
— this mode adds *coverage mechanics*, it removes nothing.

## The loop at a glance

```
INVENTORY → RECONCILE PRIOR ART → ORDER → [ BATCH: polish 3–5 → gate → commit → ledger ]* → RE-SWEEP → done when dry
```

## Phase A — Inventory by recursive traversal (never trust an estimate)

Build the surface tree from the code, not from the user's route count:

1. **Enumerate entry points.** Every route/page file (e.g.
   `find src/app -name "page.tsx"`), plus layouts, and **overlay surfaces:
   modals, drawers, toasts, dropdown menus, command palettes, popovers. Overlays
   are in scope** — they are operated like any panel and fail the same ways.
2. **Walk each entry point's import tree recursively** (grep imports, follow
   them down) and record every component that renders visible UI. Go to full
   code depth; the *visual* nesting encoding still caps at 3 ground-scale steps
   — component levels 4+ reuse level-3 ground and hairlines.
3. **Deduplicate shared components.** A panel used on five routes is ONE
   inventory row tagged `shared(×5)`, not five rows. Record which routes
   consume it.
4. **Classify each row**: `route | layout | shared-primitive | panel |
   subpanel | overlay`. A subpanel gets its own row only if it is reused
   elsewhere or independently complex; otherwise it is covered by its parent's
   pass.
5. **Drop the dead components.** A file that renders UI but has zero importers
   is not a surface — it is deletable code. Confirm every row has a consumer
   before it earns a batch slot, or the sweep spends real effort making
   unreachable components beautiful and accessible. (Seen: a drag-and-drop grid
   with no consumers that also hardcoded `rooms[0]` into every cell — it had
   never worked, and nobody noticed because nothing rendered it.)
6. **Cross-check the inventory against the running app.** Static traversal tells
   you what *could* render; the running page tells you what *does*. Open each
   route and compare. Two failure modes this catches:
   - the component you inventoried is not the one the route mounts —
     near-identical filenames, an older sibling, a re-export
   - the route is showing an **error or empty state**, so everything you audit
     next describes that shell rather than the surface. Fix the data or auth
     path first; a local dev gate that returns nothing makes a surface
     unauditable, and the findings table will look complete while being fiction
7. **Add state variants as their own coverage items** wherever styling branches:
   loading, empty, error, and state-dependent looks (selected, approved, locked,
   disabled). They ship as often as the happy path and get swept approximately
   never — and because they are awkward to reach, they accumulate the shortcuts
   (dimming, ad-hoc colors) that the main state was cleaned of.

Expect the real inventory to be 1.5–2× the route count once panels and
overlays are unpacked. If the count lands far beyond what the user's request
implied (they said "25 pages", the traversal found 120 surfaces), surface the
number **immediately** — with the ordering proposal in Phase C, not after a
batch of work is already spent.

## Phase B — Reconcile prior art (do NOT write a second brief)

Before writing any brief or token, detect whether a pass already exists: grep
for token names, accent variables, and shared primitive classes in the global
stylesheet and across components.

- **Prior system found** → recover its one-sentence brief from the existing
  tokens and treat that as canonical. Extend it; never run a parallel system.
  Two briefs = the costume party Shift 1 forbids.
- **No prior system** → proceed with Step 0 and the token phase as normal.
- Partial rollouts split the inventory: already-compliant rows skip token work
  and go straight to anatomy + accessibility checks.

### Dual-theme apps (light + dark)

The disciplines assume one ground; a dual-mode app needs **one token vocabulary
with two values per token** — each ground/ink/hairline step resolves to a
light and a dark value under the same name (CSS custom properties swapped at
the root, or paired utility classes). Never two vocabularies, never bare
dark-only colors. Design the pairing **before** token work starts, and run the
contrast matrix in *both* themes — a step that passes on dark ground routinely
fails on light.

### Prior art guarded by tests

If the existing system ships enforcement (a reskin-guard test, a lint rule, a
hex-grep CI step), that guard is part of the prior art: **extend its coverage
to every surface you migrate** as part of the batch, so the sweep leaves the
app more protected, not just prettier. Don't create a parallel guard.

## Phase C — Order the work

1. **Shared primitives first.** A shared component touches every consuming
   route, so migrating it is the highest-leverage move and must precede
   route-local work — otherwise every "finished" screen reopens when the
   primitive underneath it changes. Shared-primitive changes are their own
   PRs, verified on every consuming route (this is the sanctioned exception to
   "one PR per screen").
2. **Then routes by traffic.** No analytics? Use this fallback ranking and
   *state it once* to the user instead of silently guessing: core daily-use
   flows → primary nav destinations → secondary/settings/admin → demo and
   internal surfaces.

## Phase D — Batched migration loop

Work in **batches of 3–5 surfaces**, never one continuous sweep — quality
drifts when the whole app's state is held in working memory.

Per batch:
1. Polish each surface per [product-surfaces.md](product-surfaces.md)
   (tokens → primitives → anatomy → states).
2. **Presentation-only diff gate**: the diff must not touch data fetching,
   handlers, props contracts, or business logic. If a refactor is genuinely
   needed, split it into its own commit *before* the styling commit. Run the
   existing test suite; run the build.
3. Batch accessibility pass (semantics + axe-core; the token contrast matrix
   was validated once, globally, in the token phase).
4. Before/after screenshots at 320/768/1024/1440.
5. Commit/PR the batch, update the ledger, then take the next batch.

**PR granularity in sweep mode**: the batch is the PR unit. This supersedes
the per-screen "one PR per screen" rule from
[product-surfaces.md](product-surfaces.md) — that rule governs one-off
retrofits; a whole-app sweep at per-screen granularity produces unreviewable
PR volume. Shared-primitive migrations remain their own PRs regardless.

Checkpoint with the user after the **first** batch — confirm the brief and
ordering, **and present the true scale**: ledger row count, batch count, and a
realistic session estimate. "Polish everything" often means something smaller
once the user sees the real inventory; this is the moment to renegotiate
scope, with any cut rows recorded as deferred in the ledger. Then proceed
batch-by-batch without re-asking.

## The ledger — persistent, not mental

Track every inventory row in a file that survives the session (e.g.
`docs/plans/<date>-ui-polish-ledger.md`), one row per surface:

```markdown
| Surface | Type | Routes | Status | Batch |
|---|---|---|---|---|
| StatCard | shared(×7) | dashboard, health… | done | 1 |
| /admin/users | route | — | anatomy-pending | 3 |
```

Statuses: `not-audited → tokens-mapped → primitives-applied → a11y-passed →
done`. TodoWrite mirrors the *current batch* only; the ledger is the source of
truth across sessions. A new session resumes by reading the ledger, not by
re-deciding scope.

## Completion — loop until dry, then prove it

The job is **not** done when the ledger shows all `done`. Finish with a
re-sweep:

1. **Re-run Phase A from scratch.** New surfaces added while you were
   polishing (or missed imports) must surface here. Any new row → it enters a
   batch; the loop continues. The sweep is *dry* when a full re-inventory
   discovers zero rows that aren't `done`.
2. **Cross-screen consistency gate** (from the ship checklist): one accent
   meaning, identical focus rings, comparable sibling-panel density.
3. **Mechanical proof**: grep for hex/rgb literals outside the token file
   returns zero; grep for bare `opacity-*` on text returns zero; axe-core zero
   critical/serious **violations** app-wide, with every `incomplete` node
   measured and its ratio recorded (see
   [wcag-audit.md](wcag-audit.md) — `incomplete` is not a violation and not a
   pass, and a residue of it is normal, so "incomplete = 0" is the wrong bar).
4. **Guards for every class of bug the sweep fixed**, each mutation-tested by
   reintroducing the bug and confirming the guard goes red. A sweep should
   leave the app more protected, not just prettier — otherwise the next
   feature reintroduces what you removed.

Stopping because "the important screens are done" is not completion — it's an
unfinished sweep with an honest name. If the user wants to stop early, record
the remaining rows in the ledger as explicitly deferred so the next session
inherits scope, not amnesia.

## Red flags — you are about to break the sweep

- Working from the user's surface count instead of a traversal
- Writing a fresh brief when tokens already exist in the codebase
- Migrating a route before the shared primitives it consumes
- A "styling" diff that touches a handler or a fetch
- Holding progress in memory instead of the ledger
- Declaring done without the re-sweep
