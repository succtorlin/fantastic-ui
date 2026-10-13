# DESIGN.md — reading, checking and replacing a project's design file

DESIGN.md is Google Labs' open format for describing a design system to
coding agents ([google-labs-code/design.md](https://github.com/google-labs-code/design.md),
spec version `alpha`). Its YAML front matter holds the tokens: `colors`,
`typography`, `rounded`, `spacing` and `components`. Markdown sections then
explain them, in a fixed order:

1. Overview
2. Colors
3. Typography
4. Layout
5. Elevation & Depth
6. Shapes
7. Components
8. Do's and Don'ts

Colour values may be references, such as `primary: "{colors.accent}"`.

When a project has one, **it is the recorded direction**. The skill reads it
before anything else and changes it only when the user says to.

Tool: [`scripts/design_md.py`](../scripts/design_md.py). It needs PyYAML for
`read` and `drift`; `export` needs only the standard library. The official
linter is `npx @google/design.md lint DESIGN.md`, which exits 1 on errors.

## The two rules

1. **Replace only on an explicit request.** The words must ask for the
   replacement: "replace our DESIGN.md with Gallery White", "switch the design
   file to Charter Navy", "start the design system over". Naming a preset in a
   project that has a DESIGN.md is **not** a request to replace it. Say that the
   file exists, what direction it records, and ask: *follow the file, or
   replace it with the preset?*
2. **Ask every time the file and the code disagree.** Never decide on your
   own which one is right, even when the answer looks obvious. A colour the
   code lightened for contrast may be the fix the file is missing, or a
   regression the file is guarding against. Only the user knows.

## Precedence

Highest first:

1. The user's words in this request.
2. **DESIGN.md**: the tokens and the prose.
3. The token system in the stylesheet (Step 0a, gate 2).
4. Preset scoring (Step 0a, gate 3).

The file outranks the stylesheet because it is the written intent, but it does
not override it silently. Drift is always reported and asked about (rule 2).

## Procedure

### 1. Find

```bash
python3 scripts/design_md.py find --root .
```

The finder checks the repository root and up to two levels down, skipping
`node_modules`, build folders and dot-folders. It exits 3 when there is no
file.

If it finds more than one, list them and ask which one is canonical before
reading either. Two files that disagree are themselves a drift to report;
RRGPy, for example, has both `DESIGN.md` and `docs/DESIGN.md`.

### 2. Read and announce

```bash
python3 scripts/design_md.py read DESIGN.md
```

`read` fails (exit 1) on a duplicate section or a broken `{reference}`. The
spec rejects such a file, so report it and stop: never build on a file that
does not parse.

Then announce the recorded direction in one line, the same way Step 0a
announces a preset, with the imagery clause attached:

> Following **DESIGN.md** ("sectorRRG"): warm dark workstation, sodium-amber
> as the only accent, IBM Plex. Imagery: none in the file; proposing a warp
> plate behind route headers. Say "replace the design file" to start over instead.

If the file has no imagery guidance, propose an imagery clause as a
suggestion and say it is not yet in the file.

### 3. Check for drift — and ask

```bash
python3 scripts/design_md.py drift DESIGN.md --css app/globals.css [--css more.css] \
  [--selector ':root'] [--map colors.brand=--color-primary]
```

`drift` compares every `colors`, `typography`, `rounded` and `spacing` token
with the CSS custom properties. It reads `.css` files and the `<style>`
blocks of `.html`, `.vue`, `.svelte` and `.astro` files.

How a token finds its CSS variable:

| Token | Variables tried, in order |
| --- | --- |
| `colors.x` | `--x`, `--color-x`, `--colors-x` |
| `rounded.x` | `--r-x`, `--radius-x`, `--rounded-x`, `--x` |
| `spacing.x` | `--x`, `--spacing-x`, `--space-x` |
| `typography.x` (`fontFamily`) | mono fonts: `--mono`, `--font-mono`; display or headline: `--display`, `--font-display`, then the sans variables; everything else: `--sans`, `--font-sans`, `--font-body` |

`--map` overrides any of these.

| Status | Meaning | What you do |
| --- | --- | --- |
| `match` | same value (colours compared in sRGB, alpha included) | nothing |
| `differs` | both exist, values differ | **ask**: which is right? |
| `missing-in-css` | colour or font named in the file, absent from the CSS | **ask**; offer `suggest` |
| `uncomparable` | the CSS value is set at runtime (`var()` from next/font or a theme script) or uses a colour function the script cannot compute | check it in the browser, then **ask** if it differs |
| `not-in-css` | a spacing or radius step with no variable, which is common with utility classes | mention it once; not drift |
| `follows` | a colour that is a reference; checked through its target | nothing |

The exit code is 5 when anything needs asking. `cssOnlyColors` lists colour
variables the file never mentions. Report them as "in the code, not in the
file" and ask whether they belong in it.

`suggest` names CSS variables whose colour equals or nearly equals a missing
token (OKLab distance under 0.03). It searches every definition, light-theme
blocks included, and never matches a text token to a surface variable or the
reverse. A suggestion is a question to confirm, never an answer.

**How to ask.** Put one table in front of the user, grouped, with the
smallest number of decisions:

| Token | DESIGN.md | Code | Likely reason |
| --- | --- | --- | --- |
| `colors.text-tertiary` | `oklch(0.55 0.005 70)` | `oklch(0.605 0.005 70)` | the code was lightened, possibly for contrast |
| `colors.sodium-amber` | `oklch(0.78 0.165 70)` | (none; same value as `--color-sodium`) | a rename |

Then ask one question per group:

- **Values differ:** "Update the file to match the code, or the code to match
  the file?" Answer per token if they differ in kind.
- **Renames:** "Record these mappings in the file's prose, or rename the
  variables?"
- **Missing:** "Implement these in the CSS, or remove them from the file?"

Apply exactly what was chosen, re-run `drift`, and show it clean, or show
which drift remains by choice. This happens **every time** drift is found,
including on later runs over the same project. A previous answer is not a
standing decision.

### 4. Build against the file

While building, the file's tokens are the only palette, type and radii. Its
Do's and Don'ts are gates in the same way as a preset's traps. A component in
`components` sets the pairing for that element.

When the work needs a token the file does not have, do not invent it
silently. Name it, give its value and its contrast, and ask to add it to
the file. Adding it is an edit to the file, so it follows step 6.

### 5. Create — when there is no file

When Step 0a commits to a preset or writes a fresh brief and the project has
no DESIGN.md, **offer** to write one so that later sessions and other tools
follow the same direction:

```bash
python3 scripts/design_md.py export --preset L --name "Lumen" --out DESIGN.md
```

- The export takes its tokens from `theme-presets.md`, maps `primary` to
  `accent-ink`, `accent` or `ink`, and builds the prose from the preset's own
  text.
- It emits only the text pairs that reach 4.5:1. A pair the preset keeps for
  large text only, such as a captions-only `--muted`, becomes a Do's and
  Don'ts line with its measured ratio.
- Measured 2026-10-12: all twelve presets export clean under
  `@google/design.md@0.4.0 lint`, with 0 errors and 0 warnings.
- For a fresh brief, write the file by hand in the same shape: tokens from the
  token block, prose from the brief line and the decisions behind it.

Then run `lint`, and run `drift` against the stylesheet you just wrote.
Creating the file is an offer: write it only after the user says yes.

### 6. Replace — only when asked

1. **Confirm what is being replaced.** Show the current file's name and
   direction in one line, and the new direction in one line.
2. **Write the new file beside the old one**, never over it:
   `export --preset X --out DESIGN.next.md`, or a hand-written file at the
   same temporary path.
3. **Show the diff**, `git diff --no-index DESIGN.md DESIGN.next.md`, with a
   summary: tokens added, removed and changed, and sections rewritten. Run
   `npx @google/design.md diff DESIGN.md DESIGN.next.md` too; it exits 1 when
   the new file lints worse.
4. **On a yes, move it into place.** Use `mv DESIGN.next.md DESIGN.md`. If you
   go through `export`, write to the real path with `--force`: the script exits
   6 rather than overwrite without it. Git history is the backup. The
   project's own commit is the user's call.
5. **Migrate the code**, which is the product-surfaces retrofit:
   1. tokens first, in one mechanical commit;
   2. then shared primitives;
   3. then screens.

   Run `drift` after the token commit; it must come back clean before the
   screens move.
6. **Re-run the gates**: `lint`, `drift`, `verify-preset.mjs` for a preset,
   and the accessibility pass.

Rewriting the file without the explicit request, or overwriting it without
showing the diff first, is a ship blocker in the same class as a dark
pattern: it removes the user's recorded decision without asking.

## Mapping notes

- A fantastic-ui token `--x` exports as `colors.x` (and radius `--r-x` as
  `rounded.x`), so a preset's DESIGN.md and its stylesheet drift-check with no
  `--map` at all.
- `typography` in the export carries the three family stacks only
  (`headline-display`, `body-md`, `label-mono`). Sizes and weights per element
  live in the Components prose, as they do in the preset. Add explicit levels
  when a project needs them.
- The spec accepts any colour token name, so keep the project's own names when
  replacing a file in a codebase that already uses them. Rename only if the
  user asks to.
