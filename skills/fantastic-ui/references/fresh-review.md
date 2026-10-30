# Fresh-context review: hero first, then the finish

The builder cannot review its own page: it remembers why every choice was
made, so it reads intent instead of pixels. Two reviews are run by a
**subagent that did not build the page**, given only screenshots and the
brief line, never the conversation, the code or the reasons. The protocol
(two stages, fresh context, a verdict as the first word) is adapted from
Hallmark by Together AI (MIT, github.com/Nutlope/hallmark); the questions
below are fantastic-ui's own.

## When

| Stage | After | Before |
|---|---|---|
| **Hero review** | the first screen is built and passes the exam on its own (fold, cover, measure, axe) | any band below the hero is built |
| **Finish review** | the whole page passes the exam | the work is called done |

A web page this skill builds gets both. A single component, an in-app
screen change or a "just build it" request gets the finish review only. A
redesign of one band gets the finish review over that band's screenshots.

Build the hero first and stop. Fixing a weak first screen is cheap while it
is the only thing on the page; after six bands are built on its type scale
and spacing, a hero rebuild becomes a page rebuild.

## Inputs (and nothing else)

Capture with the exam's browser (or `plate-check-shot.mjs`):

- Hero review: the first screen at **1280×800**, **1440×900**, **1920×1080**
  and **390×844**, no scroll.
- Finish review: full-page captures at **1440** and **390**, plus the
  first screen at 1920×1080.
- The brief line (and the Motion line) from Step 0, verbatim.
- On a preset build, the preset's name. On a DESIGN.md build, its
  Overview paragraph.

Do not pass: the code, the chat, the exam output, a list of what was tried,
or why anything is the way it is. A reviewer told the reasons agrees with
them.

## Dispatch

Spawn one subagent per review, read-only tools, with the prompt below and the
file paths of the screenshots. Do not answer its questions about intent;
the page has to answer them.

### Hero review prompt

```text
You are reviewing the first screen of a web page that is still being built.
You did not build it. Your inputs are the screenshots listed below and one
brief line; read nothing else. Stop reading by your eighth turn and write.

First word of your reply: `ship` or `fix`.

Then at most five findings, one line each, worst first. Each names what you
see, where (which capture), and what would fix it. Ask:

1. Does the headline say something only this product could say, in about
   seven words? Would it survive on a competitor's page unchanged?
2. At 1280×800, are the headline, one sentence and the first action all
   visible without scrolling? At 1920, does the content hold a capped
   width, or stretch into a band of nothing?
3. Is there a real thing on this screen (the product running, a capture, a
   photograph, a chart of real data)? If the figures are simulated, do they
   read as a sample (a visible caption), or do they pretend to be live?
4. Does anything read as a template: a small tracked-caps label above the
   headline, an accent-coloured word inside a heading other than this one,
   a gradient blob, a centred stack with two filled buttons, a styled-div
   dashboard, an empty coloured box where a picture belongs?
5. Is monospace used only where it marks data (numbers, tickers, code), or
   is it dressing buttons and labels?
6. Does the screen keep the brief line's promise, clause by clause?

Do not fix anything. Do not ask for copy, images or features the page does
not have; say in one line what the owner could supply instead.
```

### Finish review prompt

```text
You are reviewing a finished web page before it ships. You did not build
it. Your inputs are the screenshots listed below and one brief line; read
nothing else. Stop reading by your tenth turn and write.

First word of your reply: `ship`, `fix` or `rebuild`.
- ship: nothing below would make a careful designer stop the release.
- fix: specific defects, each fixable in place.
- rebuild: the page's structure fails (every band the same family, the
  first screen weak, the promise not kept); patching will not get there.

Then at most seven findings, one line each, worst first, each naming the
band and the capture. Ask:

1. Rhythm: do the bands use different layout families, or is it the same
   card grid and centred heading repeated? Is any band thin (one line of
   copy in a full-height section) or a dead band of empty space?
2. Kickers: does any section open with a small label that adds nothing
   once deleted? Tracked caps belong to data labels only.
3. Proof: is every number, quote, logo and customer on the page plausibly
   the owner's own? Flag any testimonial, logo wall or metric that looks
   invented, and any form that confirms success with nothing behind it.
4. Type: one accent word at most, in the hero only; headings otherwise one
   weight, style and colour; mono only on data; prose lines under ~75
   characters.
5. Phone (390): is anything on the desktop page missing on the phone with
   no route to it? Does any text sit under another element? Does a
   heading break with a single orphaned word?
6. Finish: link and focus states visible in the captures, selection and
   scrollbar colours not the browser default on a dark page, a real
   <title> in the tab.
7. Does the whole page keep the brief line's promise?

Do not fix anything. Never ask for content the page does not have; say in
one line what the owner could supply.
```

## Acting on the verdict

- **ship**: record it in the handoff and move on.
- **fix**: fix every finding you agree with, rerun the exam, and say in the
  handoff which findings you rejected and why. A rejected finding needs a
  reason the owner would accept, not "intended".
- **rebuild** (finish only): rebuild the failing bands from the hero down,
  then run a **new** finish review with a new subagent. Never send the old
  reviewer the fixed page; it remembers the old one.

At most two review rounds per stage. If the second round still says `fix`,
stop and show the owner the open findings with screenshots; the call is
theirs.

## Gate

- [ ] Hero review run by a fresh subagent before the second band was built
      (web pages), verdict and findings recorded
- [ ] Finish review run by a fresh subagent after the exam passed, verdict
      `ship`, or the open findings shown to the owner
- [ ] Every rejected finding has a stated reason in the handoff
