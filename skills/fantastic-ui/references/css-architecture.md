# CSS architecture for instrument-grade pages

The stylesheet is a CSS module (`landing.module.css` pattern). Two structural
rules make it safe and auditable:

1. **Everything scoped under the page root.** Every selector is either a
   module class or `.page <element>`. No bare `h1 { … }` that could leak if
   the bundler ever flattens scope, and the page can't be styled by the app's
   global CSS either — the design survives being dropped into any codebase.
2. **All tokens on the root class.** The entire visual direction is legible
   (and changeable) in the first 30 lines.

## The token block

This is the shipped block from the worked example ("sodium" is the accent
name — rename per project, keep the *roles*):

```css
.page {
  /* ground scale — near-black tinted toward the accent's warmth */
  --ground: #0b0b0a;
  --ground-2: #0e0d0a;
  --panel: #151309;
  --panel-2: #1b1810;

  /* hairlines — surfaces are defined by 1px borders, not shadows */
  --hair: #26241b;
  --hair-lit: #413b28;

  /* ink scale — off-white, same warmth; never pure #fff on dark */
  --ink: #f3efe6;
  --ink-2: #cbc5b5;
  --muted: #8f8873;

  /* the one accent + its highlight + a dim wash for backgrounds */
  --sodium: #f2a83c;
  --sodium-hi: #ffc164;
  --sodium-dim: rgba(242, 168, 60, 0.14);

  /* semantic — used ONLY with their meaning */
  --up: #35c4ac;
  --down: #e3563f;
  /* optional third semantic for partial / stale / needs-attention states
     (agent runs, budgets, stale data). Add it only when a surface has such
     states; validate it in the contrast matrix like any ink. Here it shares
     the accent's amber, so warn states MUST carry an icon + a word
     ("Partial", "Stale"); see wcag-audit.md, "The accent must not
     impersonate a semantic". */
  --warn: #e8b04a;

  /* three type faces, all system stacks — zero font requests */
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", ui-serif, Georgia, serif;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;

  --edge: 1px solid var(--hair);
  --maxw: 1200px;

  background: var(--ground);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
  overflow-x: clip; /* never `hidden`: it makes .page a scroll container and kills the sticky nav */
}
```

Deriving a palette for a different accent: pick the accent first, then tint
the ground/ink scales a few degrees toward its hue at very low chroma. The
page should feel like one continuous material, not gray boxes with a colored
sticker.

Small tells that sell the direction:

```css
/* even text selection is on-palette */
.page ::selection { background: var(--sodium); color: #120d02; }

/* serif headlines, balanced wrapping */
.page h1, .page h2, .page h3 {
  font-family: var(--serif);
  font-weight: 600;
  text-wrap: balance;
  letter-spacing: -0.01em;
  margin: 0;
}
```

Note the CTA text color `#120d02` — near-black *tinted toward the accent*,
not `#000`, for text sitting on the accent color.

## Shared primitives

Small composable classes used everywhere via `className={`${s.a} ${s.b}`}`:

```css
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 24px; }

/* mono kicker with a rule-line — the section signature */
.eyebrow {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sodium);
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
}
.eyebrow::before {
  content: "";
  width: 22px; height: 1px;
  background: var(--sodium);
  opacity: 0.6;
}

/* data voice */
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

/* display headline — clamp, tight leading, accent italic for THE word */
.display {
  font-size: clamp(2.6rem, 6.4vw, 5rem);
  line-height: 1.02;
  letter-spacing: -0.025em;
}
.display em { font-style: italic; color: var(--sodium-hi); }

/* buttons: mono face, 2px radius (instrument, not pill), lift on hover */
.btn {
  display: inline-flex; align-items: center; gap: 0.5em;
  font-family: var(--mono);
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  padding: 0.85em 1.35em;
  border-radius: 2px;
  border: var(--edge);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.2s, border-color 0.2s, color 0.2s;
}
.btnPrimary { background: var(--sodium); color: #120d02; border-color: var(--sodium); font-weight: 600; }
.btnPrimary:hover { background: var(--sodium-hi); border-color: var(--sodium-hi); transform: translateY(-2px); }
.btnGhost { background: transparent; color: var(--ink); }
.btnGhost:hover { border-color: var(--sodium); color: var(--sodium-hi); transform: translateY(-2px); }

/* designed focus — applied to every interactive element */
.focusable:focus-visible { outline: 2px solid var(--sodium); outline-offset: 3px; }

/* skip link — first focusable element on the page */
.skip {
  position: absolute; left: -9999px; top: 8px; z-index: 100;
  background: var(--sodium); color: #120d02;
  padding: 10px 16px; border-radius: 3px;
  font-family: var(--mono); font-size: 0.8rem;
}
.skip:focus { left: 16px; }

/* screen-reader-only — for static duplicates of decorative marquees */
.srOnly {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

## Sticky nav that earns its blur

Transparent at top; background + blur + hairline only after scroll (state
flipped by a passive scroll listener at ~12px):

```css
.navBar {
  position: sticky; top: 0; z-index: 50;
  border-bottom: 1px solid transparent;
  transition: background 0.3s, border-color 0.3s, backdrop-filter 0.3s;
}
.navBar.scrolled {
  background: color-mix(in oklab, var(--ground) 72%, transparent); /* token scrim, never a literal */
  backdrop-filter: blur(14px) saturate(1.3);
  border-bottom: 1px solid var(--hair);
}
```

## Spacing and responsive rhythm

- Section padding via `clamp()`, e.g. `padding: clamp(64px, 9vw, 120px) 0` —
  rhythm scales with viewport, no breakpoint jumps.
- The bento is a 6-column grid with cards spanning 3 or 2 columns
  (asymmetry = editorial); collapse 6 → 2 → 1 at ~1024px and ~640px.
- Alternate band backgrounds (`--ground` / `--ground-2` / inset panels) so
  scrolling has texture without any imagery.
- No horizontal overflow at any width in the breakpoint list below (the root
  sets `overflow-x: clip` as a backstop, not as the fix; the six rules below
  are the fix).

## Mobile floor

Six ways a crafted page breaks on a phone. Each is cheap to prevent and
expensive to find afterwards, because every one of them looks fine at 1440.
`scripts/lint-surface.mjs` catches M1, M5, M6 and the image-grid half of M2
statically; M3 and M4 need a rendered page at 320 px.

- **M1 — `clip`, never `hidden`, on wrappers.** `overflow-x: hidden` (or
  `overflow: hidden`) on a wrapper that holds a sticky element (`.page`,
  `#app`, `#__next`, a layout `div`) turns that wrapper into a scroll
  container, and `position: sticky` then sticks to a box that never scrolls:
  the nav simply stops sticking, with no error. `body` or `html` alone is the
  exception, because their overflow propagates to the viewport, but setting it
  on **both** breaks sticky the same way. `overflow-x: clip` hides the overflow
  without creating a scroll container, so use it everywhere and stop counting
  exceptions. Measured in Chromium at 375 px after an 800 px scroll: `.page {
  overflow-x: hidden }` leaves the nav at top −800 px; `clip` keeps it at 0.
  Check: scroll and confirm the nav's `getBoundingClientRect().top` stays `0`.
- **M2 — let tracks shrink.** A grid track of bare `1fr` has an automatic
  minimum equal to its widest child, so one long word or an image's intrinsic
  width pushes the grid past the viewport. Write `repeat(n, minmax(0, 1fr))`
  for every track that holds images, code, tables or long words, and give
  flex children that hold text `min-width: 0`.
- **M3 — clickable text never wraps.** A button or nav label that breaks onto
  two lines at 320 px reads as two controls. Fix in this order: shorten the
  label, then `white-space: nowrap`, then drop the item into an overflow
  menu, then collapse the group. Never shrink the font below the body size.
- **M4 — display type can break.** Big headings with a long word overflow
  narrow screens. `h1, h2 { overflow-wrap: anywhere; min-width: 0; }` —
  `anywhere`, not `break-word`, because only `anywhere` lowers the
  min-content size the grid uses to size the track.
- **M5 — one sticky owns `top: 0`.** Every other sticky element (a section
  header, a table head, a chapter strip) offsets by the nav height
  (`top: var(--nav-h)`), and the z-index tokens are split so the nav always
  wins: `--z-nav` above `--z-sticky` above content. Two elements both stuck at
  `top: 0` overlap on scroll.
- **M6 — uppercase needs leading.** Uppercase display type set below
  `line-height: 1` collides between lines (caps have no descender room to
  borrow). Floor 1.0, recommended 1.02–1.08.

Use `svh` (the small viewport height) for a full-height section on a
scrolling page: plain `vh` is cropped by the mobile browser bar, and `dvh`
resizes the section while the bar collapses, which shifts the layout under
the reader's thumb. Keep `dvh` for a fixed app frame that should track the
visible area ([phone-surfaces.md](phone-surfaces.md)).

**Breakpoint list (the one place it lives):** check every page at 320, 375,
390, 414, 768, 1024 and 1440 px. Phone-only screens use the subset in
phone-surfaces.md's gate.

## Reveal-on-scroll

One attribute + one class, driven by a single IntersectionObserver (JS side
in [canvas-hero.md](canvas-hero.md)):

```css
/* Hidden only once the script has proven it is running: with JS off or
   failed, every [data-reveal] element is simply visible. */
.revealReady [data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 0.7s, transform 0.7s; }
.revealReady [data-reveal].isIn { opacity: 1; transform: none; }
```

The observer adds `revealReady` to the page root before it observes
anything; never author `opacity: 0` on content in plain CSS. Under
`prefers-reduced-motion` the JS never adds `revealReady` at all — content is
never hidden from someone who turned motion off. Which motion route to use
for what, and the slop list: [motion-routes.md](motion-routes.md).
