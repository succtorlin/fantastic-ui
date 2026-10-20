# Third-party components — adopt one without breaking the rules

Component catalogs and effect libraries (registry blocks, "copy this hero",
shadcn-style installers, animated-text packs, canvas/WebGL effect kits) are
tempting because they look finished in their demo. The demo proves nothing
about your page: it does not prove the licence lets you ship it, that it
works without its script, that its dialog is a dialog, or that the installer
leaves your files alone. This file is the procedure for taking one in. The
skill's own rules still win: one accent, zero webfonts, no GSAP or WebGL,
content complete without JavaScript, and the exam.

## When this applies

Any time the work copies, installs or ports UI code the project did not
write: a registry `add` command, a block pasted from a catalog site, a
component "inspired by" a library whose source you are reading, or an npm
package that renders UI. It does not apply to the project's own design
system, or to plain dependencies with no UI (a date library).

## 1. Decide whether it belongs at all

- **Check it against the skill's rules first.** An effect that needs WebGL,
  GSAP, a webfont or a second accent is refused, however good it looks; build
  the effect on the cheapest route in
  [motion-routes.md](motion-routes.md) instead, or drop it. A block whose look
  fights the chosen direction is a costume (SKILL.md Shift 1).
- **One component, not a catalog.** Name the one artifact, the route it goes
  on, and what it replaces. Copying a whole gallery "to have options" is how
  pages turn into demo reels.
- **Prefer the platform.** `<dialog>` with `showModal()`, `<details>`,
  `popover`, native form controls and CSS scroll-driven animation already
  carry the semantics a catalog component often fakes. A third-party
  component has to beat the native element on something the brief needs.

## 2. Read the licence file, not the badge

- Open the licence **file** at the exact revision you are copying. A README
  line, a `tier: free` field or an "MIT" badge on the CLI does not cover the
  components. Look for Commons Clause, "no redistribution", "no templates or
  kits", per-seat or paid tiers, and separate terms for effects vs tooling.
- Record what the work is allowed to do with it: use inside this one product
  is often fine where reselling, re-publishing in a starter kit or a shared
  component library is not. If the deliverable is itself reusable (a kit, a
  template, a skill), restricted components stay out of it; link the source
  instead.
- Images, fonts and 3D models bundled with a component carry their own rights.
  Webfonts are out anyway; replace demo images with the project's own or a
  generated plate.
- Keep the attribution the licence asks for, in a comment at the top of the
  copied file with the source URL and revision.

## 3. Read the source, not the registry entry

- Registry metadata drifts from the code it describes. Read the component's
  actual file and list every import: runtime libraries, icon packs, a `cn`
  helper, workspace-only packages (`@repo/...`) that will not resolve outside
  the author's monorepo. Map each to the project's existing equivalent rather
  than adding a second convention.
- Note the defaults the code really uses (colours, durations, breakpoints),
  since documented props are often wrong. Replace every hard-coded colour,
  radius and font with the project's tokens; a copied component that keeps
  its own palette is a second design system.
- Strip demo content: names, numbers, testimonials and logos in a block are
  fiction until replaced with the product's real words.

## 4. Review what the installer will do before running it

Installers and `npx <tool> add` commands are code from the internet with
write access to the project. Before running one:

- Pin the version; an unversioned `npx` runs whatever is published today.
- Read what it writes: component files, config and lock files, dependency
  installs, and **global CSS**. Some installers overwrite the stylesheet they
  are pointed at. Losing existing CSS is a blocking change, not a small diff.
- Check for telemetry, network calls on "dry run" and auto-confirm flags.
  Never pass `--yes` or `--overwrite` for convenience.
- Ask the user before running it; the command, its writes and its
  dependencies are part of the question. A reviewed manual copy (steps 2–3)
  is usually the better path.
- After it runs, `git diff` everything it touched and revert what the brief
  did not ask for.

## 5. Make it pass the same rules as your own code

The things catalog components most often get wrong, and how the skill
checks them:

| Trap | What to do | Checked by |
|---|---|---|
| Content starts at `opacity: 0` (or off-screen, or `visibility: hidden`) and only a script reveals it | Hide it in CSS only behind a class the script adds (`html.js .reveal{opacity:0}`), so without JavaScript it is simply there | the exam's no-JS pass |
| A "modal" is a positioned `div`: no dialog role, no name, focus wanders behind it, Escape does nothing, focus is lost on close | Use `<dialog>` + `showModal()`, or give it `role="dialog"`, `aria-modal="true"`, a name, a focus trap, Escape and focus return | `exam.mjs --dialog <trigger>` |
| The trigger is a clickable `div` or `span` | A real `<button>` (or the component's `asChild` path onto one) | axe, the exam's keyboard pass |
| A canvas or cursor layer sits over content and swallows clicks or enters the accessibility tree | `aria-hidden="true"`, `pointer-events: none`, and never the only path to information | axe, manual pass |
| Reduced motion still slides, scales or rotates things | A static readable state under `prefers-reduced-motion: reduce`, not a shorter animation | `verify-preset.mjs`, motion review |
| Animation loops, observers or listeners survive unmount | Tear down everything the component started; check remount and route changes | [canvas-hero.md](canvas-hero.md) lifecycle, manual pass |
| Hard-coded colours, fonts and radii | Replace with tokens | `lint-surface.mjs --strict` |

Then run the exam on every page the component appears on, with `--dialog`
for each overlay it adds, and put the result in the closing message.

## Gate

| Check | How to measure |
|---|---|
| The component is allowed by the skill's rules | no WebGL, GSAP, webfont or second accent in its imports or CSS |
| The licence permits this use | the licence file at the copied revision is named in the reply, with what it allows |
| Every import resolves to the project's own equivalent | the copied file builds with no new utility conventions; new dependencies listed |
| Installer writes were reviewed | the command, version and file list were shown before running; `git diff` after |
| Demo content replaced | grep the copied files for the library's demo names and numbers |
| It passes the exam, overlays included | `exam.mjs --url … --dialog <trigger>` exits 0 |
