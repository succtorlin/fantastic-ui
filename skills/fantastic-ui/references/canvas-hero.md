# Live canvas hero, sparklines, and scroll reveals

All the JS behavior on an instrument-grade page follows one lifecycle
contract, established once and applied to every effect:

- **DPR-aware**: scale the backing store by `devicePixelRatio` capped at 2
  (beyond 2 burns fill-rate for no visible gain), re-applied on resize.
- **Reduced-motion**: read `matchMedia("(prefers-reduced-motion:reduce)")`
  once per effect; render a single static frame (canvas) or apply the final
  state immediately (reveals). Same composition, no loop — never a blank hole
  where the animation would be.
- **Tab-hidden pause**: cancel the RAF loop on `visibilitychange` when hidden,
  resume when visible. A marketing tab left open must not spin a core.
- **Full cleanup**: every effect returns a cleanup that cancels RAF and
  removes every listener it added.
- **Palette-locked**: canvas colors are the same hex values as the CSS tokens.

## The hero canvas (worked example: orbiting-dots RRG)

The shape generalizes: **N entities moving through a meaningful coordinate
space, trailing fading tails, drawn over a faint reference grid.** Swap the
metaphor per product (nodes routing through a graph, points streaming onto a
timeline, cells filling a grid) — keep the mechanics.

```tsx
const rrgRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  const cv = rrgRef.current;
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  // -- DPR-aware sizing, rerun on resize -----------------------------------
  let W = 0, H = 0, cx = 0, cy = 0, R = 0;
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    W = rect.width; H = rect.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.5;
  };
  size();
  window.addEventListener("resize", size, { passive: true });

  // -- entities: simulated but plausible -----------------------------------
  // Each dot orbits at a base radius with a slow sinusoidal wobble, so paths
  // look organic, not mechanical. Most dots wear the accent color; a couple
  // wear the semantic up/down colors so the legend reads truthfully.
  const SOD = "#f2a83c", UP = "#35c4ac", DOWN = "#e3563f";
  const N = 14;
  const dots = Array.from({ length: N }, (_, i) => ({
    base: 0.28 + Math.random() * 0.5,        // orbit radius (fraction of R)
    amp: 0.04 + Math.random() * 0.05,        // wobble amplitude
    ang: Math.random() * Math.PI * 2,        // start angle
    spd: (0.06 + Math.random() * 0.14) * -1, // clockwise, varied speed
    wob: Math.random() * Math.PI * 2,
    wobs: 0.2 + Math.random() * 0.5,
    role: i < 2 ? "up" : i >= N - 2 ? "down" : "sod",
    trail: [] as Array<[number, number]>,
  }));
  // hex + alpha-suffix trick: "#f2a83c" + "80" — cheap per-segment fading
  const col = (role: string, a: number) => {
    const c = role === "up" ? UP : role === "down" ? DOWN : SOD;
    if (a >= 1) return c;
    return c + Math.round(a * 255).toString(16).padStart(2, "0");
  };

  let raf = 0;
  const frame = () => {
    ctx.clearRect(0, 0, W, H);

    // reference grid: concentric rings + crosshair, very low contrast —
    // it must read as "instrument face", not compete with the data
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * k) / 4.2, 0, 7);
      ctx.strokeStyle = "rgba(65,59,40,.5)"; // = --hair-lit at half alpha
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(242,168,60,.22)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.stroke();

    const dt = 0.016;
    dots.forEach((o) => {
      o.ang += o.spd * dt;
      o.wob += o.wobs * dt;
      const rad = (o.base + Math.sin(o.wob) * o.amp) * R;
      const x = cx + Math.cos(o.ang) * rad;
      const y = cy + Math.sin(o.ang) * rad;

      // fading tail: bounded array of past points, alpha and width ramp up
      // toward the head so the tail dissolves instead of clipping
      o.trail.push([x, y]);
      if (o.trail.length > 26) o.trail.shift();
      for (let j = 1; j < o.trail.length; j++) {
        const a = j / o.trail.length;
        ctx.beginPath();
        ctx.moveTo(o.trail[j - 1][0], o.trail[j - 1][1]);
        ctx.lineTo(o.trail[j][0], o.trail[j][1]);
        ctx.strokeStyle = col(o.role, a * 0.5);
        ctx.lineWidth = 1.4 * a + 0.2;
        ctx.stroke();
      }

      // glowing head — shadowBlur inside save/restore so the glow doesn't
      // leak into the next draw call
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = col(o.role, 1);
      ctx.beginPath();
      ctx.arc(x, y, o.role === "sod" ? 3.2 : 3.8, 0, 7);
      ctx.fillStyle = col(o.role, 1);
      ctx.fill();
      ctx.restore();
    });
    if (!reduce) raf = requestAnimationFrame(frame);
  };

  // reduced motion: exactly one frame — the composition, frozen
  if (reduce) frame();
  else raf = requestAnimationFrame(frame);

  // pause when hidden
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", size);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}, []);
```

Markup notes: the canvas is `aria-hidden="true"` with explicit width/height
attributes; the meaning it carries (quadrant labels, "live · 14 sectors"
caption) lives in real HTML positioned over it, so the information survives
with the canvas blank.

## Card sparklines

Same idea at postage-stamp scale: painted area charts inside feature cards,
selected by a `data-spark` attribute so one effect draws them all. Gradient
stroke ending at full accent, gradient fill fading to transparent, a bright
dot on the last point. Hardcoded plausible point arrays are fine — these are
texture, not charts. Redraw on resize; no animation loop needed, so no
reduced-motion branch required.

```tsx
useEffect(() => {
  const canvases = Array.from(
    root.querySelectorAll<HTMLCanvasElement>("[data-spark]"),
  );
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const draw = (cv: HTMLCanvasElement) => {
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pts = cv.dataset.spark === "flow"
      ? [0.5, 0.4, 0.55, 0.35, 0.6, 0.5, 0.8, 0.7, 0.9]
      : [0.3, 0.45, 0.4, 0.6, 0.55, 0.75, 0.65, 0.85, 0.9];
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - p * (h - 6) - 3;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    const stroke = ctx.createLinearGradient(0, 0, w, 0);
    stroke.addColorStop(0, "rgba(242,168,60,.5)");
    stroke.addColorStop(1, "#f2a83c");
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, "rgba(242,168,60,.16)");
    fill.addColorStop(1, "rgba(242,168,60,0)");
    ctx.fillStyle = fill;
    ctx.fill();
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(w - 2, h - last * (h - 6) - 3, 2.4, 0, 7);
    ctx.fillStyle = "#ffc164";
    ctx.fill();
  };
  const drawAll = () => canvases.forEach(draw);
  drawAll();
  window.addEventListener("resize", drawAll, { passive: true });
  return () => window.removeEventListener("resize", drawAll);
}, []);
```

## Scroll reveals

One IntersectionObserver for the whole page. Any element opts in with
`data-reveal`; the observer adds the module's `isIn` class once and
unobserves (reveals fire once — re-triggering on scroll-up reads gimmicky).
Reduced motion short-circuits to "everything visible immediately":

```tsx
useEffect(() => {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduce) {
    nodes.forEach((n) => n.classList.add(s.isIn));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add(s.isIn);
          io.unobserve(e.target);
        }
      });
    },
    // -8% bottom margin: elements reveal slightly before fully entering,
    // so the user never stares at an empty slot
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
  );
  nodes.forEach((n) => io.observe(n));
  return () => io.disconnect();
}, []);
```

The nav-blur state is the only scroll listener on the page, and it does no
layout reads: `window.addEventListener("scroll", () =>
setScrolled(window.scrollY > 12), { passive: true })`.
