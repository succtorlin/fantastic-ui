# Astryx workflow

Astryx is Meta's React design system. Its CLI exposes layout templates, blocks,
component and hook documentation, semantic tokens, theme tooling, and
diagnostics. Use the project's Astryx version when it has one. From a neutral
directory, the global CLI can inspect the catalog for any project, including
projects without React. If the global CLI is unavailable, use the official
docs or the scoped package at the intended version
(`npx @astryxdesign/cli@<version> ...`).
[GitHub repository](https://github.com/meta/astryx) · [CLI reference](https://astryx.atmeta.com/docs/cli) · [Global mode](https://astryx.atmeta.com/docs/global)

## Find a pattern

Describe the actual task and state in the query. For an opportunity feed, search
for filtering, saved views, selection, and detail panels. For a new analytics
page, distinguish a summary dashboard from a comparison or drill-down surface.

```bash
astryx search "filterable table with saved views and a detail panel"
astryx build "opportunity dashboard with filters, a detail panel, and empty results"
astryx template --list --type page
astryx template table-filter --skeleton
astryx --dense component Table
astryx --dense docs styling-overview
```

`build` recommends a page, blocks, and components. `template <id> --skeleton`
prints its layout and `template <id>` prints the source. Supplying a destination
writes a scaffold. Prefer a new file or a scratch directory when trying a
template. For an existing route, preserve its shell, data flow, and navigation,
and inspect only the blocks and components relevant to the task. Choose
template structure by task fit. Adapt its density, content, and responsive
behavior to the brief. Replace sample data with the real data path or label it
as sample data.

In another design system, apply the pattern through its own components and
tokens. For example, borrow the filter bar and detail layout for an existing
results page, then implement it with the project's table, form controls, and
panel. Project setup commands belong to an Astryx implementation.

## Compose components

In an Astryx project, check the installed Core, CLI, and theme versions and
read the relevant component or hook docs from the app directory. Use the
documented import path, required children, controlled state, accessible names,
and keyboard behavior. Compose with the project's established wrappers and
Astryx layout primitives. Preserve native HTML where it supplies the right
document semantics. Try a supported prop, slot, theme override, or wrapper
before `swizzle`, which copies component source into the app and leaves the
app responsible for maintaining that copy.

For a requested adoption, choose the compatible Core, theme, and CLI versions
using the project's package manager. Use `astryx init --help` to inspect setup
options first. The default `init` writes agent instructions, so use the
specific feature required and follow any project instruction governing edits
to `AGENTS.md`. Preview and review generated changes. During an Astryx upgrade,
`astryx upgrade --from <previous-version>` previews the codemods for the
installed target version. Add `--apply` when the preview matches the upgrade
scope and verify preserved behavior.
[Getting started](https://astryx.atmeta.com/docs/getting-started) · [CLI reference](https://astryx.atmeta.com/docs/cli)

## Theme and style

1. Start from the recorded `DESIGN.md` or the project's current token system.
   Map its accent, surfaces, text, borders, focus, typography, spacing, and
   semantic states to Astryx roles in one shared theme. Inspect roles with
   `astryx docs tokens` and supported component overrides with
   `astryx theme targets <Component>`. Keep chart series colors tied to data
   categories or states. Retain the product's selected accent and type roles.
2. Follow `astryx docs styling-overview` for the installed release. The prebuilt
   component CSS can work with plain CSS or Tailwind. A template or swizzled
   component containing `stylex.create()` needs the corresponding compiler
   setup. Check the recommended template's extra packages and icon
   requirements before scaffolding. In an existing app, verify the cascade
   before introducing a global reset.
3. Validate theme changes in every supported color mode. Where the installed
   CLI supports it, the experimental theme editor can render a sample page
   and a component sheet with
   `astryx experimental theme editor show <theme> --png`. It writes preview
   files, so use a scratch project if the preview is exploratory. A component
   sheet helps compare variants. Use the real route for contrast, cascade,
   long labels, overflow, and surrounding context. If `design_md.py drift`
   cannot resolve theme variables, inspect their computed values in the
   browser and follow the normal drift procedure.
[Styling overview](https://astryx.atmeta.com/docs/styling-overview) · [Theming](https://astryx.atmeta.com/docs/theme)

## Verify the implementation

Run `astryx doctor` in the project. When supported for the build output, also
run `astryx doctor --built <path>` after the project's production build. Review
warnings in context, including intentional native markup and existing custom
styles. Check the rendered workflow against the brief and
[Fantastic UI's accessibility phase](../SKILL.md#the-accessibility-phase--check-and-fix-wcag-22-aa).
Exercise keyboard and focus return, field labels and error recovery,
loading/empty/filtered states, responsive reflow, reduced motion, and actual
contrast in the supported modes. Measure production JS and CSS when adding
Astryx. Record diagnostics and browser checks separately so the verification
states exactly what ran.
[Astryx CLI reference](https://astryx.atmeta.com/docs/cli)
