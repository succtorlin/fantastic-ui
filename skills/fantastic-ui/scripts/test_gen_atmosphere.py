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
