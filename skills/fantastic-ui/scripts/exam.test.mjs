// node --test scripts/exam.test.mjs
// Needs playwright and @axe-core/playwright (from the project, or
// PLAYWRIGHT_DIR=<node_modules>); the browser tests are skipped without them.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools, serve, auditPage, exam, foldChecks, geometryChecks } from "./exam.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "exam");

let tools = null;
try { tools = await loadTools(process.env.PLAYWRIGHT_DIR || null); } catch {}
const skip = tools ? false : "playwright and @axe-core/playwright not installed";

describe("exam: no-JS pass and dialog check", { skip }, () => {
  let browser, srv, base;
  before(async () => {
    browser = await tools.chromium.launch();
    ({ srv, base } = await serve(FIX));
  });
  after(async () => { await browser?.close(); srv?.close(); });

  test("measures both button dimensions and the intended block edges", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    try {
      await page.setContent(`
        <style>
          button { width: 112px; height: 44px; }
          article { width: 220px; }
        </style>
        <div data-fui-buttons="Review">
          <button>Back</button><button id="save">Save changes</button>
          <button hidden style="width: 10px">Hidden</button>
        </div>
        <article data-fui-align-start="Content" data-fui-align-end="Content">Summary</article>
        <article id="detail" data-fui-align-start="Content" data-fui-align-end="Content">Detail</article>
      `);
      assert.deepEqual(await geometryChecks(page, 390), []);
      await page.addStyleTag({ content: "#save { width: 140px; height: 52px; } #detail { margin-inline-start: 6px; width: 210px; }" });
      assert.deepEqual(await geometryChecks(page, 390), [
        "geometry at 390px: Review button widths differ by 28.0px",
        "geometry at 390px: Review button heights differ by 8.0px",
        "geometry at 390px: Content start edges differ by 6.0px",
        "geometry at 390px: Content end edges differ by 4.0px",
      ]);
    } finally {
      await page.close();
    }
  });

  test("a page that follows the rules passes the whole exam, dialog included", async () => {
    const { results } = await exam({ dir: join(FIX, "good"), modules: process.env.PLAYWRIGHT_DIR || null, dialogs: ["#open-booking"] });
    assert.deepEqual(results, { "index.html": [] });
  });

  test("text hidden until a script reveals it fails the no-JS pass", async () => {
    const { problems } = await auditPage(browser, tools.AxeBuilder, `${base}/traps/index.html`);
    const nojs = problems.filter((p) => p.startsWith("hidden without JavaScript"));
    assert.equal(nojs.length, 1);
    assert.match(nojs[0], /Electric bikes by the day/);
  });

  test("html.js-gated reveal is not flagged (hidden only when the script runs)", async () => {
    const { problems } = await auditPage(browser, tools.AxeBuilder, `${base}/good/index.html`);
    assert.deepEqual(problems.filter((p) => p.includes("JavaScript")), []);
  });

  test("a div that is not a dialog is reported as no dialog", async () => {
    const { problems, dialogsFound } = await auditPage(browser, tools.AxeBuilder, `${base}/traps/index.html`, { dialogs: ["#open-booking"] });
    assert.ok(dialogsFound.has("#open-booking"));
    for (const w of [1440, 390]) assert.ok(problems.includes(`dialog "#open-booking" at ${w}: Enter on the trigger opened no visible dialog (use <dialog> + showModal(), or role="dialog")`), w);
  });

  test("a role=dialog without name, modality, close, focus or Escape fails each check", async () => {
    const { problems } = await auditPage(browser, tools.AxeBuilder, `${base}/traps/index.html`, { dialogs: ["#open-help"] });
    const at = problems.filter((p) => p.startsWith('dialog "#open-help" at 1440'));
    for (const want of [/no accessible name/, /is not modal/, /no visible close button/, /focus did not move into/, /moved focus out of the open dialog/, /Escape did not close/]) {
      assert.ok(at.some((p) => want.test(p)), String(want));
    }
  });

  test("a trigger on no examined page fails instead of passing silently", async () => {
    const { results } = await exam({ dir: join(FIX, "good"), modules: process.env.PLAYWRIGHT_DIR || null, dialogs: ["#no-such-trigger"] });
    assert.ok(results["index.html"].includes('dialog trigger "#no-such-trigger" is on none of the examined pages'));
  });
});

describe("exam: composition (measure, cover, fold)", { skip }, () => {
  let browser, srv, base;
  before(async () => {
    browser = await tools.chromium.launch();
    ({ srv, base } = await serve(join(FIX, "composition")));
  });
  after(async () => { await browser?.close(); srv?.close(); });
  const audit = (page) => auditPage(browser, tools.AxeBuilder, `${base}/${page}`);

  test("an uncapped paragraph fails the measure at 1920, a 65ch one does not", async () => {
    const { problems } = await audit("measure.html");
    const m = problems.filter((p) => p.startsWith("line length"));
    assert.ok(m.some((p) => / at 1920:/.test(p)), m.join("\n"));
    assert.ok(m.every((p) => p.includes('"Electric bikes by the day')));
    assert.equal(m.filter((p) => / at 1024:/.test(p)).length, 1);
  });

  test("an opaque box over a paragraph is reported; a stretched link's overlay is not", async () => {
    const { problems } = await audit("cover.html");
    const c = problems.filter((p) => p.startsWith("text under another element"));
    assert.ok(c.some((p) => /at 1440: <p> "Electric bikes by the day, at " is covered by <div\.box>/.test(p)), c.join("\n"));
    assert.ok(!c.some((p) => p.includes("Half day plans")), c.join("\n"));
  });

  test("a screen-reader-only label beside an opaque input is not reported as covered", async () => {
    const { problems } = await audit("sr-only-label.html");
    const c = problems.filter((p) => p.startsWith("text under another element"));
    assert.ok(!c.some((p) => p.includes("Hidden search label")), c.join("\n"));
  });

  test("a label inside a closed <details> menu is not reported as covered", async () => {
    const { problems } = await audit("closed-details.html");
    const c = problems.filter((p) => p.startsWith("text under another element"));
    assert.ok(!c.some((p) => p.includes("Closed menu option")), c.join("\n"));
  });

  test("a button inside a closed <details> menu at the right edge is not reported as cut off", async () => {
    const { problems } = await audit("closed-details-wide.html");
    const c = problems.filter((p) => p.startsWith("content cut off"));
    assert.deepEqual(c, []);
  });

  test("a marked row that scrolls by itself and can be reached is not cut-off content", async () => {
    const { problems } = await audit("scroller.html");
    assert.deepEqual(problems.filter((p) => /^(content cut off|scroller)/.test(p)), []);
  });

  test("a marked row that only scrolls on small screens is quiet at the widths where it wraps", async () => {
    const { problems } = await audit("scroller-narrow-only.html");
    assert.deepEqual(problems.filter((p) => /^(content cut off|scroller)/.test(p)), []);
  });

  test("the same row without the marker is still reported: the exemption is asked for, not assumed", async () => {
    const { problems } = await audit("scroller-unmarked.html");
    assert.ok(problems.some((p) => p.startsWith("content cut off at 320")), problems.join("\n"));
  });

  test("a marked row that does not scroll is reported, and its content still counts as cut off", async () => {
    const { problems } = await audit("scroller-hidden.html");
    assert.ok(problems.some((p) => /^scroller "Lanterns" at 320: overflow-x is hidden/.test(p)), problems.join("\n"));
    assert.ok(problems.some((p) => p.startsWith("content cut off at 320")), problems.join("\n"));
  });

  test("a marked row the keyboard cannot reach is reported", async () => {
    const { problems } = await audit("scroller-unreachable.html");
    assert.ok(problems.some((p) => /^scroller "Lanterns" at 320: cannot be reached from the keyboard/.test(p)), problems.join("\n"));
  });

  test("an item wider than the screen is reported only at the widths it does not fit", async () => {
    const { problems } = await audit("scroller-wide-item.html");
    const wide = problems.filter((p) => /^scroller "Lanterns" at \d+: an item is wider than the screen/.test(p));
    assert.ok(wide.some((p) => p.includes(" at 320:")) && wide.some((p) => p.includes(" at 390:")), problems.join("\n"));
    assert.ok(!wide.some((p) => p.includes(" at 1440:")), wide.join("\n"));
  });

  test("a headline pushed below 800px fails the fold", async () => {
    const { problems } = await audit("fold.html");
    assert.ok(problems.some((p) => /^hero headline ends at \d+px, below the 1280×800 fold/.test(p)), problems.join("\n"));
  });

  test("the first action after the headline must also clear the fold", async () => {
    const { problems } = await audit("fold-action.html");
    assert.ok(problems.some((p) => /^first action "Book a bike" ends at \d+px, below the 1280×800 fold/.test(p)), problems.join("\n"));
    assert.ok(!problems.some((p) => p.startsWith("hero headline")));
  });
});

describe("exam: fold check scope (review regressions)", { skip }, () => {
  let browser, srv, base;
  before(async () => {
    browser = await tools.chromium.launch();
    ({ srv, base } = await serve(join(FIX, "composition")));
  });
  after(async () => { await browser?.close(); srv?.close(); });

  test("a CTA inside the hero <header> that holds the h1 is judged", async () => {
    const out = await foldChecks(browser, `${base}/fold-header.html`);
    assert.ok(out.some((p) => p.startsWith('first action "Book a bike"')), out.join("\n"));
  });
  test("a link deep in an article is not taken for the hero's action", async () => {
    assert.deepEqual(await foldChecks(browser, `${base}/fold-article.html`), []);
  });
});
