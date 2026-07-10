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
  overflow-x: hidden;
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
  background: rgba(11, 11, 10, 0.72);
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
- Test at 320 / 768 / 1024 / 1440. No horizontal overflow at any of them
  (the root sets `overflow-x: hidden` as a backstop, not as the fix).

## Reveal-on-scroll

One attribute + one class, driven by a single IntersectionObserver (JS side
in [canvas-hero.md](canvas-hero.md)):

```css
[data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 0.7s, transform 0.7s; }
[data-reveal].isIn { opacity: 1; transform: none; }
```

Under `prefers-reduced-motion` the JS adds `isIn` to everything immediately —
content is never hidden from someone who turned motion off.
