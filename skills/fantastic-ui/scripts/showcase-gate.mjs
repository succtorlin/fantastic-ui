/**
 * showcase-gate.mjs — the showcase image lane.
 *
 * A preset that declares `"showcase"` in preset-gates.json (Preset M) shows
 * the user's own work as large content images. Those images, marked
 * `data-showcase`, leave the universal 30 KB raster gate and are held to
 * three gates of their own instead:
 *
 *   showcase-markup     real alt text, width/height, a srcset, never
 *                       aria-hidden, lazy below the first screen and never
 *                       lazy inside it; and the page shows the work at all:
 *                       at least one such image, or live art (an element
 *                       marked `data-showcase-live` that draws the work
 *                       from the product's own data, with no file to judge)
 *   showcase-sharpness  the browser never has to upscale: at each declared
 *                       viewport and pixel density, rendered scale × density
 *                       stays at or under 1
 *   showcase-weight     each delivered file, and the first screen's total,
 *                       stay inside the declared budget
 *
 * `collectShowcase` runs in the page and only measures. `judgeShowcase` is
 * pure, so the decisions are unit-tested without a browser
 * (showcase-gate.test.mjs). verify-preset.mjs wires the two together.
 *
 * NOT CHECKED: a CSS transform on the image (a hover zoom, a rotated
 * raster) scales pixels this gate cannot see. Bake the angle into the export.
 */

export const DEFAULTS = {
  selector: "img[data-showcase]",
  liveSelector: "[data-showcase-live]",
  required: true,
  maxKB: 200,
  firstScreenKB: 600,
  upscaleTolerance: 1.02,
  lazyBelowScreens: 2,
  densities: [
    { width: 1440, height: 900, dpr: 2 },
    { width: 390, height: 844, dpr: 3 },
  ],
};

export const showcaseConfig = (declared = {}) => ({ ...DEFAULTS, ...declared });

/**
 * How far the browser scales the image's pixels, per `object-fit`. 1 means
 * one image pixel per CSS pixel; multiply by the device pixel ratio to get
 * image pixels per device pixel. Above 1 the browser is inventing pixels.
 */
export function renderedScale({ boxW, boxH, naturalW, naturalH, fit = "fill" }) {
  if (!naturalW || !naturalH) return Infinity;
  const sx = boxW / naturalW;
  const sy = boxH / naturalH;
  if (fit === "none") return 1;
  if (fit === "contain") return Math.min(sx, sy);
  if (fit === "scale-down") return Math.min(sx, sy, 1);
  return Math.max(sx, sy); // cover, and fill judged on its worse axis
}

const label = (f) => f.name || "(no src)";

/**
 * Judge one viewport's measurements. `facts` is what collectShowcase returns;
 * `cfg` is the preset's showcase block; `density` is the viewport it was
 * measured at; `checkMarkup` and `checkWeight` are true for the first
 * density only (markup does not change with the viewport, and the weight
 * budget is stated for the file the first density is served).
 */
export function judgeShowcase(facts, cfg, density, { checkMarkup = true, checkWeight = true } = {}) {
  const at = `${density.width}@${density.dpr}x`;
  const out = { markup: [], sharpness: [], weight: [], worstUpscale: 0, firstScreenKB: 0, count: facts.images.length };
  const shown = facts.images.filter((f) => f.boxW > 0 && f.boxH > 0);

  if (checkMarkup) {
    if (cfg.required && !facts.images.length && !facts.live) {
      out.markup.push(`no ${cfg.selector} and no live art (${cfg.liveSelector}) on the page: this preset is its pictures of the work`);
    }
    for (const f of facts.images) {
      const bad = [];
      if (!f.alt || !f.alt.trim()) bad.push("no alt text (a showcase image is content: say what it shows)");
      if (f.ariaHidden) bad.push("aria-hidden (decoration belongs under the 30 KB cap, not in this lane)");
      if (!f.hasWidthHeight) bad.push("no width/height attributes");
      if (!f.hasSrcset) bad.push("no srcset");
      const lazy = f.loading === "lazy";
      if (f.inFirstScreen && lazy) bad.push("loading=lazy inside the first screen");
      if (!lazy && f.top > facts.viewportH * cfg.lazyBelowScreens) bad.push(`not lazy, ${Math.round(f.top / facts.viewportH)} screens down`);
      if (bad.length) out.markup.push(`${label(f)}: ${bad.join("; ")}`);
    }
  }

  for (const f of shown) {
    if (!f.naturalW) { out.sharpness.push(`${label(f)} did not load at ${at}`); continue; }
    const up = renderedScale(f) * density.dpr;
    if (up > out.worstUpscale) out.worstUpscale = up;
    if (up > cfg.upscaleTolerance) {
      const need = Math.ceil(f.naturalW * up);
      out.sharpness.push(`${label(f)} upscaled ${up.toFixed(2)}× at ${at} (${f.naturalW}px wide, needs ≥${need}px)`);
    }
  }

  if (checkWeight) {
    for (const f of shown) {
      if (!f.naturalW) continue;
      if (!f.kb) { out.weight.push(`${label(f)}: size not measurable (serve it from the page's own origin)`); continue; }
      if (f.kb > cfg.maxKB) out.weight.push(`${label(f)} ${f.kb} KB at ${at} (max ${cfg.maxKB})`);
      if (f.inFirstScreen) out.firstScreenKB += f.kb;
    }
    if (out.firstScreenKB > cfg.firstScreenKB) {
      out.weight.push(`first screen ${out.firstScreenKB} KB at ${at} (max ${cfg.firstScreenKB})`);
    }
  }
  return out;
}

/**
 * Runs IN THE PAGE (serialised by page.evaluate): measure every showcase
 * image. Lazy images are switched to eager so each one loads and can be
 * measured; the attribute the author wrote is recorded first.
 */
export async function collectShowcase(selector, liveSelector) {
  const imgs = [...document.querySelectorAll(selector)];
  // Live art: the work drawn in the page from its own data. Counted, not measured.
  const live = liveSelector
    ? [...document.querySelectorAll(liveSelector)].filter((el) => el.clientWidth > 0 && el.clientHeight > 0 && el.childElementCount > 0).length
    : 0;
  const before = imgs.map((img) => {
    const r = img.getBoundingClientRect();
    return {
      loading: (img.getAttribute("loading") || "").toLowerCase(),
      top: r.top + scrollY,
      inFirstScreen: r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0,
    };
  });
  for (const img of imgs) img.loading = "eager";
  await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth ? null : new Promise((done) => {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    setTimeout(done, 8000);
  }))));
  await new Promise((done) => setTimeout(done, 150)); // let resource timing entries land
  const kbOf = (url) => {
    const e = performance.getEntriesByName(url).pop();
    return e ? Math.round((e.encodedBodySize || e.transferSize || 0) / 1024) : 0;
  };
  // The file's real pixel size. With a `w` srcset, img.naturalWidth is
  // density-corrected (it reports the `sizes` width, not the file's), so the
  // chosen file is loaded again on its own, from cache, and measured there.
  const pixelsOf = (src) => new Promise((done) => {
    if (!src) return done({ w: 0, h: 0 });
    const probe = new Image();
    probe.onload = () => done({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => done({ w: 0, h: 0 });
    probe.src = src;
  });
  const pixels = await Promise.all(imgs.map((img) => pixelsOf(img.currentSrc || img.src || "")));
  const images = imgs.map((img, i) => {
    const pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
    const src = img.currentSrc || img.src || "";
    return {
      ...before[i],
      name: src.split("/").pop().split("?")[0],
      alt: img.getAttribute("alt"),
      ariaHidden: !!img.closest("[aria-hidden=true]"),
      hasWidthHeight: !!(img.getAttribute("width") && img.getAttribute("height")),
      hasSrcset: !!(img.getAttribute("srcset") || (pic && pic.querySelector("source[srcset]"))),
      boxW: img.clientWidth,
      boxH: img.clientHeight,
      naturalW: pixels[i].w,
      naturalH: pixels[i].h,
      fit: getComputedStyle(img).objectFit,
      kb: src ? kbOf(src) : 0,
    };
  });
  return { viewportH: innerHeight, images, live };
}

/**
 * Runs IN THE PAGE: every URL a showcase image could be served from (its src,
 * its srcset and its <picture> sources), absolute. The universal 30 KB gate
 * skips exactly these and nothing else.
 */
export function showcaseUrls(selector) {
  const abs = (u) => { try { return new URL(u, document.baseURI).href; } catch (e) { return null; } };
  const fromSet = (set) => (set || "").split(",").map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
  const urls = new Set();
  for (const img of document.querySelectorAll(selector)) {
    // An image that is not content does not get the exemption.
    if (!(img.getAttribute("alt") || "").trim() || img.closest("[aria-hidden=true]")) continue;
    const pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
    const all = [img.getAttribute("src"), ...fromSet(img.getAttribute("srcset"))];
    if (pic) for (const s of pic.querySelectorAll("source")) all.push(...fromSet(s.getAttribute("srcset")));
    for (const u of all) { const a = u && abs(u); if (a) urls.add(a); }
  }
  return [...urls];
}
