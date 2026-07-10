# AI-generated atmosphere backgrounds

One section of the page (the credibility/accountability band in the worked
example) sits over a full-bleed atmospheric image. Generated imagery is the
right tool **only** for atmosphere — never for UI, product shots, people, or
anything with text. The image is texture behind real content.

## The discipline

- **One image per page, maybe two.** Atmosphere loses its effect when every
  band has one.
- **Generate large, compress brutally.** 1536×1024 source → webp at quality
  ~68 → target **≤ 30 KB** shipped (the worked example shipped 11 KB). Dark,
  low-frequency images compress extraordinarily well; if yours doesn't, it's
  too busy to sit behind text anyway.
- **Commit the generator script, not the source PNG.** The multi-MB PNG is a
  build intermediate; the ~40-line script is the provenance record. Delete
  the PNG after compressing.
- **Layer it under a gradient scrim** in CSS so text contrast never depends
  on the image's luck: e.g. a `linear-gradient(rgba(11,11,10,.85),
  rgba(11,11,10,.92))` over the `background-image`.

## Prompt recipe

The prompt structure that works, adaptable to any palette:

1. **Register**: "ultra-minimal, very dark abstract background for a premium
   [domain] [product-type]"
2. **The motif in the accent color**: tiny glowing points/lines/arcs in the
   accent hue, described as *sparse* ("faint constellation", "scattered like
   a night star chart")
3. **Semantic colors sparingly**, if the domain has them ("a couple of small
   teal and red accent points used sparingly")
4. **Mostly negative space, explicitly**: "mostly deep [ground-color]
   near-black negative space … so overlaid text stays perfectly readable"
5. **Finish**: "gentle depth-of-field bokeh, subtle film grain, cinematic,
   atmospheric, restrained, high-end editorial"
6. **Hard negatives**: "No text, no words, no logos, no chart axes."

## Pipeline script (committed with the page)

```python
#!/usr/bin/env python3
"""Generate one atmospheric section-band image, compress to a compact webp."""
import base64, os, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent


def key():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("OPENAI_API_KEY", "")


PROMPT = (
    "An ultra-minimal, very dark abstract background for a premium quantitative "
    "finance terminal. A faint constellation of tiny glowing warm amber-gold data "
    "points scattered like a night star chart, a few with delicate thin curved "
    "connective arcs suggesting slow rotation, plus a couple of small teal and red "
    "accent points used sparingly. Mostly deep warm-charcoal near-black negative "
    "space with gentle depth-of-field bokeh and subtle film grain, so overlaid text "
    "stays perfectly readable. Cinematic, atmospheric, restrained, high-end editorial. "
    "No text, no words, no logos, no chart axes."
)


def main():
    from openai import OpenAI
    from PIL import Image
    client = OpenAI(api_key=key())
    r = client.images.generate(model="gpt-image-2", prompt=PROMPT,
                               size="1536x1024", quality="medium")
    raw = ROOT / "web" / "public" / "landing" / "band.png"
    raw.write_bytes(base64.b64decode(r.data[0].b64_json))
    im = Image.open(raw).convert("RGB")
    out = ROOT / "web" / "public" / "landing" / "band.webp"
    im.save(out, "WEBP", quality=68, method=6)
    print(f"OK {out} {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    sys.exit(main())
```

Usage in the page — a positioned background layer div, real content above it:

```tsx
<section className={s.ledger}>
  <div className={s.ledgerBg} style={{ backgroundImage: "url(/landing/band.webp)" }} />
  <div className={`${s.wrap} ${s.ledgerInner}`}>…content…</div>
</section>
```

If image generation isn't available (no API key), skip the image entirely —
the ground-scale banding from the token system carries the page fine without
it. Never substitute a stock photo.
