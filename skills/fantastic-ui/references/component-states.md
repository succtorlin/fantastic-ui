# Component states — when the brief is one element

Most day-to-day requests are one control, not a page: "make me a button",
"this input looks cheap", "build a toast". Running the page flow on them spends
a brief line and an imagery decision on something with no sections, and still
misses the one thing that decides whether a component is well made: whether
every state ships. This file is the route for those briefs.

Adapted in part from finesse-ui (MIT) and rewritten to fantastic-ui's rules.

## When a brief is one component

Take this route when **two or more** of these signals fire:

- the brief names **one UI element** (button, input, select, switch, slider,
  card, modal, drawer, menu, tooltip, tabs, chip, badge, pagination, toast,
  accordion row, date picker, upload);
- the brief is **under 30 words** and is about one thing;
- the target is **one component file** (`Button.tsx`, `input.css`,
  `Toast.svelte`);
- the user says **"just the X"**, "only this one", or the equivalent.

**Counter-signals keep the page flow** even if one signal fires: the brief
names several sections, asks for a layout, says "page", "screen" or
"dashboard", or names a whole surface ("the settings screen"). When it is
genuinely ambiguous, ask one question ("one pricing card, or the whole pricing
page?") and commit. If the user does not engage, default to the component: a
single control is cheaper to redirect than a page.

**What the route skips.** No brief-line band, no preset gate run, no imagery,
no plate, no ledger entry, no page rhythm. Say so in one line so the user
knows why the usual apparatus is absent: "Component scope: skipping the brief
line, imagery and page rhythm."

**What it keeps.** Everything that makes a control belong to its product:

- **The project's tokens, by name.** Read the token block, DESIGN.md
  (`scripts/design_md.py find --root .`) or `:root` first and consume
  `var(--accent)`, `var(--hair)`, the ink scale and the radius token. A button
  that ships its own literal colour into a project with a locked accent is a
  defect. With no tokens in the project, install the block from
  [css-architecture.md](css-architecture.md) rather than inventing values.
- **Siblings, not variety.** Components in one product should look related.
  Divergence is a page-level goal; at component scope it is a bug.
- The WCAG floor from [wcag-audit.md](wcag-audit.md), system font stacks, and a
  `prefers-reduced-motion` path for any motion.

## The eight states

Every interactive component ships real styling for all eight. This is the
route's one hard gate.

| State | Rule |
|---|---|
| **default** | The resting state. |
| **hover** | Inside `@media (hover: hover)`, so it never sticks after a tap on touch screens. |
| **focus-visible** | `:focus-visible` ring at ≥3:1 against the adjacent surface, `outline: 2px solid var(--accent); outline-offset: 3px`. **Never animated**: the ring is there the instant focus lands. |
| **active** | The pressed state: a 1px translate or a one-step ground shift. The state most often missing. |
| **disabled** | The native `disabled` attribute (or `aria-disabled="true"` when it must stay focusable) plus `cursor: not-allowed`, with the label moved to `--muted` and the border to `--hair`. Prefer the token swap to opacity: WCAG exempts inactive controls from contrast, so `opacity` on a disabled control is allowed (SKILL.md's opacity rule keeps `disabled:` states fine), but a token swap reads as designed and never compounds with a parent's opacity. Explain *why* it is disabled nearby when the reason is not obvious. |
| **loading** | Reserve the final width so the label swap does not move neighbours; show progress after about 300ms; set `aria-busy="true"`. |
| **error** | States the cause and the fix ("needs 8 or more characters"), never "Invalid"; colour plus icon plus text, never colour alone. |
| **success** | Usually silent. If the effect is already visible, a celebration is noise. |

`empty` is a view state and belongs to panels
([product-surfaces.md](product-surfaces.md)), not to a single control.

**Geometry that keeps layouts still:**

- **Border width never changes between states.** State moves to
  `border-color`, `background-color` or `outline`. A 1px to 2px border on
  focus shifts every neighbour.
- **A transparent outline at rest**, `outline: 2px solid transparent`, so focus
  changes colour, not geometry. It also survives forced-colours mode.
- **One shared control height** across a form row. A 38px input beside a 44px
  button is the most common tuning tell; pick one height token (44px is the
  touch-friendly default) and share it.
- **Reserve the error slot** with `min-height: 1lh` on the helper line, so an
  error appearing does not push the page down.

```css
.btn {
  block-size: var(--control-h);
  border: 1px solid var(--hair);
  outline: 2px solid transparent;
  outline-offset: 3px;
  background: var(--ground-2);
  color: var(--ink);
  transition: background-color 120ms, border-color 120ms;
}
@media (hover: hover) {
  .btn:hover:not(:disabled, [aria-disabled="true"]) { border-color: var(--hair-lit); }
}
.btn.is-hover { border-color: var(--hair-lit); } /* preview pin, any device */
.btn:focus-visible, .btn.is-focus { outline-color: var(--accent); transition: none; }
.btn:active:not(:disabled, [aria-disabled="true"]), .btn.is-active { background: var(--ground-3); translate: 0 1px; }
.btn:disabled { color: var(--muted); border-color: var(--hair); cursor: not-allowed; }
.btn[aria-busy="true"] { cursor: progress; }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
```

## The preview file

Ship two files.

1. **The component**, in the project's own convention (`Button.tsx`,
   `button.css`), consuming tokens by name.
2. **`<Name>.preview.html`**, a standalone page that renders every state side
   by side and labelled. It is not production code; say so on hand-over, and
   the user deletes it once checked.

The trick that lets a static page show hover, focus and active at once: each
state's selector targets both the real pseudo-class and a forcing class, as in
the block above (`.btn:hover, .btn.is-hover`). The preview pins each state with
the class; production never uses the classes.

```
Button: 8 states                light            dark
default        [ Save changes ]   [ Save changes ]
hover          .is-hover          …
focus-visible  .is-focus          …
active         .is-active         …
disabled       disabled attr      …
loading        aria-busy="true"   [ Saving…      ]
error          data-state=error   [ Try again    ]
success        data-state=success [ Saved        ]
```

- **Light and dark columns** when the project has both themes, each in its own
  `data-theme` wrapper so both token sets are exercised.
- **The preview links the project's real token file**, not a copy, so drift
  shows up.
- **Run axe on the preview.** This is the component's live proof: the states
  are visible instead of claimed, and measured instead of eyeballed. Forced
  hover and focus classes let axe check contrast of states it could never
  reach by itself.
- One labelled row per state, so a reviewer can point at a failure by name.

## The exam

The preview file is examined like any page, as a fragment (it has no skip
link, landmarks or `h1` of its own):

```bash
node ~/.claude/skills/fantastic-ui/scripts/exam.mjs path/to/preview-folder --fragment
```

Every state row must pass: axe WCAG 2.2 AA, targets, focus ring, reflow,
the no-JS pass and lint. A component that opens an overlay (dialog, sheet,
drawer, menu-as-dialog) adds `--dialog <trigger selector>`. A component is
not done while its preview fails. A component copied from a library follows
[third-party-components.md](third-party-components.md) first.

## Gate

- [ ] The route was chosen on ≥2 signals with no counter-signal, and the skip
      line was said to the user.
- [ ] No colour literal in the component file: `grep -nE
      "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" <component file>` returns nothing.
- [ ] All eight states have styling, verified by opening
      `<Name>.preview.html`, not by reading the CSS.
- [ ] axe returns no violations on the preview in every theme column
      ([wcag-audit.md](wcag-audit.md)); `incomplete` items are resolved, not
      dismissed.
- [ ] Focus ring measured ≥3:1 against the adjacent surface, and it has no
      transition (`getComputedStyle(el).transitionProperty` excludes
      `outline`).
- [ ] Border width identical across all states: compare
      `getComputedStyle(el).borderWidth` in each preview row.
- [ ] Hover rules sit inside `@media (hover: hover)` (grep).
- [ ] Disabled: native attribute or `aria-disabled`, `cursor: not-allowed`,
      dimmed by a token swap (or opacity scoped to the disabled state only,
      never on an ancestor that also holds enabled text).
- [ ] Loading keeps the default width: `offsetWidth` equal in the default and
      loading rows.
- [ ] Error slot reserved: toggling the error does not change the height of
      the field's container.
- [ ] Label does not wrap at 320px; target ≥24px, 44px where it is a primary
      touch control (`getBoundingClientRect`).
- [ ] Any motion has a `prefers-reduced-motion` path (toggle it in devtools
      rendering settings and re-check the preview).
