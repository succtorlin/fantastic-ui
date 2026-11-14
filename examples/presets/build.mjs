/** Rebuild the published examples with node examples/presets/build.mjs. */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetBlock, parseTokens, derive, sampleHtml } from '../../skills/fantastic-ui/scripts/direction-samples.mjs';

const here = new URL('./', import.meta.url);
const examples = JSON.parse(readFileSync(new URL('examples.json', here), 'utf8'));
copyFileSync(new URL('../../skills/fantastic-ui/templates/direction-sample/sample.css', here), new URL('sample.css', here));

for (const example of examples) {
  const { id, preset, brand, headline, sub, cta, section, kind, hero, stats, plate, rows } = example;
  const { name, decls } = presetBlock(preset);
  const direction = { preset, name, hero, proof: plate ? 'image' : 'stats' };
  const content = {
    brand, headline, sub, cta, stats, nav: ['Style gallery'],
    navCta: 'View example',
    section: { kind, title: section, rows },
    footer: `Fictional example · ${name}`,
  };
  const tokens = decls.split('\n').map((line) => line.trimEnd()).join('\n');
  const app = sampleHtml({ content }, direction, tokens, derive(parseTokens(tokens), preset));
  // The published examples have real in-page destinations and a visible gallery link.
  const html = app.replace('<body>', `<body class="preset-${preset.toLowerCase()}">`)
    .replace('</head>', '<link rel="stylesheet" href="gallery.css">\n</head>')
    .replace('<a href="#">Style gallery</a>', '<a href="index.html">Style gallery</a>')
    .replace('<a class="btn btn--primary" href="#">View example</a>', '')
    .replace('Vector S:', 'Vector&nbsp;S:')
    .replaceAll('href="#"', 'href="#example-content"')
    .replace('<section class="section">', '<section class="section" id="example-content">')
    .replaceAll('class="wrap', 'data-fui-align-start="preset" data-fui-align-end="preset" class="wrap')
    .replace('<div class="actions">', '<div class="actions" data-fui-buttons="Example actions">')
    .replace(/<figure class="slot panel (.*?)" aria-hidden="true">[\s\S]*?<\/figure>/, (_match, layout) => {
      const art = plate ? `<img src="art/${plate}.webp" width="900" height="560" alt="">` : '';
      return `<figure class="slot panel ${layout}" aria-hidden="true">${art}</figure>`;
    });
  writeFileSync(fileURLToPath(new URL(`${id}.html`, here)), html);
}

const galleryWhite = {
  preset: 'L', id: '../gallery-white/index', brand: 'Lumen One',
  look: 'Quiet studio lighting, generous white space and one blue action.',
  prompt: 'Build a device launch in Gallery White. Use my product photography and give each section one idea.',
};
const entries = [...examples, galleryWhite];
const liveGallery = 'https://succtorlin.github.io/fantastic-ui/';
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const cards = entries.map(({ preset, id, brand, look }) => {
  const { name } = presetBlock(preset);
  const shot = preset === 'L' ? '../../assets/gallery-white.png' : `previews/${id}.webp`;
  return `  <article class="style-card">
    <a href="${id}.html"><img src="${shot}" width="640" height="400" alt="" loading="lazy"><span>${escape(name)}</span></a>
    <p><strong>${escape(brand)}</strong> · ${escape(look)}</p>
  </article>`;
}).join('\n');
writeFileSync(new URL('index.html', here), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fantastic UI · Preset gallery</title>
<link rel="stylesheet" href="index.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header data-fui-align-start="gallery" data-fui-align-end="gallery"><nav aria-label="Main"><a href="#styles">Browse styles</a></nav></header>
<main id="main" data-fui-align-start="gallery" data-fui-align-end="gallery">
  <h1>Fantastic UI preset gallery</h1>
  <p class="intro">Explore twelve design directions. Each uses a fictional brief and the preset’s own tokens.</p>
  <section class="style-grid" id="styles" aria-label="The twelve presets">
${cards}
  </section>
</main>
<footer data-fui-align-start="gallery" data-fui-align-end="gallery">Fantastic UI examples</footer>
</body>
</html>
`);

const guide = entries.map(({ id, preset, brand, look, prompt }) => {
  const { name } = presetBlock(preset);
  const shot = preset === 'L' ? '../../assets/gallery-white.png' : `previews/${id}.webp`;
  const demo = new URL(`examples/presets/${id}.html`, liveGallery).href;
  return `### ${preset} · ${name}

[![${brand} preview in ${name}](${shot})](${demo})

${look}

> $fantastic-ui ${prompt}

[Open live example](${demo}) · [View source](${id}.html)${preset === 'C' ? ` · [Download the A4 report (PDF)](${liveGallery}examples/presets/marigold-report.pdf)` : ''}
`;
}).join('\n');
writeFileSync(new URL('README.md', here), `# Fantastic UI preset gallery

All twelve presets are shown below with a screenshot and a starter prompt.
The examples use fictional content. Their illustrations are intentionally
stylized examples of art direction. Use your own product, venue, or team photos
where the prompt calls for them.

Use \`$fantastic-ui\` in Codex or replace it with \`/fantastic-ui\` in Claude Code.
For the full design rules, see the [preset reference](../../skills/fantastic-ui/references/theme-presets.md).

**[Open the live gallery](${liveGallery}).** Every screenshot below opens
its live example. For local development, run this from the repository root
and open [the local gallery](http://127.0.0.1:8000/examples/presets/).

\`\`\`bash
python3 -m http.server 8000 --bind 127.0.0.1
\`\`\`

${guide}## Rebuild the examples

\`\`\`bash
node examples/presets/build.mjs
node skills/fantastic-ui/scripts/exam.mjs examples/presets
\`\`\`

The build reads \`examples.json\` and the skill’s own preset token definitions.
It writes the pages and this guide. The exam uses Playwright and axe-core. If
they are installed elsewhere, pass \`--modules /path/to/node_modules\`.
The existing [Gallery White example](../gallery-white/) is maintained separately.
`);
