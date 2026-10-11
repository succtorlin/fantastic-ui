#!/usr/bin/env node
// Browser half of the plate-visibility eval: measure plates on the COMPOSITED
// page (scrim + fit + real text) with scripts/plate-check.js, at desktop and
// phone widths. Optional: needs Playwright, which this repo does not install.
//
//   node skills/fantastic-ui/evals/plate-visibility/score_page.mjs                 # serves fixture/
//   node .../score_page.mjs --dir path/to/agent/output                             # serve another folder
//   node .../score_page.mjs --url http://localhost:3000/positions                  # an app already running
//   node .../score_page.mjs --widths 1440,768,375 --json
//   node .../score_page.mjs --expect '.route-head|background-image|positions-head'  # stale-CSS sentinel
//
// Exit: 0 every width passes; 1 a gate failed (invisible plate, text under
// 4.5:1 / 3:1, a plate behind data or on an error/filtered state, no plate
// hosts at all, or stale CSS); 2 Playwright/Chromium missing or bad usage.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(HERE, "fixture");
const DEFAULT_CHECK = path.resolve(HERE, "../../scripts/plate-check.js");
const DEFAULT_WIDTHS = [1440, 375];
const VIEWPORT_HEIGHT = 900;
// Same default as plate-check.js, so the policy checks look at the same hosts.
const DEFAULT_HOSTS = "[data-plate-host], .plate-host, .route-plate-host, .desk-plate-host";
// A plate host must never wrap these: data, or a state that is not "empty".
const DATA_SELECTOR = "table, [role=table], [role=grid]";
const PLAIN_STATE_SELECTOR = "[role=alert], [data-kind=error], [data-kind=filtered], [data-kind=loading]";

const USAGE = `usage: score_page.mjs [--dir DIR | --url URL] [--widths 1440,375] [--page '#hex']
                     [--hosts SELECTOR] [--expect 'selector|property|includes']... [--check plate-check.js] [--json]`;

function die(code, msg) {
  process.stderr.write(`score_page: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { dir: null, url: null, widths: DEFAULT_WIDTHS, page: null, hosts: null,
                 expect: [], check: DEFAULT_CHECK, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) die(2, `${a} needs a value\n${USAGE}`);
      return argv[++i];
    };
    if (a === "--dir") opts.dir = path.resolve(val());
    else if (a === "--url") opts.url = val();
    else if (a === "--widths") {
      opts.widths = val().split(",").map((w) => Number.parseInt(w, 10));
      if (opts.widths.some((w) => !Number.isFinite(w) || w < 200)) die(2, "--widths wants e.g. 1440,375");
    } else if (a === "--page") opts.page = val();
    else if (a === "--hosts") opts.hosts = val();
    else if (a === "--expect") {
      const [selector, property, includes] = val().split("|");
      if (!selector || !property || includes === undefined) die(2, "--expect wants 'selector|property|includes'");
      opts.expect.push({ selector, property, includes });
    } else if (a === "--check") opts.check = path.resolve(val());
    else if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") { process.stdout.write(USAGE + "\n"); process.exit(0); }
    else die(2, `unknown argument ${a}\n${USAGE}`);
  }
  if (opts.dir && opts.url) die(2, "give --dir or --url, not both");
  if (!opts.url && !opts.dir) opts.dir = DEFAULT_DIR;
  return opts;
}

// Same resolver as scripts/plate-check-shot.mjs: the cwd's node_modules first (your project),
// then this file's directory — a bare import("playwright") would only look next to this file.
async function loadPlaywright() {
  let chromium = null;
  try {
    const { loadPlaywright: resolveFromCwd } = await import(pathToFileURL(path.resolve(HERE, "../../scripts/plate-check-shot.mjs")).href);
    chromium = await resolveFromCwd(import.meta.url);
  } catch (e) {
    process.stderr.write(`score_page: could not load the Playwright resolver (${e.message.split("\n")[0]})\n`);
  }
  if (!chromium) {
    die(2, "Playwright is not installed, so the browser half of this eval cannot run.\n" +
      "  Install it where you run this:  npm i -D playwright && npx playwright install chromium\n" +
      "  (the offline half needs no browser: bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh)");
  }
  return chromium;
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".avif": "image/avif" };

function serveDir(root) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = path.resolve(root, "." + urlPath);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
                           "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Runs in the page: hosts that wrap data or a non-empty state.
function policyProbe({ hosts, data, plain }) {
  const out = [];
  for (const host of document.querySelectorAll(hosts)) {
    const r = host.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const label = host.id ? `#${host.id}` : host.className ? `.${String(host.className).trim().split(/\s+/).join(".")}` : host.tagName.toLowerCase();
    if (host.matches(data) || host.querySelector(data)) out.push(`plate behind data: ${label}`);
    if (host.matches(plain) || host.querySelector(plain) || host.closest(plain)) out.push(`plate on an error/filtered/loading state: ${label}`);
  }
  return out;
}

function fmtWorst(w) {
  if (w == null) return "-";
  if (typeof w === "number") return w.toFixed(2);
  if (typeof w === "object" && typeof w.ratio === "number") return `${w.ratio.toFixed(2)}${w.need ? `/${w.need}` : ""}`;
  return String(w);
}

async function measure(chromium, target, opts) {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    die(2, `Playwright is installed but Chromium would not start (${e.message.split("\n")[0]}).\n` +
      "  Run: npx playwright install chromium");
  }
  const checkerOpts = {};
  if (opts.page) checkerOpts.page = opts.page;
  if (opts.hosts) checkerOpts.hosts = opts.hosts;
  if (opts.expect.length) checkerOpts.expect = opts.expect;
  const results = [];
  try {
    for (const width of opts.widths) {
      const ctx = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
      const page = await ctx.newPage();
      await page.goto(target, { waitUntil: "load" });
      await page.evaluate(() => document.fonts?.ready);
      await page.addScriptTag({ path: opts.check });
      const report = await page.evaluate((o) => window.plateCheck(o), checkerOpts);
      const policy = await page.evaluate(policyProbe,
        { hosts: opts.hosts ?? DEFAULT_HOSTS, data: DATA_SELECTOR, plain: PLAIN_STATE_SELECTOR });
      results.push({ width, report, policy });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

function verdict({ report, policy }) {
  const reasons = [];
  if (report?.stale) reasons.push("stale CSS: an --expect sentinel did not match; nothing was measured (rebuild / clear the dev cache)");
  else if (!report?.hosts?.length) reasons.push("no plate hosts found: nothing to measure");
  else {
    for (const h of report.hosts) {
      if (h.visible === false) reasons.push(`${h.selector}: invisible plate (${h.visibility?.ge_1_1}% >=1.1, ${h.visibility?.ge_1_3}% >=1.3; floor 8/1)`);
      if (h.textPass === false) reasons.push(`${h.selector}: text under its floor (worst ${fmtWorst(h.worstText)})`);
    }
    if (report.pass === false && reasons.length === 0) reasons.push("plate-check reported pass=false");
  }
  reasons.push(...policy);
  return reasons;
}

function printHuman(results, target) {
  console.log(`plate-check on ${target}`);
  for (const r of results) {
    console.log(`\n@${r.width}px`);
    for (const h of r.report?.hosts ?? []) {
      const v = h.visibility ?? {};
      console.log(`  ${String(h.selector).padEnd(36)} ${String(h.box ?? "?").padEnd(10)} fit=${String(h.fit ?? "?").padEnd(6)} ` +
        `visible ${v.ge_1_1 ?? "?"}% >=1.1, ${v.ge_1_3 ?? "?"}% >=1.3 ${h.visible ? "ok" : "LOW"}  ` +
        `worst text ${fmtWorst(h.worstText)} ${h.textPass ? "ok" : "LOW"}`);
    }
    const reasons = verdict(r);
    console.log(reasons.length ? reasons.map((x) => `  FAIL ${x}`).join("\n") : "  PASS");
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chromium = await loadPlaywright();
  if (!existsSync(opts.check)) die(2, `plate-check.js not found at ${opts.check} (pass --check PATH)`);

  let server = null;
  let target = opts.url;
  if (!target) {
    if (!existsSync(path.join(opts.dir, "index.html"))) die(2, `no index.html in ${opts.dir}`);
    server = await serveDir(opts.dir);
    target = `http://127.0.0.1:${server.address().port}/`;
  }
  let results;
  try {
    results = await measure(chromium, target, opts);
  } finally {
    server?.close();
  }
  const failed = results.some((r) => verdict(r).length > 0);
  if (opts.json) {
    console.log(JSON.stringify({ target, pass: !failed,
      widths: results.map((r) => ({ width: r.width, report: r.report, policy: r.policy, reasons: verdict(r) })) }, null, 2));
  } else {
    printHuman(results, target);
    console.log(failed ? "\nFAIL" : "\nPASS");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => die(1, e.stack ?? String(e)));
