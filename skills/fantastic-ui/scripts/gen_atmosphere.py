#!/usr/bin/env python3
"""gen_atmosphere.py - decorative atmosphere imagery for /fantastic-ui.

Why this exists: the skill rarely produced imagery because it had no
repeatable procedure. This script is that procedure. It is local,
deterministic and needs no API key (except the optional `ai` subcommand).

The rules it serves:

  * Output is a WebP of at most --max-kb (default 30 KB). The encoder searches
    quality 82 -> 20 (step 6, method=6), then blurs 1/2/3 px and retries. If it
    still cannot fit, it exits non-zero and writes nothing. No PNG is written,
    except the raw source that `ai --keep-raw` keeps when asked (opt-in).
  * Colours come only from the page's own design tokens (`tokens` reads a CSS
    file, resolves var() chains and converts oklch/hsl/rgb/hex to sRGB). Every
    raster style blends only between those palette colours - never a rainbow.
  * Same seed + same args = byte-identical pixels. All noise is built from a
    seeded integer hash; no global random state is touched. Byte identity holds
    per environment: other libwebp / Pillow / numpy versions may encode or
    round differently. The ledger's sha256 makes any such drift visible.
  * Palette roles: the last one or two colours are the accent (and its
    highlight); the rest are grounds. The FIRST ground is the page surface the
    plate sits on (`--palette`'s first colour, or the `ground` role from
    `tokens`), and it is the plate's base. It is never re-sorted. The other
    grounds are structure: on a dark page (page-ground relative luminance
    <= 0.5) each must be no darker than the page, on a light (cream) page no
    lighter. A palette that breaks this is refused, because a plate darker
    than a dark page is invisible on it. On light palettes accent strength is
    x0.45 and ground structure x0.6 so dark text over the plate keeps high
    contrast. stdout reports "tone".
  * Plates must be perceptible. `plate` measures the encoded pixels against
    the page ground (`visibility`: the share of pixels at >= 1.1:1 and
    >= 1.3:1 WCAG contrast, and the share on the wrong side of the page) and
    refuses to write a plate below --min-visible (default 8,1), exit 4.
    `ai` and `compress` report the same measure against --page, ungated.
    `plate --page` must equal the palette's first ground (exit 1
    `page_mismatch` otherwise), so a darker well listed first cannot become
    the base.
  * Plates are measured where they are shown. A slot (`--slot WxH`) is the CSS
    box the plate fills, with a fit (cover | band | strip) and a named scrim
    from SCRIM_PROFILES (the slot catalogue; references/plate-slots.md carries
    the matching CSS). The composite is a*page + (1-a)*plate; visibility counts
    only the pixels the image covers (for `strip`, only y < strip). `plate
    --slot` gates on that, `score` reports it (plus a text-contrast gate), and
    `batch` renders a whole manifest, scores every entry, and only then swaps
    files and rewrites the ledger.
  * The result is decoration only. The caller MUST mark it `aria-hidden="true"`
    or give it `alt=""`, give it explicit width/height (no layout shift), keep
    it static (no animation), and never put information in it.

Subcommands (each prints exactly ONE JSON object on stdout; logs go to stderr):

  tokens    CSS custom properties -> ordered sRGB palette (tokens.json)
  plate     render warp | grain | contour | rings to a <=max-kb WebP
  svg       tiny vector motif (grain | grid | rings): inline HTML, jsx or CSS data-URI
  ai        optional: baoyu-image-gen -> cover-crop -> same <=max-kb WebP
  compress  user-supplied image -> cover-crop -> same <=max-kb WebP
  score     plate file + page + slot/scrim/fit (+ text) -> visibility + text gate
  batch     manifest -> render + score every plate -> atomic swap + sorted ledger

Exit codes: 0 ok, 1 error (bad input, inverted palette, page mismatch, ledger
mismatch, manifest path outside the project, budget), 2 usage, 3 ai unavailable / failed (fall back to `plate`, or
`batch --fallback`), 4 gate failed: plate too faint or score/batch below the
floors (nothing written).

`batch` runs `ai` entries through a subprocess: `gen_atmosphere.py ai ...`, or
the command in $FUI_AI_CMD (shell-split; the same `ai` arguments are appended),
which lets tests and CI swap in a fake generator without a network.

Requires Python 3.9+, numpy and Pillow (with WebP). `tokens` and `svg` run
without numpy.
"""
from __future__ import annotations

import argparse
import colorsys
import datetime as _dt
import hashlib
import io
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

try:
    import numpy as np
except ImportError:  # pragma: no cover - exercised only on broken installs
    np = None  # type: ignore[assignment]

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    ImageFilter = None  # type: ignore[assignment]

TOOL = "gen_atmosphere"
DEFAULT_MAX_KB = 30
QUALITY_START, QUALITY_STEP, QUALITY_FLOOR = 82, 6, 20
BLUR_STEPS = (0, 1, 2, 3)
STYLES = ("warp", "grain", "contour", "rings")
SVG_STYLES = ("grain", "grid", "rings")
AI_SUFFIX = (", no text, no letters, no logos, no people, no UI, "
             "abstract atmosphere, large calm empty areas")
AI_RATIOS = {"16:9": 16 / 9, "3:2": 3 / 2, "1:1": 1.0, "2:3": 2 / 3}
BUN = Path.home() / ".bun" / "bin" / "bun"
IMAGE_GEN = Path.home() / ".claude" / "skills" / "baoyu-image-gen" / "scripts" / "main.ts"
_SVG_DECOR = "Decorative only: keep aria-hidden. "
SVG_NOTES = {
    "inline": _SVG_DECOR + "HTML markup for a plain .html page; in React/TSX use --format jsx "
              "(a string style attribute throws there). Keeps var() / currentColor; a "
              "data-URI (--format css) could not.",
    "jsx": _SVG_DECOR + "JSX for React/TSX: camelCase attributes and style={{ color }}. "
           "Keeps var() / currentColor.",
    "css": _SVG_DECOR + "A data-URI cannot read CSS variables, so --color is a literal; "
           "store the url() as its own token in the token file. Grain tiles at "
           "backgroundSize with backgroundRepeat.",
}


class CliError(Exception):
    """A failure the CLI reports as one JSON object plus a non-zero exit."""

    def __init__(self, message: str, code: int = 1, payload: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.payload = payload or {"error": "failed", "message": message}


def log(msg: str) -> None:
    print(f"[{TOOL}] {msg}", file=sys.stderr)


def need_raster() -> None:
    if np is None:
        raise CliError("gen_atmosphere needs numpy for raster output: run "
                       "`python3 -m pip install numpy` (tokens and svg work without it).")
    if Image is None:
        raise CliError("gen_atmosphere needs Pillow with WebP: run `python3 -m pip install Pillow`.")


# --------------------------------------------------------------------------
# CSS tokens
# --------------------------------------------------------------------------

_IGNORED_AT = ("@media", "@supports", "@container", "@keyframes", "@font-face")


def _strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _parse_blocks(css: str) -> List[Tuple[str, str, bool]]:
    """Return (prelude, own_text, inside_ignored_at_rule) for every block."""
    css = _strip_comments(css)
    blocks: List[Tuple[str, str, bool]] = []
    stack: List[List] = []  # [prelude, own_text_parts, ignored]
    buf: List[str] = []
    quote = ""
    for ch in css:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = ""
            continue
        if ch in "\"'":
            quote = ch
            buf.append(ch)
        elif ch == "{":
            text = "".join(buf)
            # The prelude is whatever follows the last statement end.
            cut = max(text.rfind(";"), text.rfind("}"))
            prelude = " ".join(text[cut + 1:].split())
            if stack:
                stack[-1][1].append(text[:cut + 1])
            parent_ignored = bool(stack) and stack[-1][2]
            ignored = parent_ignored or prelude.lower().startswith(_IGNORED_AT)
            stack.append([prelude, [], ignored])
            buf = []
        elif ch == "}":
            if not stack:
                buf = []
                continue
            prelude, parts, ignored = stack.pop()
            parts.append("".join(buf))
            blocks.append((prelude, "".join(parts), ignored))
            buf = []
        else:
            buf.append(ch)
    return blocks


def _split_top(s: str, sep: str) -> List[str]:
    out, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == sep and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return out


def _decls(text: str) -> Dict[str, str]:
    props: Dict[str, str] = {}
    for part in _split_top(text, ";"):
        if ":" not in part:
            continue
        name, value = part.split(":", 1)
        name = name.strip()
        if name.startswith("--") and name not in props:
            props[name] = value.strip()
    return props


def _norm_selector(sel: str) -> str:
    return " ".join(sel.split()).lower()


def collect_properties(css: str, selector: str = ":root") -> Tuple[Dict[str, str], Dict[str, str]]:
    """(selector_props, fallback_props). The first matching block wins; blocks
    inside @media and friends are ignored. Fallback props are every other
    top-level block in document order (first definition wins), so var() chains
    into e.g. Tailwind v4 `@theme` blocks still resolve."""
    want = _norm_selector(selector)
    own: Optional[Dict[str, str]] = None
    other: Dict[str, str] = {}
    for prelude, text, ignored in _parse_blocks(css):
        if ignored:
            continue
        parts = [_norm_selector(p) for p in _split_top(prelude, ",")]
        decls = _decls(text)
        if own is None and want in parts:
            own = decls
            continue
        for k, v in decls.items():
            other.setdefault(k, v)
    if own is None:
        raise CliError(f"selector {selector!r} not found outside @media in the CSS file")
    return own, other


def resolve_var(value: str, lookup: Dict[str, str], _seen: Tuple[str, ...] = ()) -> str:
    """Resolve var(--x[, fallback]) recursively, innermost first."""
    if len(_seen) > 32:
        raise CliError("var() chain deeper than 32 levels")
    while True:
        m = re.search(r"var\(", value)
        if not m:
            return value.strip()
        start, depth, i = m.start(), 0, m.end() - 1
        for i in range(m.end() - 1, len(value)):
            if value[i] == "(":
                depth += 1
            elif value[i] == ")":
                depth -= 1
                if depth == 0:
                    break
        else:
            raise CliError(f"unbalanced var() in {value!r}")
        inner = value[m.end():i]
        pieces = _split_top(inner, ",")
        name = pieces[0].strip()
        fallback = ",".join(pieces[1:]).strip() if len(pieces) > 1 else None
        if name in _seen:
            raise CliError(f"var() cycle through {name}")
        if name in lookup:
            rep = resolve_var(lookup[name], lookup, _seen + (name,))
        elif fallback is not None:
            rep = resolve_var(fallback, lookup, _seen + (name,))
        else:
            raise CliError(f"{name} is not defined and var() has no fallback")
        value = value[:start] + rep + value[i + 1:]


# --------------------------------------------------------------------------
# Colour conversion (everything ends as sRGB 0..1 floats)
# --------------------------------------------------------------------------

_NAMED = {"black": "#000000", "white": "#ffffff"}


def _num(tok: str, pct_scale: float = 1.0) -> float:
    tok = tok.strip().lower()
    if tok == "none":
        return 0.0
    if tok.endswith("%"):
        return float(tok[:-1]) / 100.0 * pct_scale
    return float(tok)


def _hue(tok: str) -> float:
    tok = tok.strip().lower()
    if tok == "none":
        return 0.0
    for unit, k in (("deg", 1.0), ("grad", 0.9), ("rad", 180 / math.pi), ("turn", 360.0)):
        if tok.endswith(unit):
            return float(tok[: -len(unit)]) * k
    return float(tok)


def _args(body: str) -> List[str]:
    body = body.split("/")[0]  # alpha is ignored
    return [t for t in re.split(r"[\s,]+", body.strip()) if t]


def _gamma(c: float) -> float:
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklab_to_srgb(L: float, a: float, b: float) -> Tuple[float, float, float]:
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return _gamma(r), _gamma(g), _gamma(bb)


def parse_color(value: str) -> Tuple[float, float, float]:
    v = value.strip().lower()
    v = _NAMED.get(v, v)
    if v.startswith("#"):
        h = v[1:]
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h[:3])
        elif len(h) in (6, 8):
            h = h[:6]
        else:
            raise CliError(f"bad hex colour {value!r}")
        return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]
    m = re.fullmatch(r"([a-z]+)\((.*)\)", v, flags=re.S)
    if not m:
        raise CliError(f"unsupported colour {value!r}")
    fn, a = m.group(1), _args(m.group(2))
    if len(a) < 3:
        raise CliError(f"colour needs three channels: {value!r}")
    if fn in ("rgb", "rgba"):
        return tuple(min(1.0, max(0.0, _num(t, 255.0) / 255.0)) for t in a[:3])  # type: ignore[return-value]
    if fn in ("hsl", "hsla"):
        h, s, l = _hue(a[0]) / 360.0 % 1.0, _num(a[1]), _num(a[2])
        if not a[1].endswith("%"):
            s /= 100.0
        if not a[2].endswith("%"):
            l /= 100.0
        return colorsys.hls_to_rgb(h, min(1, max(0, l)), min(1, max(0, s)))
    if fn == "oklch":
        L, C, H = _num(a[0]), _num(a[1], 0.4), _hue(a[2])
        if L > 1.0 and not a[0].endswith("%"):
            L /= 100.0
        return oklab_to_srgb(L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H)))
    if fn == "oklab":
        L = _num(a[0])
        return oklab_to_srgb(L, _num(a[1], 0.4), _num(a[2], 0.4))
    raise CliError(f"unsupported colour function {fn}() in {value!r}")


def to_hex(rgb: Sequence[float]) -> str:
    return "#" + "".join(f"{int(round(min(1, max(0, c)) * 255)):02x}" for c in rgb)


def srgb_to_oklch(rgb: Sequence[float]) -> Tuple[float, float, float]:
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    r, g, b = lin
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


def extract_palette(css_path: str, selector: str, mapping: Dict[str, str]) -> dict:
    try:
        css = Path(css_path).read_text(encoding="utf-8")
    except OSError as exc:
        raise CliError(f"cannot read CSS file {css_path}: {exc.strerror}")
    own, other = collect_properties(css, selector)
    lookup = {**other, **own}
    palette: Dict[str, str] = {}
    for key, var in mapping.items():
        if var not in lookup:
            raise CliError(f"{var} (for {key}) is not defined in {selector} or any top-level block")
        resolved = resolve_var(lookup[var], lookup, (var,))
        try:
            palette[key] = to_hex(parse_color(resolved))
        except CliError as exc:
            raise CliError(f"{var} resolved to {resolved!r}: {exc}")
    return {"palette": palette, "source": css_path, "selector": selector, "map": mapping}


# --------------------------------------------------------------------------
# Deterministic noise
# --------------------------------------------------------------------------

_OFF = 1 << 20


def _hash(ix, iy, seed: int):
    u = np.uint32
    with np.errstate(over="ignore"):
        h = (ix.astype(np.uint32) * u(0x8DA6B343)) ^ (iy.astype(np.uint32) * u(0xD8163841))
        h ^= u((seed * 0x9E3779B1 + 0x7F4A7C15) & 0xFFFFFFFF)
        h ^= h >> u(15)
        h *= u(0x2C1B3C6D)
        h ^= h >> u(12)
        h *= u(0x297A2D39)
        h ^= h >> u(15)
    return h.astype(np.float32) * np.float32(1.0 / 4294967296.0)


def value_noise(x, y, seed: int):
    x0, y0 = np.floor(x), np.floor(y)
    fx, fy = x - x0, y - y0
    ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    ix, iy = x0.astype(np.int64) + _OFF, y0.astype(np.int64) + _OFF
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    top = a + (b - a) * ux
    bot = c + (d - c) * ux
    return top + (bot - top) * uy


def fbm(x, y, seed: int, octaves: int = 4, gain: float = 0.48):
    total = np.zeros_like(x)
    amp, norm, freq = 1.0, 0.0, 1.0
    for i in range(octaves):
        ang = 0.61 * (i + 1)  # rotate each octave to hide the lattice
        ca, sa = math.cos(ang), math.sin(ang)
        xr = (x * ca - y * sa) * freq + 17.3 * i
        yr = (x * sa + y * ca) * freq - 9.1 * i
        total += np.float32(amp) * value_noise(xr, yr, seed * 7919 + i * 104729)
        norm += amp
        amp *= gain
        freq *= 2.03
    return total / np.float32(norm)


def _upscale(field, width: int, height: int):
    img = Image.fromarray(field.astype(np.float32))
    return np.asarray(img.resize((width, height), Image.BICUBIC), dtype=np.float32)


def _grid(w: int, h: int, scale: float):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return xs / np.float32(h) * np.float32(scale), ys / np.float32(h) * np.float32(scale)


def warped_field(width: int, height: int, seed: int, scale: float = 1.7,
                 warp: float = 3.2, octaves: int = 4):
    """Domain-warped FBM in 0..1, rendered at half resolution then upscaled."""
    w2, h2 = max(8, (width + 1) // 2), max(8, (height + 1) // 2)
    x, y = _grid(w2, h2, scale)
    qx = fbm(x, y, seed + 1, octaves)
    qy = fbm(x + 5.2, y + 1.3, seed + 2, octaves)
    rx = fbm(x + warp * qx + 1.7, y + warp * qy + 9.2, seed + 3, octaves)
    ry = fbm(x + warp * qx + 8.3, y + warp * qy + 2.8, seed + 4, octaves)
    f = fbm(x + warp * rx, y + warp * ry, seed + 5, octaves)
    lo, hi = np.percentile(f, 2), np.percentile(f, 98)
    # Normalise but do NOT clip: clipping flattens peaks into plateaus whose
    # edges show up as hard creases once the field is lit or contoured.
    f = (f - lo) / max(1e-6, hi - lo)
    return _upscale(f, width, height)


# --------------------------------------------------------------------------
# Plate styles. Colours are blended in gamma-encoded sRGB (perceptually even
# on dark grounds), only between palette entries.
# --------------------------------------------------------------------------

def _rgb(hexstr: str):
    return np.array(parse_color(hexstr), dtype=np.float32)


def _encode_srgb(img):
    return np.clip(np.round(np.clip(img, 0.0, 1.0) * 255.0), 0, 255).astype(np.uint8)


def _mix(base, colour, t):
    """base HxWx3, colour (3,), t HxW in 0..1 -> blend toward colour."""
    t = np.clip(t, 0.0, 1.0)[..., None]
    return base + (colour[None, None, :] - base) * t


def _smooth(e0: float, e1: float, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


LIGHT_THRESHOLD = 0.5   # mean relative luminance of the grounds
LIGHT_ACCENT = 0.45     # accent strength multiplier on light grounds
LIGHT_STRUCT = 0.6      # ground-structure multiplier on light grounds


def rel_luminance(rgb: Sequence[float]) -> float:
    """WCAG relative luminance of an sRGB 0..1 triple."""
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def _roles(palette: List[str]):
    """(grounds, accent, accent_hi, light). The last one or two colours are the
    accent; the rest are grounds. grounds[0] is the FIRST ground as given: the
    page surface and the plate's base, never re-sorted. The tone follows it:
    light when its relative luminance is above LIGHT_THRESHOLD (a cream page).
    The remaining (structure) grounds must sit on the visible side of the page
    - no darker on a dark page, no lighter on a light one - or the palette is
    refused. They are ordered away from the page, so grounds[-1] is the ground
    that contrasts most with the base (used for hairlines)."""
    cols = [_rgb(c) for c in palette]
    if len(cols) >= 4:
        grounds, accent, accent_hi = cols[:-2], cols[-2], cols[-1]
    elif len(cols) == 3:
        grounds, accent, accent_hi = cols[:2], cols[2], cols[2]
    else:
        grounds, accent, accent_hi = cols[:1], cols[1], cols[1]
    page = grounds[0]
    lp = float(rel_luminance(page))
    light = lp > LIGHT_THRESHOLD
    for g in grounds[1:]:
        lg = float(rel_luminance(g))
        if (lg > lp) if light else (lg < lp):
            side = "lighter" if light else "darker"
            msg = (f"ground '{to_hex(g)}' is {side} than the page ground '{to_hex(page)}' "
                   f"\u2014 the plate would be {side} than the page and invisible; "
                   f"drop it or put the page surface first")
            raise CliError(msg, payload={"error": "inverted_palette", "message": msg,
                                         "page": to_hex(page), "ground": to_hex(g),
                                         "tone": "light" if light else "dark"})
    rest = sorted(grounds[1:], key=lambda g: float(rel_luminance(g)), reverse=light)
    return [page] + rest, accent, accent_hi, light


def _focus_dist(width: int, height: int, focus: Tuple[float, float]):
    """Distance from the focus point in units of image height."""
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    dx = (xs - focus[0] * width) / np.float32(height)
    dy = (ys - focus[1] * height) / np.float32(height)
    return np.sqrt(dx * dx + dy * dy)


def _flat(width: int, height: int, colour):
    return np.broadcast_to(colour, (height, width, 3)).astype(np.float32).copy()


def _aa_line(dist_px, width_px: float = 0.6):
    return np.clip(1.0 - dist_px / width_px, 0.0, 1.0)


def _iso_dist(v):
    """Pixel distance to the nearest integer iso-line of field v."""
    gy, gx = np.gradient(v)
    grad = np.sqrt(gx * gx + gy * gy) + 1e-4
    return np.abs(v - np.round(v)) / grad, grad


def _light_dir(focus: Tuple[float, float]):
    """Light comes from the focus side of the frame (default: upper right)."""
    lx, ly = focus[0] - 0.5, focus[1] - 0.5
    n = math.hypot(lx, ly)
    lx, ly = (0.6, -0.7) if n < 0.05 else (lx / n, ly / n)
    v = np.array([lx, ly, 0.6], dtype=np.float32)
    return v / np.float32(np.linalg.norm(v))


def style_warp(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False,
               weight=1.0):
    """Silk: a smooth domain-warped field lit from the focus side. On a dark
    palette lit folds rise toward the lighter grounds; on a light palette the
    folds facing away fall into soft shadow toward the darker grounds."""
    f = warped_field(width, height, seed, scale=0.9, warp=1.5, octaves=3)
    gy, gx = np.gradient(f)
    relief = np.float32(1.6 * height)
    nx, ny = -gx * relief, -gy * relief
    norm = np.sqrt(nx * nx + ny * ny + 1.0)
    L = _light_dir(focus)
    shade = np.clip((nx * L[0] + ny * L[1] + L[2]) / norm, 0.0, 1.0)
    d = _focus_dist(width, height, focus)
    calm = 0.12 + 0.88 * np.exp(-(d / 0.8) ** 2)  # far field stays quiet for text
    relief_t = (1.0 - shade) if light else shade
    st = LIGHT_STRUCT if light else 1.0
    img = _flat(width, height, grounds[0])
    if len(grounds) > 1:
        img = _mix(img, grounds[1], _smooth(0.2, 0.9, relief_t) * calm * st)
    if len(grounds) > 2:
        img = _mix(img, grounds[2], _smooth(0.6, 1.0, relief_t) * calm * st)
    fc = np.clip(f, 0.0, 1.0)
    img = _mix(img, accent, np.exp(-(d / 0.55) ** 2) * (0.4 + 0.6 * fc) * (0.16 * intensity))
    # Sparse highlights: only the folds that face the light squarely, near focus.
    # (Skipped on light palettes: a dark accent glint on cream reads as a stain.)
    if not light:
        glint = _smooth(0.92, 1.0, shade) ** 2 * np.exp(-(d / 0.45) ** 2)
        img = _mix(img, accent_hi, glint * (0.6 * intensity))
    return img


def style_grain(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False,
                weight=1.0):
    """Flat ground + per-pixel monochrome grain. Lossy WebP flattens most of it
    at <=30 KB; for visible grain prefer `svg --style grain` over a page."""
    ys, xs = np.mgrid[0:height, 0:width]
    n = _hash(xs.astype(np.int64) + _OFF, ys.astype(np.int64) + _OFF, seed)
    img = _flat(width, height, grounds[0])
    lift = grounds[-1] if len(grounds) > 1 else accent
    img = _mix(img, lift, n * ((0.5 if light else 1.0) if len(grounds) > 1 else 0.05))
    d = _focus_dist(width, height, focus)
    img = _mix(img, accent, np.exp(-(d / 0.7) ** 2) * (0.05 * intensity))
    return img


def style_contour(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False,
                  weight=1.0):
    """Topographic hairlines in the ground that contrasts most with the base
    (the lightest ground on dark palettes); two accent levels near focus.
    `weight` scales the hairline width and its mix (strip-sized slots need it)."""
    st = LIGHT_STRUCT if light else 1.0
    f = warped_field(width, height, seed, scale=1.0, warp=1.3, octaves=3)
    v = f * 14.0
    dist, grad = _iso_dist(v)
    line = _aa_line(dist, 0.75 * weight)
    line *= _smooth(0.004, 0.02, grad)        # no smudges at flat peaks/saddles
    line *= 1.0 - _smooth(0.10, 0.25, grad)   # thin out where lines bunch up
    d = _focus_dist(width, height, focus)
    near = np.exp(-(d / 0.9) ** 2)
    img = _flat(width, height, grounds[0])
    if len(grounds) > 1:
        img = _mix(img, grounds[1], np.exp(-(d / 0.8) ** 2) * 0.9 * st)
    img = _mix(img, accent, np.exp(-(d / 0.5) ** 2) * (0.07 * intensity))
    hair = grounds[-1] if len(grounds) > 1 else accent
    img = _mix(img, hair, line * (0.3 + 0.7 * near) * st * weight)
    # A few accent lines: the level passing the focus and one 3 steps away.
    fy = min(height - 1, int(focus[1] * (height - 1)))
    fx = min(width - 1, int(focus[0] * (width - 1)))
    lvl = float(np.round(v[fy, fx]))
    rv = np.round(v)
    major = ((rv == lvl) | (rv == lvl + 3.0)).astype(np.float32)
    img = _mix(img, accent, line * major * np.exp(-(d / 0.6) ** 2) * (0.8 * intensity))
    return img


def style_rings(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False,
                weight=1.0):
    """Concentric orbit hairlines around the focus, one accent orbit + body.
    `weight` scales the hairline width and mix, and the body's size."""
    st = LIGHT_STRUCT if light else 1.0
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = focus[0] * width, focus[1] * height
    dx, dy = xs - cx, ys - cy
    r = np.sqrt(dx * dx + dy * dy)
    theta = np.arctan2(dy, dx)
    r0, g = 0.07 * height, 1.24
    s = np.log(np.maximum(r, 1.0) / r0) / math.log(g)
    k = np.round(s)
    rk = r0 * np.power(g, k)
    ring = _aa_line(np.abs(r - rk), 0.85 * weight) * (k >= 0)
    # Seeded gaps: each ring keeps one long bright arc, the rest fades back.
    phase = _hash((k + 64).astype(np.int64), np.zeros_like(k, dtype=np.int64), seed) * (2 * math.pi)
    arc = 0.5 + 0.5 * np.cos(theta - phase)
    ring *= 0.3 + 0.7 * _smooth(0.1, 0.8, arc)
    d = r / np.float32(height)
    fade = np.exp(-(d / 1.1) ** 2)
    img = _flat(width, height, grounds[0])
    if len(grounds) > 1:
        img = _mix(img, grounds[1], np.exp(-(d / 0.75) ** 2) * 0.9 * st)
    img = _mix(img, accent, np.exp(-(d / 0.4) ** 2) * (0.10 * intensity))
    hair = grounds[-1] if len(grounds) > 1 else accent
    img = _mix(img, hair, ring * (0.3 + 0.7 * fade) * st * weight)
    pick = int(_hash(np.array([seed]), np.array([1]), seed)[0] * 3)
    accent_ring = (k == float(2 + pick)).astype(np.float32)
    img = _mix(img, accent, ring * accent_ring * (0.7 * intensity))
    # One small body on the accent orbit.
    ang = float(_hash(np.array([seed]), np.array([2]), seed)[0]) * 2 * math.pi
    rb = r0 * g ** (2 + pick)
    bx, by = cx + rb * math.cos(ang), cy + rb * math.sin(ang)
    body = np.sqrt((xs - bx) ** 2 + (ys - by) ** 2)
    img = _mix(img, accent_hi, _aa_line(body - 0.005 * height * weight, 1.2 * weight)
               * (0.6 + 0.4 * intensity))
    return img


_STYLE_FNS = {"warp": style_warp, "grain": style_grain,
              "contour": style_contour, "rings": style_rings}


def render_plate(palette: List[str], style: str, seed: int, width: int, height: int,
                 intensity: float = 0.6, focus: Tuple[float, float] = (0.75, 0.3),
                 weight: float = 1.0):
    """Return an HxWx3 uint8 sRGB array. Pure function of its arguments.
    `weight` thickens contour/rings hairlines; warp and grain ignore it."""
    need_raster()
    if style not in _STYLE_FNS:
        raise CliError(f"unknown style {style!r}; choose from {', '.join(STYLES)}")
    grounds, accent, accent_hi, light = _roles(palette)
    strength = float(intensity) * (LIGHT_ACCENT if light else 1.0)
    img = _STYLE_FNS[style](width, height, int(seed), grounds, accent, accent_hi,
                            strength, focus, light, float(weight))
    return _encode_srgb(img)


def palette_tone(palette: List[str]) -> str:
    """'light' when the page ground's luminance exceeds LIGHT_THRESHOLD."""
    return "light" if _roles(palette)[3] else "dark"


# --------------------------------------------------------------------------
# Visibility: is the plate perceptible on the page it sits on?
# --------------------------------------------------------------------------

VIS_RATIOS = (1.1, 1.3)   # the two perceptibility thresholds (WCAG contrast)
VIS_WRONG_SIDE = 1.02     # ignore 8-bit / codec jitter when counting wrong-side pixels
DEFAULT_MIN_VISIBLE = (8.0, 1.0)


def _lum_pixels(pixels):
    a = np.asarray(pixels)[..., :3].astype(np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def visibility(pixels, page_rgb, light: Optional[bool] = None) -> dict:
    """How much of an image a reader can tell apart from the page under it.

    pixels: HxWx3 (or x4) uint8 sRGB. page_rgb: hex string or sRGB 0..1 triple.
    Returns percentages (0..100, 2 dp) of pixels whose WCAG contrast against
    the page is >= 1.1:1 (`ge_1_1`) and >= 1.3:1 (`ge_1_3`), plus the share on
    the wrong side of the page: `darker_than_page` on a dark page, or
    `lighter_than_page` on a light one (light defaults to page luminance > 0.5).
    Wrong-side pixels count only beyond VIS_WRONG_SIDE, so codec jitter around
    the base does not."""
    need_raster()
    page = parse_color(page_rgb) if isinstance(page_rgb, str) else tuple(page_rgb)
    lp = float(rel_luminance(page))
    if light is None:
        light = lp > LIGHT_THRESHOLD
    lum = _lum_pixels(pixels)
    ratio = (np.maximum(lum, lp) + 0.05) / (np.minimum(lum, lp) + 0.05)
    n = max(1, lum.size)

    def pct(mask) -> float:
        return round(100.0 * float(np.count_nonzero(mask)) / n, 2)

    wrong = ((lum > lp) if light else (lum < lp)) & (ratio >= VIS_WRONG_SIDE)
    return {"ge_1_1": pct(ratio >= VIS_RATIOS[0]), "ge_1_3": pct(ratio >= VIS_RATIOS[1]),
            ("lighter_than_page" if light else "darker_than_page"): pct(wrong)}


def _decode(data: bytes):
    with Image.open(io.BytesIO(data)) as im:
        return np.asarray(im.convert("RGB"))


def passes_visibility(vis: dict, min_visible: Tuple[float, float]) -> bool:
    return vis["ge_1_1"] >= min_visible[0] and vis["ge_1_3"] >= min_visible[1]


def gate_visibility(vis: dict, min_visible: Tuple[float, float], where: str = "",
                    extra: Optional[dict] = None) -> None:
    """Raise exit 4 when the plate is too faint to be worth shipping. `where`
    names the slot the numbers were measured in; `extra` joins the payload."""
    a, b = min_visible
    if passes_visibility(vis, min_visible):
        return
    msg = (f"plate too faint{where}: {vis['ge_1_1']}% of pixels reach 1.1:1 against the page "
           f"(need {a:g}%) and {vis['ge_1_3']}% reach 1.3:1 (need {b:g}%); nothing written. "
           f"Base it on the page ground, raise --intensity, use --style warp, try `ai`, "
           f"or pass --allow-faint")
    raise CliError(msg, code=4, payload={"error": "too_faint", "message": msg,
                                         "visibility": vis, "minVisible": [a, b],
                                         **(extra or {})})


# --------------------------------------------------------------------------
# Slots: the CSS box a plate is shown in. Fit (scale + crop), a named scrim,
# and the composite out = a*page + (1-a)*plate. ONE implementation, used by
# `plate --slot`, `score` and `batch`.
# --------------------------------------------------------------------------

# The slot catalogue. references/plate-slots.md carries the matching CSS and
# MUST use these exact numbers. Each alpha is "page colour at N%"
# (color-mix(in oklab, var(--ground) N%, transparent)); a `transparent` stop
# is 0. Positions are fractions of the gradient line, or CSS px when units ==
# "px" ("strip" = the strip height, "strip-16" = 16 px above it, "100%" = the
# slot's full length). `text` is the region the text gate reads: ("x",
# ((x0, x1), ...)) in fractions of the slot width, ("y-strip",) = y >= strip,
# ("all",) = the whole slot.
SCRIM_PROFILES: Dict[str, dict] = {
    "header-band": {"dir": "x", "units": "frac",
                    "stops": ((0, .94), (.40, .86), (.58, 0), (.78, 0), (.90, .85), (1, .88)),
                    "fit": "cover", "position": (1.0, 0.5),
                    "text": ("x", ((0.0, 0.50), (0.88, 1.0)))},
    "state-band": {"dir": "x", "units": "frac",
                   "stops": ((0, .95), (.50, .90), (.66, 0), (.80, 0), (.92, .88), (1, .90)),
                   "fit": "cover", "position": (1.0, 0.5),
                   "text": ("x", ((0.0, 0.60),))},
    "center-band": {"dir": "x", "units": "frac",
                    "stops": ((0, 0), (.08, 0), (.22, .90), (.50, .94), (.78, .90),
                              (.92, 0), (1, 0)),
                    "fit": "band", "position": (0.5, 0.5),
                    "text": ("x", ((0.22, 0.78),))},
    "phone-strip": {"dir": "y", "units": "px",
                    "stops": ((0, 0), ("strip-16", 0), ("strip", .92), ("100%", .92)),
                    "fit": "strip", "position": (1.0, 0.0),
                    "text": ("y-strip",)},
    "full": {"dir": "x", "units": "frac", "stops": ((0, .92), (1, .84)),
             "fit": "cover", "position": (0.5, 0.5), "text": ("all",)},
    "none": {"dir": "x", "units": "frac", "stops": ((0, 0), (1, 0)),
             "fit": "cover", "position": (0.5, 0.5), "text": ("all",)},
}
SCRIMS = tuple(SCRIM_PROFILES)
FITS = ("cover", "band", "strip")
# Where the image sits when --fit overrides the profile's own fit:
# cover = centred, band = 100% wide and centred vertically, strip = right top.
FIT_POSITION = {"cover": (0.5, 0.5), "band": (0.5, 0.5), "strip": (1.0, 0.0)}
DEFAULT_STRIP = 64       # px: the phone strip's height
STRIP_FEATHER = 16       # px: the phone strip's scrim ramps in over this
DEFAULT_MIN_TEXT = 4.5   # body text; 3 for large text (>= 24px, or >= 18.66px bold)


def _scrim_from_json(spec) -> dict:
    """A custom scrim: {"dir":"x|y","stops":[[pos,alpha],...],"units":"frac|px"}.
    Its text region is the whole slot; its fit defaults to cover."""
    if isinstance(spec, str):
        try:
            spec = json.loads(spec)
        except ValueError as exc:
            raise CliError(f"--scrim-json is not valid JSON: {exc}")
    shape = '{"dir":"x|y","stops":[[pos,alpha],...],"units":"frac|px"}'
    if not isinstance(spec, dict) or spec.get("dir") not in ("x", "y"):
        raise CliError(f"--scrim-json must look like {shape}")
    units = spec.get("units", "frac")
    stops = spec.get("stops")
    if units not in ("frac", "px") or not isinstance(stops, list) or not stops:
        raise CliError(f"--scrim-json must look like {shape}")
    out = []
    for st in stops:
        ok = isinstance(st, (list, tuple)) and len(st) == 2
        pos, alpha = (st[0], st[1]) if ok else (None, None)
        pos_ok = pos == "100%" or (isinstance(pos, (int, float)) and not isinstance(pos, bool)
                                   and math.isfinite(pos))
        alpha_ok = (isinstance(alpha, (int, float)) and not isinstance(alpha, bool)
                    and 0.0 <= alpha <= 1.0)
        if not (ok and pos_ok and alpha_ok):
            raise CliError(f"--scrim-json stop {st!r} must be [position, alpha 0..1]")
        out.append((pos, float(alpha)))
    return {"dir": spec["dir"], "units": units, "stops": tuple(out), "fit": "cover",
            "position": FIT_POSITION["cover"], "text": ("all",)}


def resolve_slot(size: str, scrim: Optional[str] = None, scrim_json=None,
                 fit: Optional[str] = None, strip: int = DEFAULT_STRIP) -> dict:
    """The slot a plate is shown in: size, scrim profile, fit and placement."""
    w, h = parse_size(size, "--slot")
    if scrim_json is not None:
        if scrim:
            raise CliError("pass --scrim or --scrim-json, not both", code=2,
                           payload={"error": "usage",
                                    "message": "pass --scrim or --scrim-json, not both"})
        name, prof = "custom", _scrim_from_json(scrim_json)
    else:
        name = scrim or "none"
        if name not in SCRIM_PROFILES:
            raise CliError(f"unknown scrim {name!r}; choose from {', '.join(SCRIMS)}")
        prof = SCRIM_PROFILES[name]
    fit = fit or prof["fit"]
    if fit not in FITS:
        raise CliError(f"unknown fit {fit!r}; choose from {', '.join(FITS)}")
    if isinstance(strip, bool) or not isinstance(strip, int) or not 1 <= strip <= 8192:
        raise CliError(f"--strip must be a whole number of px within 1..8192, got {strip!r}")
    position = prof["position"] if fit == prof["fit"] else FIT_POSITION[fit]
    return {"w": w, "h": h, "scrim": name, "profile": prof, "fit": fit,
            "position": position, "strip": strip}


def slot_fields(slot: dict) -> dict:
    """The slot as it is reported in JSON output and ledger rows."""
    out = {"slot": f"{slot['w']}x{slot['h']}", "scrim": slot["scrim"], "fit": slot["fit"]}
    if slot["fit"] == "strip" or slot["scrim"] == "phone-strip":
        out["strip"] = slot["strip"]
    return out


def _stop_px(pos, units: str, length: int, strip: int) -> float:
    if pos == "100%":
        return float(length)
    if pos == "strip":
        return float(strip)
    if pos == "strip-16":
        return float(strip - STRIP_FEATHER)
    return float(pos) * length if units == "frac" else float(pos)


def scrim_alpha(slot: dict):
    """HxW scrim alpha: a linear gradient along x or y, like CSS (positions
    clamped to be non-decreasing, ends held flat, sampled at pixel centres)."""
    prof, w, h = slot["profile"], slot["w"], slot["h"]
    length = w if prof["dir"] == "x" else h
    xp = np.maximum.accumulate(np.array(
        [_stop_px(p, prof["units"], length, slot["strip"]) for p, _ in prof["stops"]]))
    fp = np.array([a for _, a in prof["stops"]], dtype=np.float64)
    line = np.interp(np.arange(length, dtype=np.float64) + 0.5, xp, fp)
    if prof["dir"] == "x":
        return np.broadcast_to(line[None, :], (h, w))
    return np.broadcast_to(line[:, None], (h, w))


def _placement(iw: int, ih: int, slot: dict) -> Tuple[int, int, int, int]:
    """(scaled_w, scaled_h, offset_x, offset_y) of the image in the slot.
    cover: CSS `cover` at the profile's position; band: `100% auto`, centred
    vertically; strip: width max(100%, strip x aspect), auto height, right top."""
    w, h, fit = slot["w"], slot["h"], slot["fit"]
    if fit == "cover":
        s = max(w / iw, h / ih)
        sw, sh = max(w, int(round(iw * s))), max(h, int(round(ih * s)))
        px, py = slot["position"]
        return sw, sh, int(round((w - sw) * px)), int(round((h - sh) * py))
    if fit == "band":
        sh = max(1, int(round(ih * w / iw)))
        return w, sh, 0, int(round((h - sh) / 2))
    sw = max(w, int(round(slot["strip"] * iw / ih)))
    sh = max(1, int(round(ih * sw / iw)))
    return sw, sh, w - sw, 0


def place_in_slot(pixels, slot: dict, page_rgb):
    """(HxWx3 float 0..255 canvas, HxW covered mask): the image scaled and
    cropped into the slot; pixels it does not cover show the page."""
    src = np.asarray(pixels)[..., :3]
    ih, iw = src.shape[:2]
    sw, sh, ox, oy = _placement(iw, ih, slot)
    if (sw, sh) != (iw, ih):
        src = np.asarray(Image.fromarray(src.astype(np.uint8)).resize((sw, sh), Image.LANCZOS))
    w, h = slot["w"], slot["h"]
    canvas = np.empty((h, w, 3), dtype=np.float64)
    canvas[:] = page_rgb
    covered = np.zeros((h, w), dtype=bool)
    x0, y0, x1, y1 = max(0, ox), max(0, oy), min(w, ox + sw), min(h, oy + sh)
    if x1 > x0 and y1 > y0:
        canvas[y0:y1, x0:x1] = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        covered[y0:y1, x0:x1] = True
    return canvas, covered


def composite_slot(pixels, page: str, slot: dict):
    """(HxWx3 uint8 composite, HxW mask of the pixels visibility counts).
    out = a*page + (1-a)*plate in gamma-encoded sRGB, as browsers blend."""
    page_rgb = np.array(parse_color(page), dtype=np.float64) * 255.0
    canvas, covered = place_in_slot(pixels, slot, page_rgb)
    a = scrim_alpha(slot)[..., None]
    comp = np.clip(np.round(a * page_rgb + (1.0 - a) * canvas), 0, 255).astype(np.uint8)
    if slot["fit"] == "strip":
        covered[slot["strip"]:, :] = False   # a strip counts only its own rows
    return comp, covered


def text_region_mask(slot: dict):
    w, h, region = slot["w"], slot["h"], slot["profile"]["text"]
    if region[0] == "x":
        cx = (np.arange(w) + 0.5) / w
        col = np.zeros(w, dtype=bool)
        for x0, x1 in region[1]:
            col |= (cx >= x0) & (cx <= x1)
        return np.broadcast_to(col[None, :], (h, w))
    if region[0] == "y-strip":
        return np.broadcast_to((np.arange(h) >= slot["strip"])[:, None], (h, w))
    return np.ones((h, w), dtype=bool)


def text_check(comp, mask, text: str, page: str, need: float) -> dict:
    """Text over the composite: light text on a dark page reads against the
    p90 background luminance under its region (the brightest 10% is the
    worst case); dark text on a light page against the p10. `ratio` is the
    result; `p90_ratio` is the same number, kept for compatibility."""
    lt = float(rel_luminance(parse_color(text)))
    light_text = lt >= float(rel_luminance(parse_color(page)))
    lum = _lum_pixels(comp[mask])
    res = {"color": text, "percentile": 90 if light_text else 10, "need": need}
    if lum.size == 0:
        return {**res, "ratio": None, "p90_ratio": None, "pass": True}
    bg = float(np.percentile(lum, res["percentile"]))
    ratio = (max(lt, bg) + 0.05) / (min(lt, bg) + 0.05)
    return {**res, "ratio": round(ratio, 2), "p90_ratio": round(ratio, 2),
            "pass": ratio >= need}


def score_pixels(pixels, page: str, slot: dict, text: Optional[str] = None,
                 min_visible: Tuple[float, float] = DEFAULT_MIN_VISIBLE,
                 min_text: float = DEFAULT_MIN_TEXT) -> dict:
    """Score a plate as the slot shows it: visibility over the pixels the
    image covers (after the scrim) and, with `text`, the text gate."""
    comp, vmask = composite_slot(pixels, page, slot)
    vis = visibility(comp[vmask], page)
    a, b = min_visible
    reasons = []
    if vis["ge_1_1"] < a:
        reasons.append(f"ge_1_1 {vis['ge_1_1']}% < {a:g}%")
    if vis["ge_1_3"] < b:
        reasons.append(f"ge_1_3 {vis['ge_1_3']}% < {b:g}%")
    tres = None
    if text:
        tres = text_check(comp, text_region_mask(slot), text, page, min_text)
        if not tres["pass"]:
            reasons.append(f"text {tres['ratio']}:1 < {min_text:g}:1")
    return {**slot_fields(slot), "visibility": vis, "text": tres,
            "pass": not reasons, "reasons": reasons}


# --------------------------------------------------------------------------
# WebP size search, cover-crop, writing
# --------------------------------------------------------------------------

def _qualities() -> List[int]:
    qs = list(range(QUALITY_START, QUALITY_FLOOR, -QUALITY_STEP))
    return qs + [QUALITY_FLOOR] if qs[-1] != QUALITY_FLOOR else qs


def fit_webp(img, max_bytes: int) -> Tuple[bytes, int, int]:
    """Smallest-effort WebP under max_bytes: (data, quality, blur)."""
    img = img.convert("RGB")
    for blur in BLUR_STEPS:
        src = img if blur == 0 else img.filter(ImageFilter.GaussianBlur(blur))
        for q in _qualities():
            buf = io.BytesIO()
            src.save(buf, format="WEBP", quality=q, method=6)
            data = buf.getvalue()
            if len(data) <= max_bytes:
                return data, q, blur
    raise CliError(f"could not fit under {max_bytes} bytes even at quality "
                   f"{QUALITY_FLOOR} with a {BLUR_STEPS[-1]}px blur; nothing written",
                   payload={"error": "too_large", "maxBytes": max_bytes})


def cover_crop(img, width: int, height: int, focus: Tuple[float, float] = (0.5, 0.5)):
    sw, sh = img.size
    target = width / height
    if sw / sh > target:
        cw, ch = sh * target, float(sh)
    else:
        cw, ch = float(sw), sw / target
    left = min(max(0.0, focus[0] * sw - cw / 2), sw - cw)
    top = min(max(0.0, focus[1] * sh - ch / 2), sh - ch)
    box = (left, top, left + cw, top + ch)
    return img.convert("RGB").resize((width, height), Image.LANCZOS, box=box)


def _umask() -> int:
    mask = os.umask(0)
    os.umask(mask)
    return mask


def write_atomic(path: Path, data: bytes) -> None:
    """Write via a temp file + rename, so a failure never leaves a partial
    file. mkstemp creates 0600; the result gets normal 0666 & ~umask."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".gen_atmosphere.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.chmod(tmp, 0o666 & ~_umask())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def append_ledger(path: Optional[str], record: dict) -> None:
    if not path:
        return
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, separators=(",", ":")) + "\n")


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def _finish(img, out: str, max_kb: float, page: Optional[str] = None,
            min_visible: Optional[Tuple[float, float]] = None) -> dict:
    """Encode under budget; with `page`, measure visibility on the DECODED
    WebP (the pixels that ship) and, with `min_visible`, refuse before
    anything is written."""
    data, quality, blur = fit_webp(img, int(max_kb * 1024))
    vis = visibility(_decode(data), page) if page else None
    if vis is not None and min_visible is not None:
        gate_visibility(vis, min_visible)
    write_atomic(Path(out), data)
    res = {"out": out, "bytes": len(data), "width": img.size[0], "height": img.size[1],
           "quality": quality, "blur": blur, "sha256": hashlib.sha256(data).hexdigest()}
    if vis is not None:
        res.update(page=page, visibility=vis)
    return res


# --------------------------------------------------------------------------
# Argument helpers
# --------------------------------------------------------------------------

def check_max_kb(v: float) -> float:
    """argparse's float() accepts nan/inf; reject them (and <= 0) as a CLI error."""
    if not math.isfinite(v) or v <= 0:
        raise CliError(f"--max-kb must be a positive finite number, got {v!r}")
    return v


def parse_size(s: str, flag: str = "--size") -> Tuple[int, int]:
    m = re.fullmatch(r"\s*(\d+)\s*[xX]\s*(\d+)\s*", s or "")
    if not m:
        raise CliError(f"{flag} must look like 1600x900, got {s!r}")
    w, h = int(m.group(1)), int(m.group(2))
    if not (16 <= w <= 8192 and 16 <= h <= 8192):
        raise CliError(f"{flag} sides must be between 16 and 8192 px")
    return w, h


WEIGHT_RANGE = (0.5, 4.0)
MAX_SEEDS = 64


def check_weight(v: float) -> float:
    lo, hi = WEIGHT_RANGE
    if not (math.isfinite(v) and lo <= v <= hi):
        raise CliError(f"--weight must be within {lo:g}..{hi:g}, got {v!r}")
    return float(v)


INTENSITY_DEFAULT = 0.6        # a plate measured on its own
INTENSITY_DEFAULT_SLOT = 1.0   # a plate in a strip or state slot, under a scrim


def default_intensity(v: Optional[float], has_slot: bool) -> float:
    """--intensity, or its default: 1.0 for a plate shown in a slot, else 0.6."""
    if v is None:
        return INTENSITY_DEFAULT_SLOT if has_slot else INTENSITY_DEFAULT
    if isinstance(v, bool) or not (math.isfinite(v) and 0.0 <= v <= 1.0):
        raise CliError("--intensity must be within 0..1")
    return float(v)


def check_min_text(v: float) -> float:
    if not (math.isfinite(v) and 1.0 <= v <= 21.0):
        raise CliError(f"--min-text must be a contrast ratio within 1..21, got {v!r}")
    return float(v)


def parse_seeds(s: str) -> List[int]:
    """'A-B' (inclusive) or 'a,b,c' -> distinct seeds in order, at most MAX_SEEDS."""
    s = (s or "").strip()
    m = re.fullmatch(r"(\d+)\s*-\s*(\d+)", s)
    try:
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if hi < lo:
                raise ValueError
            seeds = list(range(lo, hi + 1))
        else:
            seeds = [int(t) for t in s.split(",") if t.strip()]
    except ValueError:
        raise CliError(f"--seeds must be A-B or a,b,c (whole numbers), got {s!r}")
    seeds = list(dict.fromkeys(seeds))
    if not 1 <= len(seeds) <= MAX_SEEDS:
        raise CliError(f"--seeds must name 1..{MAX_SEEDS} seeds, got {len(seeds)}")
    return seeds


def _usage(message: str) -> CliError:
    return CliError(message, code=2, payload={"error": "usage", "message": message})


def plate_seeds(seed: Optional[int], seeds: Optional[str], pick: Optional[str] = None) -> List[int]:
    """--seed N, or --seeds A-B|a,b,c [--pick best]: exactly one of them."""
    if seed is not None and seeds:
        raise _usage("pass --seed or --seeds, not both")
    if seed is None and not seeds:
        raise _usage("pass --seed N or --seeds A-B|a,b,c")
    if pick and not seeds:
        raise _usage("--pick needs --seeds")
    if pick not in (None, "best"):
        raise _usage(f"--pick must be best, got {pick!r}")
    return [int(seed)] if seed is not None else parse_seeds(seeds)


def parse_focus(s: str) -> Tuple[float, float]:
    try:
        x, y = (float(t) for t in s.split(","))
    except ValueError:
        raise CliError(f"--focus must be x,y in 0..1, got {s!r}")
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise CliError("--focus values must be within 0..1")
    return x, y


def parse_min_visible(s: str) -> Tuple[float, float]:
    try:
        a, b = (float(t) for t in s.split(","))
    except ValueError:
        raise CliError(f"--min-visible must be A,B percentages (e.g. 8,1), got {s!r}")
    if not all(math.isfinite(v) and 0 <= v <= 100 for v in (a, b)):
        raise CliError("--min-visible values must be percentages within 0..100")
    return a, b


def parse_page(s: Optional[str]) -> Optional[str]:
    return to_hex(parse_color(s)) if s else None


def parse_map(s: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for item in [t for t in s.split(",") if t.strip()]:
        if "=" not in item:
            raise CliError(f"--map entries are key=--css-var, got {item!r}")
        k, v = (t.strip() for t in item.split("=", 1))
        if not k or not v.startswith("--"):
            raise CliError(f"--map entry {item!r} needs a key and a --custom-property")
        out[k] = v
    if not out:
        raise CliError("--map is empty")
    return out


def _ordered_palette(pal: Dict[str, str]) -> List[str]:
    """tokens.json palette dict -> colours; the `ground` role (the page
    surface) leads whatever the map order."""
    keys = list(pal)
    if "ground" in pal:
        keys = ["ground"] + [k for k in keys if k != "ground"]
    return [pal[k] for k in keys]


def _check_palette(cols: List[str]) -> List[str]:
    if not 2 <= len(cols) <= 6:
        raise CliError(f"palette needs 2-6 colours (page ground first, accent last), "
                       f"got {len(cols)}")
    return [to_hex(parse_color(c)) for c in cols]


def _read_tokens(tokens: str) -> dict:
    try:
        data = json.loads(Path(tokens).read_text(encoding="utf-8"))
        if not isinstance(data["palette"], dict):
            raise ValueError("`palette` is not an object")
        return data
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise CliError(f"cannot read a palette from {tokens}: {exc}")


def load_palette(tokens: Optional[str], palette: Optional[str]) -> List[str]:
    if tokens:
        cols = _ordered_palette(_read_tokens(tokens)["palette"])
    else:
        cols = [c.strip() for c in (palette or "").split(",") if c.strip()]
    return _check_palette(cols)


def page_mismatch(page: str, base: str) -> CliError:
    msg = (f"page {page} is not the palette's first ground {base}: the plate's base must be "
           f"the page it sits on. List the page surface first (a darker well listed first "
           f"makes the plate darker than the page and invisible)")
    return CliError(msg, payload={"error": "page_mismatch", "message": msg,
                                  "page": page, "base": base})


def check_page(palette: List[str], page: Optional[str]) -> str:
    """The page colour: `page` when given (it must equal the first ground,
    exact hex), else the first ground itself."""
    if page and page != palette[0]:
        raise page_mismatch(page, palette[0])
    return palette[0]


def tokens_page(tokens: Optional[str]) -> Optional[str]:
    """tokens.json's `page` (written by `tokens --page-role`), if any."""
    if not tokens:
        return None
    page = _read_tokens(tokens).get("page")
    return parse_page(page) if isinstance(page, str) and page.strip() else None


# --------------------------------------------------------------------------
# Subcommands
# --------------------------------------------------------------------------

def tokens_result(css: str, selector: str, mapping: Dict[str, str],
                  page_role: Optional[str] = None) -> dict:
    """extract_palette plus `page`: the colour of the page-role key (default
    `ground`). A role named explicitly must exist in the map; the default
    role may be absent, and then no `page` is written."""
    result = extract_palette(css, selector, mapping)
    role = page_role or "ground"
    if role in result["palette"]:
        result["page"] = result["palette"][role]
    elif page_role:
        raise CliError(f"--page-role {page_role!r} is not a key of --map "
                       f"({', '.join(result['palette'])})")
    return result


def cmd_tokens(a, argv) -> dict:
    result = tokens_result(a.css, a.selector, parse_map(a.map), a.page_role)
    if a.out:
        write_atomic(Path(a.out), (json.dumps(result, indent=2) + "\n").encode("utf-8"))
    return result


# ---- plate: render one seed or pick the best of several -------------------

def render_candidate(palette: List[str], style: str, seed: int, size: Tuple[int, int],
                     intensity: float, focus: Tuple[float, float], weight: float,
                     max_kb: float, page: str, slot: Optional[dict]) -> dict:
    """Render, encode under budget, and measure the DECODED pixels (what
    ships): whole-file visibility and, with a slot, what the slot shows."""
    pixels = render_plate(palette, style, seed, size[0], size[1], intensity, focus, weight)
    data, quality, blur = fit_webp(Image.fromarray(pixels), int(max_kb * 1024))
    decoded = _decode(data)
    cand = {"seed": seed, "data": data, "quality": quality, "blur": blur,
            "visibility": visibility(decoded, page)}
    if slot is not None:
        cand["slotVisibility"] = score_pixels(decoded, page, slot)["visibility"]
    return cand


def gate_vis(cand: dict) -> dict:
    """The measure a candidate is gated and ranked on: the slot's, else the file's."""
    return cand.get("slotVisibility", cand["visibility"])


def candidate_summary(cands: List[dict]) -> List[dict]:
    return [{"seed": c["seed"], "ge_1_1": gate_vis(c)["ge_1_1"],
             "ge_1_3": gate_vis(c)["ge_1_3"]} for c in cands]


def pick_best(cands: List[dict], min_visible: Optional[Tuple[float, float]],
              where: str = "", strict: bool = True) -> dict:
    """The best candidate by (ge_1_3, then ge_1_1) among those passing the
    gate (all of them when min_visible is None); the first seed wins a tie.
    strict: none passing raises exit 4; otherwise the best overall returns."""
    passing = [c for c in cands
               if min_visible is None or passes_visibility(gate_vis(c), min_visible)]
    if not passing and strict:
        if len(cands) == 1:
            extra = ({"slotVisibility": cands[0]["slotVisibility"]}
                     if "slotVisibility" in cands[0] else None)
            if extra:
                extra["visibility"] = cands[0]["visibility"]
            gate_visibility(gate_vis(cands[0]), min_visible, where, extra)
        a, b = min_visible
        msg = (f"no seed passes{where}: none of {len(cands)} reaches {a:g}% at 1.1:1 and "
               f"{b:g}% at 1.3:1; nothing written. Try more seeds, raise --intensity or "
               f"--weight, or use --style warp")
        raise CliError(msg, code=4, payload={"error": "too_faint", "message": msg,
                                             "candidates": candidate_summary(cands),
                                             "minVisible": [a, b]})
    pool = passing or cands
    return max(pool, key=lambda c: (gate_vis(c)["ge_1_3"], gate_vis(c)["ge_1_1"]))


def cmd_plate(a, argv) -> dict:
    need_raster()
    palette = load_palette(a.tokens, a.palette)
    page = check_page(palette, parse_page(a.page) or tokens_page(a.tokens))
    w, h = parse_size(a.size)
    focus = parse_focus(a.focus)
    intensity = default_intensity(a.intensity, bool(a.slot))
    weight = check_weight(a.weight)
    check_max_kb(a.max_kb)
    min_visible = parse_min_visible(a.min_visible)
    seeds = plate_seeds(a.seed, a.seeds, a.pick)
    if not a.slot and (a.scrim or a.fit):
        raise _usage("--scrim and --fit need --slot WxH")
    slot = resolve_slot(a.slot, a.scrim, None, a.fit, a.strip) if a.slot else None
    where = f" in slot {a.slot} ({slot['scrim']}, {slot['fit']})" if slot else ""
    cands = [render_candidate(palette, a.style, sd, (w, h), intensity, focus, weight,
                              a.max_kb, page, slot) for sd in seeds]
    best = pick_best(cands, None if a.allow_faint else min_visible, where)
    write_atomic(Path(a.out), best["data"])
    data = best["data"]
    res = {"out": a.out, "bytes": len(data), "width": w, "height": h,
           "quality": best["quality"], "blur": best["blur"],
           "sha256": hashlib.sha256(data).hexdigest(), "page": page,
           "visibility": best["visibility"]}
    extra: dict = {}
    if slot is not None:
        extra.update(slot_fields(slot), slotVisibility=best["slotVisibility"])
    if a.seeds:
        extra["candidates"] = candidate_summary(cands)
    out = {**res, "seed": best["seed"], "style": a.style, "palette": palette,
           "tone": palette_tone(palette), "intensity": intensity, "weight": weight, **extra}
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "plate", "style": a.style,
                             "seed": best["seed"], "size": f"{w}x{h}", "palette": palette,
                             "intensity": intensity, "focus": list(focus), "weight": weight,
                             "out": a.out, "bytes": res["bytes"], "quality": res["quality"],
                             "blur": res["blur"], "sha256": res["sha256"],
                             "page": page, "visibility": res["visibility"], **extra,
                             "allowFaint": bool(a.allow_faint), "argv": argv})
    v = gate_vis(best)
    log(f"{a.style} seed={best['seed']} -> {a.out} {res['bytes']} B q={res['quality']} "
        f"blur={res['blur']} visible{where} {v['ge_1_1']}%>=1.1 {v['ge_1_3']}%>=1.3")
    return out


JSX_NAMES = {"stroke-width": "strokeWidth", "stroke-dasharray": "strokeDasharray",
             "vector-effect": "vectorEffect", "flood-color": "floodColor"}
GRAIN_TILE = 256  # px: the grain is a fixed-size tile, never stretched to the box


def _attrs(attrs: Sequence[Tuple[str, Optional[str]]], jsx: bool) -> str:
    """` name="value"` pairs. None values are omitted; with jsx=True the
    kebab-case presentation attributes become React's camelCase names."""
    return "".join(f' {JSX_NAMES.get(n, n) if jsx else n}="{v}"'
                   for n, v in attrs if v is not None)


def _el(tag: str, attrs: Sequence[Tuple[str, Optional[str]]], jsx: bool,
        children: Optional[str] = None) -> str:
    head = f"<{tag}{_attrs(attrs, jsx)}"
    return head + "/>" if children is None else f"{head}>{children}</{tag}>"


def _svg_root(color: str, fmt: str, size_attrs: Sequence[Tuple[str, Optional[str]]],
              children: str) -> str:
    """The root <svg>: decorative (aria-hidden, focusable as a string), and the
    colour as `style` - a string for HTML and the data-URI, an object for JSX
    (React throws on a string style)."""
    jsx = fmt == "jsx"
    attrs = [("xmlns", "http://www.w3.org/2000/svg"), ("aria-hidden", "true"),
             ("focusable", "false")] + list(size_attrs)
    head = "<svg" + _attrs(attrs, jsx)
    if color and not jsx:
        head += f' style="color:{color}"'
    elif color:
        head += " style={{ color: " + json.dumps(color) + " }}"
    return f"{head}>{children}</svg>"


def build_svg(style: str, color: str, opacity: float, seed: int, cell: int,
              fmt: str = "inline") -> str:
    """Markup for one motif. fmt: inline (HTML), jsx (React/TSX) or css (the
    markup a data-URI wraps). opacity == 1 emits no opacity attribute at all."""
    jsx = fmt == "jsx"
    color = color.replace('"', "'")
    op = None if opacity >= 1.0 else f"{opacity:g}"
    if style == "grain":
        # A fixed 256 px tile. No viewBox, so user units are CSS px and the
        # noise frequency never stretches with the box; the inline/jsx forms
        # repeat the tile with a userSpaceOnUse pattern, the css form is one
        # 256x256 image tiled with background-size/background-repeat.
        fid, t = f"fa-grain-{seed}", str(GRAIN_TILE)
        filt = _el("filter", [("id", fid), ("x", "0"), ("y", "0"), ("width", "100%"),
                              ("height", "100%")], jsx,
                   _el("feTurbulence", [("type", "fractalNoise"), ("baseFrequency", "0.85"),
                                        ("numOctaves", "3"), ("seed", str(seed)),
                                        ("stitchTiles", "stitch"), ("result", "n")], jsx) +
                   _el("feColorMatrix", [("in", "n"), ("type", "luminanceToAlpha"),
                                         ("result", "a")], jsx) +
                   _el("feFlood", [("flood-color", "currentColor")], jsx) +
                   _el("feComposite", [("in2", "a"), ("operator", "in")], jsx))
        tile = _el("rect", [("width", t), ("height", t), ("filter", f"url(#{fid})")], jsx)
        if fmt == "css":
            body = filt + _el("g", [("opacity", op)], jsx, tile) if op else filt + tile
            return _svg_root(color, fmt, [("width", t), ("height", t)], body)
        pid = f"fa-grain-tile-{seed}"
        pattern = _el("pattern", [("id", pid), ("width", t), ("height", t),
                                  ("patternUnits", "userSpaceOnUse")], jsx, tile)
        body = (_el("defs", [], jsx, filt + pattern) +
                _el("rect", [("width", "100%"), ("height", "100%"), ("fill", f"url(#{pid})"),
                             ("opacity", op)], jsx))
        return _svg_root(color, fmt, [("width", "100%"), ("height", "100%")], body)
    if style == "grid":
        pid = f"fa-grid-{cell}-{seed}"
        body = (_el("defs", [], jsx, _el(
                    "pattern", [("id", pid), ("width", str(cell)), ("height", str(cell)),
                                ("patternUnits", "userSpaceOnUse")], jsx,
                    _el("path", [("d", f"M{cell} 0H0V{cell}"), ("fill", "none"),
                                 ("stroke", "currentColor"), ("stroke-width", "1"),
                                 ("vector-effect", "non-scaling-stroke")], jsx))) +
                _el("rect", [("width", "100%"), ("height", "100%"), ("fill", f"url(#{pid})"),
                             ("opacity", op)], jsx))
        return _svg_root(color, fmt, [("width", "100%"), ("height", "100%"),
                                      ("viewBox", f"0 0 {cell * 16} {cell * 16}"),
                                      ("preserveAspectRatio", "xMidYMid slice")], body)
    if style == "rings":
        size = cell * 32
        c = size / 2
        circles, r, i = [], float(cell), 0
        while r < size * 0.72:
            jitter = 1.0 + 0.08 * (((seed * 2654435761 + i * 40503) % 1000) / 1000.0 - 0.5)
            dash = "2 6" if (seed + i) % 4 == 3 else None
            circles.append(_el("circle", [("cx", f"{c:g}"), ("cy", f"{c:g}"),
                                          ("r", f"{r * jitter:.1f}"),
                                          ("stroke-dasharray", dash)], jsx))
            r *= 1.24
            i += 1
        body = _el("g", [("fill", "none"), ("stroke", "currentColor"), ("stroke-width", "1"),
                         ("vector-effect", "non-scaling-stroke"), ("opacity", op)], jsx,
                   "".join(circles))
        return _svg_root(color, fmt, [("width", "100%"), ("height", "100%"),
                                      ("viewBox", f"0 0 {size} {size}"),
                                      ("preserveAspectRatio", "xMidYMid slice")], body)
    raise CliError(f"unknown svg style {style!r}; choose from {', '.join(SVG_STYLES)}")


def cmd_svg(a, argv) -> dict:
    if not 0.0 < a.opacity <= 1.0:
        raise CliError("--opacity must be within (0, 1]")
    if a.cell < 4:
        raise CliError("--cell must be at least 4")
    if a.format == "css" and "var(" in a.color:
        raise CliError("--format css needs a literal --color (e.g. '#c8902e'): a data-URI "
                       "cannot read CSS variables. Use --format inline or jsx to keep var().")
    svg = build_svg(a.style, a.color, a.opacity, a.seed, a.cell, a.format)
    if a.format == "css":
        encoded = urllib.parse.quote(svg, safe=" :/=,;-_.!~*'()")
        out = {"css": f'url("data:image/svg+xml,{encoded}")'}
        if a.style == "grain":
            out.update(backgroundSize=f"{GRAIN_TILE}px {GRAIN_TILE}px", backgroundRepeat="repeat")
        emitted = out["css"]
    else:
        out = {"svg": svg, "bytes": len(svg.encode())}
        emitted = svg
    digest = hashlib.sha256(emitted.encode("utf-8")).hexdigest()
    out.update(note=SVG_NOTES[a.format], style=a.style, format=a.format, sha256=digest)
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "svg", "style": a.style,
                             "seed": a.seed, "color": a.color, "opacity": a.opacity,
                             "cell": a.cell, "format": a.format, "sha256": digest,
                             "argv": argv})
    return out


def nearest_ratio(w: int, h: int) -> str:
    r = w / h
    return min(AI_RATIOS, key=lambda k: abs(math.log(AI_RATIOS[k] / r)))


def _scrub(text: str) -> str:
    for v in os.environ.values():
        if len(v) >= 8 and v in text:
            text = text.replace(v, "***")
    return text


def _ai_unavailable(reason: str) -> CliError:
    return CliError(f"ai image generation unavailable: {reason}; run `plate` instead", code=3,
                    payload={"error": "ai_unavailable", "fallback": "run `plate` instead",
                             "reason": reason})


def cmd_ai(a, argv) -> dict:
    need_raster()
    w, h = parse_size(a.size)
    check_max_kb(a.max_kb)
    page = parse_page(a.page)
    if not BUN.exists():
        raise _ai_unavailable("bun not found at ~/.bun/bin/bun")
    if not IMAGE_GEN.exists():
        raise _ai_unavailable("baoyu-image-gen skill not installed")
    prompt = a.prompt.strip() + AI_SUFFIX
    tmp = tempfile.mkdtemp(prefix="gen_atmosphere_ai_")
    raw = Path(tmp) / "RAW.png"
    cmd = [str(BUN), str(IMAGE_GEN), "--prompt", prompt, "--image", str(raw),
           "--provider", a.provider]
    if a.provider == "openai":
        cmd += ["--model", "gpt-image-1.5"]
    cmd += ["--ar", nearest_ratio(w, h)]
    try:
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except (OSError, subprocess.SubprocessError) as exc:
            raise _ai_unavailable(f"image generator failed to run ({type(exc).__name__})")
        if proc.returncode != 0 or not raw.exists():
            lines = (proc.stderr or "").strip().splitlines()
            tail = _scrub(lines[-1]) if lines else ""
            if tail:
                log(f"image generator: {tail[:300]}")
            raise _ai_unavailable(f"image generator exited {proc.returncode}"
                                  if proc.returncode else "image generator produced no file")
        try:
            with Image.open(raw) as src:
                img = cover_crop(src, w, h)
        except OSError:
            raise _ai_unavailable("image generator wrote an unreadable file")
        res = _finish(img, a.out, a.max_kb, page=page)
        kept = None
        if a.keep_raw:
            kept = str(Path(a.out).with_suffix(".raw.png"))
            shutil.copyfile(raw, kept)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    out = {**res, "provider": a.provider, "prompt": prompt}
    if kept:
        out["raw"] = kept
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "ai", "provider": a.provider,
                             "prompt": prompt, "size": f"{w}x{h}", "out": a.out,
                             "bytes": res["bytes"], "quality": res["quality"],
                             "blur": res["blur"], "sha256": res["sha256"],
                             **_vis_fields(res), "argv": argv})
    return out


def _vis_fields(res: dict) -> dict:
    """Ledger fields for an ungated visibility report (only when --page was given)."""
    return {"page": res["page"], "visibility": res["visibility"]} if "visibility" in res else {}


def cmd_compress(a, argv) -> dict:
    need_raster()
    w, h = parse_size(a.size)
    check_max_kb(a.max_kb)
    page = parse_page(a.page)
    try:
        source = Path(a.inp).read_bytes()
        with Image.open(io.BytesIO(source)) as src:
            img = cover_crop(src, w, h)
    except OSError as exc:
        raise CliError(f"cannot open image {a.inp}: {exc}")
    res = _finish(img, a.out, a.max_kb, page=page)
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "compress",
                             "source": Path(a.inp).name,
                             "sourceSha256": hashlib.sha256(source).hexdigest(),
                             "size": f"{w}x{h}", "out": a.out, "bytes": res["bytes"],
                             "quality": res["quality"], "blur": res["blur"],
                             "sha256": res["sha256"], **_vis_fields(res), "argv": argv})
    log(f"compress {a.inp} -> {a.out} {res['bytes']} B q={res['quality']} blur={res['blur']}")
    return {**res, "in": a.inp}


# --------------------------------------------------------------------------
# score: one plate file, as a slot shows it
# --------------------------------------------------------------------------

def cmd_score(a, argv) -> dict:
    need_raster()
    page = parse_page(a.page)
    try:
        pixels = _decode(Path(a.plate).read_bytes())
    except OSError as exc:
        raise CliError(f"cannot open plate {a.plate}: {exc}")
    ih, iw = pixels.shape[:2]
    slot = resolve_slot(a.slot or f"{iw}x{ih}", a.scrim, a.scrim_json, a.fit, a.strip)
    res = {"plate": a.plate, "page": page,
           **score_pixels(pixels, page, slot, parse_page(a.text),
                          parse_min_visible(a.min_visible), check_min_text(a.min_text))}
    v, t = res["visibility"], res["text"]
    log(f"score {a.plate} in {res['slot']} ({res['scrim']}, {res['fit']}): "
        f"{v['ge_1_1']}%>=1.1 {v['ge_1_3']}%>=1.3"
        + (f", text {t['ratio']}:1" if t else "") + (" pass" if res["pass"] else " FAIL"))
    if not res["pass"]:
        raise CliError("score below the floor: " + "; ".join(res["reasons"]), code=4, payload=res)
    return res


# --------------------------------------------------------------------------
# batch: render + score a manifest of plates, then swap them in atomically.
# Paths in the manifest are relative to the current working directory: run
# it from the project root.
# --------------------------------------------------------------------------

AI_CMD_ENV = "FUI_AI_CMD"   # replaces `gen_atmosphere.py ai` (tests, CI, other generators)
AI_TIMEOUT = 900            # s; `ai` itself gives the generator 600
BATCH_TOP_KEYS = frozenset(("tokens", "page", "text", "out_dir", "ledger", "defaults",
                            "plates", "palette"))
# `page` and `map` are per entry (a plate on a raised panel), never in `defaults`.
ENTRY_ONLY_KEYS = frozenset(("page", "map"))
PLATE_KEYS = frozenset(("style", "seed", "seeds", "pick", "size", "intensity", "focus",
                        "weight", "max_kb", "slot", "scrim", "scrim_json", "fit", "strip",
                        "palette", "text", "min_visible", "min_text")) | ENTRY_ONLY_KEYS
ENTRY_KEYS = PLATE_KEYS | {"name", "ai", "fallback"}
BATCH_DEFAULTS = {"focus": "0.75,0.3", "weight": 1.0, "max_kb": DEFAULT_MAX_KB,
                  "strip": DEFAULT_STRIP, "min_visible": "8,1", "min_text": DEFAULT_MIN_TEXT}
LEDGER_DROP = ("ts", "argv", "raw")
WRITTEN_SOURCES = ("rendered", "ai", "fallback")   # sources whose bytes batch writes
_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")


class AiFailed(Exception):
    """The ai generator produced no usable image (`ai` exits 3 for ANY failure)."""


def _csv(v) -> str:
    return ",".join(str(x) for x in v) if isinstance(v, (list, tuple)) else str(v)


def _rel(path) -> str:
    return os.path.relpath(os.path.abspath(str(path)))


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _float(cfg: dict, key: str) -> float:
    v = cfg.get(key)
    if isinstance(v, bool):
        raise CliError(f"`{key}` must be a number, got {v!r}")
    try:
        return float(v)
    except (TypeError, ValueError):
        raise CliError(f"`{key}` must be a number, got {v!r}")


def _in_entry(name: str, exc: CliError) -> CliError:
    """Re-raise an entry's error with the entry named (same exit code)."""
    if exc.payload.get("name") == name:
        return exc
    msg = f"plate {name!r}: {exc}"
    return CliError(msg, exc.code, {**exc.payload, "message": msg, "name": name})


# ---- batch: the manifest ----------------------------------------------------

def load_manifest(path: str) -> dict:
    try:
        man = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as exc:
        raise CliError(f"cannot read manifest {path}: {exc.strerror}")
    except ValueError as exc:
        raise CliError(f"manifest {path} is not valid JSON: {exc}")
    if not isinstance(man, dict):
        raise CliError("the manifest must be a JSON object")
    unknown = sorted(k for k in man if k not in BATCH_TOP_KEYS and not k.startswith("_"))
    if unknown:
        raise CliError(f"manifest has unknown keys: {', '.join(unknown)}")
    for key in ("out_dir", "ledger"):
        if not isinstance(man.get(key), str) or not man[key].strip():
            raise CliError(f"the manifest needs `{key}` (a path relative to the project root)")
    if not isinstance(man.get("plates"), list) or not man["plates"]:
        raise CliError("the manifest needs a non-empty `plates` list")
    defaults = man.get("defaults", {})
    if not isinstance(defaults, dict):
        raise CliError("manifest `defaults` must be an object")
    bad = sorted(set(defaults) - (PLATE_KEYS - ENTRY_ONLY_KEYS))
    if bad:
        raise CliError(f"manifest `defaults` has unknown keys: {', '.join(bad)} "
                       f"(`page` and `map` belong on an entry)")
    return man


def confine_paths(man: dict, allow_outside: bool) -> None:
    """out_dir, ledger, tokens.css and tokens.out must resolve under the cwd
    (the project root), unless --allow-outside."""
    root = Path.cwd().resolve()
    tokens = man.get("tokens") if isinstance(man.get("tokens"), dict) else {}
    paths = [("out_dir", man["out_dir"]), ("ledger", man["ledger"]),
             ("tokens.css", tokens.get("css")), ("tokens.out", tokens.get("out"))]
    for key, path in paths:
        if not path:
            continue
        try:
            Path(str(path)).resolve().relative_to(root)
        except ValueError:
            if allow_outside:
                log(f"batch: {key} {path} is outside the project root {root} (--allow-outside)")
                continue
            msg = (f"manifest `{key}` {path} resolves outside the project root {root}; run "
                   f"from the project root, fix the path, or pass --allow-outside")
            raise CliError(msg, payload={"error": "path_outside_project", "message": msg,
                                         "key": key, "path": str(path), "root": str(root)})


def parse_only(s: Optional[str], man: dict) -> Optional[set]:
    if s is None:
        return None
    names = {t.strip() for t in s.split(",") if t.strip()}
    known = {e.get("name") for e in man["plates"] if isinstance(e, dict)}
    unknown = sorted(names - known)
    if not names or unknown:
        raise _usage(f"--only must name manifest entries; unknown: {', '.join(unknown) or '(none given)'}")
    return names


def batch_tokens(spec) -> dict:
    """The manifest's `tokens` block -> tokens_result (palette + page)."""
    if not isinstance(spec, dict) or not spec.get("css") or not spec.get("map"):
        raise CliError("manifest `tokens` needs `css` and `map` (and optionally selector, "
                       "out, page_role)")
    m = spec["map"]
    if isinstance(m, dict):
        m = ",".join(f"{k}={v}" for k, v in m.items())
    return tokens_result(str(spec["css"]), str(spec.get("selector") or ":root"),
                         parse_map(str(m)), spec.get("page_role"))


def merge_config(defaults: dict, own: dict) -> dict:
    """BATCH_DEFAULTS < manifest defaults < the entry's own keys. A seed the
    entry names replaces the defaults' seeds (and the other way round); a
    scrim the entry names brings its profile's own fit unless it names a fit."""
    cfg = {**BATCH_DEFAULTS, **defaults}
    if ("scrim" in own or "scrim_json" in own) and "fit" not in own:
        cfg.pop("fit", None)
        cfg.pop("scrim_json" if "scrim" in own else "scrim", None)
    if "seed" in own:
        cfg.pop("seeds", None)
        cfg.pop("pick", None)
    if "seeds" in own:
        cfg.pop("seed", None)
    if "palette" in own or "map" in own:
        cfg.pop("palette", None)
    return {**cfg, **{k: v for k, v in own.items() if k in PLATE_KEYS}}


def entry_config(defaults: dict, entry, index: int) -> Tuple[str, dict]:
    if not isinstance(entry, dict):
        raise CliError(f"plates[{index}] must be an object")
    name = entry.get("name")
    if not isinstance(name, str) or not _NAME_RE.fullmatch(name):
        raise CliError(f"plates[{index}] needs a `name` of letters, digits, '.', '_' or '-' "
                       f"(it becomes <out_dir>/<name>.webp)")
    unknown = sorted(set(entry) - ENTRY_KEYS)
    if unknown:
        raise CliError(f"plate {name!r} has unknown keys: {', '.join(unknown)}")
    return name, merge_config(defaults, entry)


def entry_palette(cfg: dict, ctx: dict) -> List[str]:
    """The entry's palette: its own `palette`, or its own token `map` (read from
    the manifest's tokens css/selector), else the manifest's palette."""
    if cfg.get("palette") and cfg.get("map"):
        raise CliError("give an entry `palette` or `map`, not both")
    if cfg.get("palette"):
        return _check_palette([c.strip() for c in _csv(cfg["palette"]).split(",") if c.strip()])
    if cfg.get("map"):
        if not ctx["tokens_spec"]:
            raise CliError("an entry `map` needs the manifest's `tokens` block (css, selector)")
        res = batch_tokens({**ctx["tokens_spec"], "map": cfg["map"], "page_role": None})
        return _check_palette(_ordered_palette(res["palette"]))
    if ctx["base_palette"]:
        return ctx["base_palette"]
    raise CliError("no palette: give the manifest `tokens` or a `palette`")


def entry_page(cfg: dict, ctx: dict) -> str:
    """The page this entry sits on: its own `page` (a raised panel), else the manifest's."""
    if cfg.get("page"):
        return parse_page(str(cfg["page"]))
    return ctx["page"]


def cfg_slot(cfg: dict, size: Tuple[int, int]) -> dict:
    return resolve_slot(str(cfg.get("slot") or f"{size[0]}x{size[1]}"), cfg.get("scrim"),
                        cfg.get("scrim_json"), cfg.get("fit"), cfg.get("strip", DEFAULT_STRIP))


def cfg_seeds(cfg: dict) -> List[int]:
    seed = cfg.get("seed")
    if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int)):
        raise CliError(f"`seed` must be a whole number, got {seed!r}")
    seeds = cfg.get("seeds")
    return plate_seeds(seed, _csv(seeds) if seeds is not None else None, cfg.get("pick"))


# ---- batch: entries ---------------------------------------------------------

def batch_plate_item(name: str, cfg: dict, ctx: dict, rel: str) -> dict:
    """Render a manifest plate entry in memory (deterministic every run)."""
    palette = entry_palette(cfg, ctx)
    page = entry_page(cfg, ctx)
    check_page(palette, page)
    style = cfg.get("style")
    if style not in STYLES:
        raise CliError(f"`style` must be one of {', '.join(STYLES)}, got {style!r}")
    size = parse_size(str(cfg.get("size") or ""))
    focus = parse_focus(_csv(cfg["focus"]))
    intensity = default_intensity(None if cfg.get("intensity") is None
                                  else _float(cfg, "intensity"), bool(cfg.get("slot")))
    weight = check_weight(_float(cfg, "weight"))
    max_kb = check_max_kb(_float(cfg, "max_kb"))
    seeds = cfg_seeds(cfg)
    slot = cfg_slot(cfg, size)
    cands = [render_candidate(palette, style, sd, size, intensity, focus, weight, max_kb,
                              page, slot) for sd in seeds]
    best = pick_best(cands, parse_min_visible(_csv(cfg["min_visible"])), strict=False)
    row = {"tool": TOOL, "mode": "plate", "name": name, "style": style, "seed": best["seed"],
           "size": f"{size[0]}x{size[1]}", "palette": palette, "intensity": intensity,
           "focus": list(focus), "weight": weight, "out": rel, "quality": best["quality"],
           "blur": best["blur"]}
    if cfg.get("seeds") is not None:
        row["candidates"] = candidate_summary(cands)
    return {"name": name, "rel": rel, "cfg": cfg, "slot": slot, "page": page,
            "data": best["data"], "row": row, "source": "rendered"}


def read_ledger_lines(path: str) -> List[Tuple[Optional[dict], str]]:
    """Every non-blank ledger line as (row or None, the raw line)."""
    p = Path(path)
    if not p.exists():
        return []
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise CliError(f"cannot read ledger {path}: {exc.strerror}")
    out = []
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except ValueError:
            raise CliError(f"ledger {path} line {i} is not JSON")
        out.append((row if isinstance(row, dict) else None, line))
    return out


def _row_rel(row: Optional[dict]) -> Optional[str]:
    out = row.get("out") if row else None
    return _rel(out) if isinstance(out, str) and out else None


def shipped_state(rel: str, rows: List[dict]) -> dict:
    """The file at `rel` and its LAST ledger row; ok when their sha256 agree."""
    row = None
    for r in rows:
        if _row_rel(r) == rel:
            row = r
    if row is None:
        return {"ok": False, "reason": "no ledger row for it"}
    p = Path(rel)
    if not p.is_file():
        return {"ok": False, "row": row, "reason": "the file is missing"}
    data = p.read_bytes()
    actual = _sha(data)
    if actual != row.get("sha256"):
        return {"ok": False, "row": row,
                "reason": f"its sha256 {actual[:12]} is not the ledger's "
                          f"{str(row.get('sha256'))[:12]}"}
    return {"ok": True, "row": row, "data": data}


def ledger_mismatch(name: str, rel: str, reason: str, hint: str = "") -> CliError:
    hint = hint or ("Restore the approved file, or re-generate it with --reroll-ai "
                    "(spends credits)")
    msg = (f"plate {name!r}: the shipped {rel} cannot be verified against its ledger row "
           f"({reason}); nothing changed. {hint}")
    return CliError(msg, payload={"error": "ledger_mismatch", "message": msg, "name": name,
                                  "out": rel, "reason": reason})


def clean_row(row: dict, name: str, rel: str) -> dict:
    return {**{k: v for k, v in row.items() if k not in LEDGER_DROP}, "name": name, "out": rel}


def ai_command() -> List[str]:
    custom = os.environ.get(AI_CMD_ENV, "").strip()
    if custom:
        return shlex.split(custom)
    return [sys.executable, str(Path(__file__).resolve()), "ai"]


def run_ai_tool(prompt: str, provider: str, size: Tuple[int, int], max_kb: float,
                page: str) -> Tuple[bytes, dict]:
    """Run `ai` (or $FUI_AI_CMD) into a temp dir; return (webp bytes, its JSON).
    Any failure - non-zero exit, no file, wrong size, over budget - is AiFailed."""
    tmp = tempfile.mkdtemp(prefix="gen_atmosphere_batch_ai_")
    out = Path(tmp) / "ai.webp"
    cmd = ai_command() + ["--prompt", prompt, "--provider", provider,
                          "--size", f"{size[0]}x{size[1]}", "--out", str(out),
                          "--max-kb", f"{max_kb:g}", "--page", page]
    try:
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=AI_TIMEOUT)
        except (OSError, subprocess.SubprocessError) as exc:
            raise AiFailed(f"ai command failed to run ({type(exc).__name__})")
        lines = [ln for ln in (proc.stdout or "").splitlines() if ln.strip()]
        try:
            info = json.loads(lines[-1]) if lines else {}
        except ValueError:
            info = {}
        info = info if isinstance(info, dict) else {}
        if proc.returncode != 0 or not out.is_file():
            reason = info.get("reason") or info.get("message") or (
                f"ai exited {proc.returncode}" if proc.returncode else "ai wrote no file")
            raise AiFailed(_scrub(str(reason))[:300])
        data = out.read_bytes()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    try:
        got = Image.open(io.BytesIO(data)).size
    except OSError:
        raise AiFailed("ai wrote an unreadable image")
    if got != tuple(size) or len(data) > int(max_kb * 1024):
        raise AiFailed(f"ai wrote {got[0]}x{got[1]} / {len(data)} B, expected "
                       f"{size[0]}x{size[1]} within {max_kb:g} KB")
    return data, info


def ai_spec(spec) -> Tuple[str, str]:
    if not isinstance(spec, dict) or not str(spec.get("prompt") or "").strip():
        raise CliError("`ai` needs {\"provider\": \"openai|google\", \"prompt\": \"...\"}")
    provider = spec.get("provider", "openai")
    if provider not in ("openai", "google"):
        raise CliError(f"`ai.provider` must be openai or google, got {provider!r}")
    return str(spec["prompt"]).strip(), provider


def batch_ai_item(name: str, entry: dict, cfg: dict, ctx: dict, rel: str) -> dict:
    """An ai entry: verify the shipped file against its ledger row, or (with
    --reroll-ai) generate it; on failure abort (exit 3) unless --fallback."""
    a = ctx["args"]
    prompt, provider = ai_spec(entry["ai"])
    size = parse_size(str(cfg.get("size") or ""))
    max_kb = check_max_kb(_float(cfg, "max_kb"))
    page = entry_page(cfg, ctx)
    base = {"name": name, "rel": rel, "cfg": cfg, "slot": cfg_slot(cfg, size), "page": page}
    shipped = shipped_state(rel, ctx["rows"])
    if not a.reroll_ai:
        if not shipped["ok"]:
            raise ledger_mismatch(name, rel, shipped["reason"])
        return {**base, "data": shipped["data"], "source": "verified",
                "row": clean_row(shipped["row"], name, rel)}
    if Path(rel).exists() and not shipped["ok"]:
        # Never replace a file the ledger cannot vouch for (it may be hand-placed
        # or approved elsewhere) - not with a new image, not with a fallback.
        raise ledger_mismatch(name, rel, shipped["reason"],
                              "Move the file aside (or restore its ledger row) to re-generate")
    if a.dry_run:   # never spend credits on a dry run
        return {**base, "data": None, "row": None, "source": "pending-ai",
                "note": "not scored (dry run: ai would re-roll)"}
    try:
        data, info = run_ai_tool(prompt, provider, size, max_kb, page)
    except AiFailed as exc:
        return ai_failure(name, entry, ctx, rel, shipped, base, str(exc))
    row = {"tool": TOOL, "mode": "ai", "name": name, "provider": provider, "prompt": prompt,
           "size": f"{size[0]}x{size[1]}", "out": rel}
    row.update({k: info[k] for k in ("quality", "blur") if k in info})
    if isinstance(info.get("prompt"), str) and info["prompt"] != prompt:
        row["promptSent"] = info["prompt"]
    return {**base, "data": data, "row": row, "source": "ai"}


def ai_failure(name: str, entry: dict, ctx: dict, rel: str, shipped: dict, base: dict,
               reason: str) -> dict:
    if not ctx["args"].fallback:
        msg = (f"plate {name!r}: ai generation failed ({reason}); nothing changed. "
               f"Pass --fallback to ship the entry's fallback plate instead")
        raise CliError(msg, code=3, payload={"error": "ai_failed", "message": msg,
                                             "name": name, "reason": reason})
    if shipped["ok"] and shipped["row"].get("mode") == "ai":
        # Never overwrite an approved ai image with a fallback plate.
        log(f"plate {name!r}: ai failed ({reason}); keeping the approved image {rel}")
        return {**base, "data": shipped["data"], "source": "kept", "aiError": reason,
                "row": clean_row(shipped["row"], name, rel)}
    fallback = entry.get("fallback")
    if not isinstance(fallback, dict):
        msg = (f"plate {name!r}: ai generation failed ({reason}) and the entry has no "
               f"`fallback` plate; nothing changed")
        raise CliError(msg, code=3, payload={"error": "ai_failed", "message": msg,
                                             "name": name, "reason": reason})
    bad = sorted(set(fallback) - PLATE_KEYS)
    if bad:
        raise CliError(f"plate {name!r}: `fallback` has unknown keys: {', '.join(bad)}")
    # The fallback sits where the ai image would: the entry's page, palette or map.
    carry = {k: entry[k] for k in ("page", "palette", "map") if k in entry}
    item = batch_plate_item(name, merge_config(ctx["defaults"], {**carry, **fallback}), ctx, rel)
    prompt, provider = ai_spec(entry["ai"])
    item["row"].update(fallbackFor="ai", aiError=reason, provider=provider, prompt=prompt)
    log(f"plate {name!r}: ai failed ({reason}); using the fallback "
        f"{item['row']['style']} plate (seed {item['row']['seed']})")
    return {**item, "source": "fallback", "aiError": reason}


def unselected_item(name: str, cfg: dict, ctx: dict, rel: str) -> dict:
    """--only left this entry out: keep it as-is, but it must still verify."""
    shipped = shipped_state(rel, ctx["rows"])
    if not shipped["ok"]:
        raise ledger_mismatch(name, rel, shipped["reason"],
                              "Include it in --only, or run the batch without --only")
    return {"name": name, "rel": rel, "cfg": cfg, "data": shipped["data"], "row": None,
            "source": "unselected", "note": "not selected (--only): verified, unchanged"}


def batch_items(ctx: dict, items: List[dict]) -> None:
    """Build every entry into `items` (appended as it goes, so an abort can
    still save the ai images already paid for)."""
    man = ctx["man"]
    seen = set()
    for i, entry in enumerate(man["plates"]):
        name, cfg = entry_config(ctx["defaults"], entry, i)
        if name in seen:
            raise CliError(f"plate name {name!r} appears twice in the manifest")
        seen.add(name)
        rel = _rel(Path(man["out_dir"]) / f"{name}.webp")
        try:
            if ctx["only"] is not None and name not in ctx["only"]:
                item = unselected_item(name, cfg, ctx, rel)
            elif "ai" in entry:
                item = batch_ai_item(name, entry, cfg, ctx, rel)
            else:
                item = batch_plate_item(name, cfg, ctx, rel)
        except CliError as exc:
            raise _in_entry(name, exc)
        items.append(item)


# ---- batch: scoring and reporting -------------------------------------------

def score_item(item: dict, text: Optional[str]) -> None:
    """Score with `score` semantics on the entry's slot and page; complete its row."""
    cfg, data, page = item["cfg"], item["data"], item["page"]
    decoded = _decode(data)
    text = parse_page(cfg["text"]) if "text" in cfg else text
    res = score_pixels(decoded, page, item["slot"], text,
                       parse_min_visible(_csv(cfg["min_visible"])),
                       check_min_text(_float(cfg, "min_text")))
    row = item["row"]
    for stale in ("slot", "scrim", "fit", "strip", "slotVisibility", "text"):
        row.pop(stale, None)
    row.update(bytes=len(data), sha256=_sha(data), page=page,
               visibility=visibility(decoded, page), slotVisibility=res["visibility"],
               **slot_fields(item["slot"]))
    if res["text"] is not None:
        row["text"] = res["text"]
    item["score"] = res


def item_summary(item: dict) -> dict:
    row, res = item.get("row") or {}, item.get("score")
    out = {"name": item["name"], "out": item["rel"], "source": item["source"],
           "mode": row.get("mode", "ai" if item["source"] == "pending-ai" else "-")}
    for key in ("seed", "sha256", "bytes"):
        if key in row:
            out[key] = row[key]
    if "page" in item:
        out["page"] = item["page"]
    if "aiError" in item:
        out["aiError"] = item["aiError"]
    if res is None:
        return {**out, "pass": None, "reasons": [item.get("note", "not scored")]}
    return {**out, **slot_fields(item["slot"]), "visibility": res["visibility"],
            "text": res["text"], "pass": res["pass"], "reasons": res["reasons"]}


def log_table(summary: List[dict]) -> None:
    log(f"{'name':<18} {'source':<10} {'seed':>5} {'slot':>9} {'scrim':<12} "
        f"{'ge_1_1':>7} {'ge_1_3':>7} {'text':>6}  result")
    for s in summary:
        v, t = s.get("visibility") or {}, s.get("text") or {}
        result = (s["reasons"][0] if s["pass"] is None else
                  "pass" if s["pass"] else "FAIL " + "; ".join(s["reasons"]))
        log(f"{s['name']:<18} {s['source']:<10} {str(s.get('seed', '-')):>5} "
            f"{s.get('slot', '-'):>9} {s.get('scrim', '-'):<12} "
            f"{str(v.get('ge_1_1', '-')):>7} {str(v.get('ge_1_3', '-')):>7} "
            f"{str(t.get('ratio', '-')):>6}  {result}")


def stash_rejected(items: List[dict], out_dir: str, reason: str) -> Optional[str]:
    """An aborted batch keeps the ai images it paid for: copy them to
    <out_dir>/.rejected/<UTC timestamp>/ with a note.json. out_dir itself
    is not touched."""
    paid = [i for i in items if i.get("source") == "ai" and i.get("data")]
    if not paid:
        return None
    stamp = _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base, n = Path(out_dir) / ".rejected" / stamp, 1
    while base.exists():
        base, n = Path(out_dir) / ".rejected" / f"{stamp}-{n}", n + 1
    note = []
    for item in paid:
        write_atomic(base / f"{item['name']}.webp", item["data"])
        res = item.get("score")
        note.append({"name": item["name"], "prompt": item["row"].get("prompt"),
                     "provider": item["row"].get("provider"), "sha256": _sha(item["data"]),
                     "reason": "; ".join(res["reasons"]) if res and res["reasons"] else reason})
    write_atomic(base / "note.json", (json.dumps(note, indent=2) + "\n").encode("utf-8"))
    path = _rel(base)
    log(f"batch aborted: {len(paid)} paid ai image(s) saved to {path}")
    return path


# ---- batch: the ledger and the swap -----------------------------------------

def ledger_body(lines: List[Tuple[Optional[dict], str]], items: List[dict],
                manifest_rels: set, prune: bool) -> Tuple[str, List[str]]:
    """The new ledger: one row per plate this run wrote or verified (no
    ts/argv/raw), plus every other existing line kept verbatim - rows from
    ai/compress/svg/hand-run plates and, under --only, the entries left out -
    all sorted by out. --prune drops the lines whose out is not a manifest
    plate. Returns (body, pruned outs)."""
    replaced = {i["rel"] for i in items if i.get("row") is not None}
    keep, pruned = [], []
    for row, raw in lines:
        rel = _row_rel(row)
        if rel in replaced:
            continue
        if prune and rel not in manifest_rels:
            pruned.append(rel or raw[:80])
            continue
        keep.append((rel or "", raw))
    new = [(i["rel"], json.dumps({k: v for k, v in i["row"].items() if k not in LEDGER_DROP},
                                 sort_keys=True, separators=(",", ":")))
           for i in items if i.get("row") is not None]
    ordered = sorted(keep + new, key=lambda t: t[0])
    return "".join(line + "\n" for _, line in ordered), pruned


def stage_files(writes: List[Tuple[Path, bytes]]) -> List[Tuple[Path, str]]:
    """Write each file to a temp name next to its target and verify the
    staged bytes' sha256. Returns [(target, staged temp path)]."""
    staged: List[Tuple[Path, str]] = []
    try:
        for target, data in writes:
            target.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(prefix=".gen_atmosphere.stage.", dir=str(target.parent))
            staged.append((target, tmp))
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.chmod(tmp, 0o666 & ~_umask())
            if _sha(Path(tmp).read_bytes()) != _sha(data):
                raise CliError(f"staged {target} does not read back with its sha256; "
                               f"nothing changed", payload={"error": "sha_mismatch",
                                                            "out": str(target)})
    except BaseException:
        for _, tmp in staged:
            if os.path.exists(tmp):
                os.unlink(tmp)
        raise
    return staged


def _restore(done: List[Path], backups: Dict[Path, str]) -> int:
    """Best effort: put back each renamed target's original (or remove it)."""
    restored = 0
    for target in done:
        try:
            if target in backups:
                os.replace(backups[target], target)
            else:
                os.unlink(target)
            restored += 1
        except OSError:
            pass
    return restored


def commit_staged(staged: List[Tuple[Path, str]]) -> None:
    """Back up each existing target, then rename every staged file into
    place. If a rename fails, restore the originals (best effort) and say so."""
    backups: Dict[Path, str] = {}
    done: List[Path] = []
    try:
        for target, _ in staged:
            if target.exists():
                fd, bak = tempfile.mkstemp(prefix=".gen_atmosphere.bak.", dir=str(target.parent))
                os.close(fd)
                shutil.copy2(target, bak)
                backups[target] = bak
        for target, tmp in staged:
            os.replace(tmp, target)
            done.append(target)
    except OSError as exc:
        restored = _restore(done, backups)
        msg = (f"swapping plates in failed ({exc}); restored {restored} of {len(done)} "
               f"already-renamed file(s) from backups (best effort); ledger not written")
        raise CliError(msg, payload={"error": "swap_failed", "message": msg,
                                     "restored": restored, "renamed": len(done)})
    finally:
        for bak in backups.values():
            if os.path.exists(bak):
                os.unlink(bak)
        for _, tmp in staged:
            if os.path.exists(tmp):
                os.unlink(tmp)


def swap_in(items: List[dict], tok: Optional[dict], man: dict, body: str) -> None:
    """Every entry rendered and passed: stage tokens.json and each new plate
    next to its target, verify, rename them all, then write the ledger last."""
    writes: List[Tuple[Path, bytes]] = []
    spec = man.get("tokens") or {}
    if tok is not None and spec.get("out"):
        writes.append((Path(spec["out"]), (json.dumps(tok, indent=2) + "\n").encode("utf-8")))
    writes += [(Path(i["rel"]), i["data"]) for i in items if i["source"] in WRITTEN_SOURCES]
    commit_staged(stage_files(writes))
    write_atomic(Path(man["ledger"]), body.encode("utf-8"))


def batch_palette(man: dict, tok: Optional[dict]) -> Optional[List[str]]:
    if tok is not None:
        return _check_palette(_ordered_palette(tok["palette"]))
    if man.get("palette"):
        return _check_palette([c.strip() for c in _csv(man["palette"]).split(",") if c.strip()])
    return None


def cmd_batch(a, argv) -> dict:
    need_raster()
    man = load_manifest(a.manifest)
    confine_paths(man, a.allow_outside)
    only = parse_only(a.only, man)
    tok = batch_tokens(man["tokens"]) if man.get("tokens") is not None else None
    # `page` must be stated, never inferred: inferring it from the token map
    # trusts the same map that may list a darker well first (the 2026-10-11
    # invisible-plate failure), and then page_mismatch can never fire.
    page = parse_page(man.get("page"))
    if page is None:
        raise CliError("the manifest needs an explicit `page`: the rendered page colour "
                       "(getComputedStyle(document.body).backgroundColor), not the token map's guess")
    text = parse_page(man.get("text")) if man.get("text") else None
    lines = read_ledger_lines(man["ledger"])
    ctx = {"man": man, "args": a, "only": only, "page": page, "base_palette": batch_palette(man, tok),
           "tokens_spec": man.get("tokens") if isinstance(man.get("tokens"), dict) else None,
           "defaults": man.get("defaults") or {}, "rows": [r for r, _ in lines if r]}
    items: List[dict] = []
    try:
        batch_items(ctx, items)
        for item in items:
            if item["data"] is not None and item["source"] != "unselected":
                score_item(item, text)
        summary = [item_summary(i) for i in items]
        log_table(summary)
        failed = [s["name"] for s in summary if s["pass"] is False]
        result = {"manifest": a.manifest, "dryRun": bool(a.dry_run), "page": page,
                  "pass": not failed, "plates": summary, "ledger": _rel(man["ledger"]),
                  "written": False}
        if failed:
            msg = f"{len(failed)} plate(s) below the floor: {', '.join(failed)}; nothing changed"
            raise CliError(msg, code=4, payload={"error": "gate_failed", "message": msg,
                                                 **result})
    except CliError as exc:
        if exc.code in (3, 4):
            saved = stash_rejected(items, man["out_dir"], str(exc))
            if saved:
                exc.payload["rejected"] = saved
        raise
    manifest_rels = {i["rel"] for i in items}
    body, pruned = ledger_body(lines, items, manifest_rels, a.prune)
    if pruned:
        log(f"batch: --prune {'would drop' if a.dry_run else 'drops'} {len(pruned)} ledger "
            f"row(s) not in the manifest: {', '.join(pruned)}")
    result["pruned"] = pruned
    if a.dry_run:
        return result
    swap_in(items, tok, man, body)
    log(f"batch: wrote {sum(i['source'] in WRITTEN_SOURCES for i in items)} plate(s) "
        f"and {result['ledger']}")
    return {**result, "written": True}


class _Parser(argparse.ArgumentParser):
    """Usage errors also end as one JSON object on stdout (exit 2)."""

    def error(self, message: str):  # type: ignore[override]
        self.print_usage(sys.stderr)
        raise CliError(f"{self.prog}: {message}", code=2,
                       payload={"error": "usage", "message": f"{self.prog}: {message}"})


def build_parser() -> argparse.ArgumentParser:
    p = _Parser(
        prog="gen_atmosphere.py",
        description="Deterministic decorative atmosphere (<=30 KB WebP) from a page's own tokens. "
                    "Every subcommand prints one JSON object on stdout.")
    sub = p.add_subparsers(dest="cmd", metavar="{tokens,plate,svg,ai,compress,score,batch}")
    sub.required = True

    t = sub.add_parser("tokens", help="extract an ordered sRGB palette from CSS custom properties")
    t.add_argument("--css", required=True, help="CSS file to read")
    t.add_argument("--selector", default=":root",
                   help="block to read first (default :root; e.g. '@theme inline'). @media blocks are ignored")
    t.add_argument("--map", required=True,
                   help="ordered key=--var list: the page ground first (the surface the plate "
                        "sits on, keyed `ground`), then lighter grounds (darker on a light page), "
                        "accent (and accentHi) last, e.g. "
                        "ground=--color-bg,ground2=--color-surface,accent=--color-accent")
    t.add_argument("--out", help="also write the JSON to this file")
    t.add_argument("--page-role", metavar="ROLE",
                   help="the --map key that is the page surface; its colour is written as "
                        "`page` (default `ground`, omitted when the map has no `ground`)")
    t.set_defaults(fn=cmd_tokens)

    pl = sub.add_parser(
        "plate", help="render a raster atmosphere plate to WebP",
        description="Render a decorative plate. Palette rule: the last one or two colours are the "
                    "accent; the rest are grounds. The FIRST ground is the page surface and the "
                    "plate's base; the other grounds must be no darker than it on a dark page (no "
                    "lighter on a light page, luminance > 0.5) or the palette is refused. Light "
                    "palettes get a weaker accent (x0.45) and softer structure (x0.6). The encoded "
                    "plate is measured against the page ground and refused (exit 4, nothing "
                    "written) when fewer than A%% of pixels reach 1.1:1 or B%% reach 1.3:1 "
                    "(--min-visible A,B, default 8,1). With --slot the gate measures what the "
                    "slot shows (fit + named scrim) instead of the whole file.")
    src = pl.add_mutually_exclusive_group(required=True)
    src.add_argument("--tokens", help="tokens.json from the tokens subcommand")
    src.add_argument("--palette", help="'#page,#b[,...],#accent[,#accentHi]' 2-6 colours: the "
                                       "page ground first, then structure grounds, accent last")
    pl.add_argument("--style", required=True, choices=STYLES)
    seed = pl.add_mutually_exclusive_group()
    seed.add_argument("--seed", type=int, help="one seed (or use --seeds)")
    seed.add_argument("--seeds", metavar="A-B|a,b,c",
                      help="render each seed, score each (on --slot if given) and write the "
                           "best passing one by (ge_1_3, then ge_1_1); exit 4 if none passes")
    pl.add_argument("--pick", choices=("best",), help="how --seeds chooses (only `best`)")
    pl.add_argument("--size", required=True, help="WxH, e.g. 1600x900")
    pl.add_argument("--out", required=True, help="output .webp path")
    pl.add_argument("--max-kb", type=float, default=DEFAULT_MAX_KB, help="size ceiling (default 30)")
    pl.add_argument("--intensity", type=float,
                    help="accent strength 0..1 (default 0.6; 1.0 with --slot, since strips and "
                         "states need 0.8-1.0 to stay visible under a scrim)")
    pl.add_argument("--focus", default="0.75,0.3", help="x,y in 0..1 (default 0.75,0.3)")
    pl.add_argument("--min-visible", default="8,1", metavar="A,B",
                    help="refuse (exit 4) unless >= A%% of pixels reach 1.1:1 and >= B%% reach "
                         "1.3:1 against the page ground (default 8,1)")
    pl.add_argument("--allow-faint", action="store_true",
                    help="skip the visibility gate (the measure is still reported)")
    pl.add_argument("--page", help="the page colour '#hex'; must equal the palette's first "
                                   "ground (exit 1 page_mismatch). Default: tokens.json `page`")
    pl.add_argument("--weight", type=float, default=1.0,
                    help="contour/rings hairline width + mix multiplier %g..%g (default 1; "
                         "recorded, ignored by warp/grain)" % WEIGHT_RANGE)
    _slot_args(pl)
    pl.add_argument("--ledger", help="append a JSON line describing this render")
    pl.set_defaults(fn=cmd_plate)

    s = sub.add_parser(
        "svg", help="print a tiny vector motif (no raster bytes)",
        description="Print a decorative vector motif. --format inline is HTML (plain pages), jsx "
                    "is React/TSX (camelCase attributes, style={{ color }}), css is a data-URI "
                    "url() that needs a literal --color. --opacity 1 emits no opacity attribute "
                    "(pass a pre-mixed colour instead when a guard bans opacity).")
    s.add_argument("--style", required=True, choices=SVG_STYLES)
    s.add_argument("--color", default="var(--accent)", help="CSS colour (default var(--accent))")
    s.add_argument("--opacity", type=float, default=0.05,
                   help="0 < x <= 1 (default 0.05); 1 omits the attribute")
    s.add_argument("--seed", type=int, default=1)
    s.add_argument("--cell", type=int, default=24, help="grid cell / ring step in px (default 24)")
    s.add_argument("--format", choices=("inline", "jsx", "css"), default="inline",
                   help="inline = HTML, jsx = React/TSX, css = data-URI (default inline)")
    s.add_argument("--ledger", help="append a JSON line describing this motif")
    s.set_defaults(fn=cmd_svg)

    ai = sub.add_parser("ai", help="optional: generate via baoyu-image-gen, then crop + compress")
    ai.add_argument("--prompt", required=True)
    ai.add_argument("--provider", choices=("openai", "google"), default="openai")
    ai.add_argument("--size", required=True, help="WxH")
    ai.add_argument("--out", required=True)
    ai.add_argument("--max-kb", type=float, default=DEFAULT_MAX_KB)
    ai.add_argument("--page", help="page colour '#hex' to report visibility against (no gate)")
    ai.add_argument("--ledger")
    ai.add_argument("--keep-raw", action="store_true", help="keep the raw PNG next to --out")
    ai.set_defaults(fn=cmd_ai)

    c = sub.add_parser("compress", help="cover-crop + compress a user image to <=max-kb WebP")
    c.add_argument("--in", dest="inp", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--size", required=True, help="WxH")
    c.add_argument("--max-kb", type=float, default=DEFAULT_MAX_KB)
    c.add_argument("--page", help="page colour '#hex' to report visibility against (no gate)")
    c.add_argument("--ledger", help="append a JSON line describing this compression")
    c.set_defaults(fn=cmd_compress)

    sc = sub.add_parser(
        "score", help="score a plate file as a slot shows it (no browser)",
        description="Composite the plate into the slot (fit + scrim over the page) and report "
                    "visibility over the pixels the image covers, plus the text gate (p90 "
                    "background under the profile's text region; p10 for dark text). Exit 0 "
                    "pass, 4 below the floor (the same JSON is printed).")
    sc.add_argument("--plate", required=True, help="the plate image (any format Pillow reads)")
    sc.add_argument("--page", required=True, help="page colour '#hex'")
    _slot_args(sc, custom=True)
    sc.add_argument("--text", help="text colour '#hex' to gate (omit to skip the text gate)")
    sc.add_argument("--min-visible", default="8,1", metavar="A,B",
                    help="floors: >= A%% at 1.1:1 and >= B%% at 1.3:1 (default 8,1)")
    sc.add_argument("--min-text", type=float, default=DEFAULT_MIN_TEXT, metavar="R",
                    help="text contrast floor (default 4.5; 3 for large text)")
    sc.set_defaults(fn=cmd_score)

    b = sub.add_parser(
        "batch", help="render + score a manifest of plates, then swap them in atomically",
        description="Run from the project root: manifest paths are relative to the current "
                    "directory, and out_dir, ledger, tokens.css and tokens.out must resolve "
                    "under it (exit 1 path_outside_project; --allow-outside overrides). The "
                    "manifest needs an explicit `page`; an entry may set its own `page` (a "
                    "plate on a raised panel) with its own `palette` or token `map`. Plates "
                    "are rendered (intensity defaults to 1.0 when the entry has a slot, else "
                    "0.6), ai entries verified against their ledger row, and everything is "
                    "scored on its slot. Only if all pass are the new files staged next to "
                    "their targets, verified, renamed in, and the ledger rewritten last: one "
                    "row per manifest plate, other rows kept verbatim (drop them with "
                    "--prune), sorted by out. An abort (exit 3 or 4) after paying for ai "
                    "images copies them to <out_dir>/.rejected/<timestamp>/. Exit 0 ok, 1 "
                    "error / ledger_mismatch / page_mismatch / path_outside_project, 2 usage, "
                    "3 ai failed (no --fallback), 4 gate failed.")
    b.add_argument("--manifest", required=True, help="manifest JSON")
    b.add_argument("--reroll-ai", action="store_true",
                   help="re-generate ai entries (spends credits); default verifies them. An "
                        "existing file the ledger cannot verify is refused (ledger_mismatch)")
    b.add_argument("--fallback", action="store_true",
                   help="only with --reroll-ai: when ai fails, ship the entry's `fallback` "
                        "plate (an approved ai image already shipped is kept instead)")
    b.add_argument("--only", metavar="NAME[,NAME]",
                   help="run only these entries; the others are verified against the ledger "
                        "and kept as they are, rows included")
    b.add_argument("--prune", action="store_true",
                   help="drop ledger rows whose out is not a manifest plate (default: keep "
                        "them verbatim); prints what it drops")
    b.add_argument("--allow-outside", action="store_true",
                   help="allow manifest paths that resolve outside the current directory")
    b.add_argument("--dry-run", action="store_true",
                   help="render and score, print the table, write nothing, call no ai")
    b.set_defaults(fn=cmd_batch)
    return p


def _slot_args(parser, custom: bool = False) -> None:
    """--slot/--scrim/--fit/--strip (score adds --scrim-json)."""
    parser.add_argument("--slot", metavar="WxH",
                        help="the CSS box the plate is shown in" +
                             ("" if custom else "; the gate then measures what it shows"))
    if custom:
        grp = parser.add_mutually_exclusive_group()
        grp.add_argument("--scrim", choices=SCRIMS, help="named scrim profile (default none)")
        grp.add_argument("--scrim-json", metavar="JSON",
                         help='custom scrim {"dir":"x|y","stops":[[pos,alpha],...],'
                              '"units":"frac|px"}; its text region is the whole slot')
    else:
        parser.add_argument("--scrim", choices=SCRIMS, help="named scrim profile (default none)")
    parser.add_argument("--fit", choices=FITS, help="default: the scrim profile's fit")
    parser.add_argument("--strip", type=int, default=DEFAULT_STRIP,
                        help="phone strip height in px (default 64)")


def main(argv: Optional[List[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    try:
        args = build_parser().parse_args(argv)
        result = args.fn(args, argv)
    except CliError as exc:
        log(f"error: {exc}")
        print(json.dumps(exc.payload))
        return exc.code
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
