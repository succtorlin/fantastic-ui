/** Verify the exact gallery directory packaged for GitHub Pages. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { geometryChecks, serve } from '../../skills/fantastic-ui/scripts/exam.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const examples = JSON.parse(readFileSync(new URL('examples.json', import.meta.url), 'utf8'));
const handBuilt = JSON.parse(readFileSync(new URL('hand-built.json', import.meta.url), 'utf8'));
const whitePath = '/examples/gallery-white/index.html';
// Hand-built pages sit beside presets/, so their ids start with "../".
const ownPaths = new Set(handBuilt.map(({ id }) => new URL(`${id}.html`, 'http://gallery.invalid/examples/presets/').pathname));
const expectedPaths = [whitePath, ...examples.map(({ id }) => `/examples/presets/${id}.html`), ...ownPaths].sort();
const STYLES = 18;
assert.equal(expectedPaths.length, STYLES, `The gallery must cover all ${STYLES} styles`);
const widths = [320, 390, 1440];
const tolerance = 1;
const near = (a, b) => Math.abs(a - b) <= tolerance;
const { srv, base } = await serve(resolve(process.argv[2] ?? '_site'));
let browser;

try {
  browser = await chromium.launch();
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const failures = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok((await page.goto(`${base}/index.html`))?.ok(), 'Packaged gallery did not load');
    const links = await page.locator('.style-card a').evaluateAll((anchors) => anchors.map((a) => a.href));
    assert.ok(links.every((url) => new URL(url).origin === base), 'Examples must come from the packaged site');
    assert.deepEqual(links.map((url) => new URL(url).pathname).sort(), expectedPaths, `Gallery links must cover all ${STYLES} styles exactly once`);
    failures.push(...await geometryChecks(page, width));

    for (const url of links) {
      const white = new URL(url).pathname === whitePath;
      const label = `${url.slice(base.length)} @ ${width}px`;
      assert.ok((await page.goto(url))?.ok(), `${label}: page did not load`);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      if (ownPaths.has(new URL(url).pathname)) {
        // A hand-built page has its own button sizes and grids, so the shared
        // template's fixed 192×44 action and gutter rules do not apply to it.
        // It must still mark its own peer buttons or block edges, and meet them.
        const marked = await page.locator('[data-fui-buttons], [data-fui-align-start], [data-fui-align-end]').count();
        if (!marked) failures.push(`${label}: expected at least one marked group of buttons or blocks`);
        failures.push(...(await geometryChecks(page, width)).map((issue) => `${label}: ${issue}`));
        continue;
      }

      const rail = white ? 'lumen' : 'preset';
      const rails = await page.locator(`[data-fui-align-start="${rail}"][data-fui-align-end="${rail}"]`).count();
      if (rails < 2) failures.push(`${label}: expected at least two marked blocks`);
      failures.push(...(await geometryChecks(page, width)).map((issue) => `${label}: ${issue}`));

      // Most examples have a single action, so peer comparisons alone would
      // let its size drift. Check the gallery's shared size across pages too.
      const actions = await page.locator(white ? '.chapter .pill, .actions a' : '.actions .btn').evaluateAll(
        (elements) => elements.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { name: element.textContent.trim(), width, height };
        }),
      );
      const expectedActions = white ? 9 : 1;
      if (actions.length < expectedActions) failures.push(`${label}: expected at least ${expectedActions} actions`);
      for (const action of actions) {
        if (!near(action.width, 192) || !near(action.height, 44)) {
          failures.push(`${label}: "${action.name}" is ${action.width}×${action.height}px, expected 192×44px`);
        }
      }

      if (!white) {
        const gutterOffsets = await page.locator('.section .wrap').evaluate((wrapper) => {
          const block = wrapper.querySelector('.cards, .list, .table-wrap');
          if (!block) return null;
          const section = wrapper.getBoundingClientRect();
          const style = getComputedStyle(wrapper);
          const { left, right } = block.getBoundingClientRect();
          return [left - section.left - parseFloat(style.paddingLeft), section.right - parseFloat(style.paddingRight) - right];
        });
        if (!gutterOffsets?.every((offset) => near(offset, 0))) {
          failures.push(`${label}: detail block does not meet both section gutters`);
        }
      }

      const grids = await page.locator('.section .cards, .hero .stats, .tiles, .specs').evaluateAll(
        (elements) => elements.map((grid) => {
          const style = getComputedStyle(grid);
          const tracks = style.gridTemplateColumns.split(' ').map(parseFloat);
          const gap = parseFloat(style.columnGap) || 0;
          let position = grid.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
          const edges = tracks.map((track) => {
            const edge = { start: position, end: position + track };
            position += track + gap;
            return edge;
          });
          const blocks = [...grid.children].map((block) => {
            const { left, right } = block.getBoundingClientRect();
            return { left, right };
          });
          return { name: grid.className, edges, blocks };
        }),
      );
      for (const { name, edges, blocks } of grids) {
        for (const [index, block] of blocks.entries()) {
          if (!edges.some((edge) => near(edge.start, block.left)) || !edges.some((edge) => near(edge.end, block.right))) {
            failures.push(`${label}: ${name} item ${index + 1} is off its column edges`);
          }
        }
      }
    }
  }

  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`Geometry passed for all ${STYLES} examples at ${widths.join(', ')} CSS px (${STYLES * widths.length} checks).`);
} finally {
  await browser?.close();
  srv.close();
}
