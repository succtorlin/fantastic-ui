#!/usr/bin/env python3
"""design_md.py - read, check and write a project's DESIGN.md for /fantastic-ui.

DESIGN.md is Google Labs' open format for describing a design system to coding
agents (https://github.com/google-labs-code/design.md, spec version "alpha"):
YAML front matter with tokens (colors, typography, rounded, spacing,
components) followed by markdown sections in a fixed order. When a project has
one, it is the recorded direction: the skill reads it before anything else and
never rewrites it unless the user explicitly asks to replace it
(references/design-md.md).

Subcommands
  find    [--root DIR]                      locate DESIGN.md (any case) at the root, in docs/ or design/
  read    FILE                              tokens, resolved colours, sections and problems as JSON
  drift   FILE --css F [--css F ...] [--map TOKEN=--var ...] [--selector SEL]
                                            compare the file's tokens with the CSS custom properties
  export  --preset L [--name NAME] [--out PATH] [--force]
                                            write a preset as a DESIGN.md (stdout without --out)

Exit codes
  0  ok (drift: every token matches)
  1  parse or spec error (bad front matter, duplicate section, broken reference), unreadable file
  2  command-line usage error (argparse)
  3  find: no DESIGN.md
  5  drift: at least one token differs, is missing from the CSS, or cannot be compared
  6  export: --out exists and --force was not given (the file is never overwritten silently)

Token <-> CSS mapping used by drift (first candidate that exists wins; --map overrides):
  colors.X      --X, --color-X, --colors-X
  rounded.X     --r-X, --radius-X, --rounded-X, --X
  spacing.X     --X, --spacing-X, --space-X
  typography.X  fontFamily vs --display/--font-display (X has display|headline), --mono/--font-mono
                (mono|code|label-mono), else --sans/--font-sans/--font-body
A colour token whose value is a reference ({colors.accent}) follows its target and is not looked up.

`read` and `drift` need PyYAML; `export` needs nothing beyond the standard library.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_atmosphere as ga  # noqa: E402  (CSS parsing and colour conversion; numpy not needed)

SKILL = Path(__file__).resolve().parent.parent
PRESETS_MD = SKILL / "references" / "theme-presets.md"
GATES_JSON = SKILL / "scripts" / "preset-gates.json"

SECTION_ORDER = ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth",
                 "Shapes", "Components", "Do's and Don'ts"]
SECTION_ALIASES = {"brand & style": "Overview", "layout & spacing": "Layout",
                   "elevation": "Elevation & Depth"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "out", "vendor", ".venv", "venv"}
COLOR_START = ("#", "rgb(", "rgba(", "hsl(", "hsla(", "hwb(", "oklch(", "oklab(", "lch(", "lab(",
               "color-mix(")
NAMED_COLORS = {"black", "white", "transparent"}
REF_RE = re.compile(r"^\{([A-Za-z0-9_.-]+)\}$")


class CliError(Exception):
    def __init__(self, msg: str, code: int = 1):
        super().__init__(msg)
        self.code = code


# --------------------------------------------------------------------------
# find
# --------------------------------------------------------------------------

def find_design_md(root: Path) -> List[Path]:
    """Every file named design.md (any case) at the root, or one or two levels
    down, skipping dependency and build folders. Root first, then docs/, then
    the rest, so the usual location sorts first."""
    hits: List[Path] = []
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        depth = len(Path(dirpath).relative_to(root).parts)
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        if depth >= 2:
            dirnames[:] = []
        for f in filenames:
            if f.lower() == "design.md":
                hits.append(Path(dirpath) / f)

    def rank(p: Path) -> Tuple[int, str]:
        rel = p.relative_to(root)
        if len(rel.parts) == 1:
            return (0, str(rel))
        return (1 if rel.parts[0].lower() in ("docs", "design") else 2, str(rel))
    return sorted(hits, key=rank)


# --------------------------------------------------------------------------
# read
# --------------------------------------------------------------------------

def _yaml():
    try:
        import yaml  # type: ignore
    except ImportError as e:  # pragma: no cover - environment dependent
        raise CliError("PyYAML is required to read DESIGN.md: python3 -m pip install pyyaml") from e
    return yaml


def split_front_matter(text: str) -> Tuple[Optional[str], str]:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "".join(lines[1:i]), "".join(lines[i + 1:])
    raise CliError("front matter opens with --- but never closes")


def sections_of(body: str) -> List[str]:
    """`##` headings outside code fences. A fence closes only on the same
    character repeated at least as many times as it opened with."""
    out: List[str] = []
    fence: Optional[Tuple[str, int]] = None
    for line in body.splitlines():
        m = re.match(r"\s{0,3}(`{3,}|~{3,})", line)
        if m:
            mark = m.group(1)
            if fence is None:
                fence = (mark[0], len(mark))
            elif mark[0] == fence[0] and len(mark) >= fence[1] and not line.strip()[len(mark):].strip():
                fence = None
            continue
        if fence is None and line.startswith("## "):
            out.append(re.sub(r"\s+#+\s*$", "", line[3:]).strip())
    return out


def canonical_section(title: str) -> Optional[str]:
    t = title.strip()
    for s in SECTION_ORDER:
        if t.lower() == s.lower():
            return s
    return SECTION_ALIASES.get(t.lower())


def resolve_ref(value, tokens: dict, depth: int = 0):
    """Follow {a.b} references (spec limit: 10 levels)."""
    if not isinstance(value, str):
        return value
    m = REF_RE.match(value.strip())
    if not m:
        return value
    if depth >= 10:
        raise CliError(f"reference chain deeper than 10 at {value}")
    node = tokens
    for part in m.group(1).split("."):
        keyed = {str(k): v for k, v in node.items()} if isinstance(node, dict) else None
        if keyed is None or part not in keyed:
            raise CliError(f"broken reference {value}")
        node = keyed[part]
    return resolve_ref(node, tokens, depth + 1)


def validate_refs(node, tokens: dict, path: str = "") -> None:
    """Resolve every {reference} anywhere in the token tree; the spec rejects a
    file with a broken one, so this raises rather than reporting."""
    if isinstance(node, dict):
        for k, v in node.items():
            validate_refs(v, tokens, f"{path}.{k}" if path else str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            validate_refs(v, tokens, f"{path}[{i}]")
    elif isinstance(node, str) and REF_RE.match(node.strip()):
        try:
            resolve_ref(node, tokens)
        except CliError as e:
            raise CliError(f"{e} (at {path})") from None


def is_color(value) -> bool:
    if not isinstance(value, str):
        return False
    v = value.strip().lower()
    return v.startswith(COLOR_START) or v in NAMED_COLORS


def color_key(value: str) -> Optional[str]:
    """Comparable sRGB form: #rrggbb plus alpha when not opaque; None if the
    colour cannot be computed here (color-mix(), hwb(), lch(), lab())."""
    v = value.strip().lower()
    if v == "transparent":
        return "#00000000"
    alpha = 1.0
    if v.startswith("#") and len(v) in (5, 9):
        alpha = int(v[-1] * 2 if len(v) == 5 else v[-2:], 16) / 255.0
    m = re.fullmatch(r"([a-z]+)\((.*)\)", v, flags=re.S)
    if m:
        body = m.group(2)
        try:
            if "/" in body:
                alpha = _alpha(body.rsplit("/", 1)[1])
            elif m.group(1) in ("rgb", "rgba", "hsl", "hsla") and body.count(",") == 3:
                alpha = _alpha(body.rsplit(",", 1)[1])
        except ValueError:
            return None
    if "var(" in v:
        return None
    try:
        hexv = ga.to_hex(ga.parse_color(v))
    except (ga.CliError, ValueError):
        return None
    return hexv if alpha >= 0.999 else f"{hexv}{int(alpha * 255 + 0.5):02x}"


def _alpha(tok: str) -> float:
    tok = tok.strip()
    return float(tok[:-1]) / 100.0 if tok.endswith("%") else float(tok)


TOKEN_GROUPS = ("colors", "typography", "rounded", "spacing", "components")


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig")       # -sig: a BOM must not hide the front matter
    except (OSError, UnicodeDecodeError) as e:
        raise CliError(f"cannot read {path}: {e}") from None


def load_design(path: Path) -> dict:
    fm, body = split_front_matter(_read_text(path))
    yaml = _yaml()
    try:
        tokens = (yaml.safe_load(fm) or {}) if fm is not None else {}
    except yaml.YAMLError as e:
        raise CliError(f"front matter is not valid YAML: {e}") from None
    if not isinstance(tokens, dict):
        raise CliError("front matter is not a YAML mapping")
    for group in TOKEN_GROUPS:
        if tokens.get(group) is not None and not isinstance(tokens[group], dict):
            raise CliError(f"`{group}` must be a mapping of token names to values")
    for comp, props in (tokens.get("components") or {}).items():
        if props is not None and not isinstance(props, dict):
            raise CliError(f"component `{comp}` must be a mapping of properties")
    validate_refs(tokens, tokens)
    titles = sections_of(body)
    problems, seen = [], set()
    for t in titles:
        c = canonical_section(t)
        key = c or t
        if key in seen:
            raise CliError(f"duplicate section heading: ## {t} (the spec rejects the file)")
        seen.add(key)
    known = [canonical_section(t) for t in titles if canonical_section(t)]
    if known != [s for s in SECTION_ORDER if s in known]:
        problems.append("sections are out of the spec's order")
    if tokens.get("colors") and "primary" not in tokens["colors"]:
        problems.append("no `primary` colour: agents will invent one")
    if not any(tokens.get(g) for g in TOKEN_GROUPS):
        problems.append("no tokens: the file has no front matter, or it defines no "
                        "colors/typography/rounded/spacing/components")
    for name, value in (tokens.get("rounded") or {}).items():
        if isinstance(value, (int, float)) and value != 0:
            problems.append(f"rounded.{name} is unitless ({value}); the spec wants px, em or rem")
    return {"tokens": tokens, "sections": titles, "problems": problems, "body": body}


def summarize(path: Path) -> dict:
    d = load_design(path)
    tok = d["tokens"]
    colors = {}
    for name, value in (tok.get("colors") or {}).items():
        resolved = resolve_ref(value, tok)
        colors[name] = {"value": value, "resolved": resolved,
                        "srgb": color_key(str(resolved)) if is_color(resolved) else None}
    return {
        "path": str(path), "name": tok.get("name"), "version": tok.get("version"),
        "description": tok.get("description"), "colors": colors,
        "typography": tok.get("typography") or {}, "rounded": tok.get("rounded") or {},
        "spacing": tok.get("spacing") or {},
        "components": sorted((tok.get("components") or {}).keys()),
        "sections": d["sections"],
        "missingSections": [s for s in SECTION_ORDER
                            if s not in [canonical_section(t) for t in d["sections"]]],
        "problems": d["problems"],
    }


# --------------------------------------------------------------------------
# drift
# --------------------------------------------------------------------------

def css_definitions(paths: List[Path]) -> Dict[str, List[Tuple[str, str, str]]]:
    """--var -> [(file, selector, raw value)] for every definition outside
    @media/@supports/..., in document order. HTML, Vue, Svelte and Astro files
    contribute their <style> blocks."""
    defs: Dict[str, List[Tuple[str, str, str]]] = {}
    for p in paths:
        text = _read_text(p)
        if p.suffix.lower() in (".html", ".htm", ".vue", ".svelte", ".astro"):
            text = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", text, flags=re.S | re.I))
        for prelude, text, ignored in ga._parse_blocks(text):
            if ignored:
                continue
            for name, value in _decls_last_wins(text).items():
                defs.setdefault(name, []).append((str(p), prelude, value))
    return defs


def _decls_last_wins(text: str) -> Dict[str, str]:
    """Custom properties in one block; a repeated property keeps its LAST value,
    as the cascade does (gen_atmosphere's own reader keeps the first)."""
    props: Dict[str, str] = {}
    for part in ga._split_top(text, ";"):
        if ":" in part:
            name, value = part.split(":", 1)
            if name.strip().startswith("--"):
                props[name.strip()] = value.strip()
    return props


def _candidates(kind: str, name: str, value=None) -> List[str]:
    if kind == "colors":
        return [f"--{name}", f"--color-{name}", f"--colors-{name}"]
    if kind == "rounded":
        return [f"--r-{name}", f"--radius-{name}", f"--rounded-{name}", f"--{name}"]
    if kind == "spacing":
        return [f"--{name}", f"--spacing-{name}", f"--space-{name}"]
    n, v = name.lower(), str(value or "").lower()
    sans = ["--sans", "--font-sans", "--font-body"]
    if "mono" in v or "mono" in n or "code" in n:
        return ["--mono", "--font-mono", "--font-code"]
    if "display" in n or "headline" in n:
        return ["--display", "--font-display", "--font-headline"] + sans
    return sans


def _norm_family(v: str) -> str:
    return ",".join(p.strip().strip("\"'").lower() for p in v.split(","))


def _norm_dim(v) -> str:
    s = str(v).strip().lower()
    return "0" if re.fullmatch(r"0(\.0+)?(px|rem|em)?", s) else s


def _compare(kind: str, design_value, css_value: str) -> str:
    if "var(" in css_value:
        return "uncomparable"      # set at runtime (next/font, a theme script): check in the browser
    if kind == "colors":
        a, b = color_key(str(design_value)), color_key(css_value)
        if a is None or b is None:
            same = " ".join(str(design_value).lower().split()) == " ".join(css_value.lower().split())
            return "match" if same else "uncomparable"
        return "match" if a == b else "differs"
    if kind == "typography":
        return "match" if _norm_family(str(design_value)) == _norm_family(css_value) else "differs"
    return "match" if _norm_dim(design_value) == _norm_dim(css_value) else "differs"


def drift(design: Path, css_paths: List[Path], mapping: Dict[str, str],
          selector: Optional[str]) -> dict:
    d = load_design(design)
    tok = d["tokens"]
    if not any(tok.get(g) for g in ("colors", "typography", "rounded", "spacing")):
        raise CliError(f"{design} has no tokens to compare (no front matter, or no "
                       "colors/typography/rounded/spacing)")
    defs = css_definitions(css_paths)
    norm = lambda x: " ".join(x.split()).lower()  # noqa: E731
    want = {norm(x) for x in ga._split_top(selector, ",")} if selector else None

    def in_scope(row) -> bool:
        return want is None or bool(want & {norm(x) for x in ga._split_top(row[1], ",")})
    # var() chains resolve inside the selected block first, then anywhere.
    lookup = {k: v[0][2] for k, v in defs.items()}
    if want:
        lookup.update({k: rows[0][2] for k, v in defs.items()
                       for rows in [[r for r in v if in_scope(r)]] if rows})

    def css_value(var: str, kind: str = "") -> Optional[Tuple[str, str, int]]:
        rows = [r for r in defs.get(var) or [] if in_scope(r)]
        if kind in ("rounded", "spacing"):
            rows = [r for r in rows if not is_color(_safe_resolve(r[2], lookup))]
        if not rows:
            return None
        raw = rows[0][2]
        try:
            raw = ga.resolve_var(raw, lookup)
        except ga.CliError:
            pass
        return raw, rows[0][1], len(defs.get(var, [])) - 1

    results, matched_vars = [], set()
    for kind in ("colors", "typography", "rounded", "spacing"):
        for name, value in (tok.get(kind) or {}).items():
            token = f"{kind}.{name}"
            if kind == "typography":
                value = (value or {}).get("fontFamily") if isinstance(value, dict) else None
                if value is None:
                    continue
            if kind == "colors" and isinstance(value, str) and REF_RE.match(value.strip()):
                results.append({"token": token, "design": value, "status": "follows",
                                "note": "a reference; checked through its target"})
                continue
            value = resolve_ref(value, tok)
            cands = [mapping[token]] if token in mapping else _candidates(kind, name, value)
            hit = next(((c, css_value(c, kind)) for c in cands
                        if css_value(c, kind) is not None), None)
            if hit is None:
                row = {"token": token, "design": value, "tried": cands,
                       "status": "missing-in-css" if kind in ("colors", "typography")
                       else "not-in-css"}
                if kind == "colors":
                    row["suggest"] = _suggest(name, str(value), defs, lookup)
                results.append(row)
                continue
            var, (raw, sel, variants) = hit
            matched_vars.add(var)
            results.append({"token": token, "design": value, "cssVar": var, "css": raw,
                            "selector": sel, "otherDefinitions": variants,
                            "status": _compare(kind, value, raw)})
    css_only = sorted(v for v, rows in defs.items()
                      if v not in matched_vars and is_color(_safe_resolve(rows[0][2], lookup)))
    counts: Dict[str, int] = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return {"design": str(design), "css": [str(p) for p in css_paths], "results": results,
            "summary": counts, "cssOnlyColors": css_only,
            "drift": any(r["status"] in ("differs", "missing-in-css", "uncomparable")
                         for r in results)}


def _oklab(value: str) -> Optional[Tuple[float, float, float]]:
    if "var(" in value:
        return None
    try:
        rgb = ga.parse_color(value)
    except (ga.CliError, ValueError):
        return None
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    l_ = (0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]) ** (1 / 3)
    m_ = (0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]) ** (1 / 3)
    s_ = (0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]) ** (1 / 3)
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


NEAR_DE = 0.03     # OKLab distance: below this the two colours read as the same role


_TEXT_ROLE = re.compile(r"(^|-)(text|ink|fg|foreground|on)(-|$)")
_SURFACE_ROLE = re.compile(r"(^|-)(surface|bg|background|ground|panel|paper|well|sheet|stage)(-|$)")


def _role(name: str) -> Optional[str]:
    n = name.lower().lstrip("-")
    if _TEXT_ROLE.search(n):
        return "text"
    if _SURFACE_ROLE.search(n):
        return "surface"
    return None


def _suggest(token: str, value: str, defs: Dict[str, List[Tuple[str, str, str]]],
             lookup: Dict[str, str]) -> List[dict]:
    """CSS colour variables whose value equals (or nearly equals) a token the
    CSS does not name: the likely rename, offered as a --map to confirm. Every
    definition counts (a light-theme block included), and a text token is never
    matched to a surface variable or the reverse, however close the colours."""
    want = _oklab(value)
    if want is None:
        return []
    mine, best = _role(token), {}
    for var, rows in defs.items():
        theirs = _role(var)
        if mine and theirs and mine != theirs:
            continue
        for _file, sel, raw in rows:
            raw = _safe_resolve(raw, lookup)
            got = _oklab(raw) if is_color(raw) else None
            if got is None:
                continue
            de = sum((x - y) ** 2 for x, y in zip(want, got)) ** 0.5
            if de < NEAR_DE and (var not in best or de < best[var]["deltaE"]):
                best[var] = {"cssVar": var, "selector": sel, "css": raw, "deltaE": round(de, 4),
                             "kind": "same" if de < 0.002 else "near"}
    return sorted(best.values(), key=lambda r: r["deltaE"])[:3]


def _safe_resolve(raw: str, lookup: Dict[str, str]) -> str:
    try:
        return ga.resolve_var(raw, lookup)
    except ga.CliError:
        return raw


# --------------------------------------------------------------------------
# export
# --------------------------------------------------------------------------

def _preset_section(letter: str) -> Tuple[str, str]:
    text = PRESETS_MD.read_text(encoding="utf-8")
    m = re.search(rf'^## Preset {re.escape(letter)} — "([^"]+)"\n(.*?)(?=^## |\Z)', text,
                  flags=re.S | re.M)
    if not m:
        raise CliError(f"no preset {letter!r} in theme-presets.md")
    return m.group(1), m.group(2)


def _token_lines(block: str) -> List[Tuple[str, str, str]]:
    """(name without --, value, trailing comment) from the preset's CSS block;
    a value may span lines (box-shadow lists)."""
    notes = {m.group(1): " ".join(m.group(2).split())
             for m in re.finditer(r"--([\w-]+)\s*:[^;{}]*;[ \t]*/\*(.*?)\*/", block, flags=re.S)}
    code = re.sub(r"/\*.*?\*/", " ", block, flags=re.S)       # commented-out tokens are not tokens
    out = []
    for m in re.finditer(r"--([\w-]+)\s*:\s*([^;{}]+?)\s*(?:;|(?=\}|$))", code):
        out.append((m.group(1), " ".join(m.group(2).split()), notes.get(m.group(1), "")))
    return out


def _q(s) -> str:
    """A YAML scalar: numbers bare, everything else as a JSON (= YAML double-quoted) string."""
    return str(s) if isinstance(s, (int, float)) else json.dumps(str(s), ensure_ascii=False)


AA_TEXT = 4.5


def contrast(fg: str, bg: str) -> float:
    """WCAG ratio; a translucent text colour is composited over the background
    first. Raises ga.CliError when either colour cannot be computed here."""
    def rgba(v: str):
        key = color_key(v)
        if key is None:
            raise ga.CliError(f"cannot measure {v!r}")
        rgb = ga.parse_color(key[:7])
        return rgb, (int(key[7:9], 16) / 255.0 if len(key) == 9 else 1.0)
    (f, fa), (b, _ba) = rgba(fg), rgba(bg)
    f = tuple(fa * x + (1 - fa) * y for x, y in zip(f, b))
    la, lb = ga.rel_luminance(f), ga.rel_luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _components(colors: Dict[str, str], radii: Dict[str, str], primary: str
                ) -> Tuple[Dict[str, dict], List[Tuple[str, str, float]]]:
    """Text/surface pairs the linter can measure, built only from roles that
    exist and only when the pair reaches 4.5:1. A pair below that is not a
    component: it is returned as (text, surface, ratio) for Do's and Don'ts,
    because the presets keep such tokens for large text and marks on purpose.
    The reading surface is --panel when the preset sits a sheet on a backdrop
    (r-sheet > 0), else --ground."""
    c = lambda n: f"{{colors.{n}}}"  # noqa: E731
    has = colors.__contains__
    comps: Dict[str, dict] = {}
    failing: List[Tuple[str, str, float]] = []
    sheet = _norm_dim(radii.get("sheet", "0")) != "0"
    read = "panel" if sheet and has("panel") else "ground"

    def add(name, bg=None, fg=None, **extra):
        if (bg and not has(bg)) or (fg and not has(fg)):
            return
        if bg and fg:
            try:
                r = contrast(colors[fg], colors[bg])
            except ga.CliError:
                r = 0.0                    # unmeasurable here: never emitted as a passing pair
            if r < AA_TEXT:
                failing.append((fg, bg, r))
                return
        entry = {}
        if bg:
            entry["backgroundColor"] = c(bg)
        if fg:
            entry["textColor"] = c(fg)
        entry.update(extra)
        comps[name] = entry
    if sheet:
        add("backdrop", "ground")
    add("page", read, "ink")
    add("page-secondary-text", read, "ink-2")
    add("caption", read, "muted")
    add("section", "ground-2", "ink")
    if read != "panel":
        add("card", "panel", "ink", **({"rounded": "{rounded.card}"} if "card" in radii else {}))
    add("well", "panel-2", "ink")
    text_accent = "accent-ink" if has("accent-ink") else "accent"
    add("link", read, text_accent)
    fill = "accent-fill" if has("accent-fill") else "accent"
    if has("on-accent"):
        add("button-primary", fill, "on-accent",
            **({"rounded": "{rounded.pill}"} if "pill" in radii else {}))
    elif has("accent-ink"):
        add("accent-surface", "accent", "ink")
    add("inverse", "invert", "ink-on-invert")
    add("inverse-secondary-text", "invert", "ink-2-on-invert")
    if has("invert") and not has("ink-on-invert"):
        add("inverse-band", "invert")      # a dark band that carries cards, not text
    add("stage", "stage", "stage-ink")
    add("stage-secondary-text", "stage", "stage-ink-2")
    add("stage-caption", "stage", "stage-muted")
    add("stage-link", "stage", "stage-accent")
    add("stage-tile", "stage-2", "stage-ink")
    add("signal-up", read, "up")
    add("signal-down", read, "down")
    add("divider", "hair")
    add("divider-strong", "hair-lit")
    add("selection", "accent-dim")
    add("watermark", None, "watermark")
    add("grid-texture", "grid")
    used = json.dumps(comps)
    if has("accent") and "{colors.accent}" not in used:
        add("accent-mark", "accent")
    # A token that only fails as body text is still a real token: record its
    # one sanctioned use (no surface given, so it is not measured as body text).
    for fg in dict.fromkeys(f for f, _, _ in failing):
        if f"{{colors.{fg}}}" not in json.dumps(comps):
            add(f"{fg}-large-text", None, fg)
    return comps, failing


def _unlink(text: str) -> str:
    """[label](target) -> label: links into the skill's own files mean nothing in a project."""
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)


def _prose(section: str) -> dict:
    section = _unlink(section)
    blockquote = " ".join(l.lstrip("> ").strip() for l in section.splitlines()
                          if l.startswith(">")).strip()
    after = section.split("```css")[0]
    paras = [p.strip() for p in re.split(r"\n\s*\n", after) if p.strip()
             and not p.strip().startswith(">")]
    imagery = re.search(r"^\*\*Imagery\.\*\*\s*(.*?)(?:\n\s*\n|\Z)", section, flags=re.S | re.M)
    grammar = re.search(r"^### Component grammar\n(.*?)(?=^### |^---|\Z)", section,
                        flags=re.S | re.M)
    traps = [m.group(0).strip() for m in re.finditer(
        r"^\*\*(?!Imagery)[^*\n]+\*\*.*?(?=\n\s*\n|\Z)", section.split("### Component grammar")[0],
        flags=re.S | re.M)]
    return {"blockquote": blockquote, "lead": paras[0] if paras else "",
            "imagery": " ".join(imagery.group(1).split()) if imagery else "",
            "grammar": grammar.group(1).strip() if grammar else "", "traps": traps}


SEPARATION_PROSE = {
    "tone": "Depth comes from tone alone. Bands and tiles are a step lighter or darker than "
            "what surrounds them; there are no shadows and no borders on tiles.",
    "hairline": "Surfaces are separated by 1px hairlines (`hair`, `hair-lit`) and steps of the "
                "ground scale, not by shadows.",
    "rule": "Structure comes from rules: horizontal lines between sections and rows, as on a "
            "printed report. No shadows.",
    "shadow": "Raised surfaces carry the soft `lift` shadows below; everything else is flat.",
    "flat": "Flat colour fields do the separating: no shadows, and hairlines only where a "
            "field boundary would otherwise be lost.",
}


def export(letter: str, name: Optional[str]) -> str:
    title, section = _preset_section(letter)
    gates = json.loads(GATES_JSON.read_text(encoding="utf-8"))["presets"][letter]
    block = re.search(r"```css\n(.*?)```", section, flags=re.S).group(1)
    toks = _token_lines(block)
    colors = {n: v for n, v, _ in toks if is_color(v)}
    notes = {n: c for n, _, c in toks}
    fonts = {n: v for n, v, _ in toks if n in ("sans", "display", "mono")}
    radii = {n[2:]: v for n, v, _ in toks if n.startswith("r-")}
    dims = {n: v for n, v, _ in toks
            if re.fullmatch(r"-?[\d.]+(px|rem|em)", v) and not n.startswith("r-")}
    shadows = {n: v for n, v, _ in toks if n.startswith("lift")}
    primary = "accent-ink" if "accent-ink" in colors else ("accent" if "accent" in colors else "ink")
    p = _prose(section)

    y = ["---", "version: alpha", f"name: {_q(name or title)}",
         f"description: {_q(p['blockquote'] or title)}", "colors:",
         f"  primary: {_q('{colors.' + primary + '}')}"]
    y += [f"  {n}: {_q(v)}" for n, v in colors.items()]
    y.append("typography:")
    for key, var in (("headline-display", "display"), ("body-md", "sans"), ("label-mono", "mono")):
        if var in fonts:
            y += [f"  {key}:", f"    fontFamily: {_q(fonts[var])}"]
    if radii:
        y.append("rounded:")
        y += [f"  {n}: {_q(v)}" for n, v in radii.items()]
    if dims:
        y.append("spacing:")
        y += [f"  {n}: {_q(v)}" for n, v in dims.items()]
    comps, failing = _components(colors, radii, primary)
    if comps:
        y.append("components:")
        for cn, props in comps.items():
            y.append(f"  {cn}:")
            y += [f"    {k}: {_q(v)}" for k, v in props.items()]
    y.append("---")

    md = [f"# {name or title}", "",
          "## Overview", "", p["blockquote"], "", p["lead"], "",
          f"Density: **{gates['density']}**. Separation: **{gates['separation']}**. "
          f"Exported from fantastic-ui Preset {letter} \"{title}\". Each token `x` here is the "
          f"CSS custom property `--x` in the stylesheet (rounded `x` is `--r-x`).", "",
          "## Colors", ""]
    for n, v in colors.items():
        md.append(f"- **{n} ({v}):** {notes[n]}" if notes.get(n)
                  else f"- **{n} ({v})**")
    md.append(f"- **primary** points to `{primary}`: the colour for the single most important "
              f"action or highlight.")
    md += ["", "## Typography", ""]
    for key, var in (("headline-display", "display"), ("body-md", "sans"), ("label-mono", "mono")):
        if var in fonts:
            md.append(f"- **{key}** (`--{var}`): {fonts[var]}")
    md += ["", "Sizes, weights and tracking per element are in the component grammar below.", "",
           "## Layout", ""]
    md += [f"- **{n}:** {v}" + (f" ({notes[n]})" if notes.get(n) else "") for n, v in dims.items()]
    md += [f"- Density is {gates['density']}.", "", "## Elevation & Depth", "",
           SEPARATION_PROSE.get(gates["separation"], "")]
    md += [f"- **{n}:** `{v}`" for n, v in shadows.items()]
    md += ["", "## Shapes", ""]
    md += [f"- **{n}:** {v}" + (f" ({notes['r-' + n]})" if notes.get("r-" + n) else "")
           for n, v in radii.items()]
    md += ["", "## Components", "", p["grammar"], "", "## Do's and Don'ts", ""]
    md += [f"- Don't break this rule: {t['rule']}" for t in gates.get("traps", [])]
    md += [f"- {' '.join(t.split())}" for t in p["traps"]]
    for fg, bg, r in failing:
        md.append(f"- Don't set `{fg}` as body text on `{bg}`: {r:.2f}:1. It is for large text "
                  f"(24px, or 18.66px bold) and non-text marks only.")
    md.append("- Do keep every text pair at WCAG AA: 4.5:1, or 3:1 for large text and UI marks.")
    if p["imagery"]:
        md.append(f"- Imagery: {p['imagery']}")
    md.append("")
    return "\n".join(y) + "\n\n" + "\n".join(md)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def write_new(out: Path, text: str, force: bool) -> None:
    """Never overwrite without force: exclusive create (no check-then-write
    race). With force, write a temp file beside it and swap it in atomically,
    so a failed write cannot leave a truncated DESIGN.md."""
    if not force:
        try:
            with open(out, "x", encoding="utf-8") as fh:
                fh.write(text)
        except FileExistsError:
            raise CliError(f"{out} exists; DESIGN.md is replaced only on an explicit request "
                           "(write elsewhere, show the diff, then pass --force)", 6) from None
        return
    if out.is_dir():
        raise CliError(f"{out} is a directory")
    tmp = out.with_name(f".{out.name}.tmp-{os.getpid()}")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, out)
    finally:
        if tmp.exists():
            tmp.unlink()


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("find")
    f.add_argument("--root", default=".")
    r = sub.add_parser("read")
    r.add_argument("file")
    d = sub.add_parser("drift")
    d.add_argument("file")
    d.add_argument("--css", action="append", required=True)
    d.add_argument("--map", action="append", default=[], help="TOKEN=--var, e.g. colors.brand=--accent")
    d.add_argument("--selector", help="compare against this block only, e.g. ':root' or '.page'")
    e = sub.add_parser("export")
    e.add_argument("--preset", required=True)
    e.add_argument("--name")
    e.add_argument("--out")
    e.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    try:
        if a.cmd == "find":
            if not Path(a.root).is_dir():
                raise CliError(f"--root {a.root} is not a directory")
            hits = find_design_md(Path(a.root))
            print(json.dumps({"root": str(Path(a.root).resolve()), "found": [str(h) for h in hits],
                              "primary": str(hits[0]) if hits else None}, indent=2))
            return 0 if hits else 3
        if a.cmd == "read":
            print(json.dumps(summarize(Path(a.file)), indent=2, ensure_ascii=False, default=str))
            return 0
        if a.cmd == "drift":
            mapping = {}
            for m in a.map:
                k, _, v = m.partition("=")
                if not k or not v.startswith("--"):
                    raise CliError(f"--map wants TOKEN=--var, got {m!r}")
                mapping[k] = v
            rep = drift(Path(a.file), [Path(c) for c in a.css], mapping, a.selector)
            print(json.dumps(rep, indent=2, ensure_ascii=False, default=str))
            return 5 if rep["drift"] else 0
        if a.cmd == "export":
            text = export(a.preset.upper(), a.name)
            if not a.out:
                sys.stdout.write(text)
                return 0
            write_new(Path(a.out), text, a.force)
            print(json.dumps({"out": str(Path(a.out)), "preset": a.preset.upper(), "bytes": len(text)}))
            return 0
    except OSError as err:
        print(json.dumps({"error": f"{type(err).__name__}: {err}"}), file=sys.stderr)
        return 1
    except (CliError, ga.CliError) as err:
        code = getattr(err, "code", 1)
        print(json.dumps({"error": str(err)}), file=sys.stderr)
        return code if isinstance(code, int) else 1
    return 1


if __name__ == "__main__":
    sys.exit(main())
