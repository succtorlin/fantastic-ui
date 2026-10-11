#!/usr/bin/env node
// plate-check-shot.mjs — plate-check.js on TRUE pixels, via Playwright (optional; not a dependency).
//
//   node skills/fantastic-ui/scripts/plate-check-shot.mjs <url> [--widths 1440,375] [--height 900]
//        [--hosts SEL] [--layer SEL] [--page '#hex'] [--floors 8,1,4.5,3 | 8,1,8,1,4.5,3]
//        [--expect '[{"selector":".plate--header","property":"background-image","includes":"rgba(0, 0, 0, 0) 58%"}]']
//        [--wait MS] [--json]
//
// For each width: open the URL, load plate-check.js, find the hosts and their geometry from
// computed styles, then set `color: transparent` on the text inside the hosts, screenshot each
// plate layer, and measure the screenshot (what the browser actually composited) with the same
// metrics: visibility over the image-covered area, text p90/p10 under each text run.
// STRUCTURE (visibility after a box blur) needs the plate alone, at its full displayed size, before
// the scrim — a screenshot has neither — so each host's `structure` comes from the computed raster
// (browser-decoded plate pixels, the same blur as gen_atmosphere) and is marked structureSource:"computed".
// Prints { mode: "shot", url, widths: [{ width, report }], pass }.
//
// Playwright is resolved from the current directory first (your project), then from here.
// Exit: 0 pass · 2 usage, or Playwright not installed · 4 a gate failed or the CSS was stale · 1 error.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, "plate-check.js");
const USAGE = `usage: node plate-check-shot.mjs <url> [--widths 1440,375] [--height 900] [--hosts SEL] [--layer SEL]
                                [--page '#hex'] [--floors ge11,ge13[,struct11,struct13],text,large] [--expect JSON] [--wait MS] [--json]`;

function usage(msg, code = 2) {
  if (msg) process.stderr.write(`plate-check-shot: ${msg}\n`);
  (code === 0 ? process.stdout : process.stderr).write(USAGE + "\n");
  process.exit(code);
}

function parseArgs(argv) {
  const o = { widths: [1440, 375], height: 900, wait: 300, json: false };
  const rest = [...argv];
  const value = (flag) => {
    const v = rest.shift();
    if (v == null || v.startsWith("--")) usage(`${flag} needs a value`);
    return v;
  };
  while (rest.length) {
    const a = rest.shift();
    if (a === "--help" || a === "-h") usage(null, 0);
    else if (a === "--widths") {
      const ws = value(a).split(",").map((s) => Number(s.trim()));
      if (!ws.length || ws.some((n) => !Number.isInteger(n) || n < 200 || n > 4000)) usage("--widths must be integers between 200 and 4000, comma separated");
      o.widths = ws;
    } else if (a === "--height") {
      o.height = Number(value(a));
      if (!Number.isInteger(o.height) || o.height < 200) usage("--height must be an integer ≥ 200");
    } else if (a === "--wait") {
      o.wait = Number(value(a));
      if (!Number.isFinite(o.wait) || o.wait < 0) usage("--wait must be a number of ms");
    } else if (a === "--hosts") o.hosts = value(a);
    else if (a === "--layer") o.layer = value(a);
    else if (a === "--page") o.page = value(a);
    else if (a === "--floors") {
      const f = value(a).split(",").map(Number);
      if (![4, 6].includes(f.length) || f.some((n) => !Number.isFinite(n))) usage("--floors takes ge11,ge13,text,large or ge11,ge13,struct11,struct13,text,large");
      o.floors = f.length === 4 ? { ge11: f[0], ge13: f[1], text: f[2], large: f[3] } : { ge11: f[0], ge13: f[1], struct11: f[2], struct13: f[3], text: f[4], large: f[5] };
    } else if (a === "--expect") {
      try { o.expect = JSON.parse(value(a)); } catch { usage("--expect must be JSON: [{selector, property, includes}]"); }
      if (!Array.isArray(o.expect)) usage("--expect must be a JSON array");
    } else if (a === "--json") o.json = true;
    else if (a.startsWith("--")) usage(`unknown flag ${a}`);
    else if (!o.url) o.url = a;
    else usage(`unexpected argument ${a}`);
  }
  if (!o.url) usage("a URL is required");
  try { new URL(o.url); } catch { usage(`not a URL: ${o.url}`); }
  return o;
}

/**
 * Playwright's `chromium`, resolved from the current directory first (the user's project), then
 * from `fromUrl`'s directory (default: this script's). null when it is not installed.
 * Exported so other runners (evals/plate-visibility/score_page.mjs) resolve it the same way.
 */
export async function loadPlaywright(fromUrl = import.meta.url) {
  if (process.env.PLATE_CHECK_NO_PLAYWRIGHT) return null; // lets tests force the not-installed path
  const requirers = [createRequire(join(process.cwd(), "noop.js")), createRequire(fromUrl)];
  for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    for (const req of requirers) {
      let resolved;
      try { resolved = req.resolve(name); } catch { continue; }
      const mod = await import(pathToFileURL(resolved).href);
      const chromium = mod.chromium || (mod.default && mod.default.chromium);
      if (chromium) return chromium;
    }
  }
  return null;
}

// Runs in the page: decode a PNG screenshot and measure it with plate-check's own helpers.
async function measureShotInPage({ b64, geometry, page, floors }) {
  const I = window.plateCheck._internals;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const w = Math.round(geometry.w);
  const h = Math.round(geometry.h);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const px = I.rgbaToRgbLum(ctx.getImageData(0, 0, w, h).data, w, h);
  const mask = I.coverMask(geometry.image, w, h, 1);
  if (geometry.strip != null) for (let y = 0; y < h; y++) if (y + 0.5 >= geometry.strip) mask.fill(0, y * w, (y + 1) * w);
  const pageRgb = I.parseColor(page);
  return I.measurePixels({ px, w, h, k: 1, mask, page: pageRgb, texts: geometry.texts, floors });
}

const HIDE_TEXT = (hosts) => `
  :is(${hosts}), :is(${hosts}) * {
    color: transparent !important; -webkit-text-fill-color: transparent !important;
    text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important;
  }
  *, *::before, *::after { animation: none !important; transition: none !important; }`;

async function runWidth(browser, opts, width, checkerSrc) {
  const context = await browser.newContext({ viewport: { width, height: opts.height }, deviceScaleFactor: 1, bypassCSP: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(opts.url, { waitUntil: "networkidle" });
    await page.evaluate(checkerSrc);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    if (opts.wait) await page.waitForTimeout(opts.wait);
    const checkOpts = { hosts: opts.hosts, layer: opts.layer, page: opts.page, floors: opts.floors, expect: opts.expect, _geometry: true };
    const computed = await page.evaluate((o) => window.plateCheck(o), checkOpts);
    if (computed.stale || !computed.hosts.length) return { width, report: computed };

    const hostsSel = opts.hosts || (await page.evaluate(() => window.plateCheck._internals.DEFAULT_HOSTS));
    await page.addStyleTag({ content: HIDE_TEXT(hostsSel) });
    await page.waitForTimeout(50);
    const floors = computed.floors;
    const hosts = [];
    for (const h of computed.hosts) {
      if (h.error || !h.geometry) { hosts.push(h); continue; }
      const { geometry, ...rest } = h;
      try {
        const buf = await page.locator(`[data-plate-check-index="${geometry.index}"]`).screenshot({ animations: "disabled", caret: "hide", scale: "css" });
        const m = await page.evaluate(measureShotInPage, { b64: buf.toString("base64"), geometry, page: h.page, floors });
        // STRUCTURE needs the plate alone at its displayed size, which a screenshot cannot give; keep the
        // computed raster's value (browser-decoded plate pixels, same blur) and fold it into the verdict.
        const reasons = [...m.reasons.filter((r) => !r.startsWith("structure")), ...(h.reasons || []).filter((r) => r.startsWith("structure") || r.startsWith("measurement partial"))];
        const ok = m.visible && m.textPass && h.structOk !== false && h.measured !== "partial";
        hosts.push({ ...rest, ...m, structure: h.structure, structOk: h.structOk, structureSource: "computed", reasons,
          computed: { visibility: h.visibility, structure: h.structure, worstText: h.worstText }, pass: ok });
      } catch (e) {
        hosts.push({ ...rest, error: "screenshot_failed", detail: String(e && e.message ? e.message : e).split("\n")[0], pass: false });
      }
    }
    return { width, report: { ...computed, mode: "shot", hosts, pass: hosts.length > 0 && hosts.every((x) => x.pass) } };
  } finally {
    await context.close();
  }
}

function printTable(result) {
  for (const { width, report } of result.widths) {
    if (report.stale) { console.log(`${width}px  STALE CSS — ${JSON.stringify(report.expect)}`); continue; }
    if (!report.hosts.length) { console.log(`${width}px  no hosts (${report.error ?? "none found"})`); continue; }
    for (const h of report.hosts) {
      if (h.error) { console.log(`${width}px  ${h.selector}  ERROR ${h.error}${h.url ? " " + h.url : ""}`); continue; }
      const wt = h.worstText ? `${h.worstText.ratio}:1 (need ${h.worstText.need}) "${h.worstText.text}"` : "no text";
      const st = h.structure ? `  structure ${h.structure.ge_1_1}/${h.structure.ge_1_3}` : "";
      console.log(`${width}px  ${h.pass ? "PASS" : "FAIL"}  ${h.selector}  ${h.box} ${h.fit}  ge_1_1 ${h.visibility.ge_1_1}%  ge_1_3 ${h.visibility.ge_1_3}%${st}  worst text ${wt}`);
      for (const r of h.reasons || []) console.log(`        ${r}`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chromium = await loadPlaywright();
  if (!chromium) {
    process.stderr.write(
      "plate-check-shot: Playwright is not installed (looked in " + process.cwd() + " and " + HERE + ").\n" +
      "  Install it in your project:  npm i -D playwright && npx playwright install chromium\n" +
      "  Or measure from computed styles instead: load scripts/plate-check.js in the page and run plateCheck().\n"
    );
    process.exit(2);
  }
  const checkerSrc = readFileSync(CHECKER, "utf8");
  const browser = await chromium.launch();
  const result = { mode: "shot", url: opts.url, widths: [] };
  try {
    for (const width of opts.widths) result.widths.push(await runWidth(browser, opts, width, checkerSrc));
  } finally {
    await browser.close();
  }
  result.pass = result.widths.every((x) => x.report.pass && !x.report.stale);
  if (!opts.json) printTable(result);
  console.log(JSON.stringify(result, null, opts.json ? 2 : 0));
  process.exit(result.pass ? 0 : 4);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((e) => {
    process.stderr.write(`plate-check-shot: ${e && e.stack ? e.stack : e}\n`);
    process.exit(1);
  });
}
