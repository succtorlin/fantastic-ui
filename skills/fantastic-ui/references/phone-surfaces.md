# Phone surfaces — screens that only live on a phone

Rules for phone-only product screens: app prototypes, mobile web apps,
H5 and activity pages, data-report pages. Here the phone is the target and
the desktop is the fallback, so the viewport is one fixed rectangle, not a
range. A responsive marketing page that must also survive a phone is a
different job: use the mobile floor in
[css-architecture.md](css-architecture.md#mobile-floor) and do not build a
phone frame.

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## The frame

- **The body is locked; `#app` is the only scroll container.** Status bar
  and tab bar stay put without `position: fixed` (unreliable under iOS
  Safari's collapsing chrome), rubber-banding stays inside the frame, and
  sheets can be positioned against the frame.
- **One scroll container per tab.** Each tab owns its own `.view` with
  `overflow-y: auto`, only the active one shown, so switching away and back
  keeps each tab's position, as native apps do.
- **Reference size is 390×844.** Design there, then verify at the Gate
  widths.
- **Use `dvh` for the phone's height**, so the frame tracks the visible
  viewport as browser chrome collapses.
- **On desktop (≥560px), present the phone in a frame.** About 406px wide,
  height `min(880px, 94dvh)` so the bottom bar never falls off a laptop
  screen, bezel drawn as a spread-only shadow from a token, backdrop a
  desaturated tint of the page palette. A neutral grey surround reads as an
  unstyled screenshot.
- **Radii.** UI radii inside the frame follow the active preset
  ([theme-presets.md](theme-presets.md)). The device corner and the sheet's
  top corners are hardware and OS furniture, so they may run larger.

```css
:root {
  /* percentages sum to 100%, or color-mix returns a translucent colour */
  --bezel: color-mix(in oklab, var(--ground) 92%, var(--ink) 8%);
  --backdrop: color-mix(in oklab, var(--ground) 95%, var(--accent) 5%);
}
/* lint-surface-allow: overflow-hidden-kills-sticky — the frame scrolls inside #app, never the body */
html, body { height: 100%; overflow: hidden; }
body { background: var(--backdrop); display: grid; place-items: center; }
.phone { position: relative; width: 100%; height: 100dvh; overflow: hidden;
         display: flex; flex-direction: column; background: var(--ground); }
#app, .view { flex: 1; overflow-y: auto; overflow-x: clip; overscroll-behavior: contain; }
@media (min-width: 560px) {
  .phone { width: 406px; height: min(880px, 94dvh); border-radius: 46px;
           border: 1px solid var(--hair-lit); box-shadow: 0 0 0 10px var(--bezel); }
}
```

## Safe areas

- **`viewport-fit=cover`, and never block zoom.** Common H5 boilerplate adds
  `maximum-scale=1, user-scalable=no`. This skill deviates on purpose: those
  flags break WCAG 1.4.4 (resize text) for the people who most need pinch
  zoom. A fixed frame does not justify it.

  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  ```

- **Every inset is a `calc(env(safe-area-inset-*) + N)`.** Without
  `viewport-fit=cover` the insets read as 0 and content sits under the
  notch. The insets are 0 on desktop and in the frame, so the `calc` degrades
  with no extra rule. A bare `padding-top: 44px` is a defect.

  ```css
  .status { box-sizing: border-box; padding-top: env(safe-area-inset-top); height: calc(env(safe-area-inset-top) + 44px); }
  .tabbar { bottom: calc(env(safe-area-inset-bottom) + 12px); }
  .sheet  { padding-bottom: calc(env(safe-area-inset-bottom) + 20px); }
  #app, .view { padding-bottom: calc(env(safe-area-inset-bottom) + var(--bar-h) + 24px); }
  ```

- **`#app` bottom padding equals bar height plus inset**, or the last row
  hides under the tab bar for good.

## Thumb zone and touch

- **Primary actions live in the bottom ~55%.** That is where the thumb
  reaches on an 844px screen. The top is for display: title, hero number,
  cover. A top-left back button is the accepted exception.
- **Horizontal rails bleed to the frame edge.** Mirror the column padding
  with a negative margin so the track runs edge to edge while the first card
  still aligns with the column.

  ```css
  .rail { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory;
          margin-inline: calc(-1 * var(--side)); padding-inline: var(--side); }
  ```

- **Kill the tap flash, then design the press.**
  `-webkit-tap-highlight-color: transparent` is paired with a designed
  `:active` state on every tappable element (a token background shift or a
  small `scale`), `transition` ≤ 200ms. Hover does not exist here; `:active`
  is the only free feedback.
- **Hit area ≥24px is the gate; 44px is recommended.** Grow the hit area
  with padding, not the glyph. A 20px icon sits in a 44px button.
- **Declare `passive` correctly.** `{ passive: true }` on touch and wheel
  listeners unless the handler calls `preventDefault()`, which then needs
  `{ passive: false }` or the call is ignored.
- **Pointer Events, with `pointercancel`.** `pointerdown/move/up` works for
  touch, mouse and pen, so gestures are testable in the desktop frame. An
  interrupted drag without a `pointercancel` handler leaves the row stuck
  mid-transform.
- **Prove the gesture horizontal before taking it.** Call
  `preventDefault()` only once `|dx| > |dy|` and `|dx| > 8px`; otherwise the
  list becomes unscrollable in the swipe area. `touch-action: pan-y` on the
  row lets the browser keep vertical scroll natively.
- **Thresholds.** About 8px to start a drag, about 50px to commit a swipe.
  Below commit, animate back to rest; never leave a row half open.
- **Every swipe has a visible button.** WCAG 2.5.7 requires a
  single-pointer alternative to dragging: a row menu or a visible action
  button does what the swipe does.

## Native furniture

- **Status bar only in prototypes.** A real mobile web app gets the OS bar.
  In a prototype, draw the real time (`toTimeString().slice(0, 5)`); a fixed
  `9:41` reads as a copied mock.
- **Tab bar is `position: absolute` inside the frame, never fixed.** The
  active tab is a filled shape plus its label, not a colour change alone
  (WCAG 1.4.1). Mark it with `aria-current="page"`.
- **Bottom sheet.** Rests at `translateY(102%)` (at 100% a border still
  peeks), has a grab handle, a tappable scrim, `role="dialog"` with
  `aria-modal="true"`. Focus moves into it on open and returns to the
  trigger on close; set `inert` on `#app` and the tab bar while it is open.
  Esc closes it, and so does the Android back gesture (push a history entry
  on open, close on `popstate`).
- **Push transition keeps the list mounted.** The detail layer slides over
  the list instead of replacing it, so back returns to the same scroll
  position. Focus goes to the detail heading, and back returns it to the row
  that was tapped.
- **FLIP is measured against the frame, not the viewport.** Inside the
  desktop frame the two differ by hundreds of pixels, and a viewport-measured
  zoom flies in from off screen. Subtract the `.phone` rect from the source
  rect.
- **Toasts carry undo and are announced.** One line, above the tab bar, in a
  polite live region (`role="status"`). A toast that reports a destructive
  action carries undo, and the timer pauses while it has focus.
- **At most one FAB, never over the last list row.** Add bottom padding so
  the final row can scroll clear of it. A FAB and a fifth tab is one control
  too many.

## Type and density

- **No `clamp()` inside a fixed frame.** It reads the window, not the frame,
  so in the desktop frame the type scales with a monitor the phone does not
  have. Use fixed sizes.
- **Body 14 to 15px, minimum 14px.** Meta text still meets 4.5:1.
- **Card padding 14 to 18px**, tighter than desktop. Desktop spacing in a
  390px column wastes a third of the screen.
- **Numbers stay mono with `tabular-nums`**, as everywhere in this skill.

## Motion on the phone

- **Remove ambient layers under reduced motion.** Decorative layers go to
  `display: none`; structural transitions (sheet, push) become instant. Full
  rules in [motion-routes.md](motion-routes.md).
- **Cap visible `backdrop-filter` elements at about 4.** It is the most
  expensive property on a mid-range phone, and stacking glass cards drops
  the frame rate. Never animate a blurred element's size.

## Morphologies

- **Tab app.** Feed or list per tab, detail as a push layer. Two to five
  tabs, each its own scroll container. The default for anything that acts
  like an app.
- **Single-task flow.** A wizard or checkout on the phone: one decision per
  screen, the primary action in the thumb zone, progress at the top. The
  step and pre-submit rules are in
  [workflow-surfaces.md](workflow-surfaces.md).
- **Data report.** A scrolling report of charts, one fact per screen,
  `scroll-snap-type: y mandatory` with a progress rail. Numbers count only
  when the value is new to the reader. Chart choice and colour come from
  [data-charts.md](data-charts.md); only the width budget changes.

## Gate

| Check | How to measure |
|---|---|
| Only `#app` (or the active `.view`) scrolls | scroll on the status bar and tab bar: nothing moves; `document.scrollingElement.scrollHeight === innerHeight` |
| Each tab keeps its scroll position | scroll tab A, switch to B and back: same `scrollTop` |
| Safe areas honoured | DevTools device emulation with a notched profile (or Xcode simulator): nothing under the notch or home indicator; grep shows `env(safe-area-inset` on status bar, tab bar, sheet and `#app` padding |
| Zoom not blocked | grep the viewport meta: no `user-scalable=no`, no `maximum-scale=1`; pinch zoom works on device |
| Last row clears the bars | scroll to the end: last row and FAB fully visible above the tab bar |
| Targets measured | script over interactive elements: every `getBoundingClientRect()` ≥24×24 (44 recommended); axe `target-size` passes |
| Press states exist | grep: each tappable class has an `:active` rule; tap highlight reset present |
| Gestures are safe | listeners declare `passive` correctly; `pointercancel` handled; vertical scroll works in a swipe row; each swipe action has a visible button |
| Sheet keyboard and back path | open with keyboard: focus enters, Tab stays inside, Esc closes, focus returns to trigger; Android back (or `history.back()`) closes it |
| Tab state not colour alone | greyscale screenshot: the active tab is still identifiable |
| Toast announced | screen reader (VoiceOver / TalkBack) reads it; undo reachable by keyboard |
| Reduced motion | Rendering panel, emulate `reduce`: ambient layers gone, sheet and push instant, nothing blank |
| `backdrop-filter` budget | count elements with a computed `backdrop-filter` in the viewport: ≤4 |
| Widths | screenshots at 320, 375, 390, 414 and in the desktop frame at 1280×800: no horizontal scroll, bottom bar visible, nothing clipped |
| Height floor | 320×640 emulation: no bar overlaps content |
