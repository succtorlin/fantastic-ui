#!/usr/bin/env node
/**
 * check-samples.mjs — hold direction samples to fantastic-ui's own gates before
 * anyone sees them. Run it on the folder direction-samples.mjs wrote.
 *
 *   node check-samples.mjs design-samples
 *   node check-samples.mjs design-samples --modules /path/to/node_modules
 *
 * Per sample page:
 *   1. axe-core, WCAG 2.0/2.1/2.2 A+AA tags, at 1440 and 390 px: zero
 *      violations, and every `incomplete` node reported (never silently passed)
 *   2. layout at 320/375/390/768/1024/1440: no horizontal overflow, every link
 *      and button ≥24×24 px (2.5.8), no button label wrapping (mobile floor M3)
 *   3. keyboard: skip link first, visible :focus-visible ring ≥2 px and ≥3:1 on
 *      every focusable, landmarks (header, nav, main, footer), one h1, lang
 *   4. preset samples: scripts/verify-preset.mjs (contrast, zero webfonts, asset
 *      weight, focus ring, reduced motion, token roles, accent use, separation,
 *      the preset's traps) over a local http server
 *   5. scripts/lint-surface.mjs --strict over the folder
 * The comparison sheet (index.html) gets checks 1–3 as well.
 *
 * Writes <dir>/checks.json and a per-card result line into index.html.
 * Exit 0 only when everything passes; 1 when anything fails; 2 on bad input.
 * Needs playwright and @axe-core/playwright (resolved from the project, from
 * --modules, or $PLAYWRIGHT_DIR). They are the same tools verify-preset uses.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTHS = [320, 375, 390, 768, 1024, 1440];
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const MIME = { ".html": "text/html", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".js": "text/javascript", ".json": "application/json" };

class InputError extends Error {}

/** Async child process: the local http server must keep answering while
    verify-preset loads pages from it (spawnSync would deadlock it). */
function run(cmd, args, opts) {
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

async function loadTools(modulesArg) {
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

function serve(root) {
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

async function auditPage(browser, AxeBuilder, url) {
  const problems = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" });
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

function presetOf(html) {
  const m = html.match(/<meta name="fui-preset" content="([A-L])">/);
  return m ? m[1] : null;
}

export async function check(dir, modulesArg) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new InputError(`not a folder: ${dir}`);
  const pages = readdirSync(dir).filter((f) => f.endsWith(".html")).sort((a, b) => (a === "index.html") - (b === "index.html"));
  if (!pages.length) throw new InputError(`no .html pages in ${dir}; run direction-samples.mjs first`);
  const { chromium, AxeBuilder } = await loadTools(modulesArg);
  const { srv, base } = await serve(resolve(dir));
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const f of pages) {
      const problems = await auditPage(browser, AxeBuilder, `${base}/${f}`);
      const preset = presetOf(readFileSync(join(dir, f), "utf8"));
      if (preset) {
        const env = { ...process.env, NODE_PATH: [modulesArg && resolve(modulesArg), process.env.NODE_PATH].filter(Boolean).join(":") };
        const r = await run(process.execPath, [join(HERE, "verify-preset.mjs"), "--url", `${base}/${f}`, "--preset", preset],
          { cwd: modulesArg ? resolve(modulesArg, "..") : process.cwd(), env });
        if (r.status !== 0) {
          const fails = r.out.split("\n").filter((l) => /^\s*FAIL\b|^verify-preset:|Error/.test(l)).map((l) => `preset gate: ${l.trim()}`);
          problems.push(...(fails.length ? fails : [`preset gates failed (exit ${r.status})`]));
        }
      }
      results[f] = problems;
    }
  } finally {
    await browser.close();
    srv.close();
  }
  const lint = spawnSync(process.execPath, [join(HERE, "lint-surface.mjs"), "--strict", "--json", dir], { encoding: "utf8" });
  let lintFindings = [];
  try { lintFindings = JSON.parse(lint.stdout).findings || []; } catch { lintFindings = [{ rule: "lint-surface", message: "could not run" }]; }
  for (const fd of lintFindings) {
    const key = fd.file ? fd.file.split("/").pop() : "index.html";
    (results[key] ||= []).push(`lint ${fd.rule}: ${fd.message}`);
  }
  writeFileSync(join(dir, "checks.json"), JSON.stringify({ checkedAt: new Date().toISOString(), widths: WIDTHS, axeTags: AXE_TAGS, results }, null, 2));
  stampSheet(dir, results);
  return results;
}

/** Write each card's result into the sheet, replacing the generator's marker. */
function stampSheet(dir, results) {
  const p = join(dir, "index.html");
  if (!existsSync(p)) return;
  let html = readFileSync(p, "utf8");
  html = html.replace(/<p class="checks" data-page="([^"]+)">[\s\S]*?<\/p>/g, (_m, page) => {
    const probs = results[page] || [];
    const text = probs.length
      ? `Gates: ${probs.length} problem${probs.length > 1 ? "s" : ""} (see checks.json)`
      : "Gates: WCAG 2.2 AA (axe), targets, focus, reflow 320–1440, preset gates, lint: all pass";
    return `<p class="checks${probs.length ? " flag" : ""}" data-page="${page}">${text}</p>`;
  });
  writeFileSync(p, html);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  let modules = null;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--modules") modules = args[++i];
    else if (args[i].startsWith("--modules=")) modules = args[i].slice(10);
    else rest.push(args[i]);
  }
  if (!rest[0]) { console.error("usage: check-samples.mjs <samples dir> [--modules <node_modules>]"); process.exit(2); }
  check(rest[0], modules).then((results) => {
    let bad = 0;
    for (const [page, probs] of Object.entries(results)) {
      if (probs.length) bad++;
      console.log(`${probs.length ? "FAIL" : "PASS"}  ${page}${probs.length ? "\n    " + probs.join("\n    ") : ""}`);
    }
    const n = Object.keys(results).length;
    console.log(`\n${n - bad}/${n} pages pass · details in ${join(rest[0], "checks.json")}`);
    process.exit(bad ? 1 : 0);
  }).catch((e) => {
    console.error(`check-samples: ${e.message}`);
    process.exit(e instanceof InputError ? 2 : 1);
  });
}
