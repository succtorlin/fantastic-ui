# Agent console — surfaces where something else does the work

A page where an agent, a pipeline or a batch job acts on the user's behalf over
time. It sits on top of whatever the page already is (a panel, a whole app
route, a phone screen) and changes what the page has to prove: not that it is
readable or finishable, but that it can be **trusted** while the user is not
the one acting. Load [product-surfaces.md](product-surfaces.md) first; panel
anatomy, tokens and depth rules are unchanged.

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## The four questions

The page answers these continuously, without the user asking. Every rule below
serves one of them; anything that serves none is decoration, and on this
surface decoration reads as evasion.

| Question | What answers it |
|---|---|
| What is it doing now? | the live step in the run stream |
| Why did it do that? | the step's expanded evidence |
| What is it costing? | the cost receipt and the budget bar |
| How do I stop it? | the stop control, always mounted |

**Three tenses, three regions, never three tabs.** The queue (future), the live
run (present) and the history with its artifacts (past) are all reachable
without navigating. A queue hidden behind a tab is a queue nobody checks, and
an unchecked queue spends money quietly. A chat transcript shows only the
present, which is why a chat window alone is not a console.

## The run stream

The stream replaces the chart as the load-bearing element: one row per step,
oldest at the top, newest at the bottom.

- **Icon shape carries the step type** (reasoning, tool, file write, network,
  waiting on you, output). Shape, not hue: a set that differs only in colour
  fails greyscale and colour-blind readers, and every historical row is muted
  anyway.
- **The label is the tool and its object**, such as `read orders.csv (2,481
  rows)`. Never `tool call`: seven rows of `tool call` is a progress bar in a
  costume.
- **Duration on every step**, mono `tabular-nums`, right-aligned. It is the
  only thing that tells "slow" from "hung", and the user makes that call every
  few seconds.
- **A 1px rail** (`--hair`) through the icon column makes the rows read as one
  process.
- **Expand shows raw input and output**, mono, verbatim, capped at about
  240px with its own scroll. Pretty-printing a payload into prose destroys
  the one property that makes it evidence.
- **Failed steps start expanded.** A failure the user has to click to see is a
  failure the page is hiding. Successful steps start collapsed.
- **Streaming text is skippable** (click or `Esc` jumps to the final text) and
  is **never the loading indicator**: a typing cursor says text is arriving,
  not which of nine steps the run is in. The step rows do that job.
- **The stream grows downward only.** Reserve height or append below, so the
  composer and the stop control never move. The control an anxious user
  reaches for must not be the one that drifts.

## Run states

`--warn` is the optional third semantic from
[css-architecture.md](css-architecture.md#the-token-block); add it to the
token block if the palette has none, and pair it with an icon and a word,
always. Nine states, defined once as an explicit `kind` enum and reused in the queue,
the stream row and the history table. This is the same discipline as the
`kind` prop in [product-surfaces.md](product-surfaces.md#audit-before-you-plate):
the branch is stated by the caller, never inferred from a label or a message.

| `kind` | Reads as | Required action |
|---|---|---|
| `queued` | muted row with its position | remove from queue |
| `thinking` | liveness pulse on the rail, elapsed timer | stop |
| `tool` | tool name and object on the active row | stop |
| `streaming` | text arriving in the step's block | stop, skip to end |
| `awaiting-input` | the approval card, in the accent | approve, edit, reject |
| `succeeded` | check icon, muted, collapsed | open artifact, rerun |
| `failed` | `--down` rail segment, expanded, error verbatim | **retry from this step**, retry all, copy error |
| `stopped` | muted, "stopped by you at step 4 of 9" | resume, discard |
| `partial` | `--warn` plus a warn icon and the word "Partial", never success styling | **see the N skipped** |

- **`failed` offers retry from the failing step.** Retry-all makes the user pay
  for the agent's mistake twice.
- **`stopped` names who stopped it and at which step.** Otherwise a user stop
  and a crash look the same.
- **`partial` is not success.** A run that handled 2,400 of 2,481 rows gets a
  warn treatment and the verb "see the 81 skipped". Painting it green is how
  81 rows go missing for six weeks.

## The stop control

Stop is the primary control of this surface, at the same tier as submit on a
form.

- **Always mounted**, disabled between runs. A button that appears when a run
  starts appears exactly when the layout is moving.
- **Never in a menu, never on hover.** It sits in the composer row on desktop
  and in the thumb bar on a phone. Target ≥44px.
- **Different shape and place from delete or clear.** Stopping is frequent and
  mostly reversible; deleting is rare and destructive. Same shape in the same
  corner guarantees the wrong press on the worst day.
- **Repaints to `stopped` immediately**, before the server answers. If the
  server call fails, show a warn banner saying the run may still be going.
  Never revert silently to `tool` or `thinking`.

```js
stopBtn.addEventListener("click", () => {
  const next = { ...run, kind: "stopped", stoppedAt: run.step };
  render(next);                                  // paint now
  api.stop(run.id).catch(() =>
    banner("Stop did not reach the server. The run may still be going.", "warn"));
});
```

## Approval cards

Before anything consequential and irreversible (a message to customers, a write
to a production table, spending money, publishing), the run pauses and emits a
card **into the stream**, where the user is already looking.

```
WILL DO     send a make-good coupon SMS to 37 customers
AFFECTS     37 messages · 0.06 each · about 2.22 total · cannot be recalled
EVIDENCE    from step 3: paid, not shipped, over 48h      [view the list]
            [ Approve and continue ]  [ Edit ]  [ Reject ]
IF NO ONE ANSWERS in 30 min: the run is cancelled
```

- **Evidence links to the step that produced it.** An approval with no
  evidence is a dialog asking the user to trust a stranger.
- **The risky number is set large**, mono, in `--warn` or `--down` when it is
  money, volume or irreversibility. The 37 is the decision.
- **Edit is required.** Approve or reject alone forces a full rerun to change
  one value, which trains users to approve things they would have edited.
- **It blocks the run, not the page.** Other runs continue and history stays
  browsable. No modal: a modal hides the evidence behind it and implies the
  whole console has stopped. A `confirm()` dialog is a fail.
- **The timeout outcome is printed on the card.** Auto-cancel is fine if it
  says so. **Auto-approve on timeout is banned.**
- Nothing is pre-selected; the agent wrote the proposal, the human decides it.

## Cost receipt

Cost is per action, variable and invisible: the profile of a tool that gets
switched off after one surprising invoice.

- **One receipt line per run**: `9 steps · 42.6s · 18.2k tokens · 0.41`. Mono,
  `tabular-nums`, `--ink-2`. A line, not a badge or a chart.
- **Per-step tokens only when the step is expanded.** Collapsed rows carry
  duration only, or the stream turns into a spreadsheet.
- **Budget as a bounded bar with its limit**: `18.40 / 50.00 this month`, fill
  in `--accent`, `--warn` from 80%, `--down` at 100%, and the bar says what
  stops at 100% ("new runs are paused").
- **Context trimming is its own step** in the stream ("context trimmed: dropped
  the raw text of steps 1 to 3"). Silent truncation becomes "it forgot what I
  told it", blamed on the whole product.
- **Money respects the product's display setting.** Some products hide AI
  spend from end users entirely. When that setting is off, the receipt drops
  the money field and the budget bar shows steps or runs instead; no cost
  figure may leak anywhere on the page, including tooltips and exports. Grep
  the rendered page, not the source files, to verify.

## Artifacts

What the agent produces (a table, a document, a diff) lands on a surface the
user can act on, not inside a message bubble.

- Every artifact carries **copy**, **export** and **made by step N** (a link
  back into the stream). The third is what makes an output defensible later.
- **Prefer a before/after diff** when the agent changed something that existed.
  A diff says "check me"; an after-only view says "trust me".

## Shell

```
┌──────────┬────────────────────────────┬──────────────┐
│ queue +  │ run stream (scrolls)       │ artifact /   │
│ history  │                            │ approval /   │
│          │ [composer]  [stop] [send]  │ context      │
└──────────┴────────────────────────────┴──────────────┘
   276px            1fr                      344px
```

- `grid-template-columns: 276px minmax(0, 1fr) 344px`. The middle column
  scrolls; every grid child gets `min-height: 0` or the page overflows instead.
- **The composer is pinned to the stream column**, not the viewport, so it
  never floats over the side panel.
- **The side panel has a resting state**: the run's context (data and tools the
  agent can reach) and the budget bar. A panel that is empty half the time
  gets collapsed on day two and misses the approval on day three.
- **Below 1180px** the side panel becomes a drawer. **Below 860px** switch to
  the phone form rather than squeezing three columns.

**Phone form.** A pinned run strip under the header (`2 running · support desk,
step 3 of 9`) opens the queue as a sheet; the stream is the page; evidence and
artifacts open in sheets from their step.

- When a run is waiting, the strip **flips to the accent (the "needs a human" colour, see Colour and motion below) with "N waiting on
  you"**. A web page cannot push a notification, so the strip is the recovery
  path when the user comes back.
- **Stop lives in the thumb bar**, ≥44px, at least 12px from send (or at the
  opposite end).
- **No auto-scroll while the user is scrolling.** Resume only within about 40px
  of the bottom; otherwise show a `↓ 3 new` pill.

## Colour and motion

One accent, as everywhere in fantastic-ui. The job of colour here is to
separate what needs a human from what handled itself.

- **Needs a human = the accent.** The approval card, the waiting strip, the
  `awaiting-input` row.
- **Automatic = muted ink or a lit hairline** (`--muted`, `--hair-lit`). Not a
  second hue; a second hue would be decoration.
- **Warn and down stay semantic**: partial, budget pressure, failure.
- **The blocked thing is louder than the 200 that resolved themselves.** Stock
  components get this backwards, making success loud and blocking quiet.
- **Exactly one liveness pulse**: the rail dot on the current step, opacity
  only, about 1.6s. It answers "frozen or working" without a spinner and stops
  when no run is active. Under `prefers-reduced-motion` it freezes at mid
  opacity; the elapsed timer still shows the run is alive.

```css
.step[data-kind="thinking"] .dot,
.step[data-kind="tool"] .dot { animation: live 1.6s ease-in-out infinite; }
@keyframes live { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .step .dot { animation: none; opacity: .65; }
}
```

No orb, glow, shimmering border or particles: ambient motion means "look at
me", and here that must only ever mean something is wrong.

## Anti-patterns

- Chat bubbles as the whole surface: no queue, no states, no stop, no
  artifacts.
- One global spinner standing in for nine steps.
- Stop hidden behind hover, inside a menu, or unmounted between runs.
- Success styling on a partial run.
- Approval through `confirm()` or a modal with no evidence link.
- Fake-precise agent stats ("98.7% accurate", "4.1x faster") on a page whose
  premise is that the user can check.
- Filler in step labels ("Let me think...", "On it!"). A step label is a log
  line.

## Gate

- [ ] Queue, live run and history are all on screen or one tap away, with no
      tab hiding the queue (inspect at 1440px and 375px).
- [ ] Every stream row has a shape-distinct icon, a tool-plus-object label and
      a duration (screenshot in greyscale; types still distinguishable).
- [ ] Failed steps render expanded on load; payload blocks scroll inside a
      ≤240px cap (browser measurement of the block's `clientHeight`).
- [ ] All nine `kind` values render, each screenshotted with its required
      action visible; `partial` uses `--warn`, never success styling (grep the
      state map).
- [ ] Stop is in the DOM with no run active (`document.querySelector` returns
      it, `disabled`), ≥44px (`getBoundingClientRect`), and not inside a menu.
- [ ] With the stop request blocked in devtools, the row still shows `stopped`
      and a warn banner appears; no silent revert.
- [ ] The stop control's `getBoundingClientRect().top` is unchanged across a
      full streamed response.
- [ ] Approval cards carry will-do, affects, a working evidence link, approve,
      edit, reject and a printed timeout outcome; no `confirm(` or modal
      (grep).
- [ ] Receipt line present per run; budget bar shows its limit and its 100%
      behaviour; with the spend display setting off, the rendered page
      contains no currency figure (grep the DOM text).
- [ ] Exactly one infinite animation while a run is active, zero when idle
      (`document.getAnimations()` in the console); reduced motion leaves a
      static dot.
- [ ] Phone: stop in the thumb bar ≥12px from send; scrolling up during a run
      shows the new-steps pill and does not yank the scroll position.
- [ ] axe clean in idle, running, awaiting-input and failed states
      ([wcag-audit.md](wcag-audit.md)).
