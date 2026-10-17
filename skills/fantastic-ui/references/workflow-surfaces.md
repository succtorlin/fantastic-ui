# Workflow surfaces — forms, wizards, settings, review queues, checkout

Pages the user operates rather than reads: publishing a campaign, configuring
a rule, triaging a queue, buying something. A dashboard fails by being
unreadable; a workflow fails by being **unfinishable**, or by letting the user
commit something wrong and find out after it is live. Panel anatomy, tokens and
states come from [product-surfaces.md](product-surfaces.md); form basics from
[ui-mechanics.md §7](ui-mechanics.md#7-form-mechanics).

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## Shell

```
┌───────────────────────────────────────────────┬─────────────┐
│ ‹ back   Title               ①──②──③──④       │             │
├───────────────────────────────────────────────┤ side panel  │
│ form column, max 720–820px                    │ (sticky)    │
│ 1 · Section    2 · Section    …               │ 300–380px   │
├───────────────────────────────────────────────┤             │
│ [save draft]           saved · 14:32 [Publish]│             │
└───────────────────────────────────────────────┴─────────────┘
```

- **Form column capped at 720–820px.** A field stretched to 1400px breaks the
  eye's link from label to input.
- **Side panel 300–380px**, `position: sticky` under the top bar.
- **The step rail lives in the top bar, never the sidebar.** The sidebar is app
  navigation; steps are this task's progress. Mixing them makes a step look
  like a page the user can lose.
- **At most four or five steps.** Done steps are clickable, always; the
  current step carries the accent ring; future steps are muted and inert
  until reachable.
- Below tablet width the side panel becomes a sheet opened from the action
  bar, and the rail becomes a `2 / 4` counter with a hairline progress line.

## One page or steps

**Default to one page with numbered sections.** Steps hide the total cost of
the form and raise abandonment, so they have to buy something. Step only when
at least one holds:

- more than about 15 fields;
- later answers depend on earlier ones (choosing "company" changes the next
  section);
- each step needs its own validation gate before the next can be filled.

Rules for sections:

- **Section numbers only when something refers back to them**: the step rail,
  the pre-submit check, a summary row. A number nothing points at is ordinal
  decoration; use a mono eyebrow instead.
- **Group by proximity**: the gap inside a section is clearly smaller than the
  gap between sections ([ui-mechanics.md §2](ui-mechanics.md#2-spacing-and-sizing--pick-a-scale-then-obey-it)).
- **Collapsed advanced sections show what they hold**: `Advanced · 2 changed`.
  A collapsed section must never hide a non-default value.
- **Labels go above fields, always.** Label-left layouts break at 320px and at
  200% zoom, which is a WCAG reflow failure, not a style choice. This holds
  for dense admin forms too.
- **Helper text states a consequence** ("after this time, sign-ups close"),
  never a restatement of the label.

## The field kit

- **Character counter**: `12 / 30` under the field in `--muted`, `--warn` near
  the limit, `--down` past it. Count graphemes with `Intl.Segmenter`, not
  `.length`; an emoji or a CJK character is one character to the user. **Never
  block typing** at the limit: let them overshoot and show the error. Swallowed
  keystrokes read as a broken keyboard.
- **Upload zone shows its spec before picking**: `JPG or PNG · 16:9 · up to
  5 MB`. Constraints revealed only in an error are a trap. Always pair it with
  a sibling **Choose from library** button for users without the file locally.
- **Number stepper accepts typing.** Stepper-only fields are hostile above
  about 20. The unit sits outside the input, never as placeholder text.
- **Radio cards, at most four**, for a mutually exclusive choice whose options
  differ in outcome. Each card has a title and **one line of consequence**.
  Selection is shown by the accent border and a filled radio, plus a check
  glyph so it survives greyscale. More than four options: a plain radio list
  with helper text.
- **Date range validates order on blur of the second field**, not on submit,
  and each boundary's helper says what happens at it.
- **Money**: mono `tabular-nums`, visible currency; derived amounts never sit
  in an editable-looking input.

## The side panel

Pick **one** job per page and commit to it:

- **Live preview**, when a third party will see the output. Update on about a
  150ms debounce; a preview that updates on submit lies about what it is.
  **Render the real empty state**: a blank title shows the skeleton block the
  audience will see, not lorem ipsum. Match the target frame (a phone-width
  frame for phone output) and label it as a preview.
- **Summary**, when the form produces a commitment (money, quantity, time):
  decisions in commit order, each row linking to its section.
- **Contextual help**, swapped on field focus. If it cannot follow focus, put
  the guidance under the fields and drop the panel.

## The pre-submit check

A card at the end of the form listing every requirement with its live status,
so the form walks the user to the door instead of punishing them at submit.

```
4 · Check before publishing                        1 blocker · 1 note
  ✓ Title          "Autumn restock, 50 seats"
  ✕ Cover image    not uploaded                     Upload →
  ✓ Payout         100 per person, 50 seats
  ⓘ Schedule       no end date set; it stays open   Set one →
```

- **Rows state the value, not "OK".** "Payout: 100 per person, 50 seats" lets
  the user proofread without scrolling back. "Filled in" is worthless.
- **Failing rows link to the field**: scroll to the section, move focus to the
  input, and mark the section briefly with the accent hairline.
- **Status is live**, recomputed as the user types, announced politely
  (`aria-live="polite"` on the summary count only, not every row).
- **Blockers and advisories look different.** Blocker: `--down` with a cross
  icon, prevents commit. Advisory: `--warn` with an info icon, does not. If
  they look alike, users learn to ignore both.
- **Never a disabled submit without a stated reason.** Either submit is
  enabled and pressing it lands on this card, or it is disabled and this card,
  referenced by `aria-describedby`, says exactly why.

**Derived totals show their arithmetic.** When inputs imply a number the user
answers for (a budget, a headcount, a send volume), show the total large in
mono with its breakdown below, every fee with its rate (`service fee (5%)`).
With an input missing, show the formula ("fill in payout and seats to
estimate"), never a confident `0.00`. Recompute instantly; no count-up tween on
a derived value.

## Commit

- **Autosave on about a 3s debounce** plus an explicit draft button, with
  `saved · 14:32` in `--muted` beside it. Any form over about ten fields that
  loses work on refresh has failed.
- **Confirm before consequence, not before effort.** Publish that spends money
  or goes public: yes. Save draft: no. The confirmation names the consequence
  ("This opens the task to 50 people and holds 5,000 from your balance"),
  never "Are you sure?".
- **The button carries its own progress**: label becomes `Publishing…`, the
  form gets `aria-busy="true"`, the button keeps its width. No full-page
  overlay.
- **Success is a page-level confirmation with the key facts** (ID, effective
  time, amount held) and one next action. A toast that vanishes before it is
  read is not a confirmation.

## Review queues

A queue of items to accept or reject, one detail pane beside the list.

- **Counts per state in the queue header** (`12 waiting · 40 approved · 3
  rejected`), each a filter.
- **Batch triage**: checkboxes plus a shift-click range, and a bulk action bar
  that names the count ("Approve 8").
- **Keyboard first**: `j` / `k` to move, single keys for the actions, all
  documented in a visible legend and in a `?` overlay. Keys never fire while
  focus is in a text field.
- **Undo instead of confirm.** Act immediately, then show an undo toast for
  about 8s, held open while hovered or focused. A confirm dialog on every row
  turns triage into clicking "OK".
- After an action, focus moves to the next item, not to the top of the list.

## Commerce flows

Keyed to Preset E "Terracotta Commerce" in [theme-presets.md](theme-presets.md),
though the rules hold under any preset. A product page can carry atmosphere;
listing, cart and checkout are tasks and behave like the sections above.

**Product page**

- Out-of-stock variants are **dimmed and disabled, never removed**; removing
  them hides that the size exists.
- Sizes are **buttons when there are eight or fewer**, not a dropdown. Colour
  swatches carry a text name too.
- **One primary call to action**, sticky once the user scrolls past it; a
  second action is secondary weight.
- A **trust line under it**: shipping estimate, return window, real stock.
- Reviews as a **histogram of the star distribution**, not a lone average.
- **Ask for the real product photos before generating anything.** A generated
  image of a real SKU misrepresents the goods; the preset already routes
  product shots through `compress`.

**Listing page**

- **Live result count** and a one-click **clear all** for filters.
- **Explicit sort control**; sort never changes silently when a filter does.
- Card price and add-to-cart are **pinned to the card bottom**, so they align
  across a row whatever the name length.
- Infinite or paged loading shows **"loaded 48 of 312"** and keeps the footer
  reachable.
- **Zero results** names the filters and offers a one-click reset.

**Cart and checkout**

- Quantity, variant and remove are **edited in place**, without a reload.
- **Totals always visible**, with shipping, tax and fees shown from the first
  checkout screen; "calculated at checkout" is stated, never omitted.
- **Guest checkout**; an account is offered after the order, not before.
- **Back keeps the data** the user entered.
- Correct `autocomplete` tokens (`shipping street-address`, `cc-number`,
  `cc-exp`, `cc-csc`) and `inputmode="numeric"` on numeric fields.
- **Confirmation shows the order number**, an itemised summary, the delivery
  estimate and the receipt path ("a receipt is on its way to the address you
  gave").

**Banned dark patterns.** These are absolute, and several are unlawful in
places:

- countdown timers that reset or match no real deadline;
- fabricated stock or demand ("only 2 left", "14 people viewing");
- pre-checked add-ons, insurance or upsells;
- strikethrough prices that were never actually charged;
- a close button that does anything other than close.

## Gate

- [ ] Form column computed width ≤820px at 1440px viewport
      (`getBoundingClientRect`); side panel 300–380px and sticky.
- [ ] Step rail, if present, sits in the top bar with ≤5 steps and done steps
      are focusable links or buttons (keyboard pass).
- [ ] A stepped flow has a written reason from the three conditions above.
- [ ] Every label is above its field: at 320px and at 200% zoom no field
      overflows or loses its label (resize and screenshot).
- [ ] Character counter: typing past the limit is not blocked, and an emoji
      counts as one (manual test).
- [ ] Upload spec text is visible before any file is chosen; a library button
      sits beside the zone.
- [ ] Pre-submit check rows show values; each failing row's link moves
      `document.activeElement` to its field; blockers and advisories differ in
      icon as well as colour (greyscale screenshot).
- [ ] No `disabled` submit without an `aria-describedby` reason (grep plus axe).
- [ ] Derived totals show a breakdown and every rate; with an input empty the
      total reads as a formula, not zero.
- [ ] Reload mid-form restores the draft; the saved timestamp updates.
- [ ] Submitting state: button width unchanged, `aria-busy` set, no overlay
      element in the DOM.
- [ ] Review queue: every documented key works, none fires inside a text
      field, undo restores the item.
- [ ] Commerce: out-of-stock variants present and `disabled`; checkout fields
      carry correct `autocomplete`; every banned pattern absent (grep for
      countdown and pre-`checked` add-ons, then a manual pass).
- [ ] axe clean in empty, partly filled, blocked and submitted states
      ([wcag-audit.md](wcag-audit.md)).
