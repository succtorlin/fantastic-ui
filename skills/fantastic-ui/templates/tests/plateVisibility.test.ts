// Every shipped plate must be VISIBLE against the page, not just safe for text.
//
// Copied from the fantastic-ui skill (templates/tests/plateVisibility.test.ts). Edit the CONFIG
// block only; the rest runs unchanged under Vitest (with or without `globals: true`) and Jest.
//
// Why it exists: plates once shipped that passed every text-contrast gate and were still
// invisible. They were rendered on a base darker than the page (a "recessed well" token), so
// 80%+ of each plate sat below the page colour and only ~1% of its pixels differed from the page
// by 1.1:1. Measured by this test, the four shipped files scored ge_1_1 / ge_1_3 of 1.1 / 0.18,
// 0.6 / 0.07, 4.8 / 1.46 (56% darker than the page beyond 1.02:1) and 0.7 / 0.06 — all below the floor.
// This guards the FILES; plate-check.js (in the browser) guards the slot, scrim and text.
//
// Needs `sharp` to decode WebP/PNG/AVIF (npm i -D sharp).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ── CONFIG — edit this block only ─────────────────────────────────────────────
/** The page colour the plates sit on: the FIRST ground of the palette, as hex. */
const PAGE = "#0a0907";
/** Plate files, as paths or globs (`*`, `**`, `?`) relative to ROOT. */
const PLATES: string[] = ["public/plates/**/*.webp"];
/** Token plates: list ONLY plates made by gen_atmosphere `plate` (never AI rasters, whose dark
 *  areas are legitimate). Their base must not be darker than the page. Empty = check skipped. */
const TOKEN_PLATES: string[] = [];
/** Floors: % of pixels ≥ 1.1:1 and ≥ 1.3:1 against PAGE; max % of a token plate's pixels darker than
 *  PAGE (a pixel counts as darker only beyond `darkerMargin`:1, so codec jitter around the base does not). */
const FLOORS = { ge11: 8, ge13: 1, maxDarkerPct: 20, darkerMargin: 1.02 };
/** Directory the paths above are relative to (the test runner's cwd is the project root by default). */
const ROOT = process.cwd();
/** Optional: assert the stylesheet still defines the page colour you measured against, e.g.
 *  { file: "app/globals.css", includes: "--color-bg: oklch(0.14 0.005 70)" }. null to skip. */
const PAGE_SENTINEL = null as { file: string; includes: string } | null;
// ── END CONFIG ────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
/** describe/it/expect from Jest or Vitest globals, or Vitest's module when `globals` is off. */
function testApi(): any {
  const g = globalThis as any;
  if (typeof g.describe === "function" && typeof g.it === "function" && typeof g.expect === "function") return g;
  if (g.__vitest_index__) return g.__vitest_index__;
  throw new Error("plateVisibility: no describe/it/expect found — run under Vitest or Jest (or enable `globals`).");
}
const { describe, it, expect } = testApi();

async function loadSharp(): Promise<any> {
  const name = "sharp"; // a variable keeps type-checkers and bundlers from requiring it up front
  try {
    const m: any = await import(name);
    return m.default ?? m;
  } catch (e) {
    throw new Error(`plateVisibility: decoding plates needs \`sharp\` — install it with \`npm i -D sharp\`. (${String(e)})`);
  }
}

const hex = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) throw new Error(`plateVisibility: PAGE must be #rrggbb, got ${h}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

const PAGE_RGB = hex(PAGE);
const LP = lum(...PAGE_RGB);

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") { re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*"; i += glob[i + 2] === "/" ? 2 : 1; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

/** Expand paths/globs to sorted ROOT-relative paths. Plain paths are kept even if missing (and then fail). */
function expand(patterns: string[]): string[] {
  const found = new Set<string>();
  for (const raw of patterns) {
    const p = raw.replace(/^\.\//, "");
    if (!/[*?]/.test(p)) { found.add(p); continue; }
    const segs = p.split("/");
    const base = segs.slice(0, segs.findIndex((s) => /[*?]/.test(s))).join("/");
    const re = globToRegExp(p);
    for (const f of walk(join(ROOT, base))) {
      const rel = relative(ROOT, f).split(sep).join("/");
      if (re.test(rel)) found.add(rel);
    }
  }
  return [...found].sort();
}

async function visibility(file: string) {
  const sharp = await loadSharp();
  const [r, g, b] = PAGE_RGB;
  const { data, info } = await sharp(join(ROOT, file))
    .flatten({ background: { r, g, b } }) // transparent plate pixels show the page
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let n = 0, v11 = 0, v13 = 0, darker = 0;
  for (let k = 0; k < data.length; k += info.channels) {
    const l = lum(data[k], data[k + 1], data[k + 2]);
    const ratio = (Math.max(l, LP) + 0.05) / (Math.min(l, LP) + 0.05);
    n++;
    if (ratio >= 1.1) v11++;
    if (ratio >= 1.3) v13++;
    if (l < LP && ratio >= FLOORS.darkerMargin) darker++; // same rule as gen_atmosphere's visibility()
  }
  return { ge11: (100 * v11) / n, ge13: (100 * v13) / n, darker: (100 * darker) / n };
}

const FILES = expand(PLATES);
const TOKEN_FILES = expand(TOKEN_PLATES);
const f2 = (v: number) => v.toFixed(2);

describe("plates are visible against the page", () => {
  it("finds the plate files the config names", () => {
    const missing = FILES.filter((f) => !existsSync(join(ROOT, f)));
    expect({ found: FILES.length > 0, missing }).toEqual({ found: true, missing: [] });
  });

  if (FILES.length) {
    it.each(FILES.map((f) => [f]))(
      `%s clears the floor (≥${FLOORS.ge11}% of pixels ≥1.1:1 and ≥${FLOORS.ge13}% ≥1.3:1 against ${PAGE})`,
      async (file: string) => {
        const v = await visibility(file);
        const problems: string[] = [];
        if (v.ge11 < FLOORS.ge11) problems.push(`ge_1_1 ${f2(v.ge11)}% < ${FLOORS.ge11}%`);
        if (v.ge13 < FLOORS.ge13) problems.push(`ge_1_3 ${f2(v.ge13)}% < ${FLOORS.ge13}%`);
        if (problems.length) problems.push(`(${f2(v.darker)}% of pixels darker than the page — re-render on the page ground, or raise intensity)`);
        expect(problems).toEqual([]);
      }
    );
  }

  if (TOKEN_FILES.length) {
    it.each(TOKEN_FILES.map((f) => [f]))(
      `%s (token plate) is not built on a base darker than the page (≤${FLOORS.maxDarkerPct}% of pixels darker)`,
      async (file: string) => {
        const v = await visibility(file);
        const problems = v.darker > FLOORS.maxDarkerPct ? [`${f2(v.darker)}% of pixels darker than ${PAGE} — the palette's first ground is not the page`] : [];
        expect(problems).toEqual([]);
      }
    );
  }

  if (PAGE_SENTINEL) {
    const s = PAGE_SENTINEL;
    it(`the page colour is still defined in ${s.file}`, () => {
      const css = readFileSync(join(ROOT, s.file), "utf8");
      expect(css.includes(s.includes) ? [] : [`${s.file} no longer contains "${s.includes}" — update PAGE and re-measure`]).toEqual([]);
    });
  }
});
