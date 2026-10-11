/*! plate-check.js — fantastic-ui real-pixel plate checker. Plain browser JS, no deps, no build.
 *
 * Measures every plate host on the page from its COMPUTED styles: the first url() layer of
 * the host's plate layer, the gradient layers listed above it (the scrim), its background-size
 * / -position / -repeat (calc(), max(), min() included), composited over the page colour.
 * It reports how much of the plate is visible (ge_1_1 / ge_1_3) and the worst text contrast.
 *
 * USAGE
 *   1. DevTools: paste this whole file into the console, then
 *        await plateCheck()                                   // default hosts / layers
 *        // with the stale-CSS sentinel (width-aware: phones get the strip, not the band)
 *        await plateCheck({ expect: [{ selector: ".plate-host--header > .plate",
 *          property: "background-image", includes: innerWidth >= 768 ? "58%" : "48px" }] })
 *   2. Playwright:
 *        await page.addScriptTag({ path: "skills/fantastic-ui/scripts/plate-check.js" });
 *        const report = await page.evaluate(() => plateCheck({ page: "#0a0907" }));
 *      (On a page with a strict CSP use `bypassCSP: true` on the context, or
 *       `page.evaluate(fileText)` instead of addScriptTag.)
 *   3. eval from an automation tool (any "run JS in the page" tool):
 *        eval(<this file's text>); await plateCheck();
 *      or in one call:  (0, eval)(fileText); JSON.stringify(await plateCheck())
 *   Node (unit tests only — the pure helpers):  require("./plate-check.js")._internals
 *   True pixels instead of computed geometry:   node scripts/plate-check-shot.mjs <url>
 *
 * OPTIONS  plateCheck({ hosts, layer, page, floors, expect, visibleOnly, stripPx, allowAllSkipped, imageTimeoutMs })
 *   hosts   CSS selector for hosts  (default "[data-plate-host], .plate-host, .route-plate-host, .desk-plate-host")
 *   layer   selector relative to the host (default ":scope > [data-plate], :scope > .plate, :scope > .route-plate, :scope > .desk-plate")
 *   page    CSS colour the plate is judged against (default: computed background walking up from the host)
 *   floors  { ge11: 8, ge13: 1, text: 4.5, large: 3 }
 *   expect  [{ selector, property, includes, pseudo? }] stale-CSS sentinel: if any computed value
 *           lacks `includes`, returns { stale: true } and measures nothing. Numbers that do not move
 *           after a CSS edit are stale until proven otherwise — use this.
 *           Match a STOP POSITION ("58%", "48px"), never an angle or a colour keyword: Chrome drops a
 *           default 180deg from serialised gradients, turns `transparent` into rgba(0, 0, 0, 0) and
 *           color-mix() into oklab(…). And remember media queries change the value per width.
 *   visibleOnly      skip hosts that are not rendered (default true)
 *   stripPx          the phone strip's height; default: detected from the scrim (a top-to-bottom px-stop
 *                    gradient that starts clear; the strip ends at the first stop reaching its max alpha ≥ .85)
 *   allowAllSkipped  let a page whose every host is skipped pass (default false)
 *   imageTimeoutMs   per-image fetch + decode budget (default 10000)
 *
 * REPORT  { stale:false, page, floors, hosts:[…], skipped, skippedHosts, pass, error? }
 *   page          the page colour given in options (hex), else null (each host carries its own)
 *   skipped       number of hosts skipped; skippedHosts: their selectors
 *   pass          true only if at least one host was measured and every host passes
 *   A measured host:
 *     { selector, box:"WxH", fit: strip|cover|contain|band|custom, page, url, measured: "full"|"partial",
 *       visibility:{ ge_1_1, ge_1_3 }, visible, text:[{ text, ratio, need, pass }], worstText, textPass,
 *       pass, stripPx?, unsupportedLayers?, unmodelled? }
 *     visibility    % of image-covered pixels (for a strip: only rows above the strip) at ≥1.1:1 / ≥1.3:1
 *     unsupportedLayers  [{ position: "above"|"below", layer, reason }] layers the raster could not draw
 *                   (radial/conic/angled gradients, image-set, an unparsed colour). Any ABOVE the image
 *                   makes the host measured:"partial" and pass:false.
 *     unmodelled    [ "layer opacity: 0.6", "layer mask-image", "layer filter: …", "layer mix-blend-mode: …",
 *                   "host opacity: …" ] — non-default values the raster ignores; measured:"partial", pass:false.
 *   A skipped host: { selector, box, skipped: "layer_hidden", pass: true } (the layer is display:none)
 *   A host that could not be measured: { selector, error, …, pass:false }, error one of
 *     no_layer            no element matches `layer` inside the host
 *     layer_not_rendered  the layer is displayed but has no size
 *     no_image_layer      the layer's background-image has no url() (e.g. the plate variable is unset)
 *     image_unreadable    { url, detail }: cross-origin without CORS, HTTP error, undecodable, or "timeout"
 *     measure_failed      { detail }: an unexpected exception while measuring
 * Report-level errors (with hosts: [] unless noted):
 *     no_hosts            no host matched (pass:false)
 *     all_skipped         hosts matched but every one was skipped (hosts kept; pass:false unless allowAllSkipped)
 *     bad_selector        `hosts` is not a valid selector
 *     bad_page_colour     `page` is not a colour
 *   Stale CSS:  { stale:true, pass:false, reason, expect:[{ selector, property, includes, ok, matched, got }], hosts:[] }
 */
(function (globalObj) {
  "use strict";

  const DEFAULT_HOSTS = "[data-plate-host], .plate-host, .route-plate-host, .desk-plate-host";
  const DEFAULT_LAYER = ":scope > [data-plate], :scope > .plate, :scope > .route-plate, :scope > .desk-plate";
  const DEFAULT_FLOORS = Object.freeze({ ge11: 8, ge13: 1, text: 4.5, large: 3 });
  const SAMPLE_CAP = 1500000; // raster samples per host; larger slots are measured at a lower density
  const LARGE_PX = 24;
  const LARGE_BOLD_PX = 18.66;

  // ── small utilities ───────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  const mod = (a, n) => ((a % n) + n) % n;
  const errMsg = (e) => (e && e.message) || String(e);

  /** Split at top-level separators (',' or ' ' for any whitespace, or '/'), respecting () and quotes. */
  function splitTop(input, sep) {
    const out = [];
    let depth = 0;
    let quote = null;
    let cur = "";
    for (const ch of String(input)) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      const isSep = depth === 0 && (sep === " " ? /\s/.test(ch) : ch === sep);
      if (isSep) {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // ── colour ────────────────────────────────────────────────────────────
  const lin = (c255) => {
    const v = c255 / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const gam = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
  /** WCAG relative luminance of an sRGB colour with channels 0..255. */
  const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const fromLinear = (lr, lg, lb, a) => ({
    r: clamp(gam(clamp(lr, 0, 1)), 0, 255),
    g: clamp(gam(clamp(lg, 0, 1)), 0, 255),
    b: clamp(gam(clamp(lb, 0, 1)), 0, 255),
    a: clamp(a, 0, 1),
  });

  function oklabToRgb(L, A, B, alpha) {
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    return fromLinear(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      alpha
    );
  }

  /** One colour component: `none` → 0, `N%` → N/100 × pctScale, `Ndeg` → N, else the number. */
  function comp(tok, pctScale) {
    const t = String(tok).trim();
    if (t === "none") return 0;
    if (t.endsWith("%")) return (parseFloat(t) / 100) * pctScale;
    if (t.endsWith("deg")) return parseFloat(t);
    if (t.endsWith("turn")) return parseFloat(t) * 360;
    if (t.endsWith("rad")) return (parseFloat(t) * 180) / Math.PI;
    return Number(t);
  }

  function parseHex(s) {
    const h = s.slice(1);
    if (!/^[0-9a-f]+$/i.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
    const full = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }

  /**
   * Parse a serialised CSS colour into { r, g, b (0..255), a (0..1) }, or null.
   * Covers what Chrome's computed values and canvas fillStyle emit: #hex, rgb()/rgba()
   * (comma or space syntax), oklab(L a b / A), oklch(), color(srgb | srgb-linear | display-p3 …),
   * and `transparent`. Out-of-gamut results are clamped.
   */
  function parseColor(input) {
    if (input == null) return null;
    const s = String(input).trim().toLowerCase();
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (s[0] === "#") return parseHex(s);
    const m = /^([a-z-]+)\(([\s\S]*)\)$/.exec(s);
    if (!m) return null;
    const fn = m[1];
    const body = m[2].trim();
    let parts;
    let alphaTok = null;
    if (body.includes(",") && (fn === "rgb" || fn === "rgba")) {
      parts = splitTop(body, ",");
      if (parts.length === 4) alphaTok = parts.pop();
    } else {
      const slash = splitTop(body, "/");
      parts = splitTop(slash[0], " ");
      alphaTok = slash.length > 1 ? slash[1] : null;
    }
    const alpha = alphaTok == null ? 1 : comp(alphaTok, 1);
    let out = null;
    if ((fn === "rgb" || fn === "rgba") && parts.length === 3) {
      const [r, g, b] = parts.map((p) => comp(p, 255));
      out = { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(alpha, 0, 1) };
    } else if (fn === "oklab" && parts.length === 3) {
      out = oklabToRgb(comp(parts[0], 1), comp(parts[1], 0.4), comp(parts[2], 0.4), alpha);
    } else if (fn === "oklch" && parts.length === 3) {
      const L = comp(parts[0], 1);
      const C = comp(parts[1], 0.4);
      const H = (comp(parts[2], 360) * Math.PI) / 180;
      out = oklabToRgb(L, C * Math.cos(H), C * Math.sin(H), alpha);
    } else if (fn === "color" && parts.length === 4) {
      const space = parts[0];
      const [x, y, z] = parts.slice(1).map((p) => comp(p, 1));
      if (space === "srgb") out = { r: clamp(x * 255, 0, 255), g: clamp(y * 255, 0, 255), b: clamp(z * 255, 0, 255), a: clamp(alpha, 0, 1) };
      else if (space === "srgb-linear") out = fromLinear(x, y, z, alpha);
      else if (space === "display-p3") {
        const lx = lin(x * 255), ly = lin(y * 255), lz = lin(z * 255);
        out = fromLinear(
          1.2249401 * lx - 0.2249404 * ly,
          -0.0420569 * lx + 1.0420571 * ly,
          -0.0196376 * lx - 0.0786361 * ly + 1.0982735 * lz,
          alpha
        );
      }
    }
    if (!out || [out.r, out.g, out.b, out.a].some((v) => !Number.isFinite(v))) return null;
    return out;
  }

  const toHex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  /** Source-over in gamma space, as browsers composite: src (with alpha) over an opaque dst. */
  const over = (src, dst) => ({
    r: src.r * src.a + dst.r * (1 - src.a),
    g: src.g * src.a + dst.g * (1 - src.a),
    b: src.b * src.a + dst.b * (1 - src.a),
  });
  /** Luminance of `scrim` (rgba) over an opaque `plate` pixel: out = a·scrim + (1−a)·plate. */
  const compositeLum = (plate, scrim) => {
    const c = over(scrim, plate);
    return luminance(c.r, c.g, c.b);
  };

  // ── lengths ───────────────────────────────────────────────────────────
  /**
   * Evaluate a computed length: px, %, unitless numbers, and calc()/min()/max()/clamp() with
   * + − × ÷. Percentages resolve against `basis`. Returns NaN for anything else (em, vw …),
   * which the browser resolver then hands to a probe element.
   */
  function evalLength(expr, basis) {
    const src = String(expr).trim().toLowerCase();
    let i = 0;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const fail = () => { throw new Error("bad length"); };
    const want = (ch) => { ws(); if (src[i] !== ch) fail(); i++; };
    function factor() {
      ws();
      if (src[i] === "(") { i++; const v = sum(); want(")"); return v; }
      const fn = /^(calc|min|max|clamp)\(/.exec(src.slice(i));
      if (fn) {
        i += fn[0].length;
        const args = [sum()];
        ws();
        while (src[i] === ",") { i++; args.push(sum()); ws(); }
        want(")");
        if (fn[1] === "calc") return args.length === 1 ? args[0] : fail();
        if (fn[1] === "min") return Math.min(...args);
        if (fn[1] === "max") return Math.max(...args);
        return args.length === 3 ? Math.max(args[0], Math.min(args[1], args[2])) : fail();
      }
      const num = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(px|%)?/.exec(src.slice(i));
      if (!num) fail();
      i += num[0].length;
      if (/[a-z]/.test(src[i] || "")) fail(); // an unsupported unit
      const n = parseFloat(num[0]);
      return num[3] === "%" ? (n * basis) / 100 : n;
    }
    function product() {
      let v = factor();
      for (;;) {
        ws();
        if (src[i] === "*") { i++; v *= factor(); } else if (src[i] === "/") { i++; v /= factor(); } else return v;
      }
    }
    function sum() {
      let v = product();
      for (;;) {
        ws();
        if (src[i] === "+") { i++; v += product(); } else if (src[i] === "-") { i++; v -= product(); } else return v;
      }
    }
    try {
      const v = sum();
      ws();
      return i === src.length ? v : NaN;
    } catch (_e) {
      return NaN;
    }
  }

  // ── background layers ─────────────────────────────────────────────────
  /** Split a computed background-image into layers: { kind: "url"|"gradient"|"none"|"other", value, url? }. */
  function splitLayers(backgroundImage) {
    return splitTop(backgroundImage || "none", ",").map((v) => {
      const u = /^url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)]*?))\s*\)$/i.exec(v);
      if (u) return { kind: "url", value: v, url: (u[1] ?? u[2] ?? u[3] ?? "").replace(/\\(.)/g, "$1") };
      if (/^(repeating-)?linear-gradient\(/i.test(v)) return { kind: "gradient", value: v };
      if (v === "none") return { kind: "none", value: v };
      return { kind: "other", value: v };
    });
  }

  const POS_RE = /^([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?([a-z]+|%)?|(calc|min|max|clamp)\([\s\S]*\))$/i;
  const isPos = (t) => POS_RE.test(t);

  function directionDeg(tokens) {
    if (tokens[0] === "to") {
      const side = tokens.slice(1).join(" ");
      const map = { right: 90, left: 270, bottom: 180, top: 0 };
      return side in map ? map[side] : NaN; // corners are not supported
    }
    const t = tokens[0];
    const n = parseFloat(t);
    if (/deg$/.test(t)) return n;
    if (/turn$/.test(t)) return n * 360;
    if (/grad$/.test(t)) return n * 0.9;
    if (/rad$/.test(t)) return (n * 180) / Math.PI;
    return NaN;
  }

  /**
   * Parse a (repeating-)linear-gradient at 0/90/180/270deg (or `to top|right|bottom|left`).
   * Returns { axis: "x"|"y", reverse, repeating, angle, stops: [{ color, pos }], hints } where pos is
   * the raw position string (px, %, calc …) or null for an unpositioned stop; or { error }.
   * Colours go through `resolveColor` (default: parseColor).
   */
  function parseGradient(input, resolveColor) {
    const resolve = resolveColor || parseColor;
    const m = /^(repeating-)?linear-gradient\(([\s\S]*)\)$/i.exec(String(input).trim());
    if (!m) return { error: "not_linear_gradient", value: String(input) };
    const args = splitTop(m[2], ",");
    let angle = 180;
    const head = splitTop(args[0] || "", " ").map((t) => t.toLowerCase());
    const isDir = head[0] === "to" || head[0] === "in" || /^[+-]?(\d+\.?\d*|\.\d+)(deg|turn|grad|rad)$/.test(head[0] || "");
    if (isDir) {
      args.shift();
      // drop an interpolation clause ("in oklab", "in oklch longer hue") wherever it sits
      const k = head.indexOf("in");
      const dir = k < 0 ? head : head.slice(0, k).concat(head.slice(k + 2).filter((t) => !/^(shorter|longer|increasing|decreasing|hue)$/.test(t)));
      if (dir.length) angle = directionDeg(dir);
    }
    if (!Number.isFinite(angle)) return { error: "unsupported_angle", value: String(input) };
    const a = mod(Math.round(angle * 1e6) / 1e6, 360);
    const axisMap = { 90: ["x", false], 270: ["x", true], 180: ["y", false], 0: ["y", true] };
    if (!(a in axisMap)) return { error: "unsupported_angle", angle: a, value: String(input) };
    const [axis, reverse] = axisMap[a];
    const stops = [];
    let hints = 0;
    for (const arg of args) {
      const toks = splitTop(arg, " ");
      if (toks.length === 1 && isPos(toks[0])) { hints++; continue; } // interpolation hint: ignored
      const colorStr = toks.filter((t) => !isPos(t)).join(" ");
      const positions = toks.filter(isPos);
      const color = resolve(colorStr);
      if (!color) return { error: "unparsed_color", color: colorStr, value: String(input) };
      if (positions.length === 0) stops.push({ color, pos: null });
      for (const p of positions.slice(0, 2)) stops.push({ color, pos: p });
    }
    if (stops.length < 1) return { error: "no_stops", value: String(input) };
    if (stops.length === 1) stops.push({ color: stops[0].color, pos: null });
    return { axis, reverse, repeating: !!m[1], angle: a, stops, hints };
  }

  /** Resolve stop positions to px along a gradient line of `lineLen` px (CSS Images 3 fix-up rules). */
  function resolveStops(grad, lineLen, resolveLen) {
    const rl = resolveLen || evalLength;
    const s = grad.stops.map((st) => {
      const v = st.pos == null ? null : rl(st.pos, lineLen);
      return { color: st.color, pos: Number.isFinite(v) ? v : null };
    });
    if (s[0].pos == null) s[0].pos = 0;
    if (s[s.length - 1].pos == null) s[s.length - 1].pos = lineLen;
    let max = -Infinity;
    for (const st of s) if (st.pos != null) { st.pos = Math.max(st.pos, max); max = st.pos; }
    for (let i = 1; i < s.length; i++) {
      if (s[i].pos != null) continue;
      let j = i;
      while (s[j].pos == null) j++;
      const a = s[i - 1].pos;
      const step = (s[j].pos - a) / (j - i + 1);
      for (let k = i; k < j; k++) s[k].pos = a + step * (k - i + 1);
    }
    return s;
  }

  /** Premultiplied interpolation between two rgba stops. */
  function mixStops(c0, c1, t) {
    const a = c0.a + (c1.a - c0.a) * t;
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    const ch = (k) => (c0[k] * c0.a + (c1[k] * c1.a - c0[k] * c0.a) * t) / a;
    return { r: ch("r"), g: ch("g"), b: ch("b"), a };
  }

  /** Colour of resolved stops at position p (px along the line). */
  function gradientAt(stops, p, repeating) {
    const first = stops[0].pos;
    const last = stops[stops.length - 1].pos;
    if (repeating && last > first) p = first + mod(p - first, last - first);
    if (p < first) return stops[0].color;
    for (let i = stops.length - 1; i >= 0; i--) {
      if (p >= stops[i].pos) {
        const s1 = stops[i + 1];
        if (!s1) return stops[i].color;
        const span = s1.pos - stops[i].pos;
        return span > 0 ? mixStops(stops[i].color, s1.color, (p - stops[i].pos) / span) : s1.color;
      }
    }
    return stops[0].color;
  }

  /** background-repeat value for one layer → { x, y } (space/round count as repeat). */
  function parseRepeat(tok) {
    const t = splitTop(tok || "repeat", " ");
    if (t[0] === "repeat-x") return { x: true, y: false };
    if (t[0] === "repeat-y") return { x: false, y: true };
    const r = (v) => v !== "no-repeat";
    return { x: r(t[0]), y: r(t[1] || t[0]) };
  }

  /** One background-position axis ("100%", "right 10px", "center", "calc(…)") → px offset in the area. */
  function resolveAxisPos(tok, free, resolveLen) {
    const rl = resolveLen || evalLength;
    const t = splitTop(tok == null ? "0%" : tok, " ");
    const kw = t[0];
    const off = t[1] != null ? rl(t[1], free) : 0;
    if (kw === "left" || kw === "top") return off;
    if (kw === "right" || kw === "bottom") return free - off;
    if (kw === "center") return free / 2;
    return rl(t.join(" "), free);
  }

  /**
   * Name the fit a resolved rect amounts to in an area: strip | cover | contain | band | custom.
   * `strip` is recognised by the scrim, not the aspect: pass `stripPx` (from a vertical px-stop
   * scrim, see stripHeight, or the stripPx option) and a full-width, top-anchored image is a strip
   * even when it happens to cover the whole box (a wide phone).
   */
  function classifyFit(size, rect, area, stripPx) {
    const s = String(size || "").trim();
    const e = 0.5;
    const fullW = rect.x <= e && rect.x + rect.w >= area.w - e;
    const fullH = rect.y <= e && rect.y + rect.h >= area.h - e;
    if (stripPx != null && fullW && Math.abs(rect.y) <= e) return "strip";
    if (s === "cover" || s === "contain") return s;
    if (fullW && fullH) return "cover";
    if (fullW) return "band";
    return "custom";
  }

  /**
   * Height (px from the gradient tile's top) of the clear strip a phone-strip scrim leaves:
   * a top-to-bottom gradient with px stops that starts transparent and reaches a maximum
   * alpha ≥ 0.85; the strip ends at the first stop that reaches that maximum. Else null.
   */
  function stripHeight(grad, lineLen, resolveLen) {
    if (!grad || grad.error || grad.axis !== "y" || grad.reverse || grad.repeating) return null;
    if (!grad.stops.some((st) => st.pos != null && /px/i.test(st.pos))) return null;
    const st = resolveStops(grad, lineLen, resolveLen);
    if (st[0].color.a > 0.05) return null;
    const max = Math.max(...st.map((x) => x.color.a));
    if (max < 0.85) return null;
    const hit = st.find((x) => x.color.a >= max - 1e-6);
    return hit ? hit.pos : null;
  }

  /**
   * Resolve one layer's geometry in its positioning area.
   * layer: { size, posX, posY, repeat } (computed strings); area: { w, h }; img: { w, h } or null
   * for a gradient. Returns { x, y, w, h, repeatX, repeatY, kind }.
   */
  function resolveFit(layer, area, img, resolveLen) {
    const rl = resolveLen || evalLength;
    const size = String(layer.size || "auto").trim();
    let w;
    let h;
    if (size === "cover" || size === "contain") {
      if (!img) { w = area.w; h = area.h; } else {
        const s = (size === "cover" ? Math.max : Math.min)(area.w / img.w, area.h / img.h);
        w = img.w * s;
        h = img.h * s;
      }
    } else {
      const t = splitTop(size, " ");
      const sw = t[0] === "auto" ? null : rl(t[0], area.w);
      const sh = (t[1] || "auto") === "auto" ? null : rl(t[1], area.h);
      if (!img) { w = sw ?? area.w; h = sh ?? area.h; } else if (sw == null && sh == null) { w = img.w; h = img.h; } else if (sw == null) { h = sh; w = (sh * img.w) / img.h; } else if (sh == null) { w = sw; h = (sw * img.h) / img.w; } else { w = sw; h = sh; }
    }
    const x = resolveAxisPos(layer.posX, area.w - w, rl);
    const y = resolveAxisPos(layer.posY, area.h - h, rl);
    const rep = parseRepeat(layer.repeat);
    const rect = { x, y, w, h };
    return { x, y, w, h, repeatX: rep.x, repeatY: rep.y, kind: classifyFit(size, rect, area) };
  }

  // ── raster ────────────────────────────────────────────────────────────
  /**
   * Rasterise a parsed gradient layer onto a w×h grid (k raster px per CSS px). `rect` is the
   * layer's tile in painting-area CSS px. Returns { axis, along: Float32Array(n*4), perp: Uint8Array }.
   */
  function gradientLayer(grad, rect, w, h, k, resolveLen) {
    const ax = grad.axis === "x";
    const lineLen = ax ? rect.w : rect.h;
    const stops = resolveStops(grad, lineLen, resolveLen);
    const n = ax ? w : h;
    const m = ax ? h : w;
    const along = new Float32Array(n * 4);
    const off = ax ? rect.x : rect.y;
    const repAlong = ax ? rect.repeatX : rect.repeatY;
    for (let i = 0; i < n; i++) {
      let c = (i + 0.5) / k - off;
      if (repAlong && lineLen > 0) c = mod(c, lineLen);
      else if (c < 0 || c >= lineLen) continue;
      const col = gradientAt(stops, grad.reverse ? lineLen - c : c, grad.repeating);
      along.set([col.r, col.g, col.b, col.a], i * 4);
    }
    const perp = new Uint8Array(m);
    const pOff = ax ? rect.y : rect.x;
    const pLen = ax ? rect.h : rect.w;
    const repPerp = ax ? rect.repeatY : rect.repeatX;
    for (let j = 0; j < m; j++) {
      const c = (j + 0.5) / k - pOff;
      perp[j] = repPerp || (c >= 0 && c < pLen) ? 1 : 0;
    }
    return { axis: grad.axis, along, perp };
  }

  /** Mask of raster pixels whose centre lies inside the image rect (or its repeats). */
  function coverMask(rect, w, h, k) {
    const inX = new Uint8Array(w);
    const inY = new Uint8Array(h);
    for (let x = 0; x < w; x++) { const c = (x + 0.5) / k - rect.x; inX[x] = rect.repeatX || (c >= 0 && c < rect.w) ? 1 : 0; }
    for (let y = 0; y < h; y++) { const c = (y + 0.5) / k - rect.y; inY[y] = rect.repeatY || (c >= 0 && c < rect.h) ? 1 : 0; }
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) if (inY[y]) for (let x = 0; x < w; x++) mask[y * w + x] = inX[x];
    return mask;
  }

  const listAt = (list, i, dflt) => (list.length ? list[i % list.length] : dflt);

  /**
   * The geometry of one plate layer, from its computed background longhands (pure; the browser
   * and the unit tests both go through here).
   *   style: { backgroundImage, backgroundSize, backgroundPositionX, backgroundPositionY,
   *            backgroundPosition, backgroundRepeat, backgroundOrigin,
   *            border: {l,t,r,b}, padding: {l,t,r,b} }   (numbers in px; both optional)
   *   W, H: the layer's border box in CSS px; img: the image's { w, h }; stripPx: optional override.
   * Returns { ui, url, imgRect, above:[{grad, rect}], below:[…], unsupported:[{position, layer, reason}],
   *           strip, fit } or { error: "no_image_layer" }. Rects are in painting-area CSS px.
   */
  function planSlot({ W, H, style, img, resolveLen, resolveColor, stripPx }) {
    const rl = resolveLen || evalLength;
    const layers = splitLayers(style.backgroundImage);
    const ui = layers.findIndex((l) => l.kind === "url");
    if (ui < 0) return { error: "no_image_layer" };
    const list = (v) => splitTop(v || "", ",");
    const sizes = list(style.backgroundSize);
    const posX = list(style.backgroundPositionX);
    const posY = list(style.backgroundPositionY);
    const posBoth = list(style.backgroundPosition);
    const reps = list(style.backgroundRepeat);
    const origins = list(style.backgroundOrigin);
    const bd = style.border || {};
    const pd = style.padding || {};
    const area = (i) => {
      const o = listAt(origins, i, "padding-box");
      let x = 0, y = 0, w = W, h = H;
      if (o !== "border-box") { x += bd.l || 0; y += bd.t || 0; w -= (bd.l || 0) + (bd.r || 0); h -= (bd.t || 0) + (bd.b || 0); }
      if (o === "content-box") { x += pd.l || 0; y += pd.t || 0; w -= (pd.l || 0) + (pd.r || 0); h -= (pd.t || 0) + (pd.b || 0); }
      return { x, y, w, h };
    };
    const spec = (i) => {
      let px = listAt(posX, i, null);
      let py = listAt(posY, i, null);
      if (px == null || py == null) {
        const t = splitTop(listAt(posBoth, i, "0% 0%"), " ");
        px = t.length >= 4 ? t[0] + " " + t[1] : t[0];
        py = t.length >= 4 ? t[2] + " " + t[3] : t[1] || "center";
      }
      return { size: listAt(sizes, i, "auto"), posX: px, posY: py, repeat: listAt(reps, i, "repeat") };
    };
    const fitIn = (i, im) => {
      const a = area(i);
      const f = resolveFit(spec(i), { w: a.w, h: a.h }, im, rl);
      return { ...f, x: f.x + a.x, y: f.y + a.y };
    };
    const imgRect = fitIn(ui, img);
    const unsupported = [];
    const grads = (from, to, position) => {
      const out = [];
      for (let i = from; i < to; i++) {
        const L = layers[i];
        if (L.kind === "none") continue;
        if (L.kind !== "gradient") { unsupported.push({ position, layer: L.value.slice(0, 160), reason: "unsupported_layer" }); continue; }
        const grad = parseGradient(L.value, resolveColor);
        if (grad.error) { unsupported.push({ position, layer: L.value.slice(0, 160), reason: grad.error }); continue; }
        out.push({ grad, rect: fitIn(i, null) });
      }
      return out;
    };
    const above = grads(0, ui, "above");
    const below = grads(ui + 1, layers.length, "below");
    let strip = null;
    for (const a of above) {
      const sh = stripHeight(a.grad, a.rect.h, rl);
      if (sh != null) { strip = a.rect.y + sh; break; }
    }
    if (stripPx != null && Number.isFinite(Number(stripPx))) strip = Number(stripPx);
    const fit = classifyFit(spec(ui).size, imgRect, { w: W, h: H }, strip);
    return { ui, url: layers[ui].url, imgRect, above, below, unsupported, strip: fit === "strip" ? strip : null, fit };
  }

  /**
   * Rasterise a plan over a w×h grid (k raster px per CSS px) with the image's RGBA bytes already
   * drawn at the plan's rect. Returns { px: { rgb, lum }, mask }; for a strip the mask keeps only
   * rows above the strip (the rows under the scrim are not the plate's visible area).
   */
  function rasterSlot(plan, { w, h, k, data, base, resolveLen }) {
    const toLayer = (a) => gradientLayer(a.grad, a.rect, w, h, k, resolveLen);
    const px = compositeSlot({ w, h, base, below: plan.below.map(toLayer), image: { data }, above: plan.above.map(toLayer) });
    const mask = coverMask(plan.imgRect, w, h, k);
    if (plan.fit === "strip" && plan.strip != null) {
      for (let y = 0; y < h; y++) if ((y + 0.5) / k >= plan.strip) mask.fill(0, y * w, (y + 1) * w);
    }
    return { px, mask };
  }

  /**
   * Composite a slot: base colour, then layers BELOW the image, the image, then the scrim
   * layers ABOVE it. `below`/`above` are in CSS list order (index 0 = topmost) and are painted
   * last-to-first, as browsers paint backgrounds. image: { data: RGBA Uint8ClampedArray w×h } or null.
   * Returns { rgb: Float32Array(w*h*3), lum: Float32Array(w*h) }.
   */
  function compositeSlot({ w, h, base, below = [], image = null, above = [] }) {
    const N = w * h;
    const rgb = new Float32Array(N * 3);
    const lum = new Float32Array(N);
    const paint = (L, x, y, c) => {
      const ax = L.axis === "x";
      if (!L.perp[ax ? y : x]) return c;
      const o = (ax ? x : y) * 4;
      const a = L.along[o + 3];
      if (a <= 0) return c;
      return { r: L.along[o] * a + c.r * (1 - a), g: L.along[o + 1] * a + c.g * (1 - a), b: L.along[o + 2] * a + c.b * (1 - a) };
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let c = { r: base.r, g: base.g, b: base.b };
        for (let l = below.length - 1; l >= 0; l--) c = paint(below[l], x, y, c);
        if (image) {
          const a = image.data[i * 4 + 3] / 255;
          if (a > 0) c = { r: image.data[i * 4] * a + c.r * (1 - a), g: image.data[i * 4 + 1] * a + c.g * (1 - a), b: image.data[i * 4 + 2] * a + c.b * (1 - a) };
        }
        for (let l = above.length - 1; l >= 0; l--) c = paint(above[l], x, y, c);
        rgb[i * 3] = c.r;
        rgb[i * 3 + 1] = c.g;
        rgb[i * 3 + 2] = c.b;
        lum[i] = luminance(c.r, c.g, c.b);
      }
    }
    return { rgb, lum };
  }

  /** RGBA bytes (a screenshot) → { rgb, lum } in the compositeSlot shape. */
  function rgbaToRgbLum(data, w, h) {
    const N = w * h;
    const rgb = new Float32Array(N * 3);
    const lum = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rgb[i * 3] = data[i * 4];
      rgb[i * 3 + 1] = data[i * 4 + 1];
      rgb[i * 3 + 2] = data[i * 4 + 2];
      lum[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    }
    return { rgb, lum };
  }

  /** % of masked pixels whose contrast with the page is ≥ 1.1 and ≥ 1.3. */
  function visibility(lum, mask, pageLum) {
    let n = 0;
    let v11 = 0;
    let v13 = 0;
    for (let i = 0; i < lum.length; i++) {
      if (mask && !mask[i]) continue;
      n++;
      const r = contrast(lum[i], pageLum);
      if (r >= 1.1) v11++;
      if (r >= 1.3) v13++;
    }
    return { ge_1_1: n ? round2((100 * v11) / n) : 0, ge_1_3: n ? round2((100 * v13) / n) : 0, n };
  }

  /** Nearest-rank percentile (p in 0..100) of an array of numbers. */
  function percentile(values, p) {
    if (!values.length) return NaN;
    const s = Array.from(values).sort((a, b) => a - b);
    return s[clamp(Math.ceil((p / 100) * s.length) - 1, 0, s.length - 1)];
  }

  /**
   * Contrast of a text colour over the composited pixels at `idx`. Light text on a darker page is
   * judged against the p90 background (the lightest 10% is the risk); dark text against p10.
   * Semi-transparent text is composited over that percentile pixel first.
   */
  function textContrast(idx, lum, rgb, text, page) {
    if (!idx.length) return null;
    const pageLum = luminance(page.r, page.g, page.b);
    const onPage = over(text, page);
    const light = luminance(onPage.r, onPage.g, onPage.b) >= pageLum;
    const sorted = Array.from(idx).sort((a, b) => lum[a] - lum[b]);
    const p = light ? 90 : 10;
    const pick = sorted[clamp(Math.ceil((p / 100) * sorted.length) - 1, 0, sorted.length - 1)];
    const bg = { r: rgb[pick * 3], g: rgb[pick * 3 + 1], b: rgb[pick * 3 + 2] };
    const eff = over(text, bg);
    return { ratio: contrast(luminance(eff.r, eff.g, eff.b), lum[pick]), which: light ? "p90" : "p10", bgLum: lum[pick] };
  }

  const isLargeText = (px, weight) => px >= LARGE_PX || (px >= LARGE_BOLD_PX && weight >= 700);

  /** Raster indices whose pixel centres fall inside CSS-px rects (relative to the slot). */
  function rectIndices(rects, w, h, k) {
    const out = [];
    const seen = new Uint8Array(w * h);
    for (const r of rects) {
      const x0 = clamp(Math.round(r.x * k), 0, w);
      const x1 = clamp(Math.round((r.x + r.w) * k), 0, w);
      const y0 = clamp(Math.round(r.y * k), 0, h);
      const y1 = clamp(Math.round((r.y + r.h) * k), 0, h);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; if (!seen[i]) { seen[i] = 1; out.push(i); } }
    }
    return out;
  }

  /**
   * The measurement both modes share. px: { rgb, lum } over a w×h raster (k raster px per CSS px);
   * mask: image-covered pixels; texts: [{ text, color, need, rects }] with rects in slot CSS px.
   */
  function measurePixels({ px, w, h, k = 1, mask, page, texts = [], floors = DEFAULT_FLOORS }) {
    const pageLum = luminance(page.r, page.g, page.b);
    const v = visibility(px.lum, mask, pageLum);
    const visible = v.n > 0 && v.ge_1_1 >= floors.ge11 && v.ge_1_3 >= floors.ge13;
    const text = [];
    for (const t of texts) {
      const idx = rectIndices(t.rects, w, h, k);
      const tc = textContrast(idx, px.lum, px.rgb, t.color, page);
      if (!tc) continue;
      const ratio = round2(tc.ratio);
      text.push({ text: t.text, ratio, need: t.need, pass: ratio >= t.need });
    }
    let worstText = null;
    for (const t of text) if (!worstText || t.ratio / t.need < worstText.ratio / worstText.need) worstText = t;
    return { visibility: { ge_1_1: v.ge_1_1, ge_1_3: v.ge_1_3 }, visible, text, worstText, textPass: text.every((t) => t.pass) };
  }

  // ── browser side ──────────────────────────────────────────────────────
  /** <img> fallback for what createImageBitmap cannot decode (SVG blobs). Sized from `size` when
   *  the image has no intrinsic size. Resolves { image, width, height }; rejects on error. */
  function loadImageElement(blob, url, size) {
    return new Promise((resolve, reject) => {
      if (typeof Image !== "function") { reject(new Error("no Image constructor")); return; }
      const im = new Image();
      im.onload = () => resolve({ image: im, width: im.naturalWidth || (size && size.w) || 0, height: im.naturalHeight || (size && size.h) || 0 });
      im.onerror = () => reject(new Error("the <img> fallback could not load it either"));
      im.src = blob && typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : url;
    });
  }

  /**
   * fetch → createImageBitmap (never <img>.decode, which stalls in hidden tabs); an <img> + onload
   * fallback for SVG. Never throws; every failure is { error: "image_unreadable", url, detail }.
   * deps: { fetch, createImageBitmap, loadImageElement, timeoutMs (default 10000), size: {w, h} }.
   */
  async function loadImage(url, deps) {
    const d = deps || {};
    const f = d.fetch || (typeof fetch === "function" ? fetch : null);
    const cib = d.createImageBitmap || (typeof createImageBitmap === "function" ? createImageBitmap : null);
    const lie = d.loadImageElement || loadImageElement;
    const timeoutMs = d.timeoutMs > 0 ? d.timeoutMs : 10000;
    if (!f) return { error: "image_unreadable", url, detail: "fetch unavailable" };
    const TIMEOUT = {};
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => { resolve(TIMEOUT); if (ctrl) ctrl.abort(); }, timeoutMs); });
    const race = (p) => Promise.race([p, deadline]);
    const fail = (detail) => ({ error: "image_unreadable", url, detail });
    try {
      let res;
      try {
        res = await race(f(url, { mode: "cors", credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined }));
      } catch (e) {
        return fail(ctrl && ctrl.signal.aborted ? "timeout" : "fetch failed (cross-origin without CORS, or network): " + errMsg(e));
      }
      if (res === TIMEOUT) return fail("timeout");
      if (!res || !res.ok) return fail("HTTP " + (res ? res.status : "?"));
      let blob;
      try { blob = await race(res.blob()); } catch (e) { return fail(ctrl && ctrl.signal.aborted ? "timeout" : "read failed: " + errMsg(e)); }
      if (blob === TIMEOUT) return fail("timeout");
      let first = "createImageBitmap unavailable";
      if (cib) {
        try {
          const bitmap = await race(cib(blob));
          if (bitmap === TIMEOUT) return fail("timeout");
          return { bitmap, width: bitmap.width, height: bitmap.height };
        } catch (e) { first = errMsg(e); }
      }
      try {
        const el = await race(lie(blob, url, d.size));
        if (el === TIMEOUT) return fail("timeout");
        if (!(el.width > 0 && el.height > 0)) return fail("decode failed: no size (" + first + ")");
        return { bitmap: el.image, width: el.width, height: el.height, via: "img" };
      } catch (e) {
        return fail("decode failed: " + first + "; " + errMsg(e));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function makeColorResolver() {
    let ctx = null;
    let pix = null;
    try { ctx = makeCanvas(1, 1).getContext("2d", { willReadFrequently: true }); } catch (_e) { ctx = null; }
    return (str) => {
      const direct = parseColor(str);
      if (direct || !ctx) return direct;
      // Normalise through canvas fillStyle (named colours, color-mix …), then parse what it emits.
      ctx.fillStyle = "#010203";
      ctx.fillStyle = str;
      const norm = ctx.fillStyle;
      if (norm === "#010203" && String(str).trim().toLowerCase() !== "#010203") return null;
      const parsed = parseColor(norm);
      if (parsed) return parsed;
      // Last resort: paint one pixel and read it back.
      pix = pix || ctx;
      pix.clearRect(0, 0, 1, 1);
      pix.fillRect(0, 0, 1, 1);
      const d = pix.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
  }

  /** Length resolver: evalLength first, then a probe element's margin-left (negative-safe). */
  function makeProbe() {
    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:absolute;left:0;top:0;height:0;padding:0;border:0;margin:0;visibility:hidden;pointer-events:none;box-sizing:content-box;overflow:hidden;";
    const p = document.createElement("div");
    p.style.cssText = "display:block;height:0;padding:0;border:0;";
    box.appendChild(p);
    (document.body || document.documentElement).appendChild(box);
    const measure = (expr, basis) => {
      box.style.width = basis + "px";
      p.style.marginLeft = "0px";
      p.style.marginLeft = expr;
      if (p.style.marginLeft === "0px" && !/^\s*0(px|%)?\s*$/.test(expr)) return NaN;
      return parseFloat(getComputedStyle(p).marginLeft);
    };
    return {
      resolve(expr, basis) {
        const v = evalLength(expr, basis);
        if (Number.isFinite(v)) return v;
        if (basis >= 0) return measure(expr, basis);
        const a = measure(expr, 0);
        const b = measure(expr, 1000);
        return a + ((b - a) * basis) / 1000; // linear in the % basis
      },
      remove() { box.remove(); },
    };
  }

  function cssPath(el) {
    const esc = (s) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s);
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      let s = cur.localName;
      if (cur.id) { parts.unshift(s + "#" + esc(cur.id)); break; }
      s += [...cur.classList].slice(0, 3).map((c) => "." + esc(c)).join("");
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.localName === cur.localName);
        if (same.length > 1) s += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
      }
      parts.unshift(s);
      cur = parent;
    }
    return parts.join(" > ");
  }

  /** Background colour under `el`: composite backgrounds from the first opaque ancestor down. */
  function pageColorFor(el, resolveColor) {
    const stack = [];
    for (let cur = el; cur; cur = cur.parentElement) {
      const c = resolveColor(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 0.999) break; }
    }
    let out = { r: 255, g: 255, b: 255 };
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  }

  function checkExpect(list) {
    return list.map(({ selector, property, includes, pseudo }) => {
      const els = [...document.querySelectorAll(selector)];
      const got = els.map((e) => getComputedStyle(e, pseudo || null).getPropertyValue(property));
      const ok = els.length > 0 && got.every((v) => String(v).includes(includes));
      return { selector, property, includes, ok, matched: els.length, got: got.slice(0, 3).map((v) => String(v).slice(0, 300)) };
    });
  }

  function isRendered(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (typeof el.checkVisibility === "function") return el.checkVisibility({ visibilityProperty: true, opacityProperty: false });
    return getComputedStyle(el).visibility !== "hidden";
  }

  function hasOwnOpaqueBackground(el, host, resolveColor) {
    for (let cur = el; cur && cur !== host; cur = cur.parentElement) {
      const cs = getComputedStyle(cur);
      const c = resolveColor(cs.backgroundColor);
      if ((c && c.a >= 0.99) || (cs.backgroundImage && cs.backgroundImage !== "none")) return true;
    }
    return false;
  }

  function collectText(host, layer, layerRect, resolveColor) {
    const out = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || layer.contains(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || hasOwnOpaqueBackground(el, host, resolveColor)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible" || parseFloat(cs.opacity) === 0) continue;
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()]
        .filter((r) => r.width >= 1 && r.height >= 1)
        .map((r) => ({ x: r.left - layerRect.left, y: r.top - layerRect.top, w: r.width, h: r.height }));
      if (!rects.length) continue;
      const fill = cs.webkitTextFillColor || cs.getPropertyValue("-webkit-text-fill-color");
      const color = resolveColor(fill && fill !== cs.color ? fill : cs.color);
      if (!color) continue;
      const px = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      out.push({ text: n.nodeValue.replace(/\s+/g, " ").trim().slice(0, 60), color, rects, px, weight });
    }
    return out;
  }

  function drawImage(bitmap, w, h, k, rect) {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const tiles = (start, len, total, rep) => {
      if (!rep || len <= 0) return [start];
      const out = [];
      for (let p = start - Math.ceil(start / len) * len; p < total; p += len) out.push(p);
      return out;
    };
    for (const ty of tiles(rect.y, rect.h, h / k, rect.repeatY))
      for (const tx of tiles(rect.x, rect.w, w / k, rect.repeatX))
        ctx.drawImage(bitmap, tx * k, ty * k, rect.w * k, rect.h * k);
    return ctx.getImageData(0, 0, w, h).data;
  }

  /** Properties the raster does not model; a non-default value makes the measurement partial. */
  function unmodelledProps(layerCs, hostCs) {
    const out = [];
    if (layerCs.opacity && parseFloat(layerCs.opacity) !== 1) out.push("layer opacity: " + layerCs.opacity);
    const mask = layerCs.maskImage || layerCs.webkitMaskImage;
    if (mask && mask !== "none") out.push("layer mask-image");
    if (layerCs.filter && layerCs.filter !== "none") out.push("layer filter: " + layerCs.filter);
    if (layerCs.mixBlendMode && layerCs.mixBlendMode !== "normal") out.push("layer mix-blend-mode: " + layerCs.mixBlendMode);
    if (hostCs && hostCs.opacity && parseFloat(hostCs.opacity) !== 1) out.push("host opacity: " + hostCs.opacity);
    return out;
  }

  async function measureHost(host, opts, ctx) {
    const selector = cssPath(host);
    const layer = host.querySelector(opts.layer);
    if (!layer) return { selector, error: "no_layer", layer: opts.layer, pass: false };
    const lr = layer.getBoundingClientRect();
    const W = lr.width;
    const H = lr.height;
    const box = Math.round(W) + "x" + Math.round(H);
    const cs = getComputedStyle(layer);
    // `display: none` on the layer is a deliberate opt-out (e.g. state plates
    // on phones): no image is fetched and nothing invisible ships, so the
    // host is reported as skipped rather than failed. A displayed layer with
    // no size is still an error.
    if (cs.display === "none") return { selector, box, skipped: "layer_hidden", pass: true };
    if (W < 1 || H < 1) return { selector, box, error: "layer_not_rendered", pass: false };
    const layers = splitLayers(cs.backgroundImage);
    const urlLayer = layers.find((l) => l.kind === "url");
    if (!urlLayer) return { selector, box, error: "no_image_layer", backgroundImage: String(cs.backgroundImage).slice(0, 200), pass: false };
    const url = urlLayer.url;
    const page = opts.pageColor || pageColorFor(host, ctx.resolveColor);
    const pageHex = toHex(page);

    let loaded = ctx.images.get(url);
    if (!loaded) { loaded = loadImage(url, { timeoutMs: opts.imageTimeoutMs, size: { w: W, h: H } }); ctx.images.set(url, loaded); }
    const img = await loaded;
    if (img.error) return { selector, box, page: pageHex, url, error: img.error, detail: img.detail, pass: false };

    const n = (p) => parseFloat(cs[p]) || 0;
    const style = {
      backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize,
      backgroundPositionX: cs.backgroundPositionX, backgroundPositionY: cs.backgroundPositionY,
      backgroundPosition: cs.backgroundPosition, backgroundRepeat: cs.backgroundRepeat, backgroundOrigin: cs.backgroundOrigin,
      border: { l: n("borderLeftWidth"), t: n("borderTopWidth"), r: n("borderRightWidth"), b: n("borderBottomWidth") },
      padding: { l: n("paddingLeft"), t: n("paddingTop"), r: n("paddingRight"), b: n("paddingBottom") },
    };
    const plan = planSlot({ W, H, style, img: { w: img.width, h: img.height }, resolveLen: ctx.resolveLen, resolveColor: ctx.resolveColor, stripPx: opts.stripPx });
    if (plan.error) return { selector, box, error: plan.error, pass: false };

    const k = Math.min(1, Math.sqrt(SAMPLE_CAP / (W * H)));
    const w = Math.max(1, Math.round(W * k));
    const h = Math.max(1, Math.round(H * k));
    let data;
    try { data = drawImage(img.bitmap, w, h, k, plan.imgRect); } catch (e) {
      return { selector, box, page: pageHex, url, error: "image_unreadable", detail: errMsg(e), pass: false };
    }
    const own = ctx.resolveColor(cs.backgroundColor);
    const base = own && own.a > 0 ? over(own, page) : page;
    const { px, mask } = rasterSlot(plan, { w, h, k, data, base, resolveLen: ctx.resolveLen });
    const texts = collectText(host, layer, lr, ctx.resolveColor).map((t) => ({
      text: t.text, color: t.color, rects: t.rects, need: isLargeText(t.px, t.weight) ? opts.floors.large : opts.floors.text,
    }));
    const m = measurePixels({ px, w, h, k, mask, page, texts, floors: opts.floors });
    const unmodelled = unmodelledProps(cs, getComputedStyle(host));
    const partial = plan.unsupported.some((u) => u.position === "above") || unmodelled.length > 0;
    const entry = { selector, box, fit: plan.fit, page: pageHex, url, measured: partial ? "partial" : "full", ...m, pass: m.visible && m.textPass && !partial };
    if (plan.strip != null) entry.stripPx = round2(plan.strip);
    if (plan.unsupported.length) entry.unsupportedLayers = plan.unsupported;
    if (unmodelled.length) entry.unmodelled = unmodelled;
    if (opts.geometry) {
      layer.setAttribute("data-plate-check-index", String(ctx.index));
      const r = plan.imgRect;
      entry.geometry = {
        index: ctx.index, w: W, h: H,
        image: { x: r.x, y: r.y, w: r.w, h: r.h, repeatX: r.repeatX, repeatY: r.repeatY },
        strip: plan.fit === "strip" ? plan.strip : null,
        texts,
      };
    }
    return entry;
  }

  /** The report's verdict (pure): pass needs ≥ 1 measured host and every host passing. */
  function summarize(hosts, allowAllSkipped) {
    const skippedHosts = hosts.filter((h) => h.skipped).map((h) => h.selector);
    const measured = hosts.length - skippedHosts.length;
    const out = { skipped: skippedHosts.length, skippedHosts, pass: hosts.length > 0 && hosts.every((h) => h.pass) };
    if (!hosts.length) out.error = "no_hosts";
    else if (!measured) {
      out.error = "all_skipped";
      out.pass = !!allowAllSkipped;
    }
    return out;
  }

  /** Main entry. Never throws: problems are reported per host as { error }. */
  async function plateCheck(options) {
    const o = options || {};
    const floors = { ...DEFAULT_FLOORS, ...(o.floors || {}) };
    const resolveColor = makeColorResolver();
    if (Array.isArray(o.expect) && o.expect.length) {
      const sentinel = checkExpect(o.expect);
      if (sentinel.some((s) => !s.ok)) return { stale: true, pass: false, reason: "stale_css: a computed value lacks its expected text — the CSS on the page is not the CSS you edited", expect: sentinel, hosts: [] };
    }
    let pageColor = null;
    if (o.page) {
      pageColor = resolveColor(o.page);
      if (!pageColor) return { stale: false, pass: false, error: "bad_page_colour", page: o.page, hosts: [] };
    }
    const opts = { layer: o.layer || DEFAULT_LAYER, floors, pageColor, geometry: !!o._geometry, stripPx: o.stripPx, imageTimeoutMs: o.imageTimeoutMs };
    let hostEls;
    try { hostEls = [...document.querySelectorAll(o.hosts || DEFAULT_HOSTS)]; } catch (e) {
      return { stale: false, pass: false, error: "bad_selector", detail: errMsg(e), hosts: [] };
    }
    if (o.visibleOnly !== false) hostEls = hostEls.filter(isRendered);
    // Text rects move when web fonts swap in; measure after they settle (bounded wait).
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    }
    const probe = makeProbe();
    const ctx = { resolveColor, resolveLen: probe.resolve, images: new Map(), index: 0 };
    const hosts = [];
    try {
      for (const host of hostEls) {
        try { hosts.push(await measureHost(host, opts, ctx)); } catch (e) {
          hosts.push({ selector: cssPath(host), error: "measure_failed", detail: errMsg(e), pass: false });
        }
        ctx.index++;
      }
    } finally {
      probe.remove();
    }
    const v = summarize(hosts, o.allowAllSkipped);
    const report = { stale: false, page: pageColor ? toHex(pageColor) : null, floors, hosts, skipped: v.skipped, skippedHosts: v.skippedHosts, pass: v.pass };
    if (v.error) report.error = v.error;
    return report;
  }

  const _internals = {
    DEFAULT_HOSTS, DEFAULT_LAYER, DEFAULT_FLOORS,
    splitTop, parseColor, luminance, contrast, toHex, over, compositeLum, evalLength,
    splitLayers, parseGradient, resolveStops, gradientAt, parseRepeat, resolveAxisPos,
    classifyFit, stripHeight, resolveFit, planSlot, rasterSlot, gradientLayer, coverMask, compositeSlot,
    rgbaToRgbLum, visibility, percentile, textContrast, isLargeText, rectIndices, measurePixels,
    loadImage, loadImageElement, unmodelledProps, summarize,
  };
  plateCheck._internals = _internals;

  if (typeof module === "object" && module && module.exports) module.exports = { plateCheck, _internals };
  if (globalObj) globalObj.plateCheck = plateCheck;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
