#!/usr/bin/env node
/**
 * direction-samples.mjs — render 2–3 candidate directions as sample pages and a
 * side-by-side comparison sheet, so the user picks a look by seeing it.
 *
 *   node direction-samples.mjs design-samples.json
 *   node direction-samples.mjs design-samples.json --playwright /path/to/node_modules
 *   node direction-samples.mjs design-samples.json --no-shots
 *
 * Procedure and manifest format: references/direction-samples.md.
 * Writes <out>/<id>.html per direction, <out>/index.html (the sheet) and, when
 * Playwright resolves, <out>/shots/<id>-desktop.png + <id>-phone.png.
 * Exit 0 on success (contrast flags are printed, not fatal), 2 on bad input.
 * Zero dependencies; Playwright is optional and only used for screenshots.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..");
const PRESETS_MD = join(SKILL, "references", "theme-presets.md");
const SAMPLE_CSS = join(SKILL, "templates", "direction-sample", "sample.css");
const GEN = join(SKILL, "scripts", "gen_atmosphere.py");

export class InputError extends Error {}

// ---------- tokens ----------
export function presetBlock(letter, text = readFileSync(PRESETS_MD, "utf8")) {
  if (!/^[A-L]$/.test(String(letter))) throw new InputError(`preset must be a letter A–L, got "${letter}"`);
  const re = new RegExp(`^## Preset ${letter} — "([^"]+)"\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m");
  const m = text.match(re);
  if (!m) throw new InputError(`no preset ${letter} in theme-presets.md`);
  const css = m[2].match(/```css\n([\s\S]*?)```/);
  if (!css) throw new InputError(`preset ${letter} has no css block`);
  return { name: m[1], decls: innerDecls(css[1]) };
}

/** The declarations of the FIRST top-level rule only. A token file that also
    carries a dark-mode block or media queries would otherwise leak its second
    block into the sample (and into the contrast numbers); `extra` reports it. */
export function firstBlock(css) {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const open = s.indexOf("{");
  if (open < 0) return { decls: s.trim(), extra: false };
  let depth = 0, close = -1;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) { close = i; break; }
  }
  if (close < 0) throw new InputError("unbalanced braces in the token block");
  const inner = s.slice(open + 1, close);
  if (inner.includes("{")) throw new InputError("the first token rule contains nested blocks; give a flat rule of custom properties");
  return { decls: inner.trim(), extra: /\{/.test(s.slice(close + 1)) };
}
export const innerDecls = (css) => firstBlock(css).decls;

export function parseTokens(decls) {
  const map = {};
  for (const m of decls.matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) map[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return map;
}

export function resolveVar(value, map, depth = 0) {
  if (value == null || depth > 8) return value;
  const m = value.match(/^var\(\s*--([\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (!m) return value;
  return map[m[1]] != null ? resolveVar(map[m[1]], map, depth + 1) : resolveVar(m[2], map, depth + 1);
}

// ---------- colour ----------
export function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a };
  }
  const alpha = (x) => (x == null ? 1 : x.endsWith("%") ? parseFloat(x) / 100 : parseFloat(x));
  m = v.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alpha(m[4]) };
  m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const h = (+m[1] % 360) / 360, s = +m[2] / 100, l = +m[3] / 100;
    const k = (n) => (n + h * 12) % 12, a2 = s * Math.min(l, 1 - l);
    const ch = (n) => 255 * (l - a2 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    return { r: ch(0), g: ch(8), b: ch(4), a: alpha(m[4]) };
  }
  m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const L = m[2] ? +m[1] / 100 : +m[1], C = +m[3], H = (+m[4] * Math.PI) / 180;
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s2 = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const enc = (x) => 255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
    return {
      r: enc(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s2),
      g: enc(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s2),
      b: enc(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s2),
      a: alpha(m[5]),
    };
  }
  const named = { white: [255, 255, 255], black: [0, 0, 0] };
  if (named[v]) { const [r, g, b] = named[v]; return { r, g, b, a: 1 }; }
  return null;
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(fg, bg) {
  const f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return null;
  const mix = { r: f.a * f.r + (1 - f.a) * b.r, g: f.a * f.g + (1 - f.a) * b.g, b: f.a * f.b + (1 - f.a) * b.b };
  const [x, y] = [lum(mix), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Pick the token that reads best on `bg`, preferring the first that clears `min`. */
export function bestInk(bg, names, map, min = 4.5) {
  let best = null;
  for (const n of names) {
    const v = resolveVar(map[n], map);
    const r = contrast(v, bg);
    if (r == null) continue;
    if (r >= min) return { name: n, ratio: r };
    if (!best || r > best.ratio) best = { name: n, ratio: r };
  }
  return best;
}

const GATES_JSON = join(SKILL, "scripts", "preset-gates.json");
/** Presets whose gates declare a measured white-on-accent exception (`whiteOnAccent: "declared"`, Preset L). */
function whiteOnAccentAllowed(letter) {
  if (!letter) return false;
  try {
    return JSON.parse(readFileSync(GATES_JSON, "utf8")).presets?.[letter]?.whiteOnAccent === "declared";
  } catch { return false; }
}
const isWhite = (v) => { const c = parseColor(v); return !!c && c.r > 250 && c.g > 250 && c.b > 250; };

export function derive(map, presetLetter) {
  const tok = (n) => resolveVar(map[n], map);
  const sheet = !!(map["r-sheet"] && !/^0(px)?$/.test(map["r-sheet"].trim()));
  const surface = sheet ? "panel" : "ground";
  // White is never the accent's partner (theme-presets.md, universal trap),
  // except where a preset's gates declare the measured exception. When only
  // white reads on the accent, the button takes the preset's inverted fill.
  let ctaBgName = ["accent-fill", "accent", "ink"].find((n) => map[n] != null) || "ink";
  const inkNames = ["on-accent", "ink-on-invert", "panel", "ground", "ink"];
  const allowWhite = ctaBgName === "ink" || whiteOnAccentAllowed(presetLetter);
  const usable = (bg) => inkNames.filter((n) => allowWhite || !isWhite(resolveVar(map[n], map)));
  let ctaInk = bestInk(tok(ctaBgName), usable(ctaBgName), map);
  // Only switch when the accent is measurable and nothing but white reads on it;
  // an unmeasurable accent keeps its role and is flagged instead.
  if (!allowWhite && parseColor(tok(ctaBgName)) && (!ctaInk || ctaInk.ratio < 4.5)) {
    const alt = ["invert", "ink"].find((n) => map[n] != null && n !== ctaBgName);
    if (alt) { ctaBgName = alt; ctaInk = bestInk(tok(alt), ["ink-on-invert", "panel", "ground", "on-accent", "ink"], map); }
  }
  const eyebrow = bestInk(tok(surface), ["accent-ink", "accent", "ink-2"], map);
  // Focus ring: a UI component, so 3:1 against the surface it sits on (1.4.11).
  const focus = bestInk(tok(surface), ["accent-ink", "accent", "ink"], map, 3);
  const sep = map.lift || map["lift-1"] ? "shadow" : presetLetter === "L" ? "tone" : "hairline";
  // Every text/surface pair the sample actually paints. null = not measurable
  // (a token missing or in a colour syntax this script cannot read): flagged.
  const checks = [
    ["body ink", contrast(tok("ink"), tok(surface)), 4.5],
    ["secondary ink", contrast(tok("ink-2"), tok(surface)), 4.5],
    ["section text", contrast(tok("ink-2"), tok("ground-2")), 4.5],
    ["card text", contrast(tok("ink-2"), tok("panel")), 4.5],
    ["button text", ctaInk?.ratio ?? null, 4.5],
    ["eyebrow", eyebrow?.ratio ?? null, 4.5],
    ["focus ring", focus?.ratio ?? null, 3],
  ];
  return { sheet, surface, ctaBgName, ctaInkName: ctaInk?.name, eyebrowName: eyebrow?.name, focusName: focus?.name, sep, checks };
}

// ---------- html ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** A row's [title, body, meta]; a bare meta number borrows its column name
    ("38" under "Left" reads "38 left"), so cards and lists never show an
    unlabelled figure. */
function rowParts(it, columns = []) {
  const [h, p, meta] = Array.isArray(it) ? it : [it.title, it.body, it.meta];
  const label = columns[2] && meta != null && /^[\d.,:%£$€¥+-]+$/.test(String(meta).trim())
    ? `${meta} ${String(columns[2]).toLowerCase()}` : meta;
  return [h, p, label];
}

function sectionHtml(kind, section) {
  const title = `<h2>${esc(section.title || "")}</h2>`;
  if (kind === "cards") {
    const items = (section.items || section.rows || []).slice(0, 5);
    return title + `<div class="cards">${items.map((it) => {
      const [h, p, meta] = rowParts(it, section.columns);
      return `<article class="card"><h3>${esc(h)}</h3>${p ? `<p>${esc(p)}</p>` : ""}${meta ? `<span class="meta">${esc(meta)}</span>` : ""}</article>`;
    }).join("")}</div>`;
  }
  if (kind === "list") {
    const items = (section.items || section.rows || []).slice(0, 6);
    return title + `<ol class="list">${items.map((it, i) => {
      const [h, p, meta] = rowParts(it, section.columns);
      return `<li><span class="idx">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(h)}</strong>${p ? `<br><span>${esc(p)}</span>` : ""}</div>${meta ? `<span class="meta">${esc(meta)}</span>` : ""}</li>`;
    }).join("")}</ol>`;
  }
  const head = section.columns || [];
  const rows = (section.rows || []).slice(0, 8).map((r) => (Array.isArray(r) ? r : [r.title, r.body, r.meta]));
  // Only number columns are mono and right-aligned; prose stays in the body face.
  const numeric = (head.length ? head : rows[0] || []).map((_, i) => i > 0 && rows.length > 0 && rows.every((r) => /^[\d.,:%£$€¥+\-\s]+$/.test(String(r[i] ?? "").trim())));
  const cls = (i) => (numeric[i] ? ' class="num"' : "");
  return title + `<div class="table-wrap"><table class="table">${head.length ? `<thead><tr>${head.map((h, i) => `<th scope="col"${cls(i)}>${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function sampleHtml(manifest, dir, decls, d) {
  const c = manifest.content;
  const hero = dir.hero || "split";
  const proofKind = dir.proof || (hero === "split" ? "stats" : "image");
  const stats = (c.stats || []).slice(0, 3);
  const statsHtml = stats.length ? `<div class="proof stats panel">${stats.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>` : "";
  const plate = (kind) => dir.plates?.[kind];
  const slot = (cls) => {
    const p = plate(cls === "band" ? "band" : "panel");
    const img = p ? `<img src="${esc(p.src)}" alt="" width="${p.w}" height="${p.h}">` : "";
    // The caption says what is shown, not what was asked for.
    const caption = p ? `${p.style} plate from the tokens · stands in for: ${dir.imagery || "atmosphere"}` : `imagery slot · ${dir.imagery || "atmosphere"}`;
    return `<figure class="slot panel ${cls}" aria-hidden="true">${img}<figcaption>${esc(caption)}</figcaption></figure>`;
  };
  const copy = `<div>${c.eyebrow ? `<p class="eyebrow">${esc(c.eyebrow)}</p>` : ""}<h1 class="headline">${esc(c.headline)}</h1>${c.sub ? `<p class="sub">${esc(c.sub)}</p>` : ""}<div class="actions"><a class="btn btn--primary" href="#">${esc(c.cta || "Get started")}</a>${c.secondary ? `<a class="btn btn--ghost" href="#">${esc(c.secondary)}</a>` : ""}</div></div>`;
  let heroInner;
  if (hero === "split") heroInner = copy + (proofKind === "image" ? slot("") : statsHtml || slot(""));
  else heroInner = copy + slot("band") + (proofKind === "stats" || stats.length ? statsHtml : "");
  const kind = dir.section || c.section?.kind || "table";
  const vars = `--s-cta-bg: var(--${d.ctaBgName}); --s-cta-ink: var(--${d.ctaInkName || "ink"}); --s-eyebrow: var(--${d.eyebrowName || "ink-2"}); --s-focus: var(--${d.focusName || "ink"}); --s-surface: var(--${d.surface});`;
  return `<!doctype html>
<html lang="${esc(manifest.lang || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.brand)} · ${esc(dir.name)} (sample)</title>
${dir.preset ? `<meta name="fui-preset" content="${esc(dir.preset)}">\n` : ""}
<link rel="stylesheet" href="sample.css">
<style>
.page { ${decls} }
.page { ${vars} }
</style>
</head>
<body>
<div class="page" data-sep="${esc(dir.separation || d.sep)}"${d.sheet ? " data-sheet" : ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="sheet">
<header class="wrap nav"><span class="brand">${esc(c.brand)}</span><nav aria-label="Main"><ul>${(c.nav || []).slice(0, 4).map((n) => `<li><a href="#">${esc(n)}</a></li>`).join("")}</ul></nav><a class="btn btn--primary" href="#">${esc(c.navCta || c.cta || "Start")}</a></header>
<main id="main">
<section class="hero hero--${esc(hero)}"><div class="wrap">${heroInner}</div></section>
${c.section ? `<section class="section"><div class="wrap">${sectionHtml(kind, c.section)}</div></section>` : ""}
</main>
<footer class="wrap foot">${esc(c.footer || c.brand)}</footer>
</div>
</div>
</body>
</html>
`;
}

export function contrastFlags(checks) {
  return checks.filter(([, r, min = 4.5]) => r == null || r < min)
    .map(([n, r, min = 4.5]) => (r == null ? `${n} not measurable` : `${n} ${r.toFixed(2)}:1 (needs ${min}:1)`));
}

export function sheetHtml(manifest, rows, haveShots) {
  // The recommendation is presented first, as SKILL.md asks.
  const ordered = [...rows].sort((a, b) => (b.dir.id === manifest.recommended) - (a.dir.id === manifest.recommended));
  const cards = ordered.map(({ dir, d }) => {
    const rec = dir.id === manifest.recommended;
    const flags = contrastFlags(d.checks);
    const id = esc(dir.id);
    const visual = haveShots
      ? `<a href="shots/${id}-desktop-full.png" title="Full page"><img src="shots/${id}-desktop.png" alt="${esc(dir.name)}, first screen at 1440 px"></a><a href="shots/${id}-phone.png" title="Phone, full page"><img src="shots/${id}-phone.png" alt="${esc(dir.name)} at 390 px"></a>`
      : `<iframe src="${id}.html" title="${esc(dir.name)} sample" loading="lazy"></iframe>`;
    return `<article class="cand${rec ? " rec" : ""}" id="cand-${id}">
<header><h2>${esc(dir.name)}${dir.preset ? ` <small>Preset ${esc(dir.preset)}</small>` : " <small>fresh direction</small>"}</h2>${rec ? `<span class="badge">Recommended</span>` : ""}</header>
<div class="shots">${visual}</div>
<p><b>Why:</b> ${esc(dir.why || "")}</p>
<p><b>Gives up:</b> ${esc(dir.tradeoff || "")}</p>
${flags.length ? `<p class="flag">Below WCAG AA: ${esc(flags.join(", "))}</p>` : ""}
<p class="checks" data-page="${id}.html">Gates: not checked yet (run check-samples.mjs)</p>
<p><a href="${id}.html">Open the live sample</a>${haveShots ? ` · <a href="shots/${id}-desktop-full.png">full-page shot</a>` : ""}</p>
</article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="${esc(manifest.lang || "en")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Direction samples · ${esc(manifest.title || manifest.content.brand)}</title>
<style>
:root { --bg: #f4f4f2; --card: #ffffff; --ink: #18181a; --ink-2: #55565b; --hair: #dddcd7; --rec: #1f5fbf; --flag: #9a2a1f; }
@media (prefers-color-scheme: dark) { :root { --bg: #141416; --card: #1d1d20; --ink: #ededee; --ink-2: #a6a7ad; --hair: #34343a; --rec: #7fb0ff; --flag: #ff9a8a; } }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1600px;margin:0 auto;padding:32px 24px 64px} h1{font-size:26px;margin:0 0 6px} .lede{color:var(--ink-2);margin:0 0 28px;max-width:70ch}
.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
@media (min-width:1100px){.grid{grid-template-columns:repeat(${rows.length},minmax(0,1fr))}}
.cand{background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:18px}
.cand.rec{border:2px solid var(--rec)} .cand header{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.cand h2{font-size:19px;margin:0} .cand small{font-weight:500;color:var(--ink-2);font-size:13px}
.badge{font:600 12px/1 ui-monospace,Menlo,monospace;color:var(--rec);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.shots{display:grid;grid-template-columns:minmax(0,1fr) 26%;gap:10px;align-items:start;margin:14px 0}
.shots img{width:100%;height:auto;border:1px solid var(--hair);border-radius:6px;display:block}
.shots iframe{grid-column:1/-1;width:100%;height:560px;border:1px solid var(--hair);border-radius:6px;background:var(--card)}
.cand p{margin:8px 0;color:var(--ink-2)} .cand b{color:var(--ink)} .flag{color:var(--flag)!important}
a{color:var(--rec)} p a, nav a{display:inline-flex;align-items:center;min-height:24px}
a:focus-visible{outline:2px solid var(--rec);outline-offset:3px;border-radius:4px}
.shots a{display:block}
.skip{position:absolute;left:16px;top:-200px;padding:10px 14px;background:var(--card);color:var(--ink);border:2px solid var(--rec);border-radius:6px}
.skip:focus{top:12px}
header.top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px}
header.top nav ul{display:flex;flex-wrap:wrap;gap:4px 18px;margin:0;padding:0;list-style:none}
footer{max-width:1600px;margin:0 auto;padding:0 24px 32px;color:var(--ink-2);font-size:13px}
</style></head>
<body>
<a class="skip" href="#main">Skip to the samples</a>
<main id="main">
<header class="top"><h1>Direction samples · ${esc(manifest.title || manifest.content.brand)}</h1>
<nav aria-label="Candidates"><ul>${ordered.map(({ dir }) => `<li><a href="#cand-${esc(dir.id)}">${esc(dir.name)}${dir.id === manifest.recommended ? " (recommended)" : ""}</a></li>`).join("")}</ul></nav></header>
<p class="lede">${esc(manifest.note || "Each sample uses the same real content, so only the direction changes. Click a screenshot for the full page, or open the live sample.")}</p>
<div class="grid">
${cards}
</div>
</main>
<footer>Generated by fantastic-ui direction-samples. Samples are disposable previews; the chosen direction becomes the brief.</footer>
</body></html>
`;
}

// ---------- plates ----------
const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

/** A plate palette from the direction's own tokens, in gen_atmosphere's order:
    the page surface first, then two structure grounds mixed from the page
    toward the ink (18% and 36%, so they always sit on the correct side of the
    page and far enough from it to be seen), the accent last. */
export function platePalette(map, d) {
  const col = (n) => parseColor(resolveVar(map[n], map));
  const page = col(d.surface), ink = col("ink");
  if (!page || !ink) return null;
  const mix = (p) => ({ r: page.r + (ink.r - page.r) * p, g: page.g + (ink.g - page.g) * p, b: page.b + (ink.b - page.b) * p });
  const accent = ["accent-fill", "accent", "hair-lit", "ink-2"].map(col).find(Boolean);
  if (!accent) return null;
  return [page, mix(0.18), mix(0.36), accent].map(hex).join(",");
}

/** Render the slot's plate with the skill's own generator (≤30 KB, visibility
    gate). The requested style is tried first, then the styles that pass for
    this page tone (on light pages warp is too soft: contour or studio).
    Returns null (and the slot shows a plain labelled panel) when Python,
    numpy/Pillow or every attempt fails the gate: never a CSS gradient blob. */
function renderPlate(outDir, id, kind, map, d, imagery) {
  const palette = platePalette(map, d);
  if (!palette) return null;
  const page = palette.split(",")[0];
  const light = lum(parseColor(page)) > 0.5;
  const asked = (String(imagery || "").match(/--style\s+(warp|contour|rings|studio)/) || [])[1] || (light ? "contour" : "warp");
  const tuned = { warp: ["1.0", "1"], contour: ["1.0", "3"], rings: ["1.0", "3"], studio: ["0.9", "1"] };
  const order = [asked, ...(light ? ["contour", "studio"] : ["warp", "contour"])].filter((s, i, a) => a.indexOf(s) === i);
  const [w, h] = kind === "band" ? [1600, 640] : [1000, 800];
  const rel = `plates/${id}-${kind}.webp`;
  const base = 1 + ([...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 60);   // each direction its own pattern
  mkdirSync(join(outDir, "plates"), { recursive: true });
  let last = "";
  for (const style of order) {
    const [intensity, weight] = tuned[style];
    const r = spawnSync("python3", [GEN, "plate", "--palette", palette, "--style", style, "--seeds", `${base}-${base + 7}`, "--pick", "best",
      "--size", `${w}x${h}`, "--intensity", intensity, "--weight", weight, "--max-kb", "30", "--page", page,
      "--out", join(outDir, rel), "--ledger", join(outDir, "plates", "ledger.jsonl")], { encoding: "utf8" });
    if (r.status === 0) {
      if (style !== asked) console.log(`note: ${id}: ${asked} plate too faint on this page; used ${style}`);
      const vis = (r.stderr.match(/visible ([\d.]+)%>=1\.1 ([\d.]+)%>=1\.3/) || []).slice(1);
      return { src: rel, w, h, style, visible: vis.map(Number) };
    }
    last = (r.stderr || r.error?.message || "gen_atmosphere failed").trim().split("\n").pop();
  }
  console.log(`note: ${id}: no plate for the ${kind} slot (${last}); showing a plain labelled panel`);
  return null;
}

// ---------- io ----------
export function loadDirection(dir, baseDir, presetsText) {
  if (dir.preset) {
    const p = presetBlock(dir.preset, presetsText);
    return { decls: p.decls, name: dir.name || p.name };
  }
  let css = dir.tokensCss;
  if (css == null && dir.tokensFile) {
    const p = isAbsolute(dir.tokensFile) ? dir.tokensFile : join(baseDir, dir.tokensFile);
    try { css = readFileSync(p, "utf8"); } catch { throw new InputError(`direction "${dir.id}": cannot read tokensFile ${p}`); }
  }
  if (!css) throw new InputError(`direction "${dir.id}" needs "preset", "tokensCss" or "tokensFile"`);
  const { decls, extra } = firstBlock(css);
  return { decls, name: dir.name || dir.id, extra };
}

export function validate(m) {
  if (!m || typeof m !== "object") throw new InputError("manifest must be a JSON object");
  if (!m.content?.brand || !m.content?.headline) throw new InputError("content.brand and content.headline are required (use the project's real words)");
  const dirs = m.directions;
  if (!Array.isArray(dirs) || dirs.length < 2 || dirs.length > 3) throw new InputError("give 2 or 3 directions");
  const ids = new Set(), lower = new Set();
  const ENUMS = { hero: ["split", "statement", "stack"], proof: ["stats", "image"], section: ["table", "cards", "list"], separation: ["hairline", "shadow", "tone"] };
  for (const d of dirs) {
    if (!d.id || !/^[\w-]+$/.test(d.id)) throw new InputError(`direction id "${d.id}" must be letters, digits, - or _`);
    const k = d.id.toLowerCase();   // ids are file names; macOS folds case
    if (["index", "sample", "shots"].includes(k)) throw new InputError(`direction id "${d.id}" is reserved (it would overwrite the sheet or assets)`);
    if (lower.has(k)) throw new InputError(`duplicate direction id "${d.id}" (ids are compared case-insensitively)`);
    ids.add(d.id); lower.add(k);
    for (const [field, allowed] of Object.entries(ENUMS)) {
      if (d[field] != null && !allowed.includes(d[field])) throw new InputError(`direction "${d.id}": ${field} must be one of ${allowed.join(", ")}`);
    }
  }
  if (!m.recommended) throw new InputError(`"recommended" is required: the samples are evidence for a recommendation, not a quiz`);
  if (!ids.has(m.recommended)) throw new InputError(`recommended "${m.recommended}" is not a direction id`);
  const c = m.content;
  if (c.stats != null && !(Array.isArray(c.stats) && c.stats.every((s) => Array.isArray(s) && s.length >= 2))) {
    throw new InputError(`content.stats must be a list of [value, label] pairs, e.g. [["212", "loaves last Saturday"]]`);
  }
  if (c.section != null && c.section.kind != null && !ENUMS.section.includes(c.section.kind)) {
    throw new InputError(`content.section.kind must be one of ${ENUMS.section.join(", ")}`);
  }
  const blob = JSON.stringify(c).toLowerCase();
  for (const bad of ["lorem", "ipsum", "john doe", "your headline", "acme"]) {
    if (new RegExp(`\\b${bad}\\b`).test(blob)) throw new InputError(`content contains placeholder text ("${bad}"); use the project's real words`);
  }
}

async function loadPlaywright(dirArg) {
  const tries = [];
  if (dirArg) tries.push(join(resolve(dirArg), "playwright", "index.mjs"));
  if (process.env.PLAYWRIGHT_DIR) tries.push(join(resolve(process.env.PLAYWRIGHT_DIR), "playwright", "index.mjs"));
  try { tries.push(createRequire(join(process.cwd(), "noop.js")).resolve("playwright")); } catch {}
  try { tries.push(createRequire(import.meta.url).resolve("playwright")); } catch {}
  for (const t of tries) {
    if (!existsSync(t)) continue;
    try { const mod = await import(pathToFileURL(t).href); return mod.chromium ? mod : mod.default; } catch {}
  }
  return null;
}

async function shoot(pw, outDir, ids) {
  mkdirSync(join(outDir, "shots"), { recursive: true });
  const browser = await pw.chromium.launch();
  try {
    for (const id of ids) {
      const url = pathToFileURL(join(outDir, `${id}.html`)).href;
      const shots = [["desktop", { width: 1440, height: 900 }, false], ["desktop-full", { width: 1440, height: 900 }, true], ["phone", { width: 390, height: 844 }, true]];
      for (const [tag, viewport, fullPage] of shots) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: tag === "phone" ? 2 : 1 });
        await page.goto(url, { waitUntil: "load" });
        await page.screenshot({ path: join(outDir, "shots", `${id}-${tag}.png`), fullPage });
        await page.close();
      }
    }
  } finally { await browser.close(); }
}

export async function run(argv) {
  const args = argv.slice(2);
  let pwDir = null;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--playwright") pwDir = args[++i];
    else if (args[i].startsWith("--playwright=")) pwDir = args[i].slice("--playwright=".length);
    else rest.push(args[i]);
  }
  const manifestPath = rest.find((a) => !a.startsWith("--"));
  if (!manifestPath) throw new InputError("usage: direction-samples.mjs <manifest.json> [--playwright <node_modules dir>] [--no-shots] [--no-plates]");
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch (e) { throw new InputError(`cannot read manifest: ${e.message}`); }
  validate(manifest);
  const baseDir = dirname(resolve(manifestPath));
  const outDir = resolve(baseDir, manifest.out || "design-samples");
  if (!outDir.startsWith(baseDir)) console.log(`note: writing outside the manifest's folder: ${outDir}`);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(SAMPLE_CSS, join(outDir, "sample.css"));
  const presetsText = readFileSync(PRESETS_MD, "utf8");
  const rows = manifest.directions.map((dir) => {
    const { decls, name, extra } = loadDirection(dir, baseDir, presetsText);
    if (extra) console.log(`note: ${dir.id}: only the first rule of its token block is used (later blocks, e.g. a dark theme, are ignored in the sample)`);
    const map = parseTokens(decls);
    const d = derive(map, dir.preset);
    const hero = dir.hero || "split";
    const proof = dir.proof || (hero === "split" ? "stats" : "image");
    const needs = hero === "split" ? (proof === "image" || !(manifest.content.stats || []).length ? ["panel"] : []) : ["band"];
    const plates = {};
    if (!args.includes("--no-plates")) for (const k of needs) plates[k] = renderPlate(outDir, dir.id, k, map, d, dir.imagery);
    const full = { ...dir, name, plates };
    writeFileSync(join(outDir, `${dir.id}.html`), sampleHtml(manifest, full, decls, d));
    return { dir: full, d };
  });
  let haveShots = false;
  if (!args.includes("--no-shots")) {
    const pw = await loadPlaywright(pwDir);
    if (pw) {
      try { await shoot(pw, outDir, rows.map((r) => r.dir.id)); haveShots = true; }
      catch (e) { console.log(`screenshots failed (${e.message.split("\n")[0]}); the sheet embeds the live pages instead`); }
    }
    else console.log("screenshots skipped: Playwright not found (npm i -D playwright, or pass --playwright <node_modules>); the sheet embeds the live pages instead");
  }
  writeFileSync(join(outDir, "index.html"), sheetHtml(manifest, rows, haveShots));
  for (const { dir, d } of rows) {
    const line = d.checks.map(([n, r, min = 4.5]) => `${n} ${r == null ? "NOT MEASURABLE ✗" : r.toFixed(2) + ":1" + (r < min ? " ✗" : "")}`).join(" · ");
    console.log(`${dir.id.padEnd(14)} ${dir.name}${dir.id === manifest.recommended ? " (recommended)" : ""}\n  ${line}\n  separation ${dir.separation || d.sep}, ${d.sheet ? "floating sheet" : "full-bleed"}, button ${d.ctaBgName} / ${d.ctaInkName}`);
  }
  console.log(`\nsheet: ${join(outDir, "index.html")}${haveShots ? `\nshots: ${join(outDir, "shots")}` : ""}`);
  return { outDir, rows, haveShots };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  run(process.argv).catch((e) => {
    console.error(`direction-samples: ${e.message}`);
    process.exit(e instanceof InputError ? 2 : 1);
  });
}
