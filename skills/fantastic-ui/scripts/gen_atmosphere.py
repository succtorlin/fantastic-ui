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
    highlight); the rest are grounds. The grounds are auto-sorted so the base
    is the page ground: the darkest ground for a dark palette, the LIGHTEST
    ground when the grounds' mean relative luminance is > 0.5 (e.g. a cream
    page). On light palettes accent strength is x0.45 and ground structure x0.6
    so dark text over the plate keeps high contrast. stdout reports "tone".
  * The result is decoration only. The caller MUST mark it `aria-hidden="true"`
    or give it `alt=""`, give it explicit width/height (no layout shift), keep
    it static (no animation), and never put information in it.

Subcommands (each prints exactly ONE JSON object on stdout; logs go to stderr):

  tokens    CSS custom properties -> ordered sRGB palette (tokens.json)
  plate     render warp | grain | contour | rings to a <=max-kb WebP
  svg       tiny vector motif (grain | grid | rings): inline HTML, jsx or CSS data-URI
  ai        optional: baoyu-image-gen -> cover-crop -> same <=max-kb WebP
  compress  user-supplied image -> cover-crop -> same <=max-kb WebP

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
    accent; the rest are grounds, sorted so grounds[0] is the page ground: the
    darkest on a dark palette, the LIGHTEST when the grounds' mean luminance is
    above LIGHT_THRESHOLD (a cream page). grounds[-1] is then always the ground
    that contrasts most with the base (used for hairlines)."""
    cols = [_rgb(c) for c in palette]
    if len(cols) >= 4:
        grounds, accent, accent_hi = cols[:-2], cols[-2], cols[-1]
    elif len(cols) == 3:
        grounds, accent, accent_hi = cols[:2], cols[2], cols[2]
    else:
        grounds, accent, accent_hi = cols[:1], cols[1], cols[1]
    lums = [float(rel_luminance(g)) for g in grounds]
    light = bool(sum(lums) / len(lums) > LIGHT_THRESHOLD)
    order = sorted(range(len(grounds)), key=lambda i: lums[i], reverse=light)
    return [grounds[i] for i in order], accent, accent_hi, light


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


def style_warp(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False):
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


def style_grain(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False):
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


def style_contour(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False):
    """Topographic hairlines in the ground that contrasts most with the base
    (the lightest ground on dark palettes); two accent levels near focus."""
    st = LIGHT_STRUCT if light else 1.0
    f = warped_field(width, height, seed, scale=1.0, warp=1.3, octaves=3)
    v = f * 14.0
    dist, grad = _iso_dist(v)
    line = _aa_line(dist, 0.75)
    line *= _smooth(0.004, 0.02, grad)        # no smudges at flat peaks/saddles
    line *= 1.0 - _smooth(0.10, 0.25, grad)   # thin out where lines bunch up
    d = _focus_dist(width, height, focus)
    near = np.exp(-(d / 0.9) ** 2)
    img = _flat(width, height, grounds[0])
    if len(grounds) > 1:
        img = _mix(img, grounds[1], np.exp(-(d / 0.8) ** 2) * 0.9 * st)
    img = _mix(img, accent, np.exp(-(d / 0.5) ** 2) * (0.07 * intensity))
    hair = grounds[-1] if len(grounds) > 1 else accent
    img = _mix(img, hair, line * (0.3 + 0.7 * near) * st)
    # A few accent lines: the level passing the focus and one 3 steps away.
    fy = min(height - 1, int(focus[1] * (height - 1)))
    fx = min(width - 1, int(focus[0] * (width - 1)))
    lvl = float(np.round(v[fy, fx]))
    rv = np.round(v)
    major = ((rv == lvl) | (rv == lvl + 3.0)).astype(np.float32)
    img = _mix(img, accent, line * major * np.exp(-(d / 0.6) ** 2) * (0.8 * intensity))
    return img


def style_rings(width, height, seed, grounds, accent, accent_hi, intensity, focus, light=False):
    """Concentric orbit hairlines around the focus, one accent orbit + body."""
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
    ring = _aa_line(np.abs(r - rk), 0.85) * (k >= 0)
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
    img = _mix(img, hair, ring * (0.3 + 0.7 * fade) * st)
    pick = int(_hash(np.array([seed]), np.array([1]), seed)[0] * 3)
    accent_ring = (k == float(2 + pick)).astype(np.float32)
    img = _mix(img, accent, ring * accent_ring * (0.7 * intensity))
    # One small body on the accent orbit.
    ang = float(_hash(np.array([seed]), np.array([2]), seed)[0]) * 2 * math.pi
    rb = r0 * g ** (2 + pick)
    bx, by = cx + rb * math.cos(ang), cy + rb * math.sin(ang)
    body = np.sqrt((xs - bx) ** 2 + (ys - by) ** 2)
    img = _mix(img, accent_hi, _aa_line(body - 0.005 * height, 1.2) * (0.6 + 0.4 * intensity))
    return img


_STYLE_FNS = {"warp": style_warp, "grain": style_grain,
              "contour": style_contour, "rings": style_rings}


def render_plate(palette: List[str], style: str, seed: int, width: int, height: int,
                 intensity: float = 0.6, focus: Tuple[float, float] = (0.75, 0.3)):
    """Return an HxWx3 uint8 sRGB array. Pure function of its arguments."""
    need_raster()
    if style not in _STYLE_FNS:
        raise CliError(f"unknown style {style!r}; choose from {', '.join(STYLES)}")
    grounds, accent, accent_hi, light = _roles(palette)
    strength = float(intensity) * (LIGHT_ACCENT if light else 1.0)
    img = _STYLE_FNS[style](width, height, int(seed), grounds, accent, accent_hi,
                            strength, focus, light)
    return _encode_srgb(img)


def palette_tone(palette: List[str]) -> str:
    """'light' when the grounds' mean luminance exceeds LIGHT_THRESHOLD."""
    return "light" if _roles(palette)[3] else "dark"


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


def _finish(img, out: str, max_kb: float) -> dict:
    data, quality, blur = fit_webp(img, int(max_kb * 1024))
    write_atomic(Path(out), data)
    return {"out": out, "bytes": len(data), "width": img.size[0], "height": img.size[1],
            "quality": quality, "blur": blur, "sha256": hashlib.sha256(data).hexdigest()}


# --------------------------------------------------------------------------
# Argument helpers
# --------------------------------------------------------------------------

def check_max_kb(v: float) -> float:
    """argparse's float() accepts nan/inf; reject them (and <= 0) as a CLI error."""
    if not math.isfinite(v) or v <= 0:
        raise CliError(f"--max-kb must be a positive finite number, got {v!r}")
    return v


def parse_size(s: str) -> Tuple[int, int]:
    m = re.fullmatch(r"\s*(\d+)\s*[xX]\s*(\d+)\s*", s or "")
    if not m:
        raise CliError(f"--size must look like 1600x900, got {s!r}")
    w, h = int(m.group(1)), int(m.group(2))
    if not (16 <= w <= 8192 and 16 <= h <= 8192):
        raise CliError("--size sides must be between 16 and 8192 px")
    return w, h


def parse_focus(s: str) -> Tuple[float, float]:
    try:
        x, y = (float(t) for t in s.split(","))
    except ValueError:
        raise CliError(f"--focus must be x,y in 0..1, got {s!r}")
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise CliError("--focus values must be within 0..1")
    return x, y


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


def load_palette(tokens: Optional[str], palette: Optional[str]) -> List[str]:
    if tokens:
        try:
            data = json.loads(Path(tokens).read_text(encoding="utf-8"))
            cols = list(data["palette"].values())
        except (OSError, ValueError, KeyError, AttributeError) as exc:
            raise CliError(f"cannot read a palette from {tokens}: {exc}")
    else:
        cols = [c.strip() for c in (palette or "").split(",") if c.strip()]
    if not 2 <= len(cols) <= 6:
        raise CliError(f"palette needs 2-6 colours (dark -> light, accent last), got {len(cols)}")
    return [to_hex(parse_color(c)) for c in cols]


# --------------------------------------------------------------------------
# Subcommands
# --------------------------------------------------------------------------

def cmd_tokens(a, argv) -> dict:
    result = extract_palette(a.css, a.selector, parse_map(a.map))
    if a.out:
        write_atomic(Path(a.out), (json.dumps(result, indent=2) + "\n").encode("utf-8"))
    return result


def cmd_plate(a, argv) -> dict:
    need_raster()
    palette = load_palette(a.tokens, a.palette)
    w, h = parse_size(a.size)
    focus = parse_focus(a.focus)
    if not 0.0 <= a.intensity <= 1.0:
        raise CliError("--intensity must be within 0..1")
    check_max_kb(a.max_kb)
    pixels = render_plate(palette, a.style, a.seed, w, h, a.intensity, focus)
    res = _finish(Image.fromarray(pixels), a.out, a.max_kb)
    out = {**res, "seed": a.seed, "style": a.style, "palette": palette,
           "tone": palette_tone(palette)}
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "plate", "style": a.style,
                             "seed": a.seed, "size": f"{w}x{h}", "palette": palette,
                             "intensity": a.intensity, "focus": list(focus), "out": a.out,
                             "bytes": res["bytes"], "quality": res["quality"],
                             "blur": res["blur"], "sha256": res["sha256"], "argv": argv})
    log(f"{a.style} seed={a.seed} -> {a.out} {res['bytes']} B q={res['quality']} blur={res['blur']}")
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
        res = _finish(img, a.out, a.max_kb)
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
                             "blur": res["blur"], "sha256": res["sha256"], "argv": argv})
    return out


def cmd_compress(a, argv) -> dict:
    need_raster()
    w, h = parse_size(a.size)
    check_max_kb(a.max_kb)
    try:
        source = Path(a.inp).read_bytes()
        with Image.open(io.BytesIO(source)) as src:
            img = cover_crop(src, w, h)
    except OSError as exc:
        raise CliError(f"cannot open image {a.inp}: {exc}")
    res = _finish(img, a.out, a.max_kb)
    append_ledger(a.ledger, {"ts": _now(), "tool": TOOL, "mode": "compress",
                             "source": Path(a.inp).name,
                             "sourceSha256": hashlib.sha256(source).hexdigest(),
                             "size": f"{w}x{h}", "out": a.out, "bytes": res["bytes"],
                             "quality": res["quality"], "blur": res["blur"],
                             "sha256": res["sha256"], "argv": argv})
    log(f"compress {a.inp} -> {a.out} {res['bytes']} B q={res['quality']} blur={res['blur']}")
    return {**res, "in": a.inp}


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
    sub = p.add_subparsers(dest="cmd", metavar="{tokens,plate,svg,ai,compress}")
    sub.required = True

    t = sub.add_parser("tokens", help="extract an ordered sRGB palette from CSS custom properties")
    t.add_argument("--css", required=True, help="CSS file to read")
    t.add_argument("--selector", default=":root",
                   help="block to read first (default :root; e.g. '@theme inline'). @media blocks are ignored")
    t.add_argument("--map", required=True,
                   help="ordered key=--var list: grounds first, accent (and accentHi) last, e.g. "
                        "ground=--color-bg,ground2=--color-surface,accent=--color-accent")
    t.add_argument("--out", help="also write the JSON to this file")
    t.set_defaults(fn=cmd_tokens)

    pl = sub.add_parser(
        "plate", help="render a raster atmosphere plate to WebP",
        description="Render a decorative plate. Palette rule: the last one or two colours are the "
                    "accent; the rest are grounds, auto-sorted so the base is the page ground - the "
                    "darkest ground on a dark palette, the lightest when the grounds' mean luminance "
                    "is > 0.5 (cream pages). Light palettes get a weaker accent (x0.45) and softer "
                    "structure (x0.6) so dark text over them keeps contrast.")
    src = pl.add_mutually_exclusive_group(required=True)
    src.add_argument("--tokens", help="tokens.json from the tokens subcommand")
    src.add_argument("--palette", help="'#a,#b,#c[,...]' 2-6 colours: grounds then accent last "
                                       "(accent, accentHi)")
    pl.add_argument("--style", required=True, choices=STYLES)
    pl.add_argument("--seed", type=int, required=True)
    pl.add_argument("--size", required=True, help="WxH, e.g. 1600x900")
    pl.add_argument("--out", required=True, help="output .webp path")
    pl.add_argument("--max-kb", type=float, default=DEFAULT_MAX_KB, help="size ceiling (default 30)")
    pl.add_argument("--intensity", type=float, default=0.6, help="accent strength 0..1 (default 0.6)")
    pl.add_argument("--focus", default="0.75,0.3", help="x,y in 0..1 (default 0.75,0.3)")
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
    ai.add_argument("--ledger")
    ai.add_argument("--keep-raw", action="store_true", help="keep the raw PNG next to --out")
    ai.set_defaults(fn=cmd_ai)

    c = sub.add_parser("compress", help="cover-crop + compress a user image to <=max-kb WebP")
    c.add_argument("--in", dest="inp", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--size", required=True, help="WxH")
    c.add_argument("--max-kb", type=float, default=DEFAULT_MAX_KB)
    c.add_argument("--ledger", help="append a JSON line describing this compression")
    c.set_defaults(fn=cmd_compress)
    return p


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
