#!/usr/bin/env node
/**
 * verify-preset.mjs — run a preset's gates against a live page.
 *
 *   node verify-preset.mjs --url http://localhost:3000 --preset F
 *   node verify-preset.mjs --url http://localhost:3000 --preset F --theme-key app-theme --themes dark,light
 *
 * Gates come from preset-gates.json, which is transcribed from
 * references/theme-presets.md. Seven gates are universal; three more are
 * per-preset (accent, separation strategy, radii) plus each direction's own
 * stated traps.
 *
 * WHAT THIS CANNOT CHECK, stated so nobody mistakes a pass for a verdict:
 *   - density (airy / medium / dense) — a composition judgement
 *   - whether the result actually reads as the direction
 *   - anything only visible in a state the page was not driven into
 * A green run means "no gate was violated", never "this is good design".
 *
 * Requires: playwright, @axe-core/playwright (resolved from the CWD, so run it
 * from a project that has them installed).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATES = JSON.parse(readFileSync(join(HERE, "preset-gates.json"), "utf8"));

// ---------- args ----------
const arg = (k, d = null) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const URL_ = arg("url");
const PRESET = (arg("preset") || "").toUpperCase();
const THEME_KEY = arg("theme-key");                 // localStorage key, if the page has themes
const THEMES = (arg("themes") || "").split(",").filter(Boolean);
const SCOPE = arg("scope", "body");                 // limit checks to a subtree

if (!URL_ || !GATES.presets[PRESET]) {
  console.error("usage: verify-preset.mjs --url <url> --preset <A-K> [--theme-key <ls-key> --themes dark,light] [--scope <sel>]");
  console.error("presets:", Object.keys(GATES.presets).join(" "));
  process.exit(2);
}

const P = GATES.presets[PRESET];
const U = GATES.universal;
const results = [];
const record = (id, pass, evidence, note) => results.push({ id, pass, evidence, note });

// ---------- colour helpers, injected into the page ----------
// Canvas resolution handles oklab/color-mix/gradients and composites alpha.
// A regex over computed strings silently misreads oklab channels as RGB.
const HELPERS = `
const __cv = document.createElement('canvas'); __cv.width = __cv.height = 8;
const __x = __cv.getContext('2d', { willReadFrequently: true });
function paint(css, under) {
  __x.clearRect(0,0,8,8); __x.fillStyle = under; __x.fillRect(0,0,8,8);
  try { __x.fillStyle = css } catch (e) {}
  __x.fillRect(0,0,8,8);
  const d = __x.getImageData(4,4,1,1).data; return [d[0], d[1], d[2]];
}
function lum(c){ const s=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}); return .2126*s[0]+.7152*s[1]+.0722*s[2]; }
function ratio(a,b){ const L1=lum(a),L2=lum(b); return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); }
function groundOf(el){
  const layers=[]; let n=el;
  const pageBg = getComputedStyle(document.body).backgroundColor;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const m = [...cs.backgroundImage.matchAll(/(rgba?|oklab|oklch|color-mix)\\([^)]*\\)/g)].map(s=>s[0]);
      if (m.length) { layers.push(...m); break; }
    }
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') layers.push(cs.backgroundColor);
    n = n.parentElement;
  }
  let base = pageBg;
  for (let i = layers.length - 1; i >= 0; i--) base = 'rgb(' + paint(layers[i], base) + ')';
  return paint(base, pageBg);
}
function visibleTextNodes(scope){
  const out=[];
  for (const el of document.querySelector(scope).querySelectorAll('*')) {
    if (!el.textContent || !el.textContent.trim() || el.children.length) continue;
    const cs = getComputedStyle(el);
    if (cs.display==='none' || cs.visibility==='hidden' || !el.getClientRects().length) continue;
    out.push(el);
  }
  return out;
}
`;

// ---------- runner ----------
const { chromium } = await import(join(process.cwd(), "node_modules", "playwright", "index.mjs"))
  .catch(() => import("playwright"));

const browser = await chromium.launch();

async function newPage(theme) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL_, { waitUntil: "networkidle" });
  if (theme && THEME_KEY) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [THEME_KEY, theme]);
    // Reload so the theme applies at parse time. Reading computed styles in the
    // same task as the switch returns stale inherited values.
    await page.reload({ waitUntil: "networkidle" });
  }
  await page.waitForTimeout(700);
  return { ctx, page };
}

const themeList = THEMES.length ? THEMES : [null];

// ===== GATE 1 (universal): contrast =====
for (const theme of themeList) {
  const { ctx, page } = await newPage(theme);
  const r = await page.evaluate(({ helpers, scope, min, minLarge, lgPx, lgBoldPx }) => {
    eval(helpers);
    const fails = [];
    let total = 0, worst = { r: 99, cls: "" };
    for (const el of visibleTextNodes(scope)) {
      const cs = getComputedStyle(el);
      const fg = paint(cs.color, "rgb(255,255,255)");
      const rr = ratio(fg, groundOf(el));
      const px = parseFloat(cs.fontSize);
      const large = px >= lgPx || (px >= lgBoldPx && parseInt(cs.fontWeight) >= 700);
      total++;
      const need = large ? minLarge : min;
      if (rr < need) fails.push(`${(el.className || el.tagName).toString().slice(0, 26)} ${rr.toFixed(2)} (need ${need})`);
      if (rr < worst.r) worst = { r: +rr.toFixed(2), cls: (el.className || el.tagName).toString().slice(0, 24) };
    }
    return { total, fails, worst };
  }, { helpers: HELPERS, scope: SCOPE, min: U.contrastMin, minLarge: U.contrastMinLarge, lgPx: U.largeTextPx, lgBoldPx: U.largeBoldPx });
  record(`contrast${theme ? ` [${theme}]` : ""}`, r.fails.length === 0,
    `${r.total - r.fails.length}/${r.total} pass, lowest ${r.worst.r}:1 (.${r.worst.cls})`,
    r.fails.slice(0, 5).join(" | "));
  await ctx.close();
}

// ===== GATES 2-7 (universal) + per-preset, on the default theme =====
{
  const { ctx, page } = await newPage(themeList[0]);

  // 2. zero webfonts
  const fonts = await page.evaluate(() => {
    const faces = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch (e) { return [] } })
      .filter(r => r.constructor.name === "CSSFontFaceRule").length;
    const remote = performance.getEntriesByType("resource")
      .filter(e => /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(e.name)).map(e => e.name);
    return { faces, remote };
  });
  record("zero-webfonts", fonts.faces === 0 && fonts.remote.length === 0,
    `${fonts.faces} @font-face rules, ${fonts.remote.length} font requests`, fonts.remote.slice(0, 3).join(", "));

  // 3. asset weight
  const heavy = await page.evaluate((maxKB) => performance.getEntriesByType("resource")
    .filter(e => /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(e.name))
    .map(e => ({ n: e.name.split("/").pop(), kb: Math.round((e.encodedBodySize || e.transferSize || 0) / 1024) }))
    .filter(a => a.kb > maxKB), U.maxAssetKB);
  record("asset-weight", heavy.length === 0, `${heavy.length} over ${U.maxAssetKB}KB`,
    heavy.map(a => `${a.n} ${a.kb}KB`).join(", "));

  // 4. focus ring on interactive elements
  const ring = await page.evaluate(() => {
    const missing = [];
    for (const el of document.querySelectorAll("a[href], button, select, input, textarea, summary, [tabindex]")) {
      if (!el.getClientRects().length) continue;
      // :focus-visible only matches on keyboard interaction for non-text
      // controls, so read the RULE rather than forcing focus — a programmatic
      // .focus() reports outline:none on a button that rings correctly.
      const has = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch (e) { return [] } })
        .some(r => r.selectorText && /:focus-visible/.test(r.selectorText) &&
          (() => { try { return el.matches(r.selectorText.replace(/:focus-visible/g, "")) } catch (e) { return false } })() &&
          /outline/.test(r.style.cssText));
      if (!has) missing.push(el.tagName + "." + (el.className || "").toString().slice(0, 18));
    }
    return missing;
  });
  record("focus-ring", ring.length === 0, `${ring.length} controls without a :focus-visible outline rule`,
    [...new Set(ring)].slice(0, 5).join(", "));

  // 5. reduced-motion path
  const rm = await page.evaluate(() => [...document.styleSheets]
    .flatMap(s => { try { return [...s.cssRules] } catch (e) { return [] } })
    .some(r => r.media && /prefers-reduced-motion/.test(r.conditionText || r.media.mediaText)));
  record("reduced-motion", rm, rm ? "@media prefers-reduced-motion present" : "no reduced-motion block found");

  // 6. token roles filled
  const roles = await page.evaluate((req) => {
    const cs = getComputedStyle(document.documentElement);
    const scoped = getComputedStyle(document.querySelector(".page") || document.body);
    return req.filter(r => !cs.getPropertyValue("--" + r).trim() && !scoped.getPropertyValue("--" + r).trim());
  }, U.requiredTokenRoles);
  record("token-roles", roles.length === 0, `${U.requiredTokenRoles.length - roles.length}/${U.requiredTokenRoles.length} roles defined`,
    roles.length ? "missing: " + roles.join(", ") : "");

  // 7. accent discipline (per preset)
  if (P.accent === null) {
    record("accent-absent", true, "preset declares no accent — nothing to over-use", "not machine-verifiable beyond token absence");
  } else {
    const filled = await page.evaluate((scope) => {
      const out = [];
      for (const el of document.querySelector(scope).querySelectorAll("a,button,[role=button]")) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)") out.push(bg);
      }
      return out;
    }, SCOPE);
    const counts = filled.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    record("accent-fill-restraint", true,
      `${filled.length} filled controls; most common ${top ? top[0] + " ×" + top[1] : "none"}`,
      "ADVISORY — the 'one highest-intent action' rule is per-surface intent, not a hard count");
  }

  // 8. universal trap: white never partners the accent
  if (P.accent) {
    // Resolve the accent from the PAGE's own token first, falling back to the
    // preset's published value. theme-presets.md permits a stated deviation
    // (swapping the accent while keeping the direction), and a gate pinned to
    // the published hex silently passes on every page that does so — which is
    // precisely how this check failed its first mutation test.
    const liveAccent = await page.evaluate(() => {
      const el = document.querySelector(".page") || document.documentElement;
      const cs = getComputedStyle(el);
      return (cs.getPropertyValue("--accent-fill") || cs.getPropertyValue("--accent") || "").trim() || null;
    });
    const accentUsed = liveAccent || P.accent;
    const bad = await page.evaluate(({ helpers, scope, accent }) => {
      eval(helpers);
      const acc = paint(accent, "rgb(0,0,0)");
      const near = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) < 24;
      const hits = [];
      for (const el of visibleTextNodes(scope)) {
        const cs = getComputedStyle(el);
        const fg = paint(cs.color, "rgb(0,0,0)");
        if (fg[0] > 244 && fg[1] > 244 && fg[2] > 244 && near(groundOf(el), acc))
          hits.push((el.className || el.tagName).toString().slice(0, 26));
      }
      return hits;
    }, { helpers: HELPERS, scope: SCOPE, accent: accentUsed });
    record("trap:white-never-partners-accent", bad.length === 0,
      (bad.length ? `${bad.length} element(s) render white on the accent` : "none") +
      `  [accent tested: ${accentUsed}${liveAccent && liveAccent.toLowerCase() !== P.accent.toLowerCase() ? " — page deviates from the preset's " + P.accent : ""}]`,
      bad.slice(0, 4).join(", "));
  }

  // 9. separation strategy (shadow vs hairline must not mix)
  const sep = await page.evaluate((scope) => {
    let shadowed = 0, hairlined = 0;
    for (const el of document.querySelector(scope).querySelectorAll("section,article,aside,.card,.panel,[class*=panel],[class*=card]")) {
      if (!el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.boxShadow && cs.boxShadow !== "none") shadowed++;
      const bw = ["Top","Right","Bottom","Left"].map(s => parseFloat(cs["border" + s + "Width"]) || 0);
      if (bw.some(w => w > 0)) hairlined++;
    }
    return { shadowed, hairlined };
  }, SCOPE);
  const wantsShadow = P.separation === "shadow";
  const sepOK = wantsShadow ? sep.shadowed > 0 : sep.shadowed === 0;
  record("separation-strategy", sepOK,
    `declared ${P.separation}; found ${sep.shadowed} shadowed / ${sep.hairlined} bordered surfaces`,
    sepOK ? "" : wantsShadow
      ? "preset separates with shadows but none are present"
      : "preset separates with hairlines — shadows found (theme-presets.md: do not mix the two strategies)");

  // 10. per-preset geometry traps
  for (const trap of (P.traps || [])) {
    if (trap.kind !== "geometry") continue;
    const hit = await page.evaluate(({ sel, against }) => {
      const g = document.querySelector(sel);
      if (!g) return { skipped: true };
      if (getComputedStyle(g).display === "none") return { hidden: true };
      const gr = g.getBoundingClientRect();
      const ov = (a, b) => !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
      const hits = [];
      for (const el of document.querySelectorAll(against)) {
        if (!el.getClientRects().length || el.contains(g) || g.contains(el)) continue;
        if (ov(gr, el.getBoundingClientRect())) hits.push(el.tagName);
      }
      return { hits };
    }, { sel: trap.selector, against: trap.mustNotOverlap });
    if (hit.skipped) record(`trap:${trap.id}`, true, "element not present on this page (device unused)");
    else if (hit.hidden) record(`trap:${trap.id}`, true, "element hidden at this width");
    else record(`trap:${trap.id}`, hit.hits.length === 0,
      hit.hits.length ? `overlaps ${hit.hits.length} copy element(s): ${[...new Set(hit.hits)].join(", ")}` : "no overlap", trap.rule);
  }

  await ctx.close();
}

// ===== GATE: reflow across widths =====
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const bad = [];
  for (const w of U.reflowWidths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL_, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (o.sw > o.iw + 1) bad.push(`${w}px +${o.sw - o.iw}`);
  }
  record("reflow", bad.length === 0, `${U.reflowWidths.length - bad.length}/${U.reflowWidths.length} widths clean`, bad.join(", "));
  await ctx.close();
}

// ===== axe, as the backstop =====
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL_, { waitUntil: "networkidle" });
  const { default: AxeBuilder } = await import(join(process.cwd(), "node_modules", "@axe-core", "playwright", "dist", "index.mjs"))
    .catch(() => import("@axe-core/playwright"));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const crit = r.violations.filter(v => ["critical", "serious"].includes(v.impact));
  record("axe-wcag22aa", crit.length === 0, `${crit.length} critical/serious, ${r.incomplete.length} incomplete`,
    crit.map(v => `${v.id}×${v.nodes.length}`).join(", ") +
    (r.incomplete.length ? ` | incomplete must be measured by hand: ${r.incomplete.map(i => i.id).join(", ")}` : ""));
  await ctx.close();
}

await browser.close();

// ---------- report ----------
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  Preset ${PRESET} — ${P.name}`);
console.log(`  ${URL_}${THEMES.length ? `  themes: ${THEMES.join(", ")}` : ""}\n`);
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${pad(r.id, 34)} ${r.evidence}`);
  if (r.note) console.log(`        ${" ".repeat(34)} ${r.note}`);
}
console.log(`\n  ${failed === 0 ? "All gates passed" : failed + " gate(s) failed"} — ${results.length} checked`);
console.log(`  NOT CHECKED: density (${P.density}), and whether the result reads as the direction.`);
console.log(`  A green run means no gate was violated. It is not a verdict on the design.\n`);
process.exit(failed === 0 ? 0 : 1);
