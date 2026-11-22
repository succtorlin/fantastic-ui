// node --test scripts/showcase-gate.test.mjs
// The pure tests always run. The browser tests need playwright and
// @axe-core/playwright (PLAYWRIGHT_DIR=<node_modules>) and are skipped without.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { renderedScale, judgeShowcase, showcaseConfig, DEFAULTS } from "./showcase-gate.mjs";
import { loadTools, serve, run } from "./exam.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = showcaseConfig();
const DESKTOP = CFG.densities[0];
const PHONE = CFG.densities[1];

/** One well-formed showcase image as collectShowcase would report it. */
const image = (over = {}) => ({
  name: "work-1440.webp", alt: "Run page of the product", ariaHidden: false,
  hasWidthHeight: true, hasSrcset: true, loading: "", top: 400, inFirstScreen: true,
  boxW: 600, boxH: 450, naturalW: 1440, naturalH: 1080, fit: "cover", kb: 120, ...over,
});
const facts = (...images) => ({ viewportH: 900, images, live: 0 });

describe("renderedScale", () => {
  test("cover scales by the larger axis, contain by the smaller", () => {
    const box = { boxW: 600, boxH: 300, naturalW: 1200, naturalH: 1200 };
    assert.equal(renderedScale({ ...box, fit: "cover" }), 0.5);
    assert.equal(renderedScale({ ...box, fit: "contain" }), 0.25);
  });
  test("scale-down never enlarges, none never scales, and fill is judged on its worse axis", () => {
    const small = { boxW: 600, boxH: 600, naturalW: 300, naturalH: 300 };
    assert.equal(renderedScale({ ...small, fit: "scale-down" }), 1);
    assert.equal(renderedScale({ ...small, fit: "none" }), 1);
    assert.equal(renderedScale({ boxW: 600, boxH: 300, naturalW: 300, naturalH: 300, fit: "fill" }), 2);
  });
  test("an image that did not load has no scale to trust", () => {
    assert.equal(renderedScale({ boxW: 600, boxH: 450, naturalW: 0, naturalH: 0 }), Infinity);
  });
});

describe("judgeShowcase", () => {
  test("a sharp, light, well-marked image passes all three gates", () => {
    const v = judgeShowcase(facts(image()), CFG, DESKTOP);
    assert.deepEqual([v.markup, v.sharpness, v.weight], [[], [], []]);
    assert.equal(v.firstScreenKB, 120);
  });

  test("sharpness: the same file can pass at 1x and fail once the density is counted", () => {
    const img = image({ naturalW: 800, naturalH: 600 }); // 600 px box: 0.75 at 1x
    assert.deepEqual(judgeShowcase(facts(img), CFG, { width: 1440, height: 900, dpr: 1 }).sharpness, []);
    const at2x = judgeShowcase(facts(img), CFG, DESKTOP).sharpness;
    assert.equal(at2x.length, 1);
    assert.match(at2x[0], /upscaled 1\.50× at 1440@2x \(800px wide, needs ≥1200px\)/);
  });

  test("sharpness: the tolerance allows 2% and no more", () => {
    const edge = (naturalW) => judgeShowcase(facts(image({ naturalW, naturalH: naturalW * 0.75 })), CFG, DESKTOP).sharpness.length;
    assert.equal(edge(1200), 0);  // exactly 1.00
    assert.equal(edge(1180), 0);  // 1.017
    assert.equal(edge(1150), 1);  // 1.043
  });

  test("sharpness: an image that failed to load fails, and a hidden one is skipped", () => {
    assert.match(judgeShowcase(facts(image({ naturalW: 0, naturalH: 0 })), CFG, PHONE).sharpness[0], /did not load at 390@3x/);
    assert.deepEqual(judgeShowcase(facts(image({ boxW: 0, boxH: 0, naturalW: 10, naturalH: 10 })), CFG, PHONE).sharpness, []);
  });

  test("weight: one heavy file fails, and so does a heavy first screen made of files that each pass", () => {
    assert.match(judgeShowcase(facts(image({ kb: 201 })), CFG, DESKTOP).weight[0], /201 KB at 1440@2x \(max 200\)/);
    const four = [1, 2, 3, 4].map((n) => image({ name: `w${n}.webp`, kb: 180 }));
    const v = judgeShowcase(facts(...four), CFG, DESKTOP);
    assert.deepEqual(v.weight, ["first screen 720 KB at 1440@2x (max 600)"]);
  });

  test("weight: images below the first screen do not count toward its total", () => {
    const below = image({ kb: 190, inFirstScreen: false, top: 2400, loading: "lazy" });
    const v = judgeShowcase(facts(image({ kb: 190 }), below, below, below), CFG, DESKTOP);
    assert.deepEqual(v.weight, []);
    assert.equal(v.firstScreenKB, 190);
  });

  test("weight: a size that cannot be measured fails instead of passing as zero", () => {
    assert.match(judgeShowcase(facts(image({ kb: 0 })), CFG, DESKTOP).weight[0], /size not measurable/);
  });

  test("markup: each missing piece is named", () => {
    const bad = image({ alt: " ", ariaHidden: true, hasWidthHeight: false, hasSrcset: false });
    const [line] = judgeShowcase(facts(bad), CFG, DESKTOP).markup;
    for (const want of [/no alt text/, /aria-hidden/, /no width\/height/, /no srcset/]) assert.match(line, want);
  });

  test("markup: lazy inside the first screen fails, and so does eager far below it", () => {
    assert.match(judgeShowcase(facts(image({ loading: "lazy" })), CFG, DESKTOP).markup[0], /loading=lazy inside the first screen/);
    const far = image({ inFirstScreen: false, top: 2700 });
    assert.match(judgeShowcase(facts(far), CFG, DESKTOP).markup[0], /not lazy, 3 screens down/);
    assert.deepEqual(judgeShowcase(facts(image({ inFirstScreen: false, top: 1200 })), CFG, DESKTOP).markup, []);
  });

  test("markup: a page of the preset with no showcase image fails; an optional lane does not", () => {
    assert.match(judgeShowcase(facts(), CFG, DESKTOP).markup[0], /no img\[data-showcase\] and no live art/);
    assert.deepEqual(judgeShowcase(facts(), showcaseConfig({ required: false }), DESKTOP).markup, []);
  });

  test("markup: live art drawn in the page stands in for image files", () => {
    assert.deepEqual(judgeShowcase({ viewportH: 900, images: [], live: 3 }, CFG, DESKTOP).markup, []);
    const mixed = judgeShowcase({ viewportH: 900, images: [image({ alt: "" })], live: 3 }, CFG, DESKTOP).markup;
    assert.match(mixed[0], /no alt text/, "an image beside live art is still judged");
  });

  test("markup and weight are judged once: later densities check sharpness only", () => {
    const v = judgeShowcase(facts(image({ alt: "", kb: 999 })), CFG, PHONE, { checkMarkup: false, checkWeight: false });
    assert.deepEqual([v.markup, v.weight], [[], []]);
  });

  test("a preset's declared values replace the defaults one by one", () => {
    const cfg = showcaseConfig({ maxKB: 90 });
    assert.equal(cfg.maxKB, 90);
    assert.equal(cfg.firstScreenKB, DEFAULTS.firstScreenKB);
    assert.equal(judgeShowcase(facts(image({ kb: 120 })), cfg, DESKTOP).weight.length, 1);
  });
});

// ---------- in a real browser, through verify-preset.mjs ----------
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length);
  return out;
};
/** An RGB PNG: flat (compresses to almost nothing) or noise (does not compress). */
function png(w, h, noise = false) {
  const row = 1 + w * 3;
  const raw = noise ? randomBytes(row * h) : Buffer.alloc(row * h, 0x80);
  for (let y = 0; y < h; y++) raw[y * row] = 0;
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>
<style>img{display:block;object-fit:cover}</style></head><body><main><h1>Showcase</h1>${body}</main></body></html>`;
const shot = (file, w, h, extra = "") => `<img data-showcase src="${file}" srcset="${file} ${w}w" sizes="300px" alt="A captured screen" width="${w}" height="${h}" style="width:300px;height:225px" ${extra}>`;

let tools = null;
try { tools = await loadTools(process.env.PLAYWRIGHT_DIR || null); } catch {}
const skip = tools ? false : "playwright and @axe-core/playwright not installed";

describe("showcase lane in a browser (mutation tests)", { skip }, () => {
  let dir, srv, base;
  const verify = async (file, preset) => {
    const cwd = process.env.PLAYWRIGHT_DIR ? resolve(process.env.PLAYWRIGHT_DIR, "..") : process.cwd();
    const r = await run(process.execPath, [join(HERE, "verify-preset.mjs"), "--url", `${base}/${file}`, "--preset", preset], { cwd });
    const line = (id) => r.out.split("\n").find((l) => l.includes(` ${id} `)) || "";
    const after_ = (id) => { const ls = r.out.split("\n"); const i = ls.findIndex((l) => l.includes(` ${id} `)); return i < 0 ? "" : `${ls[i]}\n${ls[i + 1] || ""}`; };
    return { out: r.out, line, block: after_ };
  };
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "fui-showcase-"));
    writeFileSync(join(dir, "sharp.png"), png(1200, 900));          // 300 px box: 0.25, fine at 3x
    writeFileSync(join(dir, "medium.png"), png(210, 210, true));    // ~130 KB: over 30, under 200
    writeFileSync(join(dir, "blurry.png"), png(100, 75));           // 300 px box: 3x at 1x
    writeFileSync(join(dir, "heavy.png"), png(420, 420, true));     // ~520 KB
    writeFileSync(join(dir, "good.html"), page(shot("sharp.png", 1200, 900) +
      `<img data-showcase src="medium.png" srcset="medium.png 210w" sizes="60px" alt="A second screen" width="210" height="210" style="width:60px;height:60px">`));
    writeFileSync(join(dir, "blurry.html"), page(shot("blurry.png", 100, 75)));
    writeFileSync(join(dir, "heavy.html"), page(shot("heavy.png", 420, 420)));
    writeFileSync(join(dir, "unmarked.html"), page(shot("sharp.png", 1200, 900) + `<img src="medium.png" alt="" width="210" height="210" style="width:60px;height:60px">`));
    writeFileSync(join(dir, "dodge.html"), page(shot("sharp.png", 1200, 900) + `<img data-showcase src="medium.png" srcset="medium.png 210w" alt="" width="210" height="210" style="width:60px;height:60px">`));
    writeFileSync(join(dir, "empty.html"), page("<p>No pictures of the work.</p>"));
    writeFileSync(join(dir, "live.html"), page(`<div data-showcase-live style="width:300px;height:200px"><div>A run, drawn from its data</div></div>`));
    writeFileSync(join(dir, "live-empty.html"), page(`<div data-showcase-live style="width:300px;height:200px"></div>`));
    // Preset M's layout trap: the art box pulled up over the tile's words.
    const tile = (cls, artStyle) => page(`<article class="tile ${cls}" style="position:relative;width:320px">
      <h2 class="tile__title">Run page</h2><p class="tile__desc">A finished run.</p>
      <div class="tile__art" style="${artStyle}">${shot("sharp.png", 1200, 900)}</div></article>`);
    writeFileSync(join(dir, "art-over.html"), tile("", "margin-top:-60px"));
    writeFileSync(join(dir, "art-under.html"), tile("", ""));
    writeFileSync(join(dir, "art-full.html"), tile("tile--full", "margin-top:-60px"));
    ({ srv, base } = await serve(dir));
  });
  after(() => { srv?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

  test("sharp, marked showcase images pass, and a 130 KB one is not held to the 30 KB cap", async () => {
    const r = await verify("good.html", "M");
    for (const id of ["showcase-markup", "showcase-sharpness", "showcase-weight", "asset-weight"]) assert.match(r.line(id), /^\s*PASS/, `${id}\n${r.out}`);
    assert.match(r.line("asset-weight"), /2 showcase file\(s\) judged separately/);
  });

  test("an image the browser must enlarge fails sharpness at both densities", async () => {
    const r = await verify("blurry.html", "M");
    assert.match(r.block("showcase-sharpness"), /FAIL[\s\S]*blurry\.png upscaled 6\.00× at 1440@2x[\s\S]*9\.00× at 390@3x/);
  });

  test("a file over the per-file budget fails weight", async () => {
    const r = await verify("heavy.html", "M");
    assert.match(r.block("showcase-weight"), /FAIL[\s\S]*heavy\.png \d+ KB at 1440@2x \(max 200\)/);
  });

  test("an image without the mark stays under the 30 KB cap", async () => {
    const r = await verify("unmarked.html", "M");
    assert.match(r.block("asset-weight"), /FAIL[\s\S]*medium\.png/);
  });

  test("marking a decorative image does not buy it the exemption", async () => {
    const r = await verify("dodge.html", "M");
    assert.match(r.block("asset-weight"), /FAIL[\s\S]*medium\.png/);
    assert.match(r.block("showcase-markup"), /FAIL[\s\S]*medium\.png: no alt text/);
  });

  test("a page of the preset with no showcase image fails", async () => {
    const r = await verify("empty.html", "M");
    assert.match(r.block("showcase-markup"), /FAIL[\s\S]*no img\[data-showcase\] and no live art/);
  });

  test("live art with something drawn in it satisfies the lane; an empty marked box does not", async () => {
    assert.match((await verify("live.html", "M")).line("showcase-markup"), /PASS.*1 live art element/);
    assert.match((await verify("live-empty.html", "M")).block("showcase-markup"), /FAIL[\s\S]*no live art/);
  });

  test("trap: art over a tile's words fails; art below them, or a declared full-bleed tile, passes", async () => {
    const id = "trap:art-never-over-the-words";
    assert.match((await verify("art-over.html", "M")).block(id), /FAIL[\s\S]*overlaps \d+ copy element/);
    assert.match((await verify("art-under.html", "M")).line(id), /PASS.*no overlap/);
    assert.match((await verify("art-full.html", "M")).line(id), /PASS/);
  });

  test("on a preset without the lane the mark changes nothing: the 30 KB cap applies and no showcase gate runs", async () => {
    const r = await verify("good.html", "L");
    assert.match(r.block("asset-weight"), /FAIL[\s\S]*medium\.png/);
    assert.equal(r.line("showcase-sharpness"), "");
  });
});
