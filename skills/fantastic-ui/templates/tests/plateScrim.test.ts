// The plate scrims in the stylesheet must stay BANDED, and phones must get the strip.
//
// Copied from the fantastic-ui skill (templates/tests/plateScrim.test.ts). Edit the CONFIG block
// only; the rest runs unchanged under Vitest (with or without `globals: true`) and Jest.
//
// Why it exists: a full-width scrim (94% → 35% across the whole header) left 0.1–0.4% of the
// plates visible while every text check passed. A banded scrim covers the text column and the
// far edge and leaves a clear band (two `transparent` stops) where the plate shows. Below 768 px
// the words span the full width, so header plates become a strip ABOVE the words instead.
// The slot catalogue (header-band, state-band, center-band, phone-strip) is in the skill's
// references/plate-slots.md; this test pins your CSS to it. Numbers come from plate-check.js.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── CONFIG — edit this block only ─────────────────────────────────────────────
/** The stylesheet that holds the plate rules, relative to ROOT. */
const CSS_FILE = "app/globals.css";
/** Plate layer rules (outside the phone media block) whose scrim must be banded. */
const BANDED: string[] = [".plate--header", ".plate--state", ".plate--center"];
/** The image layer in those rules; the scrim gradient must be listed BEFORE it (painted above). */
const IMAGE = "var(--plate)";
/** The phone block, the header strip rule inside it, and the header host that reserves the strip. */
const PHONE = {
  media: "(max-width: 767px)",
  strip: ".plate-host--header > .plate",
  host: ".plate-host--header",
  stripVar: "--plate-strip",
};
/** Also require token scrims: no literal colours and no `opacity` in the plate rules. */
const TOKEN_SCRIM = true;
const ROOT = process.cwd();
// ── END CONFIG ────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function testApi(): any {
  const g = globalThis as any;
  if (typeof g.describe === "function" && typeof g.it === "function" && typeof g.expect === "function") return g;
  if (g.__vitest_index__) return g.__vitest_index__;
  throw new Error("plateScrim: no describe/it/expect found — run under Vitest or Jest (or enable `globals`).");
}
const { describe, it, expect } = testApi();

type CssNode = { prelude: string; body?: string; children?: CssNode[] };

/** A small CSS reader: rules and nested at-rule blocks, comments stripped. Enough for a stylesheet's plate rules. */
function parseCss(src: string): CssNode[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  const block = (): CssNode[] => {
    const out: CssNode[] = [];
    let start = i;
    while (i < css.length) {
      const ch = css[i];
      if (ch === "{") {
        const prelude = css.slice(start, i).trim();
        i++;
        if (/^@(media|supports|layer|container|document)\b/.test(prelude)) out.push({ prelude, children: block() });
        else {
          const from = i;
          let depth = 1;
          while (i < css.length && depth) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; }
          out.push({ prelude, body: css.slice(from, i - 1) });
        }
        start = i;
      } else if (ch === "}") { i++; return out; }
      else if (ch === ";" && css.slice(start, i).trim().startsWith("@")) { i++; start = i; }
      else i++;
    }
    return out;
  };
  return block();
}

/** Split at top-level separators, respecting parentheses. */
function splitTop(s: string, sepCh: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && (sepCh === " " ? /\s/.test(ch) : ch === sepCh)) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const norm = (sel: string) => sel.replace(/\s*([>+~])\s*/g, " $1 ").replace(/\s+/g, " ").trim();
const matches = (prelude: string, selector: string) => splitTop(prelude, ",").some((s) => norm(s) === norm(selector));
const normMedia = (m: string) => m.replace(/\s+/g, " ").replace(/\(\s*/g, "(").replace(/\s*\)/g, ")").replace(/\s*:\s*/g, ": ").trim();

/** Rules matching `selector`, with the media prelude they sit in ("" at top level). */
function findRules(nodes: CssNode[], selector: string, media = ""): Array<{ media: string; body: string }> {
  const out: Array<{ media: string; body: string }> = [];
  for (const n of nodes) {
    if (n.children) out.push(...findRules(n.children, selector, n.prelude.startsWith("@media") ? n.prelude : media));
    else if (n.body != null && matches(n.prelude, selector)) out.push({ media, body: n.body });
  }
  return out;
}

function decl(body: string, prop: string): string | null {
  let found: string | null = null;
  for (const d of splitTop(body, ";")) {
    const k = d.indexOf(":");
    if (k > 0 && d.slice(0, k).trim().toLowerCase() === prop) found = d.slice(k + 1).trim(); // last one wins
  }
  return found;
}
const backgroundImage = (body: string) => decl(body, "background-image") ?? decl(body, "background");

/** The arguments of the first linear-gradient(…) in a value, split at top-level commas. */
function gradientArgs(value: string): string[] | null {
  const i = value.search(/(?:repeating-)?linear-gradient\(/);
  if (i < 0) return null;
  const open = value.indexOf("(", i);
  let depth = 0, j = open;
  for (; j < value.length; j++) { if (value[j] === "(") depth++; else if (value[j] === ")" && --depth === 0) break; }
  return splitTop(value.slice(open + 1, j), ",");
}
/** A stop is transparent if its colour (first token) is `transparent` — NOT a color-mix that mentions it. */
const isTransparentStop = (arg: string) => /^(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|#0{4}(0{4})?)$/i.test(splitTop(arg, " ")[0] ?? "");

const css = readFileSync(join(ROOT, CSS_FILE), "utf8");
const tree = parseCss(css);
const phoneMedia = (m: string) => normMedia(m).includes(normMedia(PHONE.media));

describe(`plate scrims in ${CSS_FILE}`, () => {
  it.each(BANDED.map((s) => [s]))("%s has a banded scrim: two transparent stops, listed above the plate", (selector: string) => {
    const rules = findRules(tree, selector).filter((r) => !phoneMedia(r.media));
    const problems: string[] = [];
    const value = rules.map((r) => backgroundImage(r.body)).filter(Boolean).pop() ?? null;
    if (!rules.length) problems.push(`no rule for ${selector} outside ${PHONE.media}`);
    else if (!value) problems.push(`${selector} sets no background-image`);
    else {
      const args = gradientArgs(value);
      const g = value.search(/linear-gradient\(/);
      const img = value.indexOf(IMAGE);
      if (!args) problems.push(`${selector}: no linear-gradient scrim`);
      else {
        const clear = args.filter(isTransparentStop).length;
        if (clear < 2) problems.push(`${selector}: ${clear} transparent stop(s) — a full-width scrim hides the plate; leave a band (two transparent stops)`);
      }
      if (img < 0) problems.push(`${selector}: the image layer ${IMAGE} is missing`);
      else if (g > img) problems.push(`${selector}: the scrim is listed after ${IMAGE}, so it paints under the plate`);
    }
    if (TOKEN_SCRIM) {
      for (const r of rules) {
        if (/#[0-9a-f]{3,8}\b|\brgba?\(/i.test(backgroundImage(r.body) ?? "")) problems.push(`${selector}: literal colour in the scrim — use color-mix(in oklab, var(--ground) N%, transparent)`);
        if (decl(r.body, "opacity") != null) problems.push(`${selector}: opacity on the plate layer — fade with the scrim, not opacity`);
      }
    }
    expect(problems).toEqual([]);
  });

  it(`below ${PHONE.media}, the header plate is a strip above the words`, () => {
    const problems: string[] = [];
    const strip = findRules(tree, PHONE.strip).filter((r) => phoneMedia(r.media));
    const host = findRules(tree, PHONE.host).filter((r) => phoneMedia(r.media));
    if (!strip.length) problems.push(`no ${PHONE.strip} rule inside @media ${PHONE.media}`);
    else {
      const body = strip[strip.length - 1].body;
      const bg = backgroundImage(body) ?? "";
      const args = gradientArgs(bg);
      if (!args) problems.push("the strip rule has no linear-gradient");
      else {
        const dir = args[0].trim();
        const vertical = /^(180deg|to bottom)$/.test(dir) || !/^(to |-?[\d.]+(deg|turn|rad|grad))/.test(dir);
        if (!vertical) problems.push(`the strip gradient runs ${dir}; it must run top → bottom (180deg)`);
        const stops = /^(to |-?[\d.]+(deg|turn|rad|grad))/.test(dir) ? args.slice(1) : args;
        if (!stops.length || !isTransparentStop(stops[0])) problems.push("the strip gradient must start transparent (the unscrimmed strip)");
        if (stops.filter(isTransparentStop).length < 2) problems.push("the strip needs two transparent stops (clear through the strip, then fade in)");
      }
      if (!bg.includes(PHONE.stripVar)) problems.push(`the strip gradient should be sized by var(${PHONE.stripVar})`);
      const size = splitTop(decl(body, "background-size") ?? "", ",");
      if (size.length < 2 || !/\bauto\b/.test(size[1])) problems.push("background-size must be `100% 100%, <width> auto` (the image keeps its aspect)");
      const pos = splitTop(decl(body, "background-position") ?? "", ",");
      if (pos.length < 2 || !/\btop\b/.test(pos[1])) problems.push("background-position must anchor the image at the top (e.g. `0 0, right top`)");
    }
    const pad = host.map((r) => decl(r.body, "padding-top")).filter(Boolean).pop();
    if (!pad || !pad.includes(PHONE.stripVar)) problems.push(`${PHONE.host} must reserve the strip: padding-top: calc(var(${PHONE.stripVar}) + …)`);
    if (!new RegExp(`${PHONE.stripVar.replace(/[-]/g, "\\-")}\\s*:`).test(css)) problems.push(`${PHONE.stripVar} is never defined`);
    expect(problems).toEqual([]);
  });
});
