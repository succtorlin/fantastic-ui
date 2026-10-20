// node --test scripts/exam.test.mjs
// Needs playwright and @axe-core/playwright (from the project, or
// PLAYWRIGHT_DIR=<node_modules>); the browser tests are skipped without them.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools, serve, auditPage, exam } from "./exam.mjs";

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
