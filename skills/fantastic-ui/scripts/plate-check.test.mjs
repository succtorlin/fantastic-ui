// node --test skills/fantastic-ui/scripts/plate-check.test.mjs   (Node ≥ 20, no deps)
// Unit tests for the pure helpers in plate-check.js, plus the "Playwright not installed"
// path of plate-check-shot.mjs. The browser path is exercised by the lead / the eval.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { plateCheck, _internals: I } = require("./plate-check.js");

const near = (a, b, eps = 0.6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} expected ${b}±${eps}, got ${a}`);
const PAGE = { r: 10, g: 9, b: 7 };

describe("module shape", () => {
  test("exports plateCheck with _internals", () => {
    assert.equal(typeof plateCheck, "function");
    assert.equal(plateCheck._internals, I);
    for (const k of ["parseGradient", "resolveFit", "compositeLum", "visibility", "percentile", "measurePixels"]) assert.equal(typeof I[k], "function", k);
  });
});

describe("parseColor — the four serialisations Chrome emits", () => {
  test("rgba(0, 0, 0, 0) and transparent are alpha 0", () => {
    assert.deepEqual(I.parseColor("rgba(0, 0, 0, 0)"), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(I.parseColor("transparent"), { r: 0, g: 0, b: 0, a: 0 });
  });
  test("rgb() comma, space and percentage syntax", () => {
    assert.deepEqual(I.parseColor("rgb(10, 9, 7)"), { r: 10, g: 9, b: 7, a: 1 });
    assert.deepEqual(I.parseColor("rgb(10 9 7 / 50%)"), { r: 10, g: 9, b: 7, a: 0.5 });
    assert.deepEqual(I.parseColor("rgba(255, 0, 0, 0.25)"), { r: 255, g: 0, b: 0, a: 0.25 });
  });
  test("oklab(L a b / alpha), numbers and percentages", () => {
    const white = I.parseColor("oklab(1 0 0 / 0.94)");
    near(white.r, 255, 0.6); near(white.g, 255, 0.6); near(white.b, 255, 0.6);
    assert.equal(white.a, 0.94);
    const pct = I.parseColor("oklab(100% 0% 0%)");
    near(pct.r, 255, 0.6);
    // #0a0907 ≈ oklab(0.1401 0.0003 0.0052); round-trip within a unit
    const page = I.parseColor("oklab(0.1401 0.0003 0.0052 / 0.86)");
    near(page.r, 10, 1); near(page.g, 9, 1); near(page.b, 7, 1);
    assert.equal(page.a, 0.86);
  });
  test("color(srgb …) with and without alpha", () => {
    assert.deepEqual(I.parseColor("color(srgb 1 0.5 0)"), { r: 255, g: 127.5, b: 0, a: 1 });
    const c = I.parseColor("color(srgb 0.0392 0.0353 0.0275 / 0.92)");
    near(c.r, 10, 0.1); assert.equal(c.a, 0.92);
  });
  test("hex forms and garbage", () => {
    assert.deepEqual(I.parseColor("#0a0907"), { r: 10, g: 9, b: 7, a: 1 });
    assert.deepEqual(I.parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
    assert.equal(I.parseColor("#00000080").a, 128 / 255);
    assert.equal(I.parseColor("not-a-colour"), null);
    assert.equal(I.parseColor("oklab(nonsense)"), null);
  });
});

describe("evalLength", () => {
  test("px, %, calc, max, min, clamp", () => {
    assert.equal(I.evalLength("48px", 0), 48);
    assert.equal(I.evalLength("50%", 200), 100);
    assert.equal(I.evalLength("calc(64px - 16px)", 0), 48);
    assert.equal(I.evalLength("calc(64px * 5)", 0), 320);
    assert.equal(I.evalLength("max(100%, 320px)", 343), 343);
    assert.equal(I.evalLength("max(100%, 320px)", 300), 320);
    assert.equal(I.evalLength("min(100%, calc(10px + 5%))", 200), 20);
    assert.equal(I.evalLength("clamp(10px, 50%, 40px)", 200), 40);
    assert.equal(I.evalLength("calc(50% + 10px)", -100), -40);
  });
  test("unsupported units are NaN (the browser probe takes over)", () => {
    assert.ok(Number.isNaN(I.evalLength("2em", 100)));
    assert.ok(Number.isNaN(I.evalLength("calc(1vw + 2px)", 100)));
  });
});

describe("splitLayers", () => {
  test("url layer under gradient layers", () => {
    const L = I.splitLayers('linear-gradient(90deg, rgba(0, 0, 0, 0) 58%, rgb(1, 2, 3) 100%), url("http://x.test/a b.webp")');
    assert.deepEqual(L.map((l) => l.kind), ["gradient", "url"]);
    assert.equal(L[1].url, "http://x.test/a b.webp");
    assert.equal(I.splitLayers("none")[0].kind, "none");
    assert.equal(I.splitLayers("url(/p.webp)")[0].url, "/p.webp");
  });
});

// The header-band scrim, as Chrome serialises it (color-mix → oklab, transparent → rgba(0, 0, 0, 0)).
const HEADER_BAND =
  "linear-gradient(90deg, oklab(0.1401 0.0003 0.0052 / 0.94) 0%, oklab(0.1401 0.0003 0.0052 / 0.86) 40%, " +
  "rgba(0, 0, 0, 0) 58%, rgba(0, 0, 0, 0) 78%, oklab(0.1401 0.0003 0.0052 / 0.85) 90%, oklab(0.1401 0.0003 0.0052 / 0.88) 100%)";
// The phone strip: 180deg, px stops.
const PHONE_STRIP =
  "linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 48px, color(srgb 0.0392 0.0353 0.0275 / 0.92) 64px, color(srgb 0.0392 0.0353 0.0275 / 0.92) 100%)";

describe("parseGradient", () => {
  test("regression: `transparent` serialised as rgba(0, 0, 0, 0) 58% is a stop, alpha 0", () => {
    const g = I.parseGradient(HEADER_BAND);
    assert.equal(g.error, undefined);
    assert.equal(g.axis, "x");
    assert.equal(g.reverse, false);
    assert.equal(g.stops.length, 6);
    assert.deepEqual(g.stops.map((s) => s.pos), ["0%", "40%", "58%", "78%", "90%", "100%"]);
    assert.deepEqual(g.stops.map((s) => Math.round(s.color.a * 100)), [94, 86, 0, 0, 85, 88]);
  });
  test("180deg default direction with px stops and color(srgb) colours", () => {
    const g = I.parseGradient(PHONE_STRIP);
    assert.equal(g.axis, "y");
    assert.deepEqual(g.stops.map((s) => s.pos), ["0px", "48px", "64px", "100%"]);
    assert.equal(g.stops[2].color.a, 0.92);
  });
  test("`to right`, `to bottom`, explicit 180deg, `to left` (reversed), and an interpolation clause", () => {
    assert.equal(I.parseGradient("linear-gradient(to right, red, blue)", () => ({ r: 0, g: 0, b: 0, a: 1 })).axis, "x");
    assert.equal(I.parseGradient("linear-gradient(to bottom, #000, #fff)").axis, "y");
    assert.equal(I.parseGradient("linear-gradient(180deg, #000, #fff)").axis, "y");
    const left = I.parseGradient("linear-gradient(to left, #000, #fff)");
    assert.deepEqual([left.axis, left.reverse], ["x", true]);
    const top = I.parseGradient("linear-gradient(0deg, #000, #fff)");
    assert.deepEqual([top.axis, top.reverse], ["y", true]);
    assert.equal(I.parseGradient("linear-gradient(in oklab 90deg, #000, #fff)").axis, "x");
    assert.equal(I.parseGradient("linear-gradient(0.25turn, #000, #fff)").axis, "x");
  });
  test("unpositioned stops are distributed evenly; double positions expand", () => {
    const g = I.parseGradient("linear-gradient(90deg, #000, #111, #222, #333 90px)");
    const s = I.resolveStops(g, 100, I.evalLength);
    assert.deepEqual(s.map((x) => x.pos), [0, 30, 60, 90]);
    const d = I.parseGradient("linear-gradient(90deg, #000 10% 20%, #fff)");
    assert.deepEqual(d.stops.map((x) => x.pos), ["10%", "20%", null]);
  });
  test("non-monotonic positions clamp to the previous stop", () => {
    const g = I.parseGradient("linear-gradient(90deg, #000 50%, #fff 20%)");
    assert.deepEqual(I.resolveStops(g, 100, I.evalLength).map((x) => x.pos), [50, 50]);
  });
  test("a colour-mix stop is not mistaken for an interpolation clause", () => {
    const g = I.parseGradient("linear-gradient(90deg, color-mix(in oklab, red 50%, transparent) 0%, #000 100%)", (s) =>
      s.startsWith("color-mix") ? { r: 255, g: 0, b: 0, a: 0.5 } : I.parseColor(s));
    assert.equal(g.stops[0].color.a, 0.5);
  });
  test("calc stop positions go through the injected resolver against the line length", () => {
    const g = I.parseGradient("linear-gradient(rgba(0, 0, 0, 0) calc(64px - 16px), #000 calc(100% - 10px))");
    const calls = [];
    const s = I.resolveStops(g, 200, (e, b) => { calls.push([e, b]); return I.evalLength(e, b); });
    assert.deepEqual(s.map((x) => x.pos), [48, 190]);
    assert.deepEqual(calls.map((c) => c[1]), [200, 200]);
  });
  test("unsupported angles and colours are reported, not thrown", () => {
    assert.equal(I.parseGradient("linear-gradient(45deg, #000, #fff)").error, "unsupported_angle");
    assert.equal(I.parseGradient("linear-gradient(to top right, #000, #fff)").error, "unsupported_angle");
    assert.equal(I.parseGradient("linear-gradient(90deg, wat, #fff)").error, "unparsed_color");
    assert.equal(I.parseGradient("radial-gradient(#000, #fff)").error, "not_linear_gradient");
  });
  test("gradientAt interpolates premultiplied: the colour holds while alpha fades to transparent", () => {
    const g = I.parseGradient(HEADER_BAND);
    const s = I.resolveStops(g, 1000, I.evalLength);
    const mid = I.gradientAt(s, 490); // halfway between 40% (.86) and 58% (0)
    near(mid.a, 0.43, 0.01);
    near(mid.r, 10, 1);
    assert.equal(I.gradientAt(s, 700).a, 0);
    near(I.gradientAt(s, 1000).a, 0.88, 1e-9);
  });
});

describe("resolveFit — injected length resolver", () => {
  const spy = () => {
    const calls = [];
    const fn = (e, b) => { calls.push(e); return I.evalLength(e, b); };
    fn.calls = calls;
    return fn;
  };
  const IMG = { w: 1600, h: 320 };

  test("cover, right center (header-band on a 1170×90 strip)", () => {
    const f = I.resolveFit({ size: "cover", posX: "100%", posY: "50%", repeat: "no-repeat" }, { w: 1170, h: 90 }, IMG, spy());
    near(f.w, 1170, 1e-9); near(f.h, 234, 1e-9); near(f.x, 0, 1e-9); near(f.y, -72, 1e-9);
    assert.equal(f.kind, "cover");
    assert.deepEqual([f.repeatX, f.repeatY], [false, false]);
  });
  test("cover on a tall state magnifies (the pitfall the band fixes)", () => {
    const f = I.resolveFit({ size: "cover", posX: "right", posY: "center", repeat: "no-repeat" }, { w: 900, h: 420 }, IMG);
    near(f.h, 420, 1e-9); near(f.w, 2100, 1e-9); near(f.x, -1200, 1e-9);
  });
  test("band: `100% 100%, 100% auto` — the image layer is 100% auto, centred", () => {
    const rl = spy();
    const f = I.resolveFit({ size: "100% auto", posX: "50%", posY: "50%", repeat: "no-repeat" }, { w: 900, h: 420 }, IMG, rl);
    near(f.w, 900, 1e-9); near(f.h, 180, 1e-9); near(f.y, 120, 1e-9); near(f.x, 0, 1e-9);
    assert.equal(f.kind, "band");
    assert.ok(rl.calls.includes("100%"));
    // the gradient layer of the same rule (100% 100%) fills the area
    const g = I.resolveFit({ size: "100% 100%", posX: "50%", posY: "50%", repeat: "no-repeat" }, { w: 900, h: 420 }, null, rl);
    assert.deepEqual([g.x, g.y, g.w, g.h], [0, 0, 900, 420]);
  });
  test("strip: `max(100%, 320px) auto` at `right top` on a phone header", () => {
    const rl = spy();
    const wide = I.resolveFit({ size: "max(100%, 320px) auto", posX: "right", posY: "top", repeat: "no-repeat" }, { w: 343, h: 150 }, IMG, rl);
    near(wide.w, 343, 1e-9); near(wide.h, 68.6, 1e-9); near(wide.x, 0, 1e-9); near(wide.y, 0, 1e-9);
    assert.equal(wide.kind, "band"); // geometry alone is not a strip; the scrim makes it one (planSlot)
    assert.ok(rl.calls.includes("max(100%, 320px)"));
    const narrow = I.resolveFit({ size: "max(100%, 320px) auto", posX: "100%", posY: "0%", repeat: "no-repeat" }, { w: 300, h: 150 }, IMG);
    near(narrow.w, 320, 1e-9); near(narrow.x, -20, 1e-9); near(narrow.h, 64, 1e-9);
  });
  test("keyword + offset positions and repeat parsing", () => {
    assert.equal(I.resolveAxisPos("right 10px", 100), 90);
    assert.equal(I.resolveAxisPos("left 25%", 200), 50);
    assert.equal(I.resolveAxisPos("center", 80), 40);
    assert.equal(I.resolveAxisPos("calc(50% + 10px)", -100), -40);
    assert.deepEqual(I.parseRepeat("no-repeat"), { x: false, y: false });
    assert.deepEqual(I.parseRepeat("repeat-x"), { x: true, y: false });
    assert.deepEqual(I.parseRepeat("repeat no-repeat"), { x: true, y: false });
  });
  test("contain and auto sizes", () => {
    const c = I.resolveFit({ size: "contain", posX: "0%", posY: "0%", repeat: "no-repeat" }, { w: 800, h: 400 }, IMG);
    near(c.w, 800, 1e-9); near(c.h, 160, 1e-9);
    assert.equal(c.kind, "contain");
    const a = I.resolveFit({ size: "auto", posX: "0%", posY: "0%", repeat: "no-repeat" }, { w: 2000, h: 400 }, IMG);
    assert.deepEqual([a.w, a.h, a.kind], [1600, 320, "custom"]);
  });
});

describe("composite and visibility on a synthetic buffer", () => {
  test("compositeLum: out = a·scrim + (1−a)·plate", () => {
    const plate = { r: 200, g: 200, b: 200 };
    assert.equal(I.compositeLum(plate, { ...PAGE, a: 0 }), I.luminance(200, 200, 200));
    near(I.compositeLum(plate, { ...PAGE, a: 1 }), I.luminance(10, 9, 7), 1e-12);
    const half = I.compositeLum(plate, { ...PAGE, a: 0.5 });
    near(half, I.luminance(105, 104.5, 103.5), 1e-12);
  });

  // A 10×2 slot: plate = page colour except two bright columns (x = 6, 7); a header-band-like scrim.
  const w = 10, h = 2;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const bright = x === 6 || x === 7;
    data.set(bright ? [120, 120, 120, 255] : [10, 9, 7, 255], i);
  }

  test("a band left clear by the scrim stays visible; a full scrim hides it", () => {
    const grad = I.parseGradient(HEADER_BAND);
    const rect = { x: 0, y: 0, w: 10, h: 2, repeatX: false, repeatY: false };
    const band = I.gradientLayer(grad, rect, w, h, 1, I.evalLength);
    const px = I.compositeSlot({ w, h, base: PAGE, image: { data }, above: [band] });
    const v = I.visibility(px.lum, I.coverMask(rect, w, h, 1), I.luminance(10, 9, 7));
    assert.equal(v.ge_1_1, 20); // the two bright columns of ten, both inside the 58–78% band
    assert.equal(v.ge_1_3, 20);

    const full = I.gradientLayer(I.parseGradient("linear-gradient(90deg, rgb(10, 9, 7) 0%, rgb(10, 9, 7) 100%)"), rect, w, h, 1);
    const hidden = I.compositeSlot({ w, h, base: PAGE, image: { data }, above: [full] });
    assert.equal(I.visibility(hidden.lum, null, I.luminance(10, 9, 7)).ge_1_1, 0);
  });

  test("visibility counts only image-covered pixels (band / strip)", () => {
    // image covers only row 0
    const rect = { x: 0, y: 0, w: 10, h: 1, repeatX: false, repeatY: false };
    const mask = I.coverMask(rect, w, h, 1);
    assert.equal(mask.reduce((a, b) => a + b, 0), 10);
    const px = I.compositeSlot({ w, h, base: PAGE, image: { data } });
    const v = I.visibility(px.lum, mask, I.luminance(10, 9, 7));
    assert.equal(v.n, 10);
    assert.equal(v.ge_1_1, 20);
  });

  test("layers below the image are painted under it; above are painted last-to-first", () => {
    const red = { axis: "x", along: new Float32Array(4).fill(0), perp: new Uint8Array([1]) };
    red.along.set([255, 0, 0, 1]);
    const blueHalf = { axis: "x", along: new Float32Array([0, 0, 255, 0.5]), perp: new Uint8Array([1]) };
    const img = { data: new Uint8ClampedArray([0, 255, 0, 0]) }; // fully transparent image pixel
    const px = I.compositeSlot({ w: 1, h: 1, base: PAGE, below: [red], image: img, above: [blueHalf] });
    assert.deepEqual(Array.from(px.rgb), [127.5, 0, 127.5]);
  });

  test("a darker-than-page plate under header-band scores far below the floor", () => {
    // 80% of pixels darker than the page (the "recessed well" failure), the rest barely lighter.
    const W = 100, H = 20;
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) d.set(i % 5 === 0 ? [14, 13, 11, 255] : [4, 4, 3, 255], i * 4);
    const rect = { x: 0, y: 0, w: W, h: H, repeatX: false, repeatY: false };
    const px = I.compositeSlot({ w: W, h: H, base: PAGE, image: { data: d }, above: [I.gradientLayer(I.parseGradient(HEADER_BAND), rect, W, H, 1)] });
    const v = I.visibility(px.lum, I.coverMask(rect, W, H, 1), I.luminance(10, 9, 7));
    assert.ok(v.ge_1_1 < 8 && v.ge_1_3 < 1, JSON.stringify(v));
  });
});

describe("text percentile selection", () => {
  test("nearest-rank percentile", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(I.percentile(xs, 90), 9);
    assert.equal(I.percentile(xs, 10), 1);
    assert.equal(I.percentile([5], 90), 5);
    assert.ok(Number.isNaN(I.percentile([], 90)));
  });
  const slot = (greys) => {
    const data = new Uint8ClampedArray(greys.length * 4);
    greys.forEach((g, i) => data.set([g, g, g, 255], i * 4));
    return I.rgbaToRgbLum(data, greys.length, 1);
  };
  test("light text on a dark page is judged against p90 (the lightest background)", () => {
    const px = slot([10, 10, 10, 10, 10, 10, 10, 10, 60, 200]);
    const idx = [...Array(10).keys()];
    const t = I.textContrast(idx, px.lum, px.rgb, { r: 230, g: 230, b: 230, a: 1 }, PAGE);
    assert.equal(t.which, "p90");
    near(t.bgLum, I.luminance(60, 60, 60), 1e-7);
  });
  test("dark text on a light page is judged against p10 (the darkest background)", () => {
    const px = slot([250, 250, 250, 250, 250, 250, 250, 250, 180, 30]);
    const t = I.textContrast([...Array(10).keys()], px.lum, px.rgb, { r: 20, g: 20, b: 20, a: 1 }, { r: 250, g: 250, b: 250 });
    assert.equal(t.which, "p10");
    near(t.bgLum, I.luminance(30, 30, 30), 1e-7);
  });
  test("large-text threshold and measurePixels report shape", () => {
    assert.equal(I.isLargeText(24, 400), true);
    assert.equal(I.isLargeText(18.66, 700), true);
    assert.equal(I.isLargeText(18.66, 400), false);
    const px = slot([10, 10, 10, 10, 10, 10, 120, 120, 10, 10]);
    const r = I.measurePixels({
      px, w: 10, h: 1, mask: null, page: PAGE,
      texts: [
        { text: "Title", color: { r: 230, g: 228, b: 224, a: 1 }, need: 3, rects: [{ x: 0, y: 0, w: 5, h: 1 }] },
        { text: "meta", color: { r: 60, g: 60, b: 60, a: 1 }, need: 4.5, rects: [{ x: 5, y: 0, w: 5, h: 1 }] },
      ],
    });
    assert.deepEqual(r.visibility, { ge_1_1: 20, ge_1_3: 20 });
    assert.equal(r.visible, true);
    assert.equal(r.text.length, 2);
    assert.equal(r.text[0].pass, true);
    assert.equal(r.text[1].pass, false);
    assert.equal(r.worstText.text, "meta");
    assert.equal(r.textPass, false);
    for (const k of ["text", "ratio", "need", "pass"]) assert.ok(k in r.text[0], k);
  });
});

describe("loadImage never throws", () => {
  test("a CORS / network failure is { error: image_unreadable, url }", async () => {
    const r = await I.loadImage("https://cdn.example/x.webp", {
      fetch: async () => { throw new TypeError("Failed to fetch"); },
      createImageBitmap: async () => ({ width: 1, height: 1 }),
    });
    assert.equal(r.error, "image_unreadable");
    assert.equal(r.url, "https://cdn.example/x.webp");
  });
  test("HTTP errors and decode failures are reported too", async () => {
    const r404 = await I.loadImage("/x.webp", { fetch: async () => ({ ok: false, status: 404 }), createImageBitmap: async () => ({}) });
    assert.match(r404.detail, /404/);
    const bad = await I.loadImage("/x.webp", {
      fetch: async () => ({ ok: true, status: 200, blob: async () => ({}) }),
      createImageBitmap: async () => { throw new Error("The source image could not be decoded."); },
    });
    assert.equal(bad.error, "image_unreadable");
    const ok = await I.loadImage("/x.webp", {
      fetch: async () => ({ ok: true, status: 200, blob: async () => ({}) }),
      createImageBitmap: async () => ({ width: 1600, height: 320 }),
    });
    assert.deepEqual([ok.width, ok.height], [1600, 320]);
  });
});

describe("plate-check-shot.mjs", () => {
  const shot = join(here, "plate-check-shot.mjs");
  const run = (args, env = {}) => spawnSync(process.execPath, [shot, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  test("exits 2 with a clear message when Playwright is not installed", () => {
    const r = run(["http://127.0.0.1:9/"], { PLATE_CHECK_NO_PLAYWRIGHT: "1" });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /Playwright is not installed/);
    assert.match(r.stderr, /npm i -D playwright/);
  });
  test("exits 2 with usage when no URL is given; --help exits 0", () => {
    const r = run([]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage/i);
    const h = run(["--help"]);
    assert.equal(h.status, 0);
    assert.match(h.stdout, /usage/i);
  });
  test("rejects a bad --widths value with exit 2", () => {
    const r = run(["http://127.0.0.1:9/", "--widths", "wide"]);
    assert.equal(r.status, 2);
  });
});

// ── review round 2 ────────────────────────────────────────────────────────────
// A synthetic, low-frequency plate (1600×320 grey). The expected numbers are what
// `gen_atmosphere.py score --scrim phone-strip --fit strip --strip 64` printed for the same
// plate written as a PNG (2026-10-11); the parity bound is 0.5 points.
const IW = 1600, IH = 320;
const plateAt = (x, y) => Math.round(10 + 70 * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / 400)) * (0.5 + 0.5 * Math.cos((2 * Math.PI * y) / 160)));
const OK = "oklab(0.140138 0.000313625 0.00516728 / 0.92)"; // color-mix(in oklab, #0a0907 92%, transparent), as Chrome serialises it
const STRIP_STYLE = {
  backgroundImage: `linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 48px, ${OK} 64px, ${OK} 100%), url("http://x.test/p.webp")`,
  backgroundSize: "100% 100%, max(100%, 320px) auto",
  backgroundPositionX: "0px, 100%",
  backgroundPositionY: "0px, 0%",
  backgroundRepeat: "no-repeat",
  backgroundOrigin: "padding-box",
};
function simulate(W, H, style, stripPx) {
  const plan = I.planSlot({ W, H, style, img: { w: IW, h: IH }, resolveLen: I.evalLength, resolveColor: I.parseColor, stripPx });
  const r = plan.imgRect;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = ((x + 0.5 - r.x) / r.w) * IW, v = ((y + 0.5 - r.y) / r.h) * IH;
    if (u >= 0 && u < IW && v >= 0 && v < IH) { const g = plateAt(u, v); data.set([g, g, g, 255], (y * W + x) * 4); }
  }
  const { px, mask } = I.rasterSlot(plan, { w: W, h: H, k: 1, data, base: PAGE, resolveLen: I.evalLength });
  const pageLum = I.luminance(10, 9, 7);
  return { plan, v: I.visibility(px.lum, mask, pageLum), unclipped: I.visibility(px.lum, I.coverMask(r, W, H, 1), pageLum) };
}

describe("H1: the phone strip counts only rows above the strip", () => {
  const cases = [
    // viewport, slot, score's ge_1_1 / ge_1_3 for the same plate and slot
    [375, 343, 150, 35.6, 21.31],
    [600, 568, 150, 41.93, 22.33],
    [760, 728, 140, 33.46, 15.05],
  ];
  for (const [vw, W, H, s11, s13] of cases) {
    test(`${vw}px viewport (${W}×${H}) classifies as strip and matches score within 0.5`, () => {
      const { plan, v, unclipped } = simulate(W, H, STRIP_STYLE);
      assert.equal(plan.fit, "strip");
      assert.equal(plan.strip, 64);
      near(v.ge_1_1, s11, 0.5, "ge_1_1");
      near(v.ge_1_3, s13, 0.5, "ge_1_3");
      assert.ok(unclipped.ge_1_1 < v.ge_1_1 - 2, `the unclipped mask under-reports (${unclipped.ge_1_1} vs ${v.ge_1_1})`);
    });
  }
  test("760px: the image covers the whole box, and it is still a strip (not cover)", () => {
    const { plan } = simulate(728, 140, STRIP_STYLE);
    assert.ok(plan.imgRect.h >= 140);
    assert.equal(I.classifyFit("max(100%, 320px) auto", plan.imgRect, { w: 728, h: 140 }), "cover");
    assert.equal(I.classifyFit("max(100%, 320px) auto", plan.imgRect, { w: 728, h: 140 }, 64), "strip");
  });
  test("stripPx option overrides the detected height", () => {
    const { plan } = simulate(343, 150, STRIP_STYLE, 40);
    assert.equal(plan.strip, 40);
  });
  test("stripHeight needs a vertical, px-stop scrim that starts clear and reaches ≥ .85", () => {
    const sh = (g, len = 150) => I.stripHeight(I.parseGradient(g), len, I.evalLength);
    assert.equal(sh(`linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 48px, ${OK} 64px, ${OK} 100%)`), 64);
    assert.equal(sh(`linear-gradient(to bottom, rgba(0, 0, 0, 0) 0px, ${OK} 80px)`), 80);
    assert.equal(sh(`linear-gradient(rgba(0, 0, 0, 0) 0%, ${OK} 40%)`), null); // % stops: a vertical band, not a strip
    assert.equal(sh(`linear-gradient(90deg, rgba(0, 0, 0, 0) 0px, ${OK} 64px)`), null);
    assert.equal(sh("linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(10, 9, 7, 0.5) 64px)"), null);
    assert.equal(sh(`linear-gradient(${OK} 0px, ${OK} 64px)`), null);
  });
  test("a header band without a strip scrim is not a strip", () => {
    const { plan } = simulate(400, 90, { ...STRIP_STYLE, backgroundImage: `linear-gradient(90deg, ${OK} 0%, rgba(0, 0, 0, 0) 58%, rgba(0, 0, 0, 0) 78%, ${OK} 100%), url("p.webp")`, backgroundSize: "cover", backgroundPositionX: "100%", backgroundPositionY: "50%" });
    assert.equal(plan.fit, "cover");
    assert.equal(plan.strip, null);
  });
});

describe("M4: unsupported and unmodelled layers make the measurement partial", () => {
  test("planSlot lists unsupported layers above and below the image", () => {
    const plan = I.planSlot({
      W: 400, H: 90, img: { w: IW, h: IH }, resolveColor: I.parseColor,
      style: { backgroundImage: 'radial-gradient(rgb(0, 0, 0), rgba(0, 0, 0, 0)), linear-gradient(45deg, rgb(0, 0, 0), rgb(1, 1, 1)), linear-gradient(90deg, rgb(10, 9, 7), rgba(0, 0, 0, 0)), url("p.webp"), conic-gradient(red, blue)', backgroundSize: "cover", backgroundRepeat: "no-repeat" },
    });
    assert.equal(plan.above.length, 1);
    assert.deepEqual(plan.unsupported.map((u) => [u.position, u.reason]), [["above", "unsupported_layer"], ["above", "unsupported_angle"], ["below", "unsupported_layer"]]);
  });
  test("an image-set or unparsed colour above the image is unsupported too", () => {
    const plan = I.planSlot({ W: 100, H: 50, img: { w: 10, h: 10 }, resolveColor: I.parseColor,
      style: { backgroundImage: 'image-set("a.webp" 1x), linear-gradient(90deg, wat, rgb(0, 0, 0)), url("p.webp")', backgroundSize: "cover" } });
    assert.deepEqual(plan.unsupported.map((u) => u.reason), ["unsupported_layer", "unparsed_color"]);
    assert.equal(I.planSlot({ W: 1, H: 1, img: { w: 1, h: 1 }, style: { backgroundImage: "linear-gradient(#000, #fff)" } }).error, "no_image_layer");
  });
  test("unmodelledProps flags layer opacity, mask, filter, blend mode and host opacity", () => {
    const clean = { opacity: "1", maskImage: "none", filter: "none", mixBlendMode: "normal" };
    assert.deepEqual(I.unmodelledProps(clean, { opacity: "1" }), []);
    const got = I.unmodelledProps({ opacity: "0.6", maskImage: "linear-gradient(black, transparent)", filter: "blur(2px)", mixBlendMode: "screen" }, { opacity: "0.9" });
    assert.equal(got.length, 5);
    assert.deepEqual(I.unmodelledProps({ ...clean, webkitMaskImage: "url(m.svg)", maskImage: undefined }, {}), ["layer mask-image"]);
  });
});

describe("M3: an all-skipped page does not pass", () => {
  const ok = { selector: "a", pass: true };
  const skip = { selector: "b", skipped: "layer_hidden", pass: true };
  test("all skipped → pass:false, error all_skipped, unless allowAllSkipped", () => {
    assert.deepEqual(I.summarize([skip], false), { skipped: 1, skippedHosts: ["b"], pass: false, error: "all_skipped" });
    assert.equal(I.summarize([skip], true).pass, true);
    assert.equal(I.summarize([skip], true).error, "all_skipped");
  });
  test("one measured host is enough; no hosts is no_hosts", () => {
    assert.deepEqual(I.summarize([ok, skip]), { skipped: 1, skippedHosts: ["b"], pass: true });
    assert.equal(I.summarize([{ selector: "c", pass: false }, skip]).pass, false);
    assert.deepEqual(I.summarize([]), { skipped: 0, skippedHosts: [], pass: false, error: "no_hosts" });
  });
});

describe("M1 / LOW 4: loadImage falls back to <img> and times out", () => {
  const okFetch = async () => ({ ok: true, status: 200, blob: async () => ({ type: "image/svg+xml" }) });
  const noBitmap = async () => { throw new Error("The source image could not be decoded."); };
  test("an SVG createImageBitmap rejects is drawn through the <img> fallback, sized from the layer", async () => {
    let seen = null;
    const r = await I.loadImage("data:image/svg+xml,…", {
      fetch: okFetch, createImageBitmap: noBitmap, size: { w: 300, h: 60 },
      loadImageElement: async (blob, url, size) => { seen = size; return { image: { tag: "img" }, width: size.w, height: size.h }; },
    });
    assert.equal(r.error, undefined);
    assert.deepEqual([r.width, r.height, r.via], [300, 60, "img"]);
    assert.deepEqual(seen, { w: 300, h: 60 });
  });
  test("when the fallback fails too, it is image_unreadable with both reasons", async () => {
    const r = await I.loadImage("x.svg", { fetch: okFetch, createImageBitmap: noBitmap, loadImageElement: async () => { throw new Error("img onerror"); } });
    assert.equal(r.error, "image_unreadable");
    assert.match(r.detail, /could not be decoded.*img onerror/);
  });
  test("a fetch that never answers is image_unreadable with detail timeout", async () => {
    let aborted = false;
    const t0 = Date.now();
    const r = await I.loadImage("slow.webp", {
      timeoutMs: 50, createImageBitmap: async () => ({ width: 1, height: 1 }),
      fetch: (url, init) => new Promise((_, rej) => init.signal && init.signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); })),
    });
    assert.deepEqual([r.error, r.detail], ["image_unreadable", "timeout"]);
    assert.ok(aborted, "the fetch is aborted");
    assert.ok(Date.now() - t0 < 2000);
  });
  test("a decode that hangs times out too", async () => {
    const r = await I.loadImage("hang.webp", { timeoutMs: 50, fetch: okFetch, createImageBitmap: () => new Promise(() => {}) });
    assert.equal(r.detail, "timeout");
  });
});
