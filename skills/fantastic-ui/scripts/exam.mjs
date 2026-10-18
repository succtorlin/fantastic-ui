#!/usr/bin/env node
/**
 * exam.mjs — the fantastic-ui exam. Every page this skill builds or changes,
 * in any project, passes it before the work is called done.
 *
 *   node exam.mjs --url http://localhost:3000/ --url http://localhost:3000/pricing
 *   node exam.mjs --url http://localhost:3000/ --preset E --lint src/app/landing
 *   node exam.mjs path/to/static-site            (serves the folder itself)
 *   options: --preset <A-L>  --lint <path>...  --modules <node_modules>  --json <file>
 *            --fragment  (a component preview, not a whole page: skips only the
 *                         skip-link, landmark and single-h1 checks)
 *
 * Per page:
 *   1. axe-core, WCAG 2.0/2.1/2.2 A+AA tags, at 1440 and 390 px: zero
 *      violations; every `incomplete` node is reported (measure it by hand),
 *      never silently passed
 *   2. reflow at 320/375/390/768/1024/1440: no horizontal overflow and no
 *      content cut off (overflow-x: clip hides overflow from scrollWidth);
 *      every link and button ≥24×24 px (2.5.8); no button label wrapping (M3)
 *   3. keyboard and structure: a skip link first, a visible :focus-visible
 *      ring ≥2 px and ≥3:1 on each focusable, header/nav/main/footer, one h1,
 *      lang on <html>
 *   4. with --preset (or a <meta name="fui-preset">): scripts/verify-preset.mjs
 *      (contrast, zero webfonts, asset weight, focus ring, reduced-motion path,
 *      token roles, accent restraint, separation, the preset's own traps)
 *   5. scripts/lint-surface.mjs --strict over every --lint path (or the folder)
 * Exit 0 only when every page passes; 1 when anything fails; 2 on bad input.
 * Needs playwright and @axe-core/playwright, from the project, --modules or
 * $PLAYWRIGHT_DIR (the same tools verify-preset.mjs uses).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
export const WIDTHS = [320, 375, 390, 768, 1024, 1440];
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const MIME = { ".html": "text/html", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".js": "text/javascript", ".json": "application/json" };

export class InputError extends Error {}

/** Async child process: the local http server must keep answering while
    verify-preset loads pages from it (spawnSync would deadlock it). */
export function run(cmd, args, opts) {
  return new Promise((ok) => {
    const p = spawn(cmd, args, opts);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (status) => ok({ status, out }));
  });
}

function resolveFrom(dirs, name) {
  for (const d of dirs) {
    try { return createRequire(join(d, "noop.js")).resolve(name); } catch {}
  }
  return null;
}

export async function loadTools(modulesArg) {
  const dirs = [modulesArg && resolve(modulesArg, ".."), modulesArg, process.env.PLAYWRIGHT_DIR && resolve(process.env.PLAYWRIGHT_DIR, ".."), process.cwd(), HERE].filter(Boolean);
  const pwPath = resolveFrom(dirs, "playwright");
  const axePath = resolveFrom(dirs, "@axe-core/playwright");
  if (!pwPath || !axePath) {
    throw new InputError("needs playwright and @axe-core/playwright: npm i -D playwright @axe-core/playwright in the project, or pass --modules <node_modules>");
  }
  const pw = await import(pathToFileURL(pwPath).href);
  const axe = await import(pathToFileURL(axePath).href);
  return { chromium: (pw.chromium || pw.default.chromium), AxeBuilder: axe.AxeBuilder || axe.default, nodeModules: dirname(dirname(pwPath).replace(/\/playwright(\/.*)?$/, "/playwright")) };
}

export function serve(root) {
  return new Promise((ok) => {
    const srv = createServer((req, res) => {
      const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
      res.end(readFileSync(p));
    });
    srv.listen(0, "127.0.0.1", () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}

// Runs in the page. Colours go through a canvas so oklch()/hsl() computed
// values are measured too.
function pageHelpers() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (c) => { if (!c || c === "transparent") return null; cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data; return { r, g, b, a: a / 255 }; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  return { parse, ratio, bgOf };
}

async function layoutChecks(page, width) {
  return page.evaluate((width) => {
    const out = [];
    const sw = document.documentElement.scrollWidth;
    if (sw > width + 1) out.push(`horizontal overflow (${sw}px) at ${width}`);
    // overflow-x: clip keeps scrollWidth honest-looking while cutting content
    // off, so also look for content that extends past the viewport edge.
    for (const el of document.querySelectorAll("body *")) {
      if (el.classList.contains("skip") || el.closest(".table-wrap")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const hasContent = el.matches("img, svg, input, button, a, h1, h2, h3, p, td, th, li, b, span, figcaption") && (el.textContent.trim() || el.matches("img, svg"));
      if (hasContent && (r.right > width + 1 || r.left < -1)) {
        out.push(`content cut off at ${width}: <${el.tagName.toLowerCase()}> spans ${Math.round(r.left)}–${Math.round(r.right)}px`);
        break;
      }
    }
    for (const el of document.querySelectorAll("a, button")) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (el.classList.contains("skip")) continue;
      if (r.width < 24 || r.height < 24) out.push(`target ${Math.round(r.width)}×${Math.round(r.height)} "${el.textContent.trim().slice(0, 30)}" at ${width}`);
      if (el.classList.contains("btn")) {
        const range = document.createRange(); range.selectNodeContents(el);
        if (range.getClientRects().length > 1) out.push(`button label wraps "${el.textContent.trim()}" at ${width}`);
      }
    }
    return out;
  }, width);
}

async function keyboardChecks(page) {
  const out = await page.evaluate(() => {
    const o = [];
    const first = document.querySelector("a[href], button");
    if (!first || !first.classList.contains("skip") || !first.getAttribute("href")?.startsWith("#")) o.push("first focusable is not a skip link");
    for (const sel of ["header", "nav", "main", "footer"]) if (!document.querySelector(sel)) o.push(`no <${sel}> landmark`);
    const h1 = document.querySelectorAll("h1").length;
    if (h1 !== 1) o.push(`${h1} h1 elements (want 1)`);
    if (!document.documentElement.lang) o.push("no lang on <html>");
    return o;
  });
  const n = await page.evaluate(() => document.querySelectorAll("a[href], button").length);
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < Math.min(n, 16); i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate((src) => {
      const h = new Function(`return (${src})()`)();
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const w = parseFloat(cs.outlineWidth) || 0;
      const col = h.parse(cs.outlineColor);
      const visible = cs.outlineStyle !== "none" && w >= 2 && col && col.a > 0;
      return { label: (el.textContent.trim() || el.querySelector("img")?.alt || el.getAttribute("href") || "").slice(0, 30), visible, ratio: col ? h.ratio(col, h.bgOf(el.parentElement || el)) : 0 };
    }, pageHelpers.toString());
    if (!r) continue;
    if (!r.visible) out.push(`no visible focus ring on "${r.label}"`);
    else if (r.ratio < 3) out.push(`focus ring ${r.ratio.toFixed(2)}:1 on "${r.label}" (needs 3:1)`);
  }
  return out;
}

export async function auditPage(browser, AxeBuilder, url) {
  const problems = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" });
    // Read the page the way a visitor does: scroll it top to bottom so
    // scroll-revealed content has arrived before anything is measured.
    await page.evaluate(async () => {
      const step = Math.max(200, innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 900));
    });
    problems.push(...await layoutChecks(page, width));
    if (width === 1440 || width === 390) {
      const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      for (const v of res.violations) problems.push(`axe ${v.id} (${v.impact}) ×${v.nodes.length} at ${width}: ${v.nodes[0].target.join(" ")}`);
      for (const v of res.incomplete) problems.push(`axe could not decide ${v.id} ×${v.nodes.length} at ${width}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")} (measure by hand)`);
    }
    if (width === 1440) problems.push(...await keyboardChecks(page));
    await ctx.close();
  }
  return [...new Set(problems)];
}

export function presetOf(html) {
  const m = html.match(/<meta name="fui-preset" content="([A-L])">/);
  return m ? m[1] : null;
}

async function presetGates(base, url, preset, modulesArg) {
  const env = { ...process.env, NODE_PATH: [modulesArg && resolve(modulesArg), process.env.NODE_PATH].filter(Boolean).join(":") };
  const r = await run(process.execPath, [join(HERE, "verify-preset.mjs"), "--url", url, "--preset", preset],
    { cwd: modulesArg ? resolve(modulesArg, "..") : process.cwd(), env });
  if (r.status === 0) return [];
  const fails = r.out.split("\n").filter((l) => /^\s*FAIL\b|^verify-preset:|Error/.test(l)).map((l) => `preset gate: ${l.trim()}`);
  return fails.length ? fails : [`preset gates failed (exit ${r.status})`];
}

function lintPaths(paths) {
  const out = [];
  for (const p of paths) {
    const r = spawnSync(process.execPath, [join(HERE, "lint-surface.mjs"), "--strict", "--json", p], { encoding: "utf8" });
    let findings;
    try { findings = JSON.parse(r.stdout).findings || []; } catch { findings = [{ rule: "lint-surface", message: `could not run on ${p}`, file: p }]; }
    out.push(...findings);
  }
  return out;
}

/**
 * Run the exam. `targets` is a list of { name, url, preset? }; or pass `dir`
 * to serve a static folder and exam every .html in it. Returns
 * { results: { name: problems[] }, lint: findings[] }.
 */
export async function exam({ targets = [], dir = null, preset = null, lint = [], modules = null, fragment = false } = {}) {
  const { chromium, AxeBuilder } = await loadTools(modules);
  let srv = null, base = null, list = targets;
  if (dir) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new InputError(`not a folder: ${dir}`);
    const pages = readdirSync(dir).filter((f) => f.endsWith(".html")).sort((a, b) => (a === "index.html") - (b === "index.html"));
    if (!pages.length) throw new InputError(`no .html pages in ${dir}`);
    ({ srv, base } = await serve(resolve(dir)));
    list = pages.map((f) => ({ name: f, url: `${base}/${f}`, preset: presetOf(readFileSync(join(dir, f), "utf8")) || preset }));
    if (!lint.length) lint = [dir];
  } else {
    if (!list.length) throw new InputError("give at least one --url or a folder");
    list = list.map((t) => ({ ...t, preset: t.preset || preset }));
  }
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const t of list) {
      let problems = await auditPage(browser, AxeBuilder, t.url);
      if (fragment) problems = problems.filter((p) => !/skip link|landmark|h1 elements/.test(p));
      if (t.preset) problems.push(...await presetGates(base, t.url, t.preset, modules));
      results[t.name] = problems;
    }
  } finally {
    await browser.close();
    if (srv) srv.close();
  }
  const lintFindings = lintPaths(lint);
  for (const fd of lintFindings) {
    const key = dir ? (fd.file ? fd.file.split("/").pop() : "index.html") : "lint";
    (results[key] ||= []).push(`lint ${fd.rule}: ${fd.file ? fd.file + ":" + (fd.line ?? "") + " " : ""}${fd.message}`);
  }
  return { results, lint: lintFindings };
}

export function report(results) {
  let bad = 0;
  for (const [name, probs] of Object.entries(results)) {
    if (probs.length) bad++;
    console.log(`${probs.length ? "FAIL" : "PASS"}  ${name}${probs.length ? "\n    " + probs.join("\n    ") : ""}`);
  }
  const n = Object.keys(results).length;
  console.log(`\nexam: ${n - bad}/${n} pass${bad ? " · NOT DONE until every page passes" : ""}`);
  return bad;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const a = process.argv.slice(2);
  const opt = { targets: [], lint: [], modules: null, preset: null, fragment: false, dir: null };
  let jsonOut = null;
  for (let i = 0; i < a.length; i++) {
    const [k, v] = a[i].includes("=") ? a[i].split(/=(.*)/s) : [a[i], null];
    const val = () => v ?? a[++i];
    if (k === "--url") { const u = val(); opt.targets.push({ name: u, url: u }); }
    else if (k === "--preset") opt.preset = val().toUpperCase();
    else if (k === "--lint") opt.lint.push(val());
    else if (k === "--modules") opt.modules = val();
    else if (k === "--json") jsonOut = val();
    else if (k === "--fragment") opt.fragment = true;
    else if (!k.startsWith("--")) opt.dir = k;
    else { console.error(`exam: unknown option ${k}`); process.exit(2); }
  }
  if (opt.preset && !/^[A-L]$/.test(opt.preset)) { console.error("exam: --preset must be A-L"); process.exit(2); }
  exam(opt).then(({ results }) => {
    if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ examinedAt: new Date().toISOString(), widths: WIDTHS, axeTags: AXE_TAGS, results }, null, 2));
    process.exit(report(results) ? 1 : 0);
  }).catch((e) => {
    console.error(`exam: ${e.message}`);
    process.exit(e instanceof InputError ? 2 : 1);
  });
}
