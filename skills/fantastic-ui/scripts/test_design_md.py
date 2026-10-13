#!/usr/bin/env python3
"""Tests for design_md.py.

Run with pytest:   python3 -m pytest -q skills/fantastic-ui/scripts/
or standalone:     python3 skills/fantastic-ui/scripts/test_design_md.py

No test touches the network. The official linter (`npx @google/design.md
lint`) is run by hand; see references/design-md.md for the measured result.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "design_md.py"
EXAMPLE = HERE.parent.parent.parent / "examples" / "gallery-white" / "index.html"
sys.path.insert(0, str(HERE))

import design_md as D  # noqa: E402

PRESETS = "ABCDEFGHIJKL"

MINIMAL = """---
version: alpha
name: Fixture
colors:
  primary: "{colors.accent}"
  ground: "#ffffff"
  ink: "#1b1b1d"
  accent: "#0062c4"
  brand: "#0062c4"
  ink-soft: "#45454a"
typography:
  body-md:
    fontFamily: "Inter, sans-serif"
  label-mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  card: 28px
spacing:
  gutter: 24px
---

# Fixture

## Overview

Text.

## Colors

Text.
"""

CSS = """
:root {
  --ground: #fff;
  --ink: rgb(27, 27, 29);
  --accent: #0062c4;
  --color-ink-soft: #45454a;
  --r-card: 28px;
  --sans: "Inter", sans-serif;
  --mono: var(--font-runtime-mono);
  --surface-raised: #0062c5;
  --leftover: #ff0000;
}
@media (prefers-color-scheme: dark) { :root { --ground: #000000; } }
"""


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def tmpdir() -> Path:
    return Path(tempfile.mkdtemp(prefix="design_md_test_")).resolve()


def write(dirpath: Path, name: str, text: str) -> Path:
    p = dirpath / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


# ---------------------------------------------------------------- find


def test_find_prefers_root_then_docs_and_skips_dependencies():
    d = tmpdir()
    write(d, "docs/design.md", "x")
    write(d, "DESIGN.md", "x")
    write(d, "node_modules/pkg/DESIGN.md", "x")
    write(d, "a/b/c/DESIGN.md", "x")          # deeper than two levels
    hits = D.find_design_md(d)
    assert [h.relative_to(d).as_posix() for h in hits] == ["DESIGN.md", "docs/design.md"], hits


def test_find_exits_3_when_there_is_none():
    proc = run("find", "--root", str(tmpdir()))
    assert proc.returncode == 3 and json.loads(proc.stdout)["primary"] is None


# ---------------------------------------------------------------- read


def test_read_resolves_references_and_reports_sections():
    p = write(tmpdir(), "DESIGN.md", MINIMAL)
    s = D.summarize(p)
    assert s["colors"]["primary"]["resolved"] == "#0062c4"
    assert s["sections"] == ["Overview", "Colors"]
    assert "Typography" in s["missingSections"] and s["problems"] == []


def test_read_rejects_duplicate_sections_and_broken_references():
    dup = write(tmpdir(), "DESIGN.md", MINIMAL + "\n## Colours\n\n## Colors\n")
    assert run("read", str(dup)).returncode == 1
    broken = write(tmpdir(), "DESIGN.md", MINIMAL.replace("{colors.accent}", "{colors.nope}"))
    proc = run("read", str(broken))
    assert proc.returncode == 1 and "broken reference" in proc.stderr


def test_read_ignores_headings_inside_code_fences():
    text = MINIMAL + "\n```markdown\n## Colors\n```\n"
    assert D.summarize(write(tmpdir(), "DESIGN.md", text))["sections"] == ["Overview", "Colors"]


def test_read_accepts_a_file_without_front_matter():
    s = D.summarize(write(tmpdir(), "DESIGN.md", "# Just prose\n\n## Overview\n\nHi.\n"))
    assert s["colors"] == {} and s["sections"] == ["Overview"]


def test_color_key_compares_in_srgb_with_alpha():
    assert D.color_key("#FFF") == D.color_key("rgb(255, 255, 255)") == "#ffffff"
    assert D.color_key("#0062c480") == D.color_key("rgba(0, 98, 196, 0.5)") == "#0062c480"
    assert D.color_key("rgb(0 98 196 / 50%)") == "#0062c480"
    assert D.color_key("#0062c4") != D.color_key("#0062c480")
    assert D.color_key("color-mix(in srgb, red, blue)") is None


# ---------------------------------------------------------------- export


def test_every_preset_exports_a_readable_file_with_a_resolving_primary():
    for letter in PRESETS:
        p = write(tmpdir(), "DESIGN.md", D.export(letter, None))
        s = D.summarize(p)
        assert s["colors"]["primary"]["srgb"], letter
        assert [D.canonical_section(t) for t in s["sections"]] == D.SECTION_ORDER, (letter, s)
        assert s["problems"] == [], (letter, s["problems"])


def test_export_components_only_carry_text_pairs_that_pass_aa():
    for letter in PRESETS:
        tok = D._yaml().safe_load(D.split_front_matter(D.export(letter, None))[0])
        colors = {k: D.resolve_ref(v, tok) for k, v in tok["colors"].items()}
        for name, props in tok.get("components", {}).items():
            bg, fg = props.get("backgroundColor"), props.get("textColor")
            if bg and fg:
                r = D.contrast(D.resolve_ref(fg, tok), D.resolve_ref(bg, tok))
                assert r >= D.AA_TEXT, (letter, name, round(r, 2))
        assert set(colors) >= {"primary", "ink"}, letter


def test_export_turns_a_failing_pair_into_a_dont_with_its_ratio():
    text = D.export("A", None)          # Coastal Editorial: --muted is captions-only on the sheet
    assert re.search(r"Don't set `muted` as body text on `panel`: 3\.\d\d:1", text), text[-1500:]
    assert "caption:" not in text.split("---", 2)[1]


def test_export_follows_the_sheet_device_for_the_reading_surface():
    fm = D.split_front_matter(D.export("A", None))[0]       # r-sheet 24px: text on --panel
    assert 'page:\n    backgroundColor: "{colors.panel}"' in fm
    fm = D.split_front_matter(D.export("L", None))[0]       # r-sheet 0: text on --ground
    assert 'page:\n    backgroundColor: "{colors.ground}"' in fm


def test_export_drops_links_into_the_skill():
    assert "](" not in D.export("L", None)


def test_export_never_overwrites_without_force():
    d = tmpdir()
    target = write(d, "DESIGN.md", "the user's file\n")
    proc = run("export", "--preset", "L", "--out", str(target))
    assert proc.returncode == 6 and target.read_text() == "the user's file\n"
    proc = run("export", "--preset", "L", "--out", str(target), "--force")
    assert proc.returncode == 0 and target.read_text().startswith("---\nversion: alpha")


def test_export_rejects_an_unknown_preset():
    proc = run("export", "--preset", "Z")
    assert proc.returncode == 1 and "no preset" in proc.stderr


# ---------------------------------------------------------------- drift


def _drift_fixture(**kw):
    d = tmpdir()
    return D.drift(write(d, "DESIGN.md", MINIMAL), [write(d, "app.css", CSS)],
                   kw.get("mapping", {}), kw.get("selector"))


def _by_token(rep):
    return {r["token"]: r for r in rep["results"]}


def test_drift_statuses():
    rep = _drift_fixture()
    t = _by_token(rep)
    assert t["colors.primary"]["status"] == "follows"
    assert t["colors.ground"]["status"] == "match"          # #fff == #ffffff; @media ignored
    assert t["colors.ink"]["status"] == "match"             # rgb() == hex
    assert t["colors.ink-soft"]["cssVar"] == "--color-ink-soft"
    assert t["typography.body-md"]["status"] == "match"     # quotes and spacing normalised
    assert t["typography.label-mono"]["status"] == "uncomparable"   # set at runtime
    assert t["rounded.card"]["status"] == "match"
    assert t["spacing.gutter"]["status"] == "not-in-css"
    assert t["colors.brand"]["status"] == "missing-in-css"
    assert rep["drift"] is True
    assert "--leftover" in rep["cssOnlyColors"] and "--ground" not in rep["cssOnlyColors"]


def test_drift_suggests_renames_but_never_across_roles():
    t = _by_token(_drift_fixture())
    sug = [s["cssVar"] for s in t["colors.brand"]["suggest"]]
    assert sug[0] == "--accent"                              # same colour
    assert "--surface-raised" in sug                         # near, and brand has no role
    d = tmpdir()
    text_tok = MINIMAL.replace('  brand: "#0062c4"', '  text-link: "#0062c4"')
    rep = D.drift(write(d, "DESIGN.md", text_tok), [write(d, "a.css", CSS)], {}, None)
    sug = [s["cssVar"] for s in _by_token(rep)["colors.text-link"]["suggest"]]
    assert "--surface-raised" not in sug and "--accent" in sug


def test_drift_detects_a_changed_value_and_map_overrides():
    d = tmpdir()
    css = CSS.replace("--accent: #0062c4", "--accent: #1677e6")
    rep = D.drift(write(d, "DESIGN.md", MINIMAL), [write(d, "a.css", css)],
                  {"colors.brand": "--surface-raised"}, None)
    t = _by_token(rep)
    assert t["colors.accent"]["status"] == "differs"
    assert t["colors.brand"]["cssVar"] == "--surface-raised" and t["colors.brand"]["status"] == "differs"


def test_drift_selector_restricts_to_one_block():
    d = tmpdir()
    css = CSS + '\n[data-theme="light"] { --ink: #222222; }\n'
    rep = D.drift(write(d, "DESIGN.md", MINIMAL), [write(d, "a.css", css)], {},
                  '[data-theme="light"]')
    t = _by_token(rep)
    assert t["colors.ink"]["status"] == "differs" and t["colors.ink"]["css"] == "#222222"
    assert t["colors.ground"]["status"] == "missing-in-css"


def test_drift_exit_codes():
    d = tmpdir()
    design = write(d, "DESIGN.md", MINIMAL)
    assert run("drift", str(design), "--css", str(write(d, "a.css", CSS))).returncode == 5
    clean = write(d, "clean.md", "---\nname: x\ncolors:\n  primary: \"#0062c4\"\n---\n")
    css = write(d, "b.css", ":root { --primary: #0062c4; }")
    assert run("drift", str(clean), "--css", str(css)).returncode == 0
    assert run("drift", str(clean), "--css", str(css), "--map", "bad").returncode == 1


def test_drift_reads_style_blocks_and_the_example_page_matches_its_preset():
    d = tmpdir()
    design = write(d, "DESIGN.md", D.export("L", None))
    rep = D.drift(design, [EXAMPLE], {}, None)
    bad = [r for r in rep["results"] if r["status"] not in ("match", "follows")]
    assert not rep["drift"] and not bad, bad
    assert rep["summary"]["match"] >= 25


# ---------------------------------------------------------------- review regressions


def test_drift_rejects_a_broken_reference_instead_of_following_it():          # M1
    d = tmpdir()
    design = write(d, "DESIGN.md", MINIMAL.replace("{colors.accent}", "{colors.nope}"))
    proc = run("drift", str(design), "--css", str(write(d, "a.css", CSS)))
    assert proc.returncode == 1 and "broken reference" in proc.stderr


def test_selector_resolves_var_chains_inside_the_selected_block():           # M2
    d = tmpdir()
    css = write(d, "a.css", ":root{--base:#fff;--bg:var(--base)} .dark{--base:#000;--bg:var(--base)}")
    design = write(d, "DESIGN.md", '---\nname: x\ncolors:\n  bg: "#000000"\n---\n')
    t = _by_token(D.drift(design, [css], {}, ".dark"))
    assert t["colors.bg"]["status"] == "match", t["colors.bg"]


def test_unparseable_colours_never_crash():                                  # M3
    d = tmpdir()
    bad = write(d, "DESIGN.md", '---\nname: x\ncolors:\n  primary: "#gggggg"\n  other: "#123456"\n---\n')
    assert run("read", str(bad)).returncode == 0
    css = write(d, "a.css", ":root{--c:hsl(var(--h), 50%, 50%)}")
    proc = run("drift", str(bad), "--css", str(css))
    assert proc.returncode == 5 and "Traceback" not in proc.stderr


def test_read_validates_references_in_every_group():                         # M4
    d = tmpdir()
    text = '---\nname: x\ncolors:\n  primary: "#000"\nrounded:\n  md: "{rounded.nope}"\n---\n'
    assert run("read", str(write(d, "DESIGN.md", text))).returncode == 1


def test_numeric_scale_keys_resolve():                                       # M5
    text = ('---\nname: x\ncolors:\n  primary: "#000"\nspacing:\n  4: 16px\n'
            'components:\n  card:\n    padding: "{spacing.4}"\n---\n')
    assert run("read", str(write(tmpdir(), "DESIGN.md", text))).returncode == 0


def test_alpha_in_four_argument_rgb_and_half_up_rounding():                  # L1, L2
    assert D.color_key("rgb(0,0,0,0.5)") == D.color_key("rgba(0,0,0,.5)") != D.color_key("rgb(0,0,0)")
    assert D.color_key("rgba(0,0,0,.3)") == "#0000004d"


def test_scale_tokens_never_bind_to_colour_variables():                      # L3
    d = tmpdir()
    text = '---\nname: x\ncolors:\n  card: "#ffffff"\nrounded:\n  card: 16px\n---\n'
    t = _by_token(D.drift(write(d, "DESIGN.md", text), [write(d, "a.css", ":root{--card:#ffffff}")],
                          {}, None))
    assert t["rounded.card"]["status"] == "not-in-css" and t["colors.card"]["status"] == "match"


def test_drift_refuses_a_file_without_tokens_and_bom_is_tolerated():         # L4, L5
    d = tmpdir()
    proc = run("drift", str(write(d, "DESIGN.md", "## Overview\n")), "--css",
               str(write(d, "a.css", ":root{--a:#000}")))
    assert proc.returncode == 1 and "no tokens" in proc.stderr
    bom = write(d, "bom.md", "\ufeff" + MINIMAL)
    assert D.summarize(bom)["colors"]["ground"]["srgb"] == "#ffffff"


def test_bad_structures_and_missing_files_give_json_errors():                # L6, L7, L14
    d = tmpdir()
    cases = [("read", str(write(d, "l.md", "---\ncolors: [a, b]\n---\n"))),
             ("read", str(write(d, "y.md", "---\ncolors: {a: [\n---\n"))),
             ("read", str(d / "nope.md"))]
    for cmd, path in cases:
        proc = run(cmd, path)
        assert proc.returncode == 1 and json.loads(proc.stderr)["error"], (path, proc.stderr)
    dated = write(d, "dated.md", '---\nversion: 2024-05-01\ncolors:\n  primary: "#000"\n---\n')
    assert run("read", str(dated)).returncode == 0
    assert run("find", "--root", str(d / "missing")).returncode == 1
    proc = run("export", "--preset", "L", "--out", str(d / "nodir" / "x.md"))
    assert proc.returncode == 1 and "Traceback" not in proc.stderr


def test_front_matter_and_fence_edge_cases():                                # L9
    text = MINIMAL.replace("\n---\n\n# Fixture", "\n--- \n\n# Fixture")
    assert D.summarize(write(tmpdir(), "DESIGN.md", text))["colors"]
    body = "## Overview ##\n\n````md\n```\n## Colors\n```\n````\n\n## Typography\n"
    assert D.sections_of(body) == ["Overview", "Typography"]


def test_last_declaration_in_a_block_wins():                                 # L10
    d = tmpdir()
    text = '---\nname: x\ncolors:\n  bg: "#111111"\n---\n'
    t = _by_token(D.drift(write(d, "DESIGN.md", text),
                          [write(d, "a.css", ":root{--bg:#000;--bg:#111}")], {}, None))
    assert t["colors.bg"]["status"] == "match"


def test_selector_accepts_a_list():                                          # L11
    d = tmpdir()
    text = '---\nname: x\ncolors:\n  bg: "#000000"\n---\n'
    t = _by_token(D.drift(write(d, "DESIGN.md", text), [write(d, "a.css", ":root{--bg:#000}")],
                          {}, ".dark, :root"))
    assert t["colors.bg"]["status"] == "match"


def test_token_lines_ignore_comments():                                      # L12
    block = ("  /* --legacy: #000000; */\n  /* x */ --b: #222222;\n"
             "  --c: #333 /* inline; */;\n  --d: #444;  /* a note */\n  --e: #555\n")
    got = {n: (v, c) for n, v, c in D._token_lines(block)}
    assert "legacy" not in got and got["b"][0] == "#222222" and got["c"][0] == "#333"
    assert got["d"] == ("#444", "a note") and got["e"][0] == "#555"


def test_translucent_or_unmeasurable_text_is_not_a_passing_component():      # L13
    colors = {"ground": "#ffffff", "ink": "rgba(0,0,0,0.2)",
              "ink-2": "color-mix(in srgb, #fff 90%, #000)"}
    comps, failing = D._components(colors, {}, "ink")
    assert "page" not in comps and "page-secondary-text" not in comps
    assert {f for f, _, _ in failing} == {"ink", "ink-2"}


def test_export_output_is_unchanged_by_the_token_parser_rewrite():
    for letter in PRESETS:
        tok = D._yaml().safe_load(D.split_front_matter(D.export(letter, None))[0])
        title, section = D._preset_section(letter)
        block = re.search(r"```css\n(.*?)```", section, flags=re.S).group(1)
        declared = set(re.findall(r"^\s*--([\w-]+)\s*:", block, flags=re.M))
        exported = set(tok["colors"]) | {"r-" + k for k in tok.get("rounded", {})} \
            | set(tok.get("spacing", {})) | {"sans", "display", "mono"}
        assert declared - exported <= {"lift", "lift-1", "lift-2"}, (letter, declared - exported)


# ---------------------------------------------------------------- runner


def _main() -> int:
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"ok    {name}")
        except Exception:  # noqa: BLE001 - report every failure, keep going
            failed += 1
            print(f"FAIL  {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(_main())
