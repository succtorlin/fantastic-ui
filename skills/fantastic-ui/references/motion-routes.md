# Motion routes — the cheapest route that does the job

Every motion decision has two parts: the effect the viewer sees and the route
that builds it. The same effect can cost four lines of CSS or a 100KB library.
This file picks the route, lists the motion that reads as slop, and names how
each rule is measured. The canvas lifecycle lives in
[canvas-hero.md](canvas-hero.md); the reduced-motion audit lives in
[wcag-audit.md](wcag-audit.md) §3c.

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## The route ladder

Start at R1. Stop at the first route that does the job. Each step down costs
weight or DOM fidelity, and a step is justified only by something the cheaper
route cannot do.

| Route | Owns | Still form (reduced motion, or no support) |
|---|---|---|
| **R1 · CSS transition / keyframes** | state change, entrance, micro-interaction, `clip-path` and `stroke-dashoffset` reveals | the authored end state |
| **R2 · Native scroll-driven animation** (`animation-timeline: view()` / `scroll()`) | parallax, per-item arrival, progress rails, sticky-pin tracks | content simply visible, no timeline |
| **R3 · View Transitions + WAAPI** | filter re-sort, list add/remove, expand to detail, same-document route change; cross-document `@view-transition` for page to page | an instant swap |
| **R4 · Canvas 2D** | the live-proof hero: entities moving through a meaningful space | one composed frame, loop never scheduled |
| **R5 · CSS 3D space** (perspective transforms) | a rare spatial scene made of real DOM panels | camera parked at its best composition |

- **R2 needs a no-support path.** Wrap every timeline in
  `@supports (animation-timeline: view())`. Outside it the content is already
  in its final state, so older engines show a still page, not a hidden one.
- **R3's fallback is an instant swap.** Call the update directly when
  `document.startViewTransition` is missing or reduced motion is on. Never
  leave the old browser with a half-run tween.
- **R4 inherits the lifecycle contract.** DPR cap at 2, one reduced-motion
  frame, tab-hidden pause, full cleanup, token colours. See
  [canvas-hero.md](canvas-hero.md); this file does not restate it.
- **R5 is used rarely.** CSS 3D has no depth buffer, so overlapping panels at
  similar depth flicker as the paint order flips. Space panels so they cannot
  overlap, and keep children inside their parent's plane.

Not used in this skill, on purpose:

- **GSAP.** Roughly 100KB with ScrollTrigger for work R1 to R3 do natively,
  including pinning (sticky plus a scroll timeline) and staggers.
- **WebGL and Three.js.** Text rendered into a texture leaves the DOM: it
  cannot be selected, indexed or read by assistive tech. A decorative
  particle field proves nothing about the product.

```css
/* R2: per-item arrival. Final state is authored; keyframes only say "from". */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .row { animation: arrive linear both;
           animation-timeline: view(); animation-range: entry 0% entry 70%; }
  }
}
@keyframes arrive { from { opacity: 0; transform: translateY(12px); } }
```

```js
// R3: one wrapper for every DOM change that should be legible.
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const transition = (update) =>
  !document.startViewTransition || REDUCE ? update() : document.startViewTransition(update);
```

```css
/* R3 cross-document: page to page, off under reduced motion. */
@view-transition { navigation: auto; }
@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }
```

## Effect → route lookup

| The page wants | Take | Note |
|---|---|---|
| things settling into place as you scroll | R2 | `view()` timeline, `entry` range |
| parallax | R2 | `scroll()` timeline on a `transform`, one layer, not every layer |
| filtered cards re-sorting | R3 | unique `view-transition-name` per card, set inline |
| list add / remove | R3 | the new row gets a name for one transition, then loses it |
| a number counting up | R1, or a ~10-line WAAPI / rAF counter | **only when the value actually changes**, never on load to fake liveness |
| masked or cropped image / panel reveal | R1 | `clip-path: inset()` animates on the compositor |
| an SVG line drawing itself | R1 | `stroke-dashoffset` from `pathLength="1"` |
| page to page | R3 | cross-document `@view-transition` |
| a pinned horizontal track | R2 | `position: sticky` inside a tall parent, track driven by a `view-timeline`; no scroll handler |
| a card expanding to detail | R3 | shared `view-transition-name` on card and detail |

- **If every row of a page's motion plan resolves to R1 to R3, the page ships
  zero motion JS** beyond the few lines of the wrapper above. That is the
  normal case, not the modest one.

```css
/* Pinned horizontal track: sticky pin, scroll-timeline drive, zero JS. */
.track-section { height: 300vh; view-timeline: --track block; }
.track-view    { position: sticky; top: 0; height: 100svh; overflow: hidden; container-type: inline-size; }
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .track { width: max-content; animation: slide linear both;
             animation-timeline: --track; animation-range: contain 0% contain 100%; }
  }
}
@keyframes slide { to { transform: translateX(calc(-100% + 100cqi)); } }
/* 100cqi = the track-view's width (make .track-view `container-type: inline-size`);
   100vw would include the scrollbar and clip the last ~15px */
/* No support or reduced motion: un-pin; the track is a native scroll rail. */
@supports not (animation-timeline: view()) {
  .track-section { height: auto; } .track-view { position: static; height: auto; overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .track-section { height: auto; } .track-view { position: static; height: auto; overflow-x: auto; }
}
```

## Motion gate rules

- **Motivated.** Each motion shows a state change, a spatial relationship or
  product behaviour. Write the reason in one sentence; no sentence, no motion.
- **Survives removal.** Strip every animation and transition: all content is
  present and legible. Motion is enhancement, never the thing that makes
  content appear.
- **Author the final state, animate from elsewhere.** The common
  `0.01ms` reduced-motion backstop stops motion; it does not compose a still.
  Anything authored at `opacity: 0` stays invisible under it. Keyframes carry
  only `from`, and the element's own rules are its resting state.
- **Hidden-start classes come from JS.** For JS-driven reveals, the class
  that hides an element before it enters is added by the script, so with JS
  off nothing was ever hidden. A stylesheet rule like
  `[data-reveal] { opacity: 0 }` fails this.
- **Pinned sections un-pin under reduced motion.** A frozen pin still traps
  the scroll. Drop `position: sticky` and the tall parent; the content
  becomes a normal stack or rail.
- **Ambient layers are removed, not frozen.** Under reduced motion, take a
  decorative layer out (`display: none`) unless its frozen frame is a
  designed still. A canvas hero's single composed frame is a designed still;
  rain frozen mid-fall is not.
- **Compositor-only properties.** Animate `transform`, `opacity`,
  `clip-path`, and `filter` sparingly. Never `width`, `height`, `top`,
  `margin` or `box-shadow`.
- **No per-frame layout reads on scroll.** Scroll work goes through
  IntersectionObserver or scroll-driven CSS. A scroll handler that reads
  `getBoundingClientRect` every frame is a layout-thrash bug.
- **Measure it.** DevTools Performance panel during a scroll: no long tasks,
  no purple layout bars per frame. Rendering panel: emulate
  `prefers-reduced-motion: reduce`. Then a JS-disabled pass.

## The beat sheet

A marketing page is a few beats, not one engine. Four beats, each from a
different family, plus a declared still version:

| Beat | Job | Route |
|---|---|---|
| **First screen** | the live proof of what the product does, if it has a live behaviour; otherwise a still or a quiet R1 entrance | R4, else R1 or none |
| **Scroll** | what rewards moving down | R2 |
| **Interaction** | what responds on a real control (filter, toggle, tab) | R1 or R3 |
| **Close** | a quiet ending | R1 |
| **Still** | what each beat becomes under reduced motion | declared, not implied |

- **At most one heavy beat** (R4 or R5) and **at most one marquee** per page.
  Two spectacles compete and both lose.
- **Each beat from a different effect family.** A family is the kind of
  effect (arrival, re-sort, line draw, mask reveal, live data), not the
  route: an R1 hover on a filter and an R1 line drawing in at the close are
  different families. Two scroll-arrival beats are a repeat, not a
  composition.
- **Write a one-line Motion plan beside the brief line**, so the plan can be
  vetoed before it is built:
  `Motion: canvas RRG orbit · rows settle on scroll · filter re-sorts cards · footer rule draws in · still = orbit frame, rows in place.`

**Product surfaces.** State transitions are the only family that belongs on
a product surface by default: list add/remove, panel expand, status change,
filter re-sort. They are also the family most often missing, which is why a
dashboard update feels like a page refresh. Give them R3 before anything
else; see [product-surfaces.md](product-surfaces.md).

## Motion slop

Ban these. Each has been shipped so often it now reads as a template tell.

- fade-up 24px on every section, all the way down the page
- connected-dot constellation backgrounds with lines between neighbours
- purple-to-cyan animated mesh gradient blobs
- typewriter headlines with a blinking cursor
- images greyscale until hover
- a laggy custom cursor ring chasing the pointer
- animated film grain (freeze grain, if grain is used at all)
- parallax on everything
- count-up stats on load
- infinitely bouncing scroll cues

## Make procedural motion look intentional

A Canvas 2D wave at constant amplitude to both edges reads as a screensaver.
Two moves fix it: multiply amplitude by a Gaussian envelope `exp(-d²·k)` around
the focal point, and add a second harmonic at a non-integer frequency ratio
with opposite drift so the pattern never visibly loops. Colours come from the
tokens via `tokenHex` ([canvas-hero.md](canvas-hero.md)).

```js
// d runs -1..1 across the canvas; cx is the focal point; t is time.
ctx.beginPath();
for (let x = 0; x <= W; x += 4) {
  const d = (x - cx) / (W / 2);
  const amp = Math.exp(-d * d * 2.2) * A;                // peaks at the focus, fades to 0
  const y = cy + Math.sin(x * f + t) * amp * 0.42
               + Math.sin(x * f * 2.37 - t * 1.4) * amp * 0.2; // 2.37: non-integer, opposite drift
  x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
}
ctx.strokeStyle = fade(ACCENT, 0.6); ctx.stroke();
```

## Gate

| Check | How to measure |
|---|---|
| Every motion has a written one-sentence reason | the Motion plan line exists beside the brief; each beat names its reason |
| Content survives removal | DevTools: disable CSS animations (Animations panel, playback 0) and JS; every heading, number and image is visible |
| No content authored hidden | grep the stylesheet for `opacity: 0` / `clip-path: inset(0 0 100%` on content selectors outside `@keyframes` or a JS-added class |
| Reduced motion composes a still | Rendering panel, emulate `reduce`: canvas shows one composed frame, pins are un-pinned, ambient layers are gone, nothing blank |
| R2 has a no-support path | every `animation-timeline` sits inside `@supports`; view in an engine without it (or delete the rule) and the page is complete |
| R3 falls back to an instant swap | stub `document.startViewTransition = undefined`; filters and expands still work |
| Compositor-only | Performance panel during scroll and interaction: no per-frame Layout or Paint on animated elements |
| No scroll-handler layout reads | grep for `addEventListener("scroll"`; any handler body must not call `getBoundingClientRect`, `offset*`, `client*` or element `scrollTop`/`scrollHeight` (reading `window.scrollY` for the nav-blur flag is fine) |
| Budget | count beats: ≤4, one heavy (R4/R5), ≤1 marquee, no two from the same family |
| No library | grep imports and `<script src>` for `gsap`, `three`, `pixi`, `lottie`: zero matches |
| No slop | review against the Motion slop list; any match is a fail |
| Auto-motion over 5 s can be paused | per [wcag-audit.md](wcag-audit.md) §3c (2.2.2) |
