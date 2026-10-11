#!/usr/bin/env python3
"""Tests for gen_atmosphere.py.

Run with pytest:   python3 -m pytest -q skills/fantastic-ui/scripts/
or standalone:     python3 skills/fantastic-ui/scripts/test_gen_atmosphere.py

No test touches the network: the `ai` subcommand is exercised with
subprocess.run mocked out.
"""
from __future__ import annotations

import contextlib
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import traceback
import urllib.parse
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "gen_atmosphere.py"
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import gen_atmosphere as G  # noqa: E402

RRG_PALETTE = ["#040302", "#0a0907", "#151311", "#f9a216", "#ea8b00"]
# The real app: the page is #0a0907 and #040302 is a recessed well, darker.
PAGE_FIRST_WITH_WELL = ["#0a0907", "#040302", "#151311", "#f9a216", "#ea8b00"]
PAGE_PALETTE = ["#0a0907", "#151311", "#26231d", "#f9a216", "#ea8b00"]
COOL_PALETTE = ["#05080d", "#0b1220", "#16233a", "#3b82f6", "#93c5fd"]
LIGHT_PALETTE = ["#f5efe6", "#e9e0d2", "#d8cbb6", "#b5562b", "#8f3d1c"]

FIXTURE_CSS = """
/* comment with { braces } that must be ignored */
@theme inline {
  --color-bg: oklch(0.14 0.005 70);
  --color-accent: oklch(0.78 0.165 70);
}
:root {
  --ground: var(--color-bg);
  --raised: var(--missing-token, var(--fallback-raised));
  --fallback-raised: rgb(21 19 17);
  --accent: var(--color-accent);
  --hsl: hsl(210 50% 40%);
  --short: #abc;
}
@media (prefers-color-scheme: light) {
  :root { --ground: #ffffff; --accent: #ff00ff; }
}
:root { --ground: #123456; }
.card { --ground: #654321; }
"""


def run_cli(*args, check=False):
    proc = subprocess.run([sys.executable, str(SCRIPT), *args],
                          capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise AssertionError(f"cli failed rc={proc.returncode}: {proc.stderr}")
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    assert len(lines) <= 1, f"stdout must be one JSON object, got: {proc.stdout!r}"
    payload = json.loads(lines[0]) if lines else None
    return proc.returncode, payload, proc.stderr


def run_main(argv):
    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = G.main(argv)
    return rc, json.loads(out.getvalue()), err.getvalue()


# ---------------------------------------------------------------- colour


def test_oklch_dark_warm_grey():
    r, g, b = G.parse_color("oklch(0.14 0.005 70)")
    hexv = G.to_hex((r, g, b))
    ch = [int(hexv[i:i + 2], 16) for i in (1, 3, 5)]
    assert max(ch) < 0x14, hexv              # very dark
    assert ch[0] >= ch[1] >= ch[2], hexv     # warm: red >= green >= blue
    assert ch[0] - ch[2] <= 4, hexv          # but nearly grey
    L, C, H = G.srgb_to_oklch((r, g, b))
    assert abs(L - 0.14) < 0.01 and C < 0.01


def test_oklch_white_black_round_trip():
    assert G.to_hex(G.parse_color("oklch(1 0 0)")) == "#ffffff"
    assert G.to_hex(G.parse_color("oklch(100% 0 0)")) == "#ffffff"
    assert G.to_hex(G.parse_color("oklch(0 0 0)")) == "#000000"
    assert G.to_hex(G.parse_color("oklch(0% 0 0deg / 0.5)")) == "#000000"
    L, C, _ = G.srgb_to_oklch(G.parse_color("#ffffff"))
    assert abs(L - 1.0) < 1e-3 and C < 1e-3


def test_other_colour_syntaxes():
    assert G.to_hex(G.parse_color("#abc")) == "#aabbcc"
    assert G.to_hex(G.parse_color("#11223380")) == "#112233"
    assert G.to_hex(G.parse_color("rgb(255, 0, 0)")) == "#ff0000"
    assert G.to_hex(G.parse_color("rgba(0 128 255 / 50%)")) == "#0080ff"
    assert G.to_hex(G.parse_color("hsl(120 100% 50%)")) == "#00ff00"
    # out-of-gamut oklch is clamped, never wraps or raises
    assert len(G.to_hex(G.parse_color("oklch(0.7 0.4 145)"))) == 7


# ---------------------------------------------------------------- tokens


def test_var_chain_with_fallback():
    lookup = {"--a": "var(--b)", "--b": "var(--nope, var(--c))", "--c": "#102030"}
    assert G.resolve_var("var(--a)", lookup) == "#102030"
    assert G.resolve_var("var(--missing, #ff0000)", {}) == "#ff0000"
    try:
        G.resolve_var("var(--x)", {"--x": "var(--y)", "--y": "var(--x)"})
    except G.CliError:
        pass
    else:
        raise AssertionError("a var() cycle must fail")


def test_tokens_cli_ignores_media_and_later_blocks():
    with tempfile.TemporaryDirectory() as tmp:
        css = Path(tmp) / "fixture.css"
        css.write_text(FIXTURE_CSS)
        out = Path(tmp) / "nested" / "tokens.json"
        rc, data, _ = run_cli("tokens", "--css", str(css),
                              "--map", "ground=--ground,raised=--raised,accent=--accent,"
                                       "hsl=--hsl,short=--short",
                              "--out", str(out), check=True)
        assert rc == 0
        pal = data["palette"]
        assert list(pal) == ["ground", "raised", "accent", "hsl", "short"]  # map order
        assert pal["ground"] == G.to_hex(G.parse_color("oklch(0.14 0.005 70)"))  # not #123456/#fff
        assert pal["raised"] == "#151311"                                     # fallback chain
        assert pal["accent"] == G.to_hex(G.parse_color("oklch(0.78 0.165 70)"))  # not #ff00ff
        assert pal["short"] == "#aabbcc"
        assert data["selector"] == ":root" and data["map"]["ground"] == "--ground"
        assert json.loads(out.read_text()) == data


def test_tokens_missing_var_fails_cleanly():
    with tempfile.TemporaryDirectory() as tmp:
        css = Path(tmp) / "f.css"
        css.write_text(FIXTURE_CSS)
        rc, data, err = run_cli("tokens", "--css", str(css), "--map", "x=--not-there")
        assert rc != 0 and data["error"] and "--not-there" in err


# ---------------------------------------------------------------- plates


def test_determinism_same_seed_identical_different_seed_differs():
    with tempfile.TemporaryDirectory() as tmp:
        pal = ",".join(RRG_PALETTE)
        outs = []
        for name, seed in (("a", 11), ("b", 11), ("c", 12)):
            p = Path(tmp) / f"{name}.webp"
            run_cli("plate", "--palette", pal, "--style", "warp", "--seed", str(seed),
                    "--size", "480x270", "--out", str(p), check=True)
            outs.append(p.read_bytes())
        assert outs[0] == outs[1]
        assert outs[0] != outs[2]
    a = G.render_plate(RRG_PALETTE, "contour", 5, 320, 180)
    b = G.render_plate(RRG_PALETTE, "contour", 5, 320, 180)
    assert a.dtype == np.uint8 and np.array_equal(a, b)


def test_every_style_fits_30kb_at_1600x900():
    with tempfile.TemporaryDirectory() as tmp:
        pal = ",".join(RRG_PALETTE)
        for style in G.STYLES:
            p = Path(tmp) / f"{style}.webp"
            rc, data, _ = run_cli("plate", "--palette", pal, "--style", style, "--seed", "7",
                                  "--size", "1600x900", "--out", str(p), "--allow-faint",
                                  check=True)
            size = p.stat().st_size
            assert set(data["visibility"]) == {"ge_1_1", "ge_1_3", "darker_than_page"}
            assert size <= 30 * 1024, (style, size)
            assert data["bytes"] == size and data["width"] == 1600 and data["height"] == 900
            with Image.open(p) as im:
                assert im.format == "WEBP" and im.size == (1600, 900)
        assert not list(Path(tmp).glob("*.png")), "no PNG may be written"


def test_tiny_budget_succeeds_or_leaves_no_file():
    with tempfile.TemporaryDirectory() as tmp:
        for style in ("grain", "contour"):
            p = Path(tmp) / f"{style}.webp"
            rc, data, _ = run_cli("plate", "--palette", ",".join(RRG_PALETTE), "--style", style,
                                  "--seed", "3", "--size", "1600x900", "--max-kb", "2",
                                  "--out", str(p))
            if rc == 0:
                assert p.stat().st_size <= 2048
            else:
                assert not p.exists(), "a failed fit must not leave a file"
                assert data["error"] == "too_large"
        assert not [f for f in os.listdir(tmp) if f.startswith(".gen_atmosphere")]


def test_fit_webp_never_exceeds_budget():
    rng = np.random.default_rng(0)  # high-entropy input that cannot fit
    noisy = Image.fromarray(rng.integers(0, 256, (600, 800, 3), dtype=np.uint8))
    try:
        G.fit_webp(noisy, 1024)
    except G.CliError:
        pass
    else:
        raise AssertionError("pure noise should not fit in 1 KB")


def _hull_distance(px, palette_rgb):
    """Distance (0..255 units) from each pixel to the nearest palette triangle."""
    P = np.asarray(palette_rgb, dtype=np.float64)
    best = np.full(len(px), np.inf)
    n = len(P)
    tris = [(i, j, k) for i in range(n) for j in range(i, n) for k in range(j, n)]
    for i, j, k in tris:
        a, b, c = P[i], P[j], P[k]
        # dense barycentric sampling of the triangle (exact enough for a test)
        steps = 24
        pts = [a + (b - a) * (u / steps) + (c - a) * (v / steps)
               for u in range(steps + 1) for v in range(steps + 1 - u)]
        pts = np.asarray(pts)
        d = np.sqrt(((px[:, None, :] - pts[None, :, :]) ** 2).sum(-1)).min(1)
        best = np.minimum(best, d)
    return best


def _sample(arr, n=2000, seed=1):
    rng = np.random.default_rng(seed)
    ys = rng.integers(0, arr.shape[0], n)
    xs = rng.integers(0, arr.shape[1], n)
    return arr[ys, xs].astype(np.float64)


def _check_palette_fidelity(palette, style):
    pal = [np.array(G.parse_color(c)) * 255 for c in palette]
    # 1. The renderer itself: every sampled pixel lies in the palette's blend
    #    hull (within 8-bit rounding + the test's triangle sampling step).
    raw = _sample(G.render_plate(palette, style, 4, 800, 450))
    assert _hull_distance(raw, pal).max() <= 4.0, style
    # 2. After lossy WebP: nearly all pixels still sit on palette blends. A few
    #    hairline pixels lose chroma to 4:2:0 subsampling (they go greyer, never
    #    to a new hue), so only the 99th percentile is bounded here...
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "p.webp"
        run_cli("plate", "--palette", ",".join(palette), "--style", style, "--seed", "4",
                "--size", "800x450", "--out", str(p), "--allow-faint", check=True)
        with Image.open(p) as im:
            px = _sample(np.asarray(im.convert("RGB")))
    dist = _hull_distance(px, pal)
    assert np.percentile(dist, 99) <= 6.0, (style, np.percentile(dist, 99))
    # 3. ...and no rainbow: every clearly chromatic pixel sits near a palette hue.
    hues = [G.srgb_to_oklch(c / 255)[2] for c in pal if G.srgb_to_oklch(c / 255)[1] > 0.04]
    for rgb in px:
        _, C, H = G.srgb_to_oklch(rgb / 255)
        if C > 0.05:
            gap = min(abs((H - h + 180) % 360 - 180) for h in hues)
            assert gap <= 20, (style, rgb, H)


def test_palette_fidelity_all_styles():
    for style in G.STYLES:
        _check_palette_fidelity(RRG_PALETTE, style)
    _check_palette_fidelity(COOL_PALETTE, "warp")
    _check_palette_fidelity(COOL_PALETTE[:3], "contour")
    _check_palette_fidelity(LIGHT_PALETTE, "contour")


def _luminance(arr):
    a = np.asarray(arr, dtype=np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def test_light_palette_stays_light_and_small():
    assert G.palette_tone(LIGHT_PALETTE) == "light"
    assert G.palette_tone(RRG_PALETTE) == "dark"
    # base = the FIRST ground as listed (the page); structure is ordered away from it
    grounds, _, _, light = G._roles(["#f5efe6", "#d8cbb6", "#e9e0d2", "#b5562b", "#8f3d1c"])
    assert light and G.to_hex(grounds[0]) == "#f5efe6"
    assert [G.to_hex(g) for g in grounds[1:]] == ["#e9e0d2", "#d8cbb6"]
    with tempfile.TemporaryDirectory() as tmp:
        for style in G.STYLES:
            p = Path(tmp) / f"{style}.webp"
            rc, data, _ = run_cli("plate", "--palette", ",".join(LIGHT_PALETTE), "--style", style,
                                  "--seed", "7", "--size", "1600x900", "--out", str(p),
                                  "--allow-faint", check=True)
            assert data["tone"] == "light"
            assert "lighter_than_page" in data["visibility"]
            assert p.stat().st_size <= 30 * 1024, (style, p.stat().st_size)
            with Image.open(p) as im:
                lum = _luminance(np.asarray(im.convert("RGB")))
            assert lum.mean() > 0.7, (style, lum.mean())
            # dark text (#1a1a1a) keeps >= 7:1 over 99% of the plate
            p1 = np.percentile(lum, 1)
            assert (p1 + 0.05) / (0.0103 + 0.05) >= 7.0, (style, p1)


def test_plate_ledger_line():
    with tempfile.TemporaryDirectory() as tmp:
        ledger = Path(tmp) / "deep" / "dir" / "ledger.jsonl"
        out = Path(tmp) / "x.webp"
        for _ in range(2):
            rc, data, _ = run_cli("plate", "--palette", ",".join(PAGE_PALETTE), "--style", "warp",
                                  "--seed", "2", "--size", "320x180", "--intensity", "1",
                                  "--out", str(out), "--ledger", str(ledger), check=True)
        lines = ledger.read_text().splitlines()
        assert len(lines) == 2
        rec = json.loads(lines[0])
        for key in ("ts", "tool", "mode", "style", "seed", "size", "palette", "intensity",
                    "focus", "out", "bytes", "quality", "blur", "sha256", "page", "visibility",
                    "allowFaint", "argv"):
            assert key in rec, key
        assert rec["mode"] == "plate" and rec["tool"] == "gen_atmosphere"
        assert rec["page"] == "#0a0907" and rec["allowFaint"] is False
        assert rec["visibility"] == data["visibility"] and data["page"] == "#0a0907"


def test_plate_rejects_bad_palette_and_size():
    rc, data, _ = run_cli("plate", "--palette", "#000000", "--style", "warp", "--seed", "1",
                          "--size", "100x100", "--out", "/tmp/never.webp")
    assert rc != 0 and data["error"]
    rc, data, _ = run_cli("plate", "--palette", "#000,#fff", "--style", "warp", "--seed", "1",
                          "--size", "huge", "--out", "/tmp/never.webp")
    assert rc != 0 and "size" in data["message"]


# ---------------------------------------------------------------- page ground + visibility


def test_page_ground_is_the_first_ground_not_the_darkest():
    grounds, _, _, light = G._roles(PAGE_PALETTE)
    assert not light and G.to_hex(grounds[0]) == "#0a0907"
    px = G.render_plate(PAGE_PALETTE, "warp", 3, 320, 180, 1.0)
    vis = G.visibility(px, "#0a0907")
    assert vis["darker_than_page"] == 0.0, vis   # nothing falls below the page
    # structure grounds are ordered away from the page, whatever the listed order
    grounds, _, _, _ = G._roles(["#0a0907", "#26231d", "#151311", "#f9a216", "#ea8b00"])
    assert [G.to_hex(g) for g in grounds] == ["#0a0907", "#151311", "#26231d"]


def test_ground_darker_than_page_is_refused():
    try:
        G._roles(PAGE_FIRST_WITH_WELL)
    except G.CliError as exc:
        assert "'#040302' is darker than the page ground '#0a0907'" in str(exc), exc
        assert exc.payload["error"] == "inverted_palette"
    else:
        raise AssertionError("a ground darker than the page must be refused")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "x.webp"
        rc, data, err = run_cli("plate", "--palette", ",".join(PAGE_FIRST_WITH_WELL),
                                "--style", "warp", "--seed", "1", "--size", "320x180",
                                "--out", str(out), "--allow-faint")
        assert rc == 1 and data["error"] == "inverted_palette", data
        assert data["page"] == "#0a0907" and data["ground"] == "#040302"
        assert "invisible" in data["message"] and not out.exists()


def test_light_palette_refuses_a_lighter_ground_and_passes_the_gate():
    try:
        G._roles(["#e9e0d2", "#f5efe6", "#b5562b", "#8f3d1c"])
    except G.CliError as exc:
        assert "lighter than the page ground '#e9e0d2'" in str(exc)
    else:
        raise AssertionError("a ground lighter than a light page must be refused")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "light.webp"
        rc, data, _ = run_cli("plate", "--palette", ",".join(LIGHT_PALETTE), "--style", "warp",
                              "--seed", "7", "--size", "1600x900", "--intensity", "1",
                              "--out", str(out), check=True)
        assert data["tone"] == "light" and data["page"] == "#f5efe6"
        vis = data["visibility"]
        assert vis["ge_1_1"] >= 8 and vis["ge_1_3"] >= 1, vis
        assert vis["lighter_than_page"] == 0.0 and "darker_than_page" not in vis


def test_tokens_ground_role_leads_the_palette():
    with tempfile.TemporaryDirectory() as tmp:
        tok = Path(tmp) / "tokens.json"
        tok.write_text(json.dumps({"palette": {"ground2": "#151311", "ground": "#0a0907",
                                               "accent": "#f9a216"}}))
        assert G.load_palette(str(tok), None) == ["#0a0907", "#151311", "#f9a216"]


def test_visibility_numbers_on_a_synthetic_image():
    page = "#0a0907"
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    img[:] = (10, 9, 7)                   # 60 px: the page itself (1.0:1)
    img[0:2] = (40, 38, 34)               # 20 px: ~1.36:1, clears both thresholds
    img[2:3] = (30, 28, 25)               # 10 px: ~1.2:1, clears 1.1 only
    img[3:4] = (0, 0, 0)                  # 10 px: darker than the page (~1.06:1)
    vis = G.visibility(img, page)
    assert vis == {"ge_1_1": 30.0, "ge_1_3": 20.0, "darker_than_page": 10.0}, vis
    # sRGB triples work too, and a light page reports the lighter side
    assert G.visibility(img, G.parse_color(page)) == vis
    light = np.full((4, 4, 3), 230, dtype=np.uint8)
    light[0] = 255
    lv = G.visibility(light, "#e6e6e6")
    assert lv["lighter_than_page"] == 25.0 and lv["ge_1_1"] == 25.0 and lv["ge_1_3"] == 0.0


def test_min_visible_fails_with_exit_4_and_allow_faint_passes():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "faint.webp"
        args = ["plate", "--palette", ",".join(PAGE_PALETTE), "--style", "contour", "--seed", "3",
                "--size", "1600x180", "--intensity", "0.3", "--out", str(out)]
        rc, data, err = run_cli(*args)
        assert rc == 4 and data["error"] == "too_faint", data
        assert data["minVisible"] == [8, 1]
        vis = data["visibility"]
        assert vis["ge_1_1"] < 8 or vis["ge_1_3"] < 1
        assert f"{vis['ge_1_1']}%" in data["message"] and "nothing written" in data["message"]
        assert not out.exists() and not [f for f in os.listdir(tmp) if f.startswith(".gen_")]
        # a stricter gate fails a plate the default passes
        ok = Path(tmp) / "ok.webp"
        strong = ["plate", "--palette", ",".join(PAGE_PALETTE), "--style", "warp", "--seed", "7",
                  "--size", "960x240", "--intensity", "1", "--out", str(ok)]
        rc, data, _ = run_cli(*strong, check=True)
        assert data["visibility"]["ge_1_1"] >= 8 and data["visibility"]["ge_1_3"] >= 1
        ok.unlink()
        rc, data, _ = run_cli(*strong, "--min-visible", "90,50")
        assert rc == 4 and data["minVisible"] == [90, 50] and not ok.exists()
        # --allow-faint writes it and still reports the measure
        rc, data, _ = run_cli(*args, "--allow-faint", check=True)
        assert out.exists() and data["visibility"] == vis
        rc, data, _ = run_cli(*args, "--min-visible", "0,0", check=True)
        for bad in ("8", "x,1", "8,101", "nan,1"):
            rc, data, _ = run_cli(*args, "--min-visible", bad)
            assert rc == 1 and "--min-visible" in data["message"], bad


# ---------------------------------------------------------------- svg


def test_svg_inline_and_css():
    for style in G.SVG_STYLES:
        rc, data, _ = run_cli("svg", "--style", style, "--seed", "9", check=True)
        svg = data["svg"]
        assert 'aria-hidden="true"' in svg and 'focusable="false"' in svg
        assert "<image" not in svg and "base64" not in svg
        assert "data URI" in data["note"] or "data-URI" in data["note"]
        if style in ("grid", "rings"):
            assert 'stroke="currentColor"' in svg
    rc, data, _ = run_cli("svg", "--style", "grain", "--seed", "9", "--format", "css",
                          "--color", "#c8902e", check=True)
    css = data["css"]
    assert css.startswith('url("data:image/svg+xml,') and "#" not in css.split(",", 1)[1]
    assert "seed=%229%22" in css
    rc, data, _ = run_cli("svg", "--style", "grid", "--format", "css")  # default var() colour
    assert rc != 0 and "literal" in data["message"]


_KEBAB_ATTR = re.compile(r"\s((?!aria-)[a-z]+(?:-[a-z]+)+)=")


def test_svg_jsx_format_is_valid_jsx_shape():
    for style in G.SVG_STYLES:
        rc, data, _ = run_cli("svg", "--style", style, "--seed", "9", "--format", "jsx", check=True)
        jsx = data["svg"]
        assert 'aria-hidden="true"' in jsx and 'focusable="false"' in jsx
        assert 'style={{ color: "var(--accent)" }}' in jsx, jsx
        assert 'style="' not in jsx, "a string style throws in React"
        assert not _KEBAB_ATTR.search(jsx), _KEBAB_ATTR.findall(jsx)
        if style == "grain":
            assert 'floodColor="currentColor"' in jsx
        else:
            assert 'strokeWidth="1"' in jsx and 'vectorEffect="non-scaling-stroke"' in jsx
        assert data["format"] == "jsx" and "React" in data["note"]
    # the inline (HTML) format keeps HTML attribute names
    rc, data, _ = run_cli("svg", "--style", "grid", "--format", "inline", check=True)
    assert 'stroke-width="1"' in data["svg"] and 'style="color:var(--accent)"' in data["svg"]
    # quotes in the colour cannot break out of the JSX string
    rc, data, _ = run_cli("svg", "--style", "grid", "--format", "jsx",
                          "--color", 'color-mix(in oklab, var(--accent) 6%, transparent)', check=True)
    assert 'style={{ color: "color-mix(in oklab, var(--accent) 6%, transparent)" }}' in data["svg"]


def test_svg_opacity_one_omits_attribute():
    for fmt in ("inline", "jsx"):
        for style in G.SVG_STYLES:
            rc, data, _ = run_cli("svg", "--style", style, "--format", fmt, "--opacity", "1",
                                  check=True)
            assert "opacity" not in data["svg"], (fmt, style)
            rc, data, _ = run_cli("svg", "--style", style, "--format", fmt, "--opacity", "0.05",
                                  check=True)
            assert 'opacity="0.05"' in data["svg"], (fmt, style)
    rc, data, _ = run_cli("svg", "--style", "grain", "--format", "css", "--color", "#c8902e",
                          "--opacity", "1", check=True)
    assert "opacity" not in data["css"]


def test_svg_grain_is_a_fixed_size_tile_not_stretched():
    for fmt in ("inline", "jsx"):
        rc, data, _ = run_cli("svg", "--style", "grain", "--format", fmt, check=True)
        svg = data["svg"]
        assert 'preserveAspectRatio="none"' not in svg
        assert "viewBox" not in svg, "user units must be CSS px so the grain never scales"
        assert re.search(r'<pattern [^>]*width="256" height="256"[^>]*patternUnits="userSpaceOnUse"', svg)
        assert 'fill="url(#' in svg
    rc, data, _ = run_cli("svg", "--style", "grain", "--format", "css", "--color", "#c8902e",
                          check=True)
    assert data["backgroundSize"] == "256px 256px" and data["backgroundRepeat"] == "repeat"
    decoded = urllib.parse.unquote(data["css"])
    assert 'width="256" height="256"' in decoded and 'preserveAspectRatio="none"' not in decoded


def test_svg_ledger_line():
    with tempfile.TemporaryDirectory() as tmp:
        ledger = Path(tmp) / "l" / "ledger.jsonl"
        rc, data, _ = run_cli("svg", "--style", "rings", "--seed", "4", "--format", "jsx",
                              "--ledger", str(ledger), check=True)
        rec = json.loads(ledger.read_text().splitlines()[0])
        assert rec["mode"] == "svg" and rec["tool"] == "gen_atmosphere"
        assert rec["style"] == "rings" and rec["seed"] == 4 and rec["format"] == "jsx"
        assert rec["color"] == "var(--accent)" and "argv" in rec
        assert rec["sha256"] == hashlib.sha256(data["svg"].encode()).hexdigest() == data["sha256"]
        rc, data, _ = run_cli("svg", "--style", "grain", "--format", "css", "--color", "#c8902e",
                              "--ledger", str(ledger), check=True)
        rec = json.loads(ledger.read_text().splitlines()[1])
        assert rec["format"] == "css" and rec["sha256"] == hashlib.sha256(data["css"].encode()).hexdigest()


# ---------------------------------------------------------------- ai


def test_ai_unavailable_when_generator_fails():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "ai.webp"
        fake = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="boom")
        with mock.patch.object(G, "BUN", Path(sys.executable)), \
                mock.patch.object(G, "IMAGE_GEN", SCRIPT), \
                mock.patch.object(G.subprocess, "run", return_value=fake) as run:
            rc, data, _ = run_main(["ai", "--prompt", "warm dusk", "--size", "1600x900",
                                    "--out", str(out)])
        assert rc == 3
        assert data["error"] == "ai_unavailable" and "plate" in data["fallback"]
        assert not out.exists()
        cmd = run.call_args[0][0]
        assert "--ar" in cmd and cmd[cmd.index("--ar") + 1] == "16:9"
        assert "--model" in cmd and "gpt-image-1.5" in cmd
        assert cmd[cmd.index("--prompt") + 1].endswith(G.AI_SUFFIX)


def test_ai_unavailable_when_bun_missing():
    with mock.patch.object(G, "BUN", Path("/nonexistent/bun")), \
            mock.patch.object(G.subprocess, "run") as run:
        rc, data, _ = run_main(["ai", "--prompt", "x", "--size", "800x800", "--out", "/tmp/n.webp"])
    assert rc == 3 and data["error"] == "ai_unavailable"
    run.assert_not_called()


def test_ai_success_path_crops_compresses_and_cleans_up():
    def fake_run(cmd, **kw):
        raw = Path(cmd[cmd.index("--image") + 1])
        grad = np.linspace(0, 255, 1024 * 1024 * 3).reshape(1024, 1024, 3).astype(np.uint8)
        Image.fromarray(grad).save(raw)
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "ai.webp"
        ledger = Path(tmp) / "l.jsonl"
        with mock.patch.object(G, "BUN", Path(sys.executable)), \
                mock.patch.object(G, "IMAGE_GEN", SCRIPT), \
                mock.patch.object(G.subprocess, "run", side_effect=fake_run) as run:
            rc, data, _ = run_main(["ai", "--prompt", "dusk", "--provider", "google",
                                    "--size", "1200x800", "--out", str(out),
                                    "--page", "#0a0907", "--ledger", str(ledger)])
        assert rc == 0, data
        cmd = run.call_args[0][0]
        assert cmd[cmd.index("--ar") + 1] == "3:2" and "--model" not in cmd
        raw_dir = Path(cmd[cmd.index("--image") + 1]).parent
        assert not raw_dir.exists(), "RAW must be deleted without --keep-raw"
        with Image.open(out) as im:
            assert im.size == (1200, 800)
        assert out.stat().st_size <= 30 * 1024
        rec = json.loads(ledger.read_text().splitlines()[0])
        assert rec["mode"] == "ai" and rec["provider"] == "google" and "prompt" in rec
        # a gradient over a near-black page: visible, reported, never gated
        assert data["page"] == "#0a0907" and data["visibility"]["ge_1_3"] > 50
        assert rec["visibility"] == data["visibility"] and rec["page"] == "#0a0907"


def test_nearest_ratio():
    assert G.nearest_ratio(1600, 900) == "16:9"
    assert G.nearest_ratio(1000, 1000) == "1:1"
    assert G.nearest_ratio(800, 1200) == "2:3"
    assert G.nearest_ratio(1500, 1000) == "3:2"


# ---------------------------------------------------------------- compress


def test_compress_cover_crop():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.png"
        grad = np.linspace(0, 255, 900 * 1400 * 3).reshape(900, 1400, 3).astype(np.uint8)
        Image.fromarray(grad).save(src)
        out = Path(tmp) / "out.webp"
        rc, data, _ = run_cli("compress", "--in", str(src), "--out", str(out),
                              "--size", "640x640", check=True)
        with Image.open(out) as im:
            assert im.size == (640, 640)
        assert data["bytes"] == out.stat().st_size <= 30 * 1024
        assert "visibility" not in data          # no --page, no measure


def test_compress_reports_visibility_against_page_without_gating():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "flat.png"
        Image.fromarray(np.full((200, 300, 3), (10, 9, 7), dtype=np.uint8)).save(src)
        out = Path(tmp) / "out.webp"
        ledger = Path(tmp) / "l.jsonl"
        rc, data, _ = run_cli("compress", "--in", str(src), "--out", str(out), "--size", "300x200",
                              "--page", "#0a0907", "--ledger", str(ledger), check=True)
        assert out.exists() and data["page"] == "#0a0907"
        assert data["visibility"]["ge_1_1"] == 0.0     # invisible, but compress never gates
        rec = json.loads(ledger.read_text().splitlines()[0])
        assert rec["visibility"] == data["visibility"] and rec["page"] == "#0a0907"


def test_compress_ledger_line():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "photo.png"
        grad = np.linspace(0, 255, 400 * 600 * 3).reshape(400, 600, 3).astype(np.uint8)
        Image.fromarray(grad).save(src)
        out = Path(tmp) / "out.webp"
        ledger = Path(tmp) / "d" / "ledger.jsonl"
        rc, data, _ = run_cli("compress", "--in", str(src), "--out", str(out), "--size", "300x200",
                              "--ledger", str(ledger), check=True)
        rec = json.loads(ledger.read_text().splitlines()[0])
        assert rec["mode"] == "compress" and rec["tool"] == "gen_atmosphere"
        assert rec["source"] == "photo.png"
        assert rec["sourceSha256"] == hashlib.sha256(src.read_bytes()).hexdigest()
        assert rec["sha256"] == hashlib.sha256(out.read_bytes()).hexdigest() == data["sha256"]
        assert rec["bytes"] == out.stat().st_size and rec["size"] == "300x200"


def test_outputs_respect_umask_not_mkstemp_0600():
    old = os.umask(0o022)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "a.bin"
            G.write_atomic(p, b"x")
            assert p.stat().st_mode & 0o777 == 0o644, oct(p.stat().st_mode)
            os.umask(0o027)
            q = Path(tmp) / "b.bin"
            G.write_atomic(q, b"y")
            assert q.stat().st_mode & 0o777 == 0o640, oct(q.stat().st_mode)
            assert os.umask(0o027) == 0o027, "write_atomic must restore the umask"
    finally:
        os.umask(old)


def test_invalid_max_kb_is_a_json_error_not_a_traceback():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.png"
        Image.fromarray(np.zeros((32, 32, 3), dtype=np.uint8)).save(src)
        for bad in ("nan", "inf", "-inf", "0", "-5"):
            out = Path(tmp) / "p.webp"
            rc, data, err = run_cli("plate", "--palette", ",".join(RRG_PALETTE), "--style", "warp",
                                    "--seed", "1", "--size", "64x64", f"--max-kb={bad}",
                                    "--out", str(out))
            assert rc != 0 and "max-kb" in data["message"], (bad, data)
            assert "Traceback" not in err and not out.exists(), bad
            rc, data, err = run_cli("compress", "--in", str(src), "--out", str(out),
                                    "--size", "32x32", f"--max-kb={bad}")
            assert rc != 0 and "max-kb" in data["message"] and "Traceback" not in err, bad
        # `--max-kb -inf` looks like an option to argparse: still one JSON object, exit 2
        rc, data, err = run_cli("plate", "--palette", ",".join(RRG_PALETTE), "--style", "warp",
                                "--seed", "1", "--size", "64x64", "--max-kb", "-inf",
                                "--out", str(Path(tmp) / "p.webp"))
        assert rc == 2 and data["error"] == "usage" and "max-kb" in data["message"]
        assert "Traceback" not in err
        with mock.patch.object(G.subprocess, "run") as run:
            rc, data, _ = run_main(["ai", "--prompt", "x", "--size", "64x64", "--max-kb", "nan",
                                    "--out", str(Path(tmp) / "ai.webp")])
        assert rc == 1 and "max-kb" in data["message"]
        run.assert_not_called()


def test_help_for_every_subcommand():
    for sub in ("tokens", "plate", "svg", "ai", "compress"):
        proc = subprocess.run([sys.executable, str(SCRIPT), sub, "--help"],
                              capture_output=True, text=True)
        assert proc.returncode == 0 and "usage" in proc.stdout.lower(), sub


# ---------------------------------------------------------------- page, weight, slots, seeds

REF_PALETTE = ["#0a0907", "#151311", "#4c2a00", "#f9a216", "#ea8b00"]   # page first
WELL_FIRST = ["#040302", "#0a0907", "#151311", "#f9a216", "#ea8b00"]    # a darker well first
REF_ARGS = ["--style", "warp", "--seed", "131", "--intensity", "1", "--size", "1600x320",
            "--focus", "0.70,0.45"]
WELL_CSS = """
:root {
  --well: #040302;
  --bg: #0a0907;
  --panel: #151311;
  --accent: #f9a216;
  --accent-hi: #ea8b00;
}
"""


def test_plate_page_mismatch_and_tokens_page_role():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "x.webp"
        rc, data, _ = run_cli("plate", "--palette", ",".join(WELL_FIRST), "--style", "warp",
                              "--seed", "1", "--size", "320x180", "--page", "#0A0907",
                              "--out", str(out), "--allow-faint")
        assert rc == 1 and data["error"] == "page_mismatch", data
        assert data["page"] == "#0a0907" and data["base"] == "#040302" and not out.exists()
        # a --page equal to the first ground (any spelling) is fine
        rc, data, _ = run_cli("plate", "--palette", ",".join(REF_PALETTE), *REF_ARGS,
                              "--page", "rgb(10 9 7)", "--out", str(out), check=True)
        assert data["page"] == "#0a0907"
        # tokens --page-role writes `page`; plate --tokens defaults --page to it
        css = Path(tmp) / "t.css"
        css.write_text(WELL_CSS)
        tok = Path(tmp) / "tokens.json"
        rc, data, _ = run_cli("tokens", "--css", str(css), "--map",
                              "well=--well,bg=--bg,panel=--panel,accent=--accent,hi=--accent-hi",
                              "--page-role", "bg", "--out", str(tok), check=True)
        assert data["page"] == "#0a0907" and json.loads(tok.read_text())["page"] == "#0a0907"
        rc, data, _ = run_cli("plate", "--tokens", str(tok), "--style", "warp", "--seed", "1",
                              "--size", "320x180", "--out", str(out), "--allow-faint")
        assert rc == 1 and data["error"] == "page_mismatch" and data["base"] == "#040302"
        # default role `ground`: written when mapped, omitted when not; a named role must exist
        rc, data, _ = run_cli("tokens", "--css", str(css), "--map",
                              "ground=--bg,panel=--panel,accent=--accent", check=True)
        assert data["page"] == "#0a0907"
        rc, data, _ = run_cli("tokens", "--css", str(css), "--map", "bg=--bg,accent=--accent",
                              check=True)
        assert "page" not in data
        rc, data, _ = run_cli("tokens", "--css", str(css), "--map", "bg=--bg,accent=--accent",
                              "--page-role", "nope")
        assert rc == 1 and "--page-role" in data["message"]


def test_weight_raises_contour_and_rings_at_strip_size():
    for style in ("contour", "rings"):
        thin = G.render_plate(PAGE_PALETTE, style, 3, 1600, 180, 0.6, (0.75, 0.3), 1.0)
        bold = G.render_plate(PAGE_PALETTE, style, 3, 1600, 180, 0.6, (0.75, 0.3), 3.0)
        vt, vb = G.visibility(thin, "#0a0907"), G.visibility(bold, "#0a0907")
        assert vb["ge_1_3"] > vt["ge_1_3"] and vb["ge_1_1"] > vt["ge_1_1"], (style, vt, vb)
    # weight 1 is today's output, byte for byte; warp ignores it
    assert np.array_equal(G.render_plate(PAGE_PALETTE, "contour", 3, 320, 180),
                          G.render_plate(PAGE_PALETTE, "contour", 3, 320, 180, weight=1.0))
    assert np.array_equal(G.render_plate(PAGE_PALETTE, "warp", 3, 320, 180, weight=1.0),
                          G.render_plate(PAGE_PALETTE, "warp", 3, 320, 180, weight=4.0))
    with tempfile.TemporaryDirectory() as tmp:
        out, ledger = Path(tmp) / "c.webp", Path(tmp) / "l.jsonl"
        base = ["plate", "--palette", ",".join(PAGE_PALETTE), "--style", "contour", "--seed",
                "3", "--size", "1600x180", "--out", str(out), "--allow-faint"]
        _, thin, _ = run_cli(*base, check=True)
        _, bold, _ = run_cli(*base, "--weight", "3", "--ledger", str(ledger), check=True)
        assert bold["weight"] == 3.0 and thin["weight"] == 1.0
        assert bold["visibility"]["ge_1_3"] > thin["visibility"]["ge_1_3"]
        assert json.loads(ledger.read_text())["weight"] == 3.0
        for bad in ("0.2", "5", "nan"):
            rc, data, _ = run_cli(*base, "--weight", bad)
            assert rc == 1 and "--weight" in data["message"], bad


def test_scrim_profiles_match_the_contract_table():
    hb = G.resolve_slot("1000x50", "header-band")
    alpha = G.scrim_alpha(hb)[0]
    assert alpha.shape == (1000,) and abs(alpha[0] - 0.94) < 1e-3 and abs(alpha[-1] - 0.88) < 1e-3
    assert abs(alpha[399] - 0.86) < 2e-3 and alpha[600] == 0 and alpha[779] == 0
    assert abs(alpha[899] - 0.85) < 5e-3     # pixel centre 899.5, half a px before the stop
    assert G.SCRIM_PROFILES["state-band"]["stops"] == (
        (0, .95), (.50, .90), (.66, 0), (.80, 0), (.92, .88), (1, .90))
    assert G.SCRIM_PROFILES["center-band"]["stops"] == (
        (0, 0), (.08, 0), (.22, .90), (.50, .94), (.78, .90), (.92, 0), (1, 0))
    assert G.SCRIM_PROFILES["full"]["stops"] == ((0, .92), (1, .84))
    ps = G.resolve_slot("375x200", "phone-strip")
    col = G.scrim_alpha(ps)[:, 0]
    assert ps["fit"] == "strip" and col[0] == 0 and col[47] == 0
    assert abs(col[63] - 0.92 * 15.5 / 16) < 1e-6 and col[64] == 0.92 and col[-1] == 0.92
    assert not G.scrim_alpha(G.resolve_slot("64x64", "none")).any()
    tm = G.text_region_mask(hb)[0]
    assert tm[:500].all() and not tm[500:880].any() and tm[880:].all()


def test_slot_fits_count_only_the_pixels_the_image_covers():
    white = np.full((320, 1600, 3), 255, dtype=np.uint8)
    # band: 100% wide, auto height (800x160), centred in a 800x400 slot
    band = G.resolve_slot("800x400", None, None, "band")
    comp, mask = G.composite_slot(white, "#000000", band)
    assert mask.sum() == 800 * 160 and mask[120:280].all() and not mask[:120].any()
    assert (comp[0] == 0).all() and (comp[200] == 255).all()
    assert G.score_pixels(white, "#000000", band)["visibility"]["ge_1_3"] == 100.0
    # strip: width max(100%, 64 x 5 = 320) -> 375x75, right top; only y < 64 counts
    strip = G.resolve_slot("375x400", "phone-strip")
    comp, mask = G.composite_slot(white, "#000000", strip)
    assert mask.sum() == 375 * 64 and comp[100, 10].tolist() == [0, 0, 0]
    # cover at the profile's position (right centre), custom scrim at 50%
    custom = G.resolve_slot("100x100", None, '{"dir":"y","stops":[[0,0.5],[1,0.5]]}')
    comp, mask = G.composite_slot(white, "#000000", custom)
    assert custom["scrim"] == "custom" and mask.all() and (comp == 128).all()
    for bad in ('{"dir":"z","stops":[[0,1]]}', '{"dir":"x","stops":[[0,2]]}', "nope"):
        try:
            G.resolve_slot("100x100", None, bad)
        except G.CliError:
            pass
        else:
            raise AssertionError(bad)


def test_plate_slot_measures_the_slot_not_the_whole_file():
    with tempfile.TemporaryDirectory() as tmp:
        out, ledger = Path(tmp) / "h.webp", Path(tmp) / "l.jsonl"
        rc, data, _ = run_cli("plate", "--palette", ",".join(REF_PALETTE), *REF_ARGS,
                              "--out", str(out), "--slot", "1170x90", "--scrim", "header-band",
                              "--ledger", str(ledger), check=True)
        assert data["slot"] == "1170x90" and data["scrim"] == "header-band" and data["fit"] == "cover"
        sv, wv = data["slotVisibility"], data["visibility"]
        assert sv != wv and 12 <= sv["ge_1_1"] <= 24 and 2 <= sv["ge_1_3"] <= 6, sv
        rec = json.loads(ledger.read_text())
        assert rec["slotVisibility"] == sv and rec["scrim"] == "header-band"
        # the whole file passes, but under the band's opaque left side the slot shows nothing
        left = ["plate", "--palette", ",".join(PAGE_PALETTE), "--style", "warp", "--seed", "7",
                "--intensity", "1", "--size", "1600x320", "--focus", "0.15,0.5",
                "--out", str(out)]
        out.unlink()
        rc, data, _ = run_cli(*left, check=True)
        assert G.passes_visibility(data["visibility"], (8, 1))
        out.unlink()
        rc, data, _ = run_cli(*left, "--slot", "1170x90", "--scrim", "header-band")
        assert rc == 4 and data["error"] == "too_faint" and not out.exists()
        assert data["slotVisibility"]["ge_1_1"] < 8 and "slot 1170x90" in data["message"]
        rc, data, _ = run_cli(*left, "--scrim", "header-band")
        assert rc == 2 and data["error"] == "usage"


def test_seeds_pick_best_and_exit_4_when_none_passes():
    with tempfile.TemporaryDirectory() as tmp:
        out, ledger = Path(tmp) / "s.webp", Path(tmp) / "l.jsonl"
        base = ["plate", "--palette", ",".join(REF_PALETTE), "--style", "warp", "--intensity",
                "1", "--size", "1600x320", "--focus", "0.70,0.45", "--out", str(out),
                "--slot", "1170x90", "--scrim", "header-band"]
        rc, data, _ = run_cli(*base, "--seeds", "129-132", "--pick", "best",
                              "--ledger", str(ledger), check=True)
        cands = data["candidates"]
        assert [c["seed"] for c in cands] == [129, 130, 131, 132]
        ok = [c for c in cands if c["ge_1_1"] >= 8 and c["ge_1_3"] >= 1]
        best = max(ok, key=lambda c: (c["ge_1_3"], c["ge_1_1"]))
        assert data["seed"] == best["seed"]
        assert data["slotVisibility"]["ge_1_3"] == best["ge_1_3"]
        rec = json.loads(ledger.read_text())
        assert rec["seed"] == best["seed"] and rec["candidates"] == cands
        # the written file is that seed's render
        rc, single, _ = run_cli(*base[:-4], "--seed", str(best["seed"]),
                                "--out", str(Path(tmp) / "one.webp"), check=True)
        assert single["sha256"] == data["sha256"]
        out.unlink()
        rc, data, _ = run_cli(*base, "--seeds", "1,2,3", "--min-visible", "90,50")
        assert rc == 4 and data["error"] == "too_faint" and len(data["candidates"]) == 3
        assert not out.exists()
        rc, data, _ = run_cli(*base, "--seed", "1", "--seeds", "1-2")
        assert rc == 2 and data["error"] == "usage"
        rc, data, _ = run_cli(*base)
        assert rc == 2 and "--seed" in data["message"]
        rc, data, _ = run_cli(*base, "--seeds", "5-2")
        assert rc == 1 and "--seeds" in data["message"]


# ---------------------------------------------------------------- score


def _write_png(path, arr):
    Image.fromarray(np.asarray(arr, dtype=np.uint8)).save(path)


def test_score_darker_than_page_fails_and_page_based_passes():
    with tempfile.TemporaryDirectory() as tmp:
        # 80% of pixels darker than the page (the old "recessed well" base)
        dark = np.zeros((320, 1600, 3), dtype=np.uint8)
        dark[:] = (4, 3, 2)
        ys, xs = np.mgrid[0:320, 0:1600]
        dark[(xs + ys) % 5 == 0] = (26, 24, 21)
        p = Path(tmp) / "dark.png"
        _write_png(p, dark)
        assert G.visibility(dark, "#0a0907")["darker_than_page"] == 80.0
        rc, data, _ = run_cli("score", "--plate", str(p), "--page", "#0a0907",
                              "--slot", "1170x90", "--scrim", "header-band")
        assert rc == 4 and data["pass"] is False and data["visibility"]["ge_1_1"] < 8, data
        assert any(r.startswith("ge_1_1") for r in data["reasons"])
        # a rendered plate on the well, default intensity: far below the floor
        well = Path(tmp) / "well.webp"
        run_cli("plate", "--palette", ",".join(WELL_FIRST), "--style", "warp", "--seed", "11",
                "--size", "1600x320", "--out", str(well), "--allow-faint", check=True)
        rc, data, _ = run_cli("score", "--plate", str(well), "--page", "#0a0907",
                              "--slot", "1170x90", "--scrim", "header-band")
        assert rc == 4 and data["visibility"]["ge_1_1"] < 4, data
        # the page-based warp plate passes in the same slot
        good = Path(tmp) / "good.webp"
        run_cli("plate", "--palette", ",".join(REF_PALETTE), *REF_ARGS, "--out", str(good),
                check=True)
        rc, data, _ = run_cli("score", "--plate", str(good), "--page", "#0a0907",
                              "--slot", "1170x90", "--scrim", "header-band", check=True)
        assert data["pass"] is True and data["reasons"] == [] and data["text"] is None
        assert set(data) >= {"plate", "slot", "scrim", "fit", "visibility", "text", "pass",
                             "reasons"}
        assert data["slot"] == "1170x90" and data["fit"] == "cover"
        # no --slot: the plate's own size, no scrim
        rc, data, _ = run_cli("score", "--plate", str(good), "--page", "#0a0907", check=True)
        assert data["slot"] == "1600x320" and data["scrim"] == "none"


def test_score_text_gate():
    with tempfile.TemporaryDirectory() as tmp:
        good = Path(tmp) / "good.webp"
        run_cli("plate", "--palette", ",".join(REF_PALETTE), *REF_ARGS, "--out", str(good),
                check=True)
        args = ["score", "--plate", str(good), "--page", "#0a0907", "--slot", "1170x90",
                "--scrim", "header-band"]
        rc, data, _ = run_cli(*args, "--text", "#84817e", check=True)
        t = data["text"]
        assert t["pass"] and t["ratio"] >= 4.5 and t["percentile"] == 90
        assert t["p90_ratio"] == t["ratio"]          # the old key stays as an alias
        rc, data, _ = run_cli(*args, "--text", "#5a5856")
        assert rc == 4 and not data["text"]["pass"] and data["text"]["p90_ratio"] < 3.5
        assert any(r.startswith("text") for r in data["reasons"])
        rc, data, _ = run_cli(*args, "--text", "#5a5856", "--min-text", "2.5", check=True)
        # the same text with no scrim reads against the raw plate and fails
        rc, data, _ = run_cli("score", "--plate", str(good), "--page", "#0a0907",
                              "--slot", "1170x90", "--text", "#84817e")
        assert rc == 4 and data["text"]["p90_ratio"] < 4.5
        # dark text on a light page reads against the p10 (darkest) background
        light = Path(tmp) / "light.png"
        _write_png(light, np.full((90, 400, 3), 240))
        rc, data, _ = run_cli("score", "--plate", str(light), "--page", "#f0f0f0",
                              "--text", "#1a1a1a", "--min-visible", "0,0", check=True)
        assert data["text"]["percentile"] == 10 and data["text"]["ratio"] > 12


# ---------------------------------------------------------------- batch

BATCH_CSS = """
:root {
  --color-bg: #0a0907;
  --color-surface-raised: #151311;
  --color-sodium-soft: #4c2a00;
  --color-sodium: #f9a216;
  --color-sodium-strong: #ea8b00;
}
"""
FAKE_AI = """
import json, os, sys
sys.path.insert(0, {scripts!r})
import gen_atmosphere as G
args = sys.argv[1:]
arg = lambda k: args[args.index(k) + 1]
if os.environ.get("FAKE_AI_MODE") == "fail" or "FAIL" in arg("--prompt"):
    print(json.dumps({{"error": "ai_unavailable", "reason": "fake outage"}}))
    sys.exit(3)
sys.exit(G.main(["plate", "--palette", "#0a0907,#151311,#4c2a00,#f9a216,#ea8b00",
                 "--style", "warp", "--seed", "131", "--intensity", "1", "--focus", "0.70,0.45",
                 "--size", arg("--size"), "--out", arg("--out"), "--allow-faint"]))
"""
MANIFEST = "docs/imagery/plates.manifest.json"


def _batch_project(tmp, plates, **over):
    root = Path(tmp)
    (root / "web/app").mkdir(parents=True)
    (root / "web/app/globals.css").write_text(BATCH_CSS)
    man = {"tokens": {"css": "web/app/globals.css", "selector": ":root",
                      "map": "ground=--color-bg,ground2=--color-surface-raised,"
                             "ground3=--color-sodium-soft,accent=--color-sodium,"
                             "accentHi=--color-sodium-strong",
                      "out": "docs/imagery/tokens.json"},
           "page": "#0a0907", "text": "#84817e", "out_dir": "web/public/plates",
           "ledger": "docs/imagery/plates.jsonl",
           "defaults": {"size": "1600x320", "intensity": 1.0, "focus": "0.70,0.45",
                        "max_kb": 30, "slot": "1170x90", "scrim": "header-band", "fit": "cover"},
           "plates": plates}
    man.update(over)
    (root / "docs/imagery").mkdir(parents=True)
    (root / MANIFEST).write_text(json.dumps(man))
    fake = root / "fake_ai.py"
    fake.write_text(FAKE_AI.format(scripts=str(HERE)))
    return root


def run_batch(root, *args, env=None):
    full_env = {**os.environ, "FUI_AI_CMD": f"{sys.executable} {root / 'fake_ai.py'}",
                **(env or {})}
    proc = subprocess.run([sys.executable, str(SCRIPT), "batch", "--manifest", MANIFEST, *args],
                          cwd=str(root), capture_output=True, text=True, env=full_env)
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    assert len(lines) == 1, f"stdout must be one JSON object: {proc.stdout!r} {proc.stderr}"
    return proc.returncode, json.loads(lines[0]), proc.stderr


def _snapshot(root):
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(Path(root).rglob("*"))
            if p.is_file()}


TWO_PLATES = [{"name": "today", "style": "warp", "seed": 131},
              {"name": "trades", "style": "warp", "seeds": "129-131", "pick": "best"}]


def test_batch_dry_run_writes_nothing_and_success_writes_a_clean_ledger():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, TWO_PLATES)
        before = _snapshot(root)
        rc, data, err = run_batch(root, "--dry-run")
        assert rc == 0 and data["dryRun"] and data["written"] is False, (data, err)
        assert _snapshot(root) == before, "a dry run writes nothing"
        assert "today" in err and "ge_1_1" in err             # the table, on stderr
        rc, data, err = run_batch(root)
        assert rc == 0 and data["written"] and data["pass"], (data, err)
        ledger = root / "docs/imagery/plates.jsonl"
        rows = [json.loads(ln) for ln in ledger.read_text().splitlines()]
        assert [r["out"] for r in rows] == ["web/public/plates/today.webp",
                                            "web/public/plates/trades.webp"]
        for r in rows:
            assert not {"ts", "argv", "raw"} & set(r), r
            assert r["sha256"] == hashlib.sha256((root / r["out"]).read_bytes()).hexdigest()
            assert r["slot"] == "1170x90" and r["scrim"] == "header-band"
            assert r["slotVisibility"]["ge_1_1"] >= 8 and r["text"]["pass"]
        assert rows[1]["seed"] in (129, 130, 131) and len(rows[1]["candidates"]) == 3
        assert json.loads((root / "docs/imagery/tokens.json").read_text())["page"] == "#0a0907"
        # deterministic: a second run rewrites the same bytes
        first = _snapshot(root)
        rc, _, _ = run_batch(root)
        assert rc == 0 and _snapshot(root) == first


def test_batch_gate_failure_changes_nothing():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, TWO_PLATES)
        assert run_batch(root)[0] == 0
        man = json.loads((root / MANIFEST).read_text())
        man["plates"].append({"name": "faint", "style": "contour", "seed": 3, "intensity": 0.3})
        man["plates"][0]["seed"] = 132            # would change today.webp if written
        (root / MANIFEST).write_text(json.dumps(man))
        before = _snapshot(root)
        rc, data, err = run_batch(root)
        assert rc == 4 and data["error"] == "gate_failed" and "faint" in data["message"], data
        assert [p["name"] for p in data["plates"] if p["pass"] is False] == ["faint"]
        assert _snapshot(root) == before


def _ship_ai_plate(root):
    """Simulate an approved ai image: a file plus its ledger row."""
    out = root / "web/public/plates/crowding.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    G.main(["plate", "--palette", ",".join(REF_PALETTE), *REF_ARGS, "--out", str(out)])
    row = {"ts": "2026-10-11T00:00:00+00:00", "tool": "gen_atmosphere", "mode": "ai",
           "provider": "openai", "prompt": "particle trails", "size": "1600x320",
           "out": "web/public/plates/crowding.webp", "argv": ["ai"],
           "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}
    (root / "docs/imagery/plates.jsonl").write_text(json.dumps(row) + "\n")
    return out


AI_ENTRY = {"name": "crowding", "ai": {"provider": "openai", "prompt": "particle trails"},
            "fallback": {"style": "warp", "seed": 131}}


def test_batch_ai_entry_is_verified_against_its_ledger():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, [TWO_PLATES[0], AI_ENTRY])
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            out = _ship_ai_plate(root)
        approved = out.read_bytes()
        rc, data, err = run_batch(root, env={"FAKE_AI_MODE": "fail"})   # ai is never called
        assert rc == 0, (data, err)
        crowd = [p for p in data["plates"] if p["name"] == "crowding"][0]
        assert crowd["source"] == "verified" and out.read_bytes() == approved
        rows = {r["name"]: r for r in map(json.loads,
                (root / "docs/imagery/plates.jsonl").read_text().splitlines())}
        assert rows["crowding"]["mode"] == "ai" and rows["crowding"]["prompt"] == "particle trails"
        assert "ts" not in rows["crowding"] and "argv" not in rows["crowding"]
        # a file that no longer matches its ledger row is refused
        out.write_bytes(approved + b"x")
        before = _snapshot(root)
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["error"] == "ledger_mismatch" and data["name"] == "crowding"
        assert _snapshot(root) == before


def test_batch_ai_failure_exit_3_or_fallback():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, [TWO_PLATES[0], AI_ENTRY])
        before = _snapshot(root)
        rc, data, _ = run_batch(root, "--reroll-ai", env={"FAKE_AI_MODE": "fail"})
        assert rc == 3 and data["error"] == "ai_failed" and "fake outage" in data["reason"]
        assert _snapshot(root) == before
        # no reroll and nothing shipped yet: nothing to verify
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["error"] == "ledger_mismatch"
        rc, data, err = run_batch(root, "--reroll-ai", "--fallback",
                                  env={"FAKE_AI_MODE": "fail"})
        assert rc == 0, (data, err)
        crowd = [p for p in data["plates"] if p["name"] == "crowding"][0]
        assert crowd["source"] == "fallback" and "fake outage" in crowd["aiError"]
        assert "fallback" in err
        rows = {r["name"]: r for r in map(json.loads,
                (root / "docs/imagery/plates.jsonl").read_text().splitlines())}
        assert rows["crowding"]["fallbackFor"] == "ai" and rows["crowding"]["seed"] == 131
        assert rows["crowding"]["mode"] == "plate"
        # ai success through the injected command
        rc, data, err = run_batch(root, "--reroll-ai")
        assert rc == 0, (data, err)
        crowd = [p for p in data["plates"] if p["name"] == "crowding"][0]
        assert crowd["source"] == "ai" and crowd["mode"] == "ai"
        # an approved ai image is kept, never replaced by the fallback
        approved = (root / "web/public/plates/crowding.webp").read_bytes()
        rc, data, err = run_batch(root, "--reroll-ai", "--fallback",
                                  env={"FAKE_AI_MODE": "fail"})
        crowd = [p for p in data["plates"] if p["name"] == "crowding"][0]
        assert rc == 0 and crowd["source"] == "kept"
        assert (root / "web/public/plates/crowding.webp").read_bytes() == approved


def test_batch_manifest_errors():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, [{"name": "../escape", "style": "warp", "seed": 1}])
        rc, data, _ = run_batch(root)
        assert rc == 1 and "name" in data["message"]
        man = json.loads((root / MANIFEST).read_text())
        man["plates"] = [{"name": "a", "style": "warp", "seed": 1, "colour": "x"}]
        (root / MANIFEST).write_text(json.dumps(man))
        rc, data, _ = run_batch(root)
        assert rc == 1 and "colour" in data["message"]
        man["plates"] = [{"name": "a", "style": "warp", "seed": 1}]
        man["page"] = "#000000"
        (root / MANIFEST).write_text(json.dumps(man))
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["error"] == "page_mismatch" and data["name"] == "a"
        assert not (root / "web/public").exists()
        # `page` is never inferred from the token map: a manifest without it is refused.
        del man["page"]
        (root / MANIFEST).write_text(json.dumps(man))
        rc, data, _ = run_batch(root)
        assert rc == 1 and "explicit `page`" in data["message"]
        assert not (root / "web/public").exists()


def test_batch_entry_scrim_brings_its_own_fit():
    defaults = {"slot": "1170x90", "scrim": "header-band", "fit": "cover", "seeds": "1-4"}
    cfg = G.merge_config(defaults, {"name": "p", "seed": 3, "slot": "375x200",
                                    "scrim": "phone-strip"})
    assert "fit" not in cfg and "seeds" not in cfg and cfg["seed"] == 3
    assert G.cfg_slot(cfg, (1600, 320))["fit"] == "strip"
    cfg = G.merge_config(defaults, {"name": "p", "scrim": "center-band", "fit": "cover"})
    assert cfg["fit"] == "cover" and cfg["seeds"] == "1-4"
    assert G.merge_config(defaults, {"name": "p"})["fit"] == "cover"



# ---------------------------------------------------------------- batch: review fixes


def _rows(root):
    return [json.loads(ln) for ln in
            (root / "docs/imagery/plates.jsonl").read_text().splitlines()]


def _edit_manifest(root, fn):
    man = json.loads((root / MANIFEST).read_text())
    fn(man)
    (root / MANIFEST).write_text(json.dumps(man))


def test_batch_keeps_foreign_ledger_rows_and_prune_drops_them():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, TWO_PLATES)
        svg_row = json.dumps({"ts": "x", "tool": "gen_atmosphere", "mode": "svg", "argv": ["svg"]})
        other = ('{"ts":"2026-10-11","mode":"compress","out":"web/public/other.webp",'
                 '"sha256":"abc","argv":["compress"]}')
        stale = json.dumps({"mode": "plate", "out": "web/public/plates/today.webp", "sha256": "old"})
        (root / "docs/imagery/plates.jsonl").write_text("\n".join([other, stale, svg_row]) + "\n")
        rc, data, err = run_batch(root)
        assert rc == 0 and data["pruned"] == [], (data, err)
        lines = (root / "docs/imagery/plates.jsonl").read_text().splitlines()
        # foreign rows verbatim, the manifest's own out replaced, all sorted by out
        assert lines[0] == svg_row and lines[1] == other
        assert [json.loads(ln)["out"] for ln in lines[2:]] == [
            "web/public/plates/today.webp", "web/public/plates/trades.webp"]
        assert stale not in lines
        rc, data, err = run_batch(root, "--prune")
        assert rc == 0 and sorted(data["pruned"]) == sorted(
            ["web/public/other.webp", svg_row[:80]]), data
        assert "--prune drops 2" in err
        assert [r["out"] for r in _rows(root)] == ["web/public/plates/today.webp",
                                                   "web/public/plates/trades.webp"]


PANEL_PALETTE = "#151311,#26231d,#4c2a00,#f9a216,#ea8b00"


def test_batch_entry_page_for_a_raised_panel():
    with tempfile.TemporaryDirectory() as tmp:
        panel = {"name": "panel", "style": "warp", "seed": 131, "page": "#151311",
                 "palette": PANEL_PALETTE, "text": "#b8b5b2"}
        mapped = {"name": "mapped", "style": "warp", "seed": 131, "page": "#151311",
                  "map": "ground=--color-surface-raised,ground2=--color-sodium-soft,"
                         "accent=--color-sodium,accentHi=--color-sodium-strong",
                  "text": "#b8b5b2"}
        root = _batch_project(tmp, [TWO_PLATES[0], panel, mapped])
        _edit_manifest(root, lambda m: m["defaults"].pop("intensity"))   # LOW 6 default
        rc, data, err = run_batch(root)
        assert rc == 0, (data, err)
        rows = {r["name"]: r for r in _rows(root)}
        assert rows["panel"]["page"] == "#151311" and rows["today"]["page"] == "#0a0907"
        assert rows["mapped"]["palette"][0] == "#151311"
        assert all(r["intensity"] == 1.0 for r in rows.values())    # slotted: 1.0, not 0.6
        # the same entry without its own page sits on the manifest page: refused
        _edit_manifest(root, lambda m: m["plates"][1].pop("page"))
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["error"] == "page_mismatch" and data["name"] == "panel"
        assert data["page"] == "#0a0907" and data["base"] == "#151311"
        # an entry gives a palette or a map, not both; `page` never goes in defaults
        _edit_manifest(root, lambda m: (m["plates"][1].update(page="#151311"),
                                        m["plates"][2].update(palette=PANEL_PALETTE)))
        rc, data, _ = run_batch(root)
        assert rc == 1 and "not both" in data["message"]
        _edit_manifest(root, lambda m: m["defaults"].update(page="#151311"))
        rc, data, _ = run_batch(root)
        assert rc == 1 and "defaults" in data["message"]


def test_batch_reroll_refuses_an_unverified_existing_file():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, [AI_ENTRY])
        hero = root / "web/public/plates/crowding.webp"
        hero.parent.mkdir(parents=True)
        hero.write_bytes(b"hand-placed, no ledger row")
        before = _snapshot(root)
        for flags in (["--reroll-ai", "--fallback"], ["--reroll-ai"]):
            rc, data, _ = run_batch(root, *flags, env={"FAKE_AI_MODE": "fail"})
            assert rc == 1 and data["error"] == "ledger_mismatch", (flags, data)
            assert _snapshot(root) == before
        # a missing file is fine: the fallback is shipped
        hero.unlink()
        rc, data, _ = run_batch(root, "--reroll-ai", "--fallback", env={"FAKE_AI_MODE": "fail"})
        assert rc == 0 and data["plates"][0]["source"] == "fallback"


UNWIND = {"name": "unwind", "ai": {"provider": "openai", "prompt": "FAIL two streams"},
          "fallback": {"style": "warp", "seed": 131}}


def test_batch_only_runs_the_named_entries():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, TWO_PLATES + [AI_ENTRY])
        rc, data, err = run_batch(root, "--reroll-ai")
        assert rc == 0, (data, err)
        lines = (root / "docs/imagery/plates.jsonl").read_text().splitlines()
        trades_line = [ln for ln in lines if '"name":"trades"' in ln][0]
        before = _snapshot(root)

        def change(m):
            m["plates"][0]["seed"] = 132           # today changes
            m["plates"][1]["seeds"] = "1-2"        # trades would change, but is not selected
        _edit_manifest(root, change)
        rc, data, err = run_batch(root, "--only", "today", "--reroll-ai",
                                  env={"FAKE_AI_MODE": "fail"})     # crowding is not re-rolled
        assert rc == 0, (data, err)
        src = {p["name"]: p["source"] for p in data["plates"]}
        assert src == {"today": "rendered", "trades": "unselected", "crowding": "unselected"}
        after = _snapshot(root)
        for f in ("web/public/plates/trades.webp", "web/public/plates/crowding.webp"):
            assert after[f] == before[f]
        assert after["web/public/plates/today.webp"] != before["web/public/plates/today.webp"]
        assert trades_line in (root / "docs/imagery/plates.jsonl").read_text().splitlines()
        rc, data, _ = run_batch(root, "--only", "today,nope")
        assert rc == 2 and "nope" in data["message"]
        (root / "web/public/plates/trades.webp").write_bytes(b"tampered")
        rc, data, _ = run_batch(root, "--only", "today")
        assert rc == 1 and data["error"] == "ledger_mismatch" and data["name"] == "trades"


def test_batch_abort_saves_paid_ai_images_to_rejected():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, [AI_ENTRY, UNWIND])
        before = _snapshot(root)
        rc, data, err = run_batch(root, "--reroll-ai")        # crowding paid, unwind fails
        assert rc == 3 and data["error"] == "ai_failed" and data["name"] == "unwind"
        rejected = root / data["rejected"]
        assert rejected.parent.name == ".rejected" and rejected.parent.parent.name == "plates"
        note = json.loads((rejected / "note.json").read_text())
        img = (rejected / "crowding.webp").read_bytes()
        assert [n["name"] for n in note] == ["crowding"]
        assert note[0]["prompt"] == "particle trails" and note[0]["sha256"] == _sha256(img)
        assert "unwind" in note[0]["reason"] and data["rejected"] in err
        plates = root / "web/public/plates"
        assert sorted(p.name for p in plates.iterdir()) == [".rejected"]
        assert {k: v for k, v in _snapshot(root).items() if ".rejected" not in k} == before
        # exit 4 (a later plate fails its gate) also keeps the paid image
        _edit_manifest(root, lambda m: m.update(plates=[AI_ENTRY, {
            "name": "faint", "style": "contour", "seed": 3, "intensity": 0.3}]))
        rc, data, _ = run_batch(root, "--reroll-ai")
        assert rc == 4 and data["error"] == "gate_failed"
        assert (root / data["rejected"] / "crowding.webp").exists()
        assert not (plates / "crowding.webp").exists()


def _sha256(b):
    return hashlib.sha256(b).hexdigest()


def test_batch_paths_must_stay_in_the_project():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(Path(tmp) / "proj", TWO_PLATES[:1], out_dir="../outside/plates")
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["error"] == "path_outside_project" and data["key"] == "out_dir"
        rc, data, err = run_batch(root, "--allow-outside", "--dry-run")
        assert rc == 0 and "outside the project root" in err
        _edit_manifest(root, lambda m: (m.update(out_dir="web/public/plates"),
                                        m["tokens"].update(css=str(Path(tmp) / "x.css"))))
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["key"] == "tokens.css"
        _edit_manifest(root, lambda m: (m["tokens"].update(css="web/app/globals.css"),
                                        m.update(ledger="/tmp/plates.jsonl")))
        rc, data, _ = run_batch(root)
        assert rc == 1 and data["key"] == "ledger"
        assert not (Path(tmp) / "outside").exists()


def test_batch_swap_restores_originals_when_a_rename_fails():
    with tempfile.TemporaryDirectory() as tmp:
        root = _batch_project(tmp, TWO_PLATES)
        assert run_batch(root)[0] == 0
        _edit_manifest(root, lambda m: (m["plates"][0].update(seed=132),
                                        m["plates"][1].update(seeds="1-2")))
        before = _snapshot(root)
        real_replace, calls = os.replace, []

        def flaky(src, dst):
            if ".stage." in str(src):
                calls.append(dst)
                if len(calls) == 3:          # tokens.json and today renamed, trades fails
                    raise OSError(28, "No space left on device")
            return real_replace(src, dst)

        cwd = os.getcwd()
        os.chdir(root)
        try:
            with mock.patch.object(G.os, "replace", side_effect=flaky):
                rc, data, _ = run_main(["batch", "--manifest", MANIFEST])
        finally:
            os.chdir(cwd)
        assert rc == 1 and data["error"] == "swap_failed" and data["restored"] == 2, data
        assert _snapshot(root) == before, "originals restored, ledger untouched"
        leftovers = [p for p in root.rglob(".gen_atmosphere.*")]
        assert not leftovers, leftovers


def test_plate_intensity_defaults_to_1_with_a_slot():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "p.webp"
        base = ["plate", "--palette", ",".join(REF_PALETTE), "--style", "warp", "--seed", "131",
                "--size", "1600x320", "--focus", "0.70,0.45", "--out", str(out)]
        _, data, _ = run_cli(*base, "--allow-faint", check=True)
        assert data["intensity"] == 0.6
        _, data, _ = run_cli(*base, "--slot", "1170x90", "--scrim", "header-band", check=True)
        assert data["intensity"] == 1.0
        _, data, _ = run_cli(*base, "--slot", "1170x90", "--intensity", "0.9", "--allow-faint",
                             check=True)
        assert data["intensity"] == 0.9


PLATE_SLOTS_MD = HERE.parent / "references" / "plate-slots.md"
_MIX = re.compile(r"color-mix\(in oklab, var\(--[\w-]+\) (\d+)%, transparent\) (.+)$")
_TRANSPARENT = re.compile(r"^transparent (.+)$")


def _stop_position(text):
    """'100%),' -> '100%'; 'calc(var(--s) - 16px),' keeps its own parens."""
    text = text.rstrip(",")
    while text.endswith(")") and text.count(")") > text.count("("):
        text = text[:-1]
    return text


def _doc_css_block(md, profile):
    """The first ```css block after the `### `profile`` heading."""
    m = re.search(r"^### `%s`.*?^```css\n(.*?)^```" % re.escape(profile), md, re.S | re.M)
    assert m, f"no ### `{profile}` css block in plate-slots.md"
    return m.group(1)


def _gradient_stops(css):
    stops = []
    for line in (ln.strip() for ln in css.splitlines()):
        mix, clear = _MIX.match(line), _TRANSPARENT.match(line)
        if mix:
            stops.append((_stop_position(mix.group(2)), int(mix.group(1)) / 100))
        elif clear:
            stops.append((_stop_position(clear.group(1)), 0.0))
    return stops


def test_plate_slots_doc_css_matches_scrim_profiles():
    """The docs' CSS is pinned to SCRIM_PROFILES (parsed from the CSS blocks)."""
    md = PLATE_SLOTS_MD.read_text(encoding="utf-8")
    for name in ("header-band", "state-band", "center-band"):
        stops = _gradient_stops(_doc_css_block(md, name))
        want = [(f"{round(p * 100):g}%", float(a)) for p, a in G.SCRIM_PROFILES[name]["stops"]]
        assert stops == want, (name, stops, want)
    phone = _gradient_stops(md[md.index("### Phones"):])[:4]
    assert phone == [("0px", 0.0), ("calc(var(--plate-strip) - 16px)", 0.0),
                     ("var(--plate-strip)", 0.92), ("100%", 0.92)], phone
    assert G.SCRIM_PROFILES["phone-strip"]["stops"] == (
        (0, 0), ("strip-16", 0), ("strip", .92), ("100%", .92))
    assert G.STRIP_FEATHER == 16 and G.DEFAULT_STRIP == 64


def test_help_for_new_subcommands():
    for sub in ("score", "batch"):
        proc = subprocess.run([sys.executable, str(SCRIPT), sub, "--help"],
                              capture_output=True, text=True)
        assert proc.returncode == 0 and "usage" in proc.stdout.lower(), sub


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
