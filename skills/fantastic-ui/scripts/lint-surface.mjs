#!/usr/bin/env node
/**
 * lint-surface.mjs: a static pass over HTML, CSS, JS/JSX/TSX, Vue and Svelte
 * files for the surface failures fantastic-ui gates on.
 *
 *   node lint-surface.mjs [--json] [--strict] [--root-selector .page]...
 *                         [--token-file path]... [--token-selector sel]... <files|dirs…>
 *   node lint-surface.mjs --rules
 *
 * Findings are data: the exit code is 0 unless --strict is set and a P0 exists
 * (then 1). Usage errors exit 2. Zero dependencies, Node 20+.
 *
 * Parsing is pragmatic: comments are blanked (offsets kept, so line numbers stay
 * true), CSS is split into rule blocks, markup is walked tag by tag. Anything a
 * static pass cannot judge is printed as `notCovered` on every run, so a clean
 * report is never read as "the page is fine".
 */
import { readFileSync, existsSync, statSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const RULES = [
  { id: "dead-local-ref", severity: "P0", description: "a relative href/src/url()/import points at a file that is not on disk" },
  { id: "overflow-hidden-kills-sticky", severity: "P0", description: "overflow hidden on a root selector while the run uses position: sticky (use overflow-x: clip)" },
  { id: "reduced-motion-missing", severity: "P0", description: "the run animates (keyframes, transform/opacity transitions, rAF, WAAPI, scroll-driven) but has no prefers-reduced-motion anywhere" },
  { id: "zoom-blocked", severity: "P0", description: "viewport meta blocks zoom (user-scalable=no or maximum-scale=1)" },
  { id: "opacity-on-text", severity: "P1", description: "text dimmed with opacity instead of a muted colour token" },
  { id: "color-literal-outside-tokens", severity: "P1", description: "hex/rgb/hsl/oklch literal outside the token block or token files" },
  { id: "ai-default-palette", severity: "P1", description: "indigo/violet default palette or gradient-filled text" },
  { id: "transition-all", severity: "P1", description: "transition: all / Tailwind transition-all (name the properties)" },
  { id: "uppercase-tight-leading", severity: "P1", description: "uppercase text with line-height below 1.0 (caps collide on wrap)" },
  { id: "two-sticky-top0", severity: "P1", description: "more than one position: sticky + top: 0 in the run (offset the others by --nav-h)" },
  { id: "bare-1fr-image-grid", severity: "P1", description: "repeat(n, 1fr) columns in a file that styles images (use minmax(0, 1fr))" },
  { id: "root-relative-ref", severity: "P2", description: "a root-relative /… reference: the site root is unknown to a static pass, check by hand" },
  { id: "suppression-without-reason", severity: "P2", description: "a lint-surface-allow comment with no reason after the rule id" },
  { id: "copy-buzzword", severity: "P2", description: "hype word in visible copy" },
  { id: "copy-em-dash", severity: "P2", description: "em dash in visible prose" },
  { id: "button-label-vague", severity: "P2", description: "button or link label that does not say what happens (Submit, Click here, OK, repeated Learn more / Get started)" },
];
const SEV = Object.fromEntries(RULES.map((r) => [r.id, r.severity]));

export const NOT_COVERED = [
  "Real contrast of text over images, plates and gradients: run plate-check.js (or plate-check-shot.mjs) in a browser.",
  "Computed contrast of token pairs, focus-ring 3:1, target sizes: axe plus verify-preset.mjs against the live page.",
  "Whether motion is motivated (shows product behaviour or a state change): the motion review pass.",
  "Rendering at 320px and 375px, horizontal overflow, text that wraps into collisions: the browser breakpoint pass.",
  "Keyboard order, focus visibility, traps, escape routes: the manual keyboard pass.",
  "Layout shift and Core Web Vitals: Lighthouse.",
  "Styles built at runtime (CSS-in-JS template literals, class names from variables, computed style objects) are not parsed.",
  "Path aliases (@/, ~/) and bare package imports are not resolved; only ./ and ../ references are checked.",
];

// html and body overflow propagates to the viewport, so either alone keeps sticky
// working; both together, or any wrapper that does not propagate, break it.
const ROOT_DEFAULT = ["html", "body", ".page", "#app", "#__next", ":root"];
const rootKind = (r) => (r === "html" || r === ":root" ? "html" : r === "body" ? "body" : "other");
const TOKEN_SEL_DEFAULT = [":root", "[data-theme", ".page", ".theme-"];
const EXT_CSS = new Set([".css", ".scss", ".pcss"]);
const EXT_HTML = new Set([".html", ".htm", ".vue", ".svelte"]);
const EXT_JS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "out", ".turbo", "coverage", "fixtures"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const JS_TRY = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json", ".vue", ".svelte", ".css"];

const DEFAULT_HEX = new Set(["#6366f1", "#8b5cf6", "#7c3aed", "#6c63ff"]);
const COLOR_RE = /(?<![\w&#/$-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lch|lab|hwb)\(/gi;
const BUZZ_RE = /\b(revolutionary|revolutioni[sz]e[sd]?|powerful|seamless(?:ly)?|streamlin(?:e[sd]?|ing)|empower(?:s|ed|ing)?|leverag(?:e[sd]?|ing)|unlock(?:s|ed|ing)?|elevat(?:e[sd]?|ing)|supercharg(?:e[sd]?|ing)|game[- ]chang(?:er|ing)|next[- ]generation|cutting[- ]edge|effortless(?:ly)?|world[- ]class)\b/gi;
const TW_PAL_RE = /^(?:bg|text|border(?:-[trblxyse])?|from|via|to|ring|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:indigo|violet|purple)-\d{2,3}(?:\/\d+)?$/;
const TW_RESPONSIVE = /^(?:sm|md|lg|xl|2xl|dark|print)$/;

// ---------- text utilities ----------
const blankRange = (s, a, b) => s.slice(0, a) + s.slice(a, b).replace(/[^\n]/g, " ") + s.slice(b);
const blankRe = (s, re) => s.replace(re, (m) => m.replace(/[^\n]/g, " "));
function lineStarts(s) { const out = [0]; for (let i = 0; i < s.length; i++) if (s[i] === "\n") out.push(i + 1); return out; }
function lineAt(starts, off) { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= off) lo = m; else hi = m - 1; } return lo + 1; }
const decode = (s) => s.replace(/&mdash;|&#8212;|&#x2014;/gi, "—").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&rsaquo;|&raquo;|&rarr;/g, "");
function splitTop(s, sep = ",") { const out = []; let d = 0, cur = ""; for (const c of s) { if ("([".includes(c)) d++; else if (")]".includes(c)) d--; if (c === sep && d === 0) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }
function skipQuoted(s, i) { const q = s[i]; for (let j = i + 1; j < s.length; j++) { if (s[j] === "\\") { j++; continue; } if (s[j] === q || (s[j] === "\n" && q !== "`")) return j + 1; } return s.length; }

// JS: blank comments, keep strings, record string literal spans. A quote opens a
// string only where an expression may start, so the apostrophe in JSX text
// ("It's") does not swallow the rest of the line.
const KW_BEFORE_EXPR = /\b(?:return|case|typeof|in|of|yield|await|export|default|from|import|else|throw|new|void)$/;
function scanJs(src, base = 0) {
  let out = src; const strings = []; let prev = ""; let i = 0;
  const opens = (j) => { if (!prev || "=(,:[{?!&|+-*%;<}".includes(prev)) return true; if (prev === ">") return src[j - 1] === ">" && false || /=>\s*$/.test(src.slice(Math.max(0, j - 8), j)); return KW_BEFORE_EXPR.test(src.slice(Math.max(0, j - 12), j).trimEnd()); };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? src.length : e + 2; out = blankRange(out, i, end); i = end; continue; }
    if (c === "/" && d === "/" && src[i - 1] !== ":" && src[i - 1] !== "\\") { const e = src.indexOf("\n", i); const end = e < 0 ? src.length : e; out = blankRange(out, i, end); i = end; continue; }
    if ((c === '"' || c === "'" || c === "`") && opens(i)) { const end = skipQuoted(src, i); strings.push({ start: base + i, end: base + end, value: src.slice(i + 1, Math.max(i + 1, end - 1)), before: src.slice(Math.max(0, i - 40), i) }); prev = c; i = end; continue; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { code: out, strings };
}

// ---------- CSS ----------
function parseCss(css, base) {
  const blocks = [], statements = [], keyframes = [];
  let i = 0;
  const declsOf = (s, e, into) => {
    const raw = css.slice(s, e), t = raw.trim(); if (!t) return;
    const off = base + s + raw.indexOf(t[0]);
    if (t[0] === "@") { statements.push({ text: t, off }); return; }
    const k = t.indexOf(":"); if (k < 1) return;
    const prop = t.slice(0, k).trim().toLowerCase(); if (!/^-?-?[\w-]+$/.test(prop)) return;
    into.push({ prop, value: t.slice(k + 1).trim(), off });
  };
  const body = (ctx) => {
    let buf = i; const decls = [];
    while (i < css.length) {
      const c = css[i];
      if (c === '"' || c === "'") { i = skipQuoted(css, i); continue; }
      if (c === "(") { let dp = 0; for (; i < css.length; i++) { if (css[i] === "(") dp++; else if (css[i] === ")" && --dp === 0) break; } i++; continue; }
      if (c === "{") {
        const raw = css.slice(buf, i), prelude = raw.trim(), poff = base + buf + Math.max(0, raw.indexOf(prelude[0] ?? ""));
        i++;
        if (prelude.startsWith("@")) {
          const kf = /^@(?:-[\w]+-)?keyframes/i.test(prelude); if (kf) keyframes.push({ text: prelude, off: poff });
          body({ sel: ctx.sel, at: [...ctx.at, prelude], kf: ctx.kf || kf, off: poff });
        } else {
          const sel = !ctx.sel ? prelude : prelude.includes("&") ? prelude.replace(/&/g, ctx.sel) : `${ctx.sel} ${prelude}`;
          body({ sel, at: ctx.at, kf: ctx.kf, off: poff });
        }
        buf = i; continue;
      }
      if (c === ";") { declsOf(buf, i, decls); buf = ++i; continue; }
      if (c === "}") { declsOf(buf, i, decls); i++; break; }
      i++;
    }
    if (i >= css.length && buf < css.length) declsOf(buf, css.length, decls);
    if (ctx.sel && decls.length) blocks.push({ sel: ctx.sel, at: ctx.at, kf: ctx.kf, decls, off: ctx.off });
  };
  while (i < css.length) body({ sel: null, at: [], kf: false, off: base });
  return { blocks, statements, keyframes };
}
const dval = (b, ...props) => { for (let j = b.decls.length - 1; j >= 0; j--) if (props.includes(b.decls[j].prop)) return b.decls[j]; return null; };
const lastCompound = (part) => { const p = part.replace(/\([^)]*\)/g, (m) => m.replace(/[\s>+~]/g, "_")); const segs = p.split(/[\s>+~]+/).filter(Boolean); return segs.length ? part.slice(p.lastIndexOf(segs[segs.length - 1])) : part; };
function patHit(compound, pat) {
  const p = pat.replace(/…$/, "");
  if (/[-[]$/.test(p) || (p.startsWith("[") && !p.includes("]"))) return compound.includes(p);
  return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])").test(compound);
}
const isTokenSel = (sel, pats) => splitTop(sel).every((part) => pats.some((p) => patHit(lastCompound(part), p)));
// Exact compound only: `body` is a root, `body.modal-open` (a scroll lock) is not.
const rootsIn = (sel, roots) => splitTop(sel).flatMap((part) => roots.filter((r) => part === r));
const num = (v) => { const m = /^(-?\d*\.?\d+)(%?)$/.exec(v.trim()); return m ? Number(m[1]) / (m[2] ? 100 : 1) : NaN; };
const isZero = (v) => /^0(?:px|rem|em|%)?$/.test((v || "").trim());
const isSticky = (b) => /(^|\s)(-webkit-)?sticky\b/.test(dval(b, "position")?.value ?? "");
const topZero = (b) => isZero(dval(b, "top", "inset-block-start")?.value);

// ---------- markup ----------
function scanTags(text, start, end, isJs) {
  const tags = []; const re = /<(\/?)([A-Za-z][\w.:-]*)/g; re.lastIndex = start; let m;
  while ((m = re.exec(text)) && m.index < end) {
    if (isJs) { const p = text[m.index - 1]; if (p && /[\w$)\]]/.test(p)) continue; }
    let i = re.lastIndex, depth = 0, q = null, ok = false;
    for (; i < end && i - m.index < 4000; i++) {
      const c = text[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || (c === "`" && depth > 0)) { q = c; continue; }
      if (c === "{") depth++; else if (c === "}") depth--;
      else if (c === ">" && depth <= 0) { ok = true; break; }
      else if (c === "<" && depth <= 0 && !isJs) break;
    }
    if (!ok) continue;
    const name = m[2], attrs = text.slice(re.lastIndex, i);
    tags.push({ name, lname: name.toLowerCase(), closing: m[1] === "/", attrs, attrsOff: re.lastIndex, start: m.index, end: i + 1, self: attrs.trimEnd().endsWith("/") || VOID.has(name.toLowerCase()) });
    re.lastIndex = i + 1;
  }
  return tags;
}
function parseAttrs(s, base) {
  const out = []; let i = 0;
  while (i < s.length) {
    const m = /[^\s=/>]+/y; m.lastIndex = i; const nm = m.exec(s); if (!nm) { i++; continue; }
    i = m.lastIndex; while (/\s/.test(s[i] ?? "")) i++;
    const a = { name: nm[0], value: null, strings: [], off: base + nm.index };
    if (s[i] === "=") {
      i++; while (/\s/.test(s[i] ?? "")) i++;
      if (s[i] === '"' || s[i] === "'") { const e = skipQuoted(s, i); a.value = s.slice(i + 1, e - 1); a.strings.push(a.value); a.voff = base + i + 1; i = e; }
      else if (s[i] === "{") { let d = 0, j = i; for (; j < s.length; j++) { if ("\"'`".includes(s[j])) { const e = skipQuoted(s, j); a.strings.push(s.slice(j + 1, e - 1)); j = e - 1; continue; } if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } a.expr = s.slice(i, j + 1); i = j + 1; }
      else { const v = /[^\s>]+/y; v.lastIndex = i; const vm = v.exec(s); a.value = vm ? vm[0] : ""; a.strings.push(a.value); a.voff = base + i; i = v.lastIndex; }
    }
    out.push(a);
  }
  return out;
}
const attr = (attrs, ...names) => attrs.find((a) => names.includes(a.name));
const stripExpr = (s) => { let out = "", d = 0; for (const c of s) { if (c === "{") d++; else if (c === "}") d = Math.max(0, d - 1); else if (!d) out += c; } return out; };
const visible = (s) => decode(stripExpr(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
function classTokens(attrs) { const a = attrs.filter((x) => /^(?::?class|className|class:list)$/.test(x.name)); return a.flatMap((x) => x.strings.join(" ").split(/\s+/)).filter(Boolean); }
const twBase = (tok) => { const parts = tok.replace(/^!/, "").split(":"); return { base: parts.pop().replace(/^!/, ""), variants: parts }; };

// ---------- files ----------
const LINTABLE = new Set([...EXT_CSS, ...EXT_HTML, ...EXT_JS]);
// Top-level paths that do not exist are a usage error (thrown). Anything found while
// walking that cannot be read (broken symlink, loop, permissions) goes to `skipped`.
function collect(paths) {
  const out = [], skipped = [], seenDirs = new Set();
  const walk = (p, top) => {
    let ls;
    try { ls = lstatSync(p); } catch { if (top) throw new Error(`no such file or directory: ${p}`); skipped.push(`${p} (unreadable)`); return; }
    let st = ls;
    if (ls.isSymbolicLink()) {
      try { st = statSync(p); } catch { skipped.push(`${p} (broken symlink)`); return; }
      if (st.isDirectory() && !top) { skipped.push(`${p} (symlinked directory, not followed)`); return; }
    }
    if (st.isDirectory()) {
      let real; try { real = realpathSync(p); } catch { skipped.push(`${p} (unreadable)`); return; }
      if (seenDirs.has(real)) return; seenDirs.add(real);
      let entries; try { entries = readdirSync(p).sort(); } catch { skipped.push(`${p} (unreadable directory)`); return; }
      for (const e of entries) {
        if (SKIP_DIRS.has(e) || e.startsWith(".")) continue;
        const q = join(p, e); let el; try { el = lstatSync(q); } catch { skipped.push(`${q} (unreadable)`); continue; }
        if (el.isDirectory() || el.isSymbolicLink() || LINTABLE.has(extname(e).toLowerCase())) walk(q, false);
      }
    } else if (top || LINTABLE.has(extname(p).toLowerCase())) out.push(resolve(p));
  };
  for (const p of paths) walk(p, true);
  return { files: [...new Set(out)], skipped };
}
function loadFile(abs) {
  const text = readFileSync(abs, "utf8"), ext = extname(abs).toLowerCase();
  const f = { abs, ext, text, starts: lineStarts(text), css: [], scripts: [], markup: [], strings: [], clean: text, allow: new Map() };
  // Suppressions live in comments, so read them from the raw text before comments are blanked.
  const are = /lint-surface-allow:\s*([\w-]+)([^\n]*)/g; let am;
  while ((am = are.exec(text))) {
    const reason = am[2].replace(/\*\/.*$|-->.*$/, "").replace(/^\s*(?:\u2014|\u2013|--|-|:)\s*/, "").trim();
    const line = lineAt(f.starts, am.index); if (!f.allow.has(line)) f.allow.set(line, []); f.allow.get(line).push({ rule: am[1], reason, off: am.index });
  }
  if (EXT_CSS.has(ext)) { f.clean = blankRe(text, /\/\*[\s\S]*?\*\//g); f.css.push([0, text.length]); }
  else if (EXT_JS.has(ext)) { const r = scanJs(text); f.clean = r.code; f.strings = r.strings; f.scripts.push([0, text.length]); if (/\.(jsx|tsx)$/.test(ext) || /<\/[A-Za-z]/.test(r.code)) f.markup.push([0, text.length, true]); }
  else {
    let c = blankRe(text, /<!--[\s\S]*?-->/g); const re = /<(style|script)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi; let m; let last = 0;
    while ((m = re.exec(c))) {
      const inner = m.index + m[0].indexOf(">") + 1, innerEnd = inner + m[3].length;
      f.markup.push([last, inner, false]); last = innerEnd;
      if (m[1].toLowerCase() === "style") { c = c.slice(0, inner) + blankRe(c.slice(inner, innerEnd), /\/\*[\s\S]*?\*\//g) + c.slice(innerEnd); f.css.push([inner, innerEnd]); }
      else if (!/type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template)/i.test(m[2])) { const r = scanJs(c.slice(inner, innerEnd), inner); c = c.slice(0, inner) + r.code + c.slice(innerEnd); f.strings.push(...r.strings); f.scripts.push([inner, innerEnd]); }
    }
    f.markup.push([last, c.length, false]); f.clean = c;
  }
  // An allow comment quoted inside a string literal (a test fixture, say) is data, not a suppression.
  for (const [line, list] of f.allow) { const keep = list.filter((x) => !f.strings.some((st) => st.start < x.off && x.off < st.end)); if (keep.length) f.allow.set(line, keep); else f.allow.delete(line); }
  return f;
}

// ---------- the linter ----------
export function lint(paths, opts = {}) {
  const roots = opts.rootSelectors?.length ? opts.rootSelectors : ROOT_DEFAULT;
  const tokenSels = [...TOKEN_SEL_DEFAULT, ...(opts.tokenSelectors ?? [])];
  const tokenFiles = new Set((opts.tokenFiles ?? []).map((p) => resolve(p)));
  const cwd = opts.cwd ?? process.cwd();
  const col = collect(paths); const skipped = [...col.skipped]; const files = [];
  for (const p of col.files) { try { files.push(loadFile(p)); } catch (e) { skipped.push(`${p} (${e.code ?? "unreadable"})`); } }
  const findings = [], seen = new Set(), motion = [], sticky = [], rootHidden = [];
  let guard = false;
  const rel = (abs) => { const r = relative(cwd, abs); return !r || r.startsWith("../..") ? abs : r; };
  const suppressed = [];
  // A suppression covers its own line and the next; blockOff lets a comment above a selector cover that rule block.
  const add = (rule, f, off, message, blockOff) => {
    const line = lineAt(f.starts, off); const k = `${rule}|${f.abs}|${line}|${message}`; if (seen.has(k)) return; seen.add(k);
    const lines = [line, line - 1]; if (blockOff != null) { const bl = lineAt(f.starts, blockOff); lines.push(bl, bl - 1); }
    const allow = lines.flatMap((n) => f.allow.get(n) ?? []).find((x) => x.rule === rule);
    if (allow) { suppressed.push({ rule, file: rel(f.abs), line, reason: allow.reason }); return; }
    findings.push({ rule, severity: SEV[rule], file: rel(f.abs), line, message });
  };
  for (const f of files) for (const [line, list] of f.allow) for (const x of list) if (!x.reason) add("suppression-without-reason", f, f.starts[line - 1], `lint-surface-allow: ${x.rule} has no reason; write why the rule does not apply here after a dash.`);

  for (const f of files) {
    if (/prefers-reduced-motion/.test(f.clean)) guard = true;
    const isTokenFile = tokenFiles.has(f.abs);
    // True when an offset sits inside a string literal: code-like text there is data, not syntax.
    const inString = (off) => { const S = f.strings; let lo = 0, hi = S.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].end <= off) lo = m + 1; else if (S[m].start > off) hi = m - 1; else return true; } return false; };
    const blocks = [];
    for (const [a, b] of f.css) { const p = parseCss(f.clean.slice(a, b), a); blocks.push(...p.blocks); for (const k of p.keyframes) motion.push({ f, off: k.off, what: "@keyframes" }); for (const s of p.statements) { const im = /^@import\s+(?:url\()?\s*["']?([^"')\s;]+)/i.exec(s.text); if (im) checkRef(f, s.off, im[1], "@import", "css"); } }
    const inline = []; // pseudo-blocks from style attributes
    const cssOwnsImages = f.css.length && blocks.some((bl) => /(^|[\s,>+~(])(img|picture|video)\b/.test(bl.sel) || dval(bl, "object-fit"));

    // markup: tags, attributes, Tailwind classes, visible text
    for (const [a, b, isJs] of f.markup) {
      const tags = scanTags(f.clean, a, b, isJs).filter((tg) => !isJs || !inString(tg.start)); let depth = 0; const vague = [];
      for (let t = 0; t < tags.length; t++) {
        const tg = tags[t];
        if (tg.closing) { depth = Math.max(0, depth - 1); } else {
          const attrs = parseAttrs(tg.attrs, tg.attrsOff), cls = classTokens(attrs);
          markupTag(f, tg, attrs, cls, tags, t, inline, vague, isJs);
          if (!tg.self) depth++;
        }
        const next = tags[t + 1]; if (!next || (isJs && depth === 0)) continue;
        const raw = f.clean.slice(tg.end, next.start); if (!raw.trim()) continue;
        if (["script", "style"].includes(tg.lname) && !tg.closing) continue;
        const txt = visible(raw); if (txt) copyChecks(f, tg.end + raw.search(/\S/), txt);
      }
      const counts = {}; for (const v of vague) counts[v.key] = (counts[v.key] ?? 0) + 1;
      for (const v of vague) if (v.always || counts[v.key] > 1) add("button-label-vague", f, v.off, `${v.always ? "" : `${counts[v.key]}× `}"${v.label}" says nothing about the destination; name the action or the thing ("Read the pricing notes", "Save changes").`);
    }

    // scripts: motion, refs, JSX style objects, colour strings, copy strings
    for (const [a, b] of f.scripts) {
      const code = f.clean.slice(a, b); let m;
      const mre = /\brequestAnimationFrame\b|\.animate\s*\(|\bstartViewTransition\b|\bScrollTimeline\b|\bViewTimeline\b/g;
      while ((m = mre.exec(code))) if (!inString(a + m.index)) motion.push({ f, off: a + m.index, what: m[0].replace(/[\s(]/g, "") });
      // A specifier followed by `+` is a concatenated dynamic import: the path is not known statically.
      const ire = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(\.{1,2}\/[^"'\n]+)\1(?!\s*\+)/g;
      while ((m = ire.exec(code))) if (!inString(a + m.index)) checkRef(f, a + m.index, m[2], "import", "js");
      const ure = /new\s+URL\s*\(\s*(["'])([^"'\n]+)\1\s*,\s*import\.meta\.url/g;
      while ((m = ure.exec(code))) if (!inString(a + m.index)) checkRef(f, a + m.index, m[2], "new URL()", "js");
      const vre = /\b(?:maximumScale\s*:\s*(1(?:\.0+)?)\b|userScalable\s*:\s*(false|["']no["']))/g;
      while ((m = vre.exec(code))) if (!inString(a + m.index)) add("zoom-blocked", f, a + m.index, `viewport export sets ${m[0].replace(/\s+/g, "")}, which blocks pinch zoom (WCAG 1.4.4); remove it.`);
      const sre = /\bstyle\s*=\s*\{\{([\s\S]*?)\}\}/g;
      while ((m = sre.exec(code))) { if (inString(a + m.index)) continue;
        const decls = []; const pre = /([A-Za-z]+)\s*:\s*(?:(["'`])([^"'`\n]*)\2|(-?\d*\.?\d+)\b)/g; let p;
        while ((p = pre.exec(m[1]))) decls.push({ prop: p[1].replace(/[A-Z]/g, (x) => "-" + x.toLowerCase()), value: p[3] ?? p[4], off: a + m.index + 9 + p.index });
        if (decls.length) inline.push({ sel: "[style]", decls, off: a + m.index, at: [], kf: false, jsx: true });
      }
    }
    for (const s of f.strings) {
      if (/\b(?:href|to|id|key|htmlFor|name|xlinkHref)\s*=\s*\{?\s*$/.test(s.before) || /(?:querySelector(?:All)?|getElementById|closest|matches)\s*\(\s*$/.test(s.before) || /\b(?:from|import|require\s*\()\s*$/.test(s.before)) continue;
      if (/\bclass(?:Name)?\s*=\s*\{?[^=]*$/.test(s.before) && !/\[#|\[rgb|\[hsl|\[oklch/.test(s.value)) { /* class strings: only arbitrary colour values matter */ } else if (!isTokenFile) colourIn(f, s.start + 1, s.value, "string");
      for (const hx of s.value.match(/#[0-9a-f]{6}\b/gi) ?? []) if (DEFAULT_HEX.has(hx.toLowerCase())) add("ai-default-palette", f, s.start, `${hx} is a stock AI-default indigo/violet; pick the accent from the preset's token block.`);
      if (/^\s*(?:transition(?:-property)?\s*:\s*)?all\b/.test(s.value) && /transition(?:Property)?\s*:\s*$/.test(s.before)) add("transition-all", f, s.start, "transition: all animates layout properties too; name them (transition: opacity 200ms, transform 200ms).");
      if (!/\bclass(?:Name)?\s*=|\bcn\(|\bclsx\(|\btw`/.test(s.before) && looksLikeCopy(s.value)) copyChecks(f, s.start + 1, s.value);
    }

    // CSS rules over parsed blocks and inline styles
    for (const bl of [...blocks, ...inline]) {
      const tokenBlock = isTokenFile || (!bl.jsx && bl.sel !== "[style]" && isTokenSel(bl.sel, tokenSels));
      if (isSticky(bl)) sticky.push({ f, off: bl.off, sel: bl.sel, top0: topZero(bl) });
      const hitRoots = bl.sel === "[style]" ? [] : rootsIn(bl.sel, roots);
      if (hitRoots.length) for (const d of bl.decls) if (/^overflow(-x|-y)?$/.test(d.prop) && /\bhidden\b/.test(d.value)) rootHidden.push({ f, off: d.off, blockOff: bl.off, kinds: new Set(hitRoots.map(rootKind)), what: `${bl.sel} { ${d.prop}: ${d.value} }` });
      for (const d of bl.decls) { const um = /\burl\(\s*(["']?)([^"')\s]+)\1\s*\)/g; let u; while ((u = um.exec(d.value))) checkRef(f, d.off, u[2], "url()", "css"); }
      for (const d of bl.decls) {
        if (!bl.kf && (d.prop === "animation" || d.prop === "animation-name") && !/^none\b/.test(d.value)) motion.push({ f, off: d.off, what: `${d.prop}: ${d.value}` });
        if (/^(?:animation-timeline|view-timeline(?:-name)?|scroll-timeline(?:-name)?|view-transition-name)$/.test(d.prop)) motion.push({ f, off: d.off, what: d.prop });
        if (/^transition(-property)?$/.test(d.prop)) {
          if (/\b(transform|opacity|translate|scale|rotate|all)\b/.test(d.value)) motion.push({ f, off: d.off, what: `${d.prop}: ${d.value}` });
          if (splitTop(d.value).some((x) => /^all\b/.test(x))) add("transition-all", f, d.off, "transition: all animates layout properties too; name them (transition: opacity 200ms, transform 200ms).");
        }
        if (!tokenBlock && !bl.jsx) colourIn(f, d.off, d.value, d.prop);
        for (const hx of d.value.match(/#[0-9a-f]{6}\b/gi) ?? []) if (DEFAULT_HEX.has(hx.toLowerCase())) add("ai-default-palette", f, d.off, `${hx} is a stock AI-default indigo/violet; pick the accent from the preset's token block.`);
      }
      const clip = dval(bl, "background-clip", "-webkit-background-clip");
      if (clip && /\btext\b/.test(clip.value)) {
        const bg = dval(bl, "background", "background-image")?.value ?? "", fill = (dval(bl, "-webkit-text-fill-color")?.value ?? "") + (dval(bl, "color")?.value ?? "");
        if (/gradient\(/.test(bg) || /transparent/.test(fill)) add("ai-default-palette", f, clip.off, "gradient-filled text (background-clip: text) is the stock AI hero; set the headline in solid ink and let the accent carry one element.");
      }
      const op = dval(bl, "opacity"), o = op ? num(op.value) : NaN;
      if (!bl.kf && o > 0 && o < 1 && !/:disabled|\[disabled|\[aria-disabled|::?placeholder/.test(bl.sel) && bl.decls.some((d) => d.prop === "color" || d.prop.startsWith("font")))
        add("opacity-on-text", f, op.off, `opacity: ${op.value} on a rule that sets text (${bl.sel}); dim with a muted colour token instead, opacity fails contrast unpredictably.`);
      if (/uppercase/.test(dval(bl, "text-transform")?.value ?? "")) {
        const lh = dval(bl, "line-height"), fs = dval(bl, "font");
        const v = lh ? num(lh.value) : fs ? num((/\/\s*([\d.]+%?)/.exec(fs.value) ?? [])[1] ?? "") : NaN;
        if (v < 1) add("uppercase-tight-leading", f, (lh ?? fs).off, `uppercase with line-height ${v} on ${bl.sel}; caps have no descenders, so wrapped lines collide. Use at least 1.0 (1.1 for display).`);
      }
      const gtc = dval(bl, "grid-template-columns", "grid-template");
      if (gtc && cssOwnsImages) { const v = gtc.value.replace(/minmax\([^)]*\)/g, "M"); if (/repeat\(\s*[\w-]+\s*,\s*1fr\s*\)/.test(v) || (v.match(/(^|\s)1fr\b/g) ?? []).length >= 2) add("bare-1fr-image-grid", f, gtc.off, `grid-template-columns: ${gtc.value} lets an image's min-content width blow the track open; use repeat(n, minmax(0, 1fr)).`); }
    }

    function colourIn(file, off, value, where) {
      const v = value.replace(/url\([^)]*\)/g, (m) => " ".repeat(m.length)); let m; COLOR_RE.lastIndex = 0;
      while ((m = COLOR_RE.exec(v))) {
        const lit = m[0].endsWith("(") ? v.slice(m.index, v.indexOf(")", m.index) + 1 || undefined) : m[0];
        if (/var\(/.test(lit) && !/\d/.test(lit.replace(/var\([^)]*\)/g, ""))) continue;
        add("color-literal-outside-tokens", file, off + m.index, `colour literal ${lit.length > 40 ? lit.slice(0, 40) + "…" : lit} (${where}) outside the token block; define it once as a token and use var(--…). Allow a file or scope with --token-file / --token-selector.`);
        if (m[0].endsWith("(")) COLOR_RE.lastIndex = m.index + lit.length;
      }
    }
    function markupTag(file, tg, attrs, cls, tags, t, inl, vague, isJs) {
      const name = tg.lname;
      if (name === "meta" && /^viewport$/i.test(attr(attrs, "name")?.value ?? "")) {
        const c = attr(attrs, "content"); const v = c?.value ?? "";
        if (/user-scalable\s*=\s*(no|0)\b/i.test(v) || /maximum-scale\s*=\s*(0?\.\d+|1(\.0+)?)(?![\d.])/i.test(v)) add("zoom-blocked", file, tg.start, `viewport meta "${v}" blocks pinch zoom (WCAG 1.4.4); use "width=device-width, initial-scale=1".`);
      }
      for (const a of attrs) {
        if (a.value == null || a.voff == null) continue;
        if (["src", "href", "poster", "data", "xlink:href"].includes(a.name) && name !== "use" && name !== "base") checkRef(file, a.voff, a.value, `${name} ${a.name}`, "html", tg.name === "Link" ? "a" : name);
        if (a.name === "srcset") for (const part of a.value.split(",")) { const u = part.trim().split(/\s+/)[0]; if (u) checkRef(file, a.voff, u, `${name} srcset`, "html", name); }
        if (!isJs && a.name === "style") { const decls = []; for (const d of a.value.split(";")) { const k = d.indexOf(":"); if (k > 0) decls.push({ prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim(), off: a.voff }); } if (decls.length) inl.push({ sel: "[style]", decls, off: a.voff, at: [], kf: false }); }
        if (!isJs && /^(fill|stroke|stop-color|flood-color|lighting-color|color|bgcolor)$/.test(a.name) && !/^(none|currentcolor|transparent|inherit)$/i.test(a.value.trim())) colourIn(file, a.voff, a.value, `${a.name}=`);
      }
      // Tailwind and utility classes
      if (cls.length) {
        const bases = cls.map(twBase); const plain = (b) => !b.variants.length || b.variants.every((x) => TW_RESPONSIVE.test(x));
        const has = (re) => bases.some((b) => plain(b) && re.test(b.base));
        if (bases.some((b) => b.variants.some((x) => /^motion-(safe|reduce)$/.test(x)))) guard = true;
        for (const b of bases) {
          if (TW_PAL_RE.test(b.base)) add("ai-default-palette", file, tg.start, `${b.base} is the stock AI-default indigo/violet; use the preset accent token.`);
          if (b.base === "transition-all") add("transition-all", file, tg.start, "transition-all animates layout properties too; use transition-opacity / transition-transform or name them.");
          if (/^animate-(?!none\b)/.test(b.base) || /^transition(?:-(?:all|transform|opacity))?$/.test(b.base)) motion.push({ f: file, off: tg.start, what: b.base });
          const arb = /\[(#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch)\([^\]]*\))\]/i.exec(b.base); if (arb) add("color-literal-outside-tokens", file, tg.start, `colour literal ${arb[1]} (class ${b.base}) outside the token block; define it once as a token and use var(--…). Allow a file or scope with --token-file / --token-selector.`);
        }
        if (has(/^bg-clip-text$/) && has(/^bg-(?:gradient-to|linear|radial|conic)-/)) add("ai-default-palette", file, tg.start, "gradient-filled text (bg-clip-text + gradient) is the stock AI hero; set the headline in solid ink.");
        if (has(/^sticky$/)) sticky.push({ f: file, off: tg.start, sel: `<${tg.name} class="sticky top-0">`, top0: has(/^top-0$/) });
        const opN = bases.find((b) => plain(b) && /^opacity-(\d+)$/.test(b.base) && +b.base.slice(8) > 0 && +b.base.slice(8) < 100);
        const textAlpha = bases.find((b) => plain(b) && (/^text-opacity-\d+$/.test(b.base) || /^text-(?!transparent)[a-z]+(?:-\d+)?\/\d+$/.test(b.base)));
        if (textAlpha) add("opacity-on-text", file, tg.start, `${textAlpha.base} dims text with alpha; use a muted colour token so contrast is a known number.`);
        else if (opN && (has(/^(text|font|leading|tracking)-/) || innerText(tags, t, file).length >= 2)) add("opacity-on-text", file, tg.start, `${opN.base} on an element that holds text; dim with a muted colour token instead, opacity fails contrast unpredictably.`);
        const idv = attr(attrs, "id")?.value;
        const elRoots = roots.filter((r) => (r[0] === "." ? cls.includes(r.slice(1)) : r[0] === "#" ? idv === r.slice(1) : r === name));
        if (elRoots.length && has(/^overflow(-[xy])?-hidden$/)) rootHidden.push({ f: file, off: tg.start, kinds: new Set(elRoots.map(rootKind)), what: `<${tg.name}> overflow-hidden class` });
      }
      // vague labels
      const role = attr(attrs, "role")?.value;
      if (/^(button|a|link|Button|Link)$/.test(tg.name) || role === "button" || (name === "input" && /^(submit|button)$/i.test(attr(attrs, "type")?.value ?? ""))) {
        if (attr(attrs, "aria-label", "aria-labelledby", "ariaLabel")) return;
        const label = name === "input" ? (attr(attrs, "value")?.value ?? "") : innerText(tags, t, file);
        const key = label.toLowerCase().replace(/[\s›»→↗>.!]+$/g, "").trim();
        if (/^(submit|click here|ok|okay)$/.test(key)) vague.push({ key, label, off: tg.start, always: true });
        else if (/^(learn more|get started|read more)$/.test(key)) vague.push({ key, label, off: tg.start, always: false });
      }
    }
    function innerText(tags, t, file) {
      const open = tags[t]; if (open.self) return ""; let d = 0;
      for (let j = t + 1; j < tags.length && j < t + 400; j++) { const x = tags[j]; if (x.name !== open.name) continue; if (!x.closing && !x.self) d++; else if (x.closing && d-- === 0) return visible(file.clean.slice(open.end, x.start)); }
      return "";
    }
  }

  function copyChecks(f, off, txt) {
    let m; BUZZ_RE.lastIndex = 0;
    while ((m = BUZZ_RE.exec(txt))) add("copy-buzzword", f, off + m.index, `"${m[0]}" is a hype word; say what the product does, with a number or a noun ("${snip(txt, m.index)}").`);
    const words = txt.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const k = txt.indexOf("\u2014");
    if (k >= 0 && words >= 3) add("copy-em-dash", f, off + k, `em dash in prose ("${snip(txt, k)}"); use a comma, a colon or a new sentence.`);
  }

  function checkRef(f, off, raw, what, kind, tag) {
    let ref = raw.trim(); try { ref = decodeURIComponent(ref); } catch { /* keep raw */ }
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(ref) || /[{}$<>]|%7B|^@|^~/.test(ref)) return;
    const path = ref.split(/[?#]/)[0]; if (!path || path.endsWith("/")) return; // a directory prefix of a built path
    if (path.startsWith("/")) {
      if (tag === "a" && !/\.\w{2,5}$/.test(path)) return; // a route (<a>, Next <Link>), not a file
      for (let d = dirname(f.abs), k = 0; k < 8; k++, d = dirname(d)) { if (existsSync(join(d, "public", path))) return; if (dirname(d) === d) break; }
      add("root-relative-ref", f, off, `${what} "${ref}" is root-relative; the site root is unknown here, so check it by hand (or confirm it lands in public/).`); return;
    }
    if (kind === "html" && tag === "a" && !/\.\w{1,5}$/.test(path) && !path.startsWith(".")) return; // bare relative route in a template
    const full = resolve(dirname(f.abs), path);
    const tries = [full];
    if (kind === "js") { tries.push(...JS_TRY.map((e) => full + e), ...JS_TRY.map((e) => join(full, "index" + e))); if (/\.m?js$/.test(full)) tries.push(full.replace(/\.m?js$/, ".ts"), full.replace(/\.m?js$/, ".tsx")); }
    else tries.push(join(full, "index.html"));
    if (tries.some((p) => { try { return statSync(p).isFile(); } catch { return false; } })) return;
    add("dead-local-ref", f, off, `${what} "${ref}" points at ${relative(cwd, full) || full}, which does not exist; fix the path or add the file.`);
  }

  // run-level rules
  if (motion.length && !guard) { const m0 = motion[0]; add("reduced-motion-missing", m0.f, m0.off, `the run animates (${motion.length} signal${motion.length > 1 ? "s" : ""}, first: ${m0.what}) but no file has prefers-reduced-motion; add an @media (prefers-reduced-motion: reduce) path that shows the final state.`); }
  const kindsHidden = new Set(rootHidden.flatMap((r) => [...r.kinds]));
  const bothPropagating = kindsHidden.has("html") && kindsHidden.has("body");
  const breaking = rootHidden.filter((r) => r.kinds.has("other") || bothPropagating);
  if (breaking.length && sticky.length) for (const r of breaking) add("overflow-hidden-kills-sticky", r.f, r.off, `${r.what} ${r.kinds.has("other") ? "turns a wrapper into a scroll container" : "plus hidden overflow on the other of html/body stops propagation to the viewport"}, so position: sticky in this run stops sticking; use overflow-x: clip.`, r.blockOff);
  const top0 = []; for (const s of sticky) if (s.top0 && !top0.some((x) => x.sel === s.sel)) top0.push(s);
  if (top0.length > 1) for (const s of top0.slice(1)) add("two-sticky-top0", s.f, s.off, `${s.sel} is a second sticky top: 0 (first: ${top0[0].sel}); they stack on the same line. Offset it with top: var(--nav-h).`);

  findings.sort((x, y) => x.severity.localeCompare(y.severity) || x.rule.localeCompare(y.rule) || x.file.localeCompare(y.file) || x.line - y.line);
  const notCovered = [...NOT_COVERED];
  const rr = findings.filter((x) => x.rule === "root-relative-ref").length;
  if (skipped.length) notCovered.unshift(`${skipped.length} path(s) skipped, not linted: ${skipped.slice(0, 6).join("; ")}${skipped.length > 6 ? "; …" : ""}`);
  if (rr) notCovered.unshift(`${rr} root-relative reference(s) listed as P2 root-relative-ref: open the built page and confirm each loads.`);
  return { files: files.map((f) => rel(f.abs)), findings, suppressed, p0: findings.filter((x) => x.severity === "P0").length, notCovered };
}

const snip = (t, i) => { const a = Math.max(0, i - 24), b = Math.min(t.length, i + 24); return (a ? "…" : "") + t.slice(a, b).trim() + (b < t.length ? "…" : ""); };
function looksLikeCopy(s) {
  const t = s.trim(); if (t.length < 4 || /\$\{|[{};=<>]|^[./#@]|https?:|\\n/.test(t)) return false;
  const words = t.split(/\s+/); if (words.length < 2) return false;
  const codeish = words.filter((w) => /[-_:/[\]().=]|\d/.test(w.replace(/[.,!?;:]$/, "")) && !/^[—–-]$/.test(w)).length;
  return codeish / words.length < 0.4 && /[A-Za-z]{2}/.test(t);
}

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { json: false, strict: false, rules: false, rootSelectors: [], tokenFiles: [], tokenSelectors: [], paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { const v = argv[++i]; if (v == null) throw new Error(`${a} needs a value`); return v; };
    if (a === "--json") o.json = true; else if (a === "--strict") o.strict = true; else if (a === "--rules") o.rules = true;
    else if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--root-selector") o.rootSelectors.push(next()); else if (a === "--token-file") o.tokenFiles.push(next()); else if (a === "--token-selector") o.tokenSelectors.push(next());
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`); else o.paths.push(a);
  }
  return o;
}
function report(r) {
  const by = { P0: 0, P1: 0, P2: 0 }; for (const x of r.findings) by[x.severity]++;
  const lines = [`lint-surface: ${r.files.length} file(s), ${r.findings.length} finding(s) (P0 ${by.P0}, P1 ${by.P1}, P2 ${by.P2})`];
  let cur = "";
  for (const x of r.findings) {
    const k = `${x.severity} ${x.rule}`; if (k !== cur) { cur = k; lines.push("", `${x.severity}  ${x.rule} (${r.findings.filter((y) => y.rule === x.rule).length})`); }
    lines.push(`    ${x.file}:${x.line}  ${x.message}`);
  }
  if (!r.findings.length) lines.push("", "No static findings. That is not a pass: see below.");
  if (r.suppressed.length) lines.push("", `${r.suppressed.length} finding(s) suppressed by lint-surface-allow comments (see --json for rule, line and reason).`);
  lines.push("", "Not covered by a static pass:", ...r.notCovered.map((n) => `  - ${n}`));
  return lines.join("\n");
}
const USAGE = "usage: node lint-surface.mjs [--json] [--strict] [--root-selector sel]... [--token-file path]... [--token-selector sel]... <files|dirs…>\n       node lint-surface.mjs --rules";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let o; try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`lint-surface: ${e.message}\n${USAGE}`); process.exit(2); }
  if (o.help) { console.log(USAGE); process.exit(0); }
  if (o.rules) { for (const r of RULES) console.log(`${r.severity}  ${r.id.padEnd(30)} ${r.description}`); process.exit(0); }
  if (!o.paths.length) { console.error(USAGE); process.exit(2); }
  let r; try { r = lint(o.paths, o); } catch (e) { console.error(`lint-surface: ${e.message}`); process.exit(2); }
  console.log(o.json ? JSON.stringify(r, null, 2) : report(r));
  process.exit(o.strict && r.p0 > 0 ? 1 : 0);
}
