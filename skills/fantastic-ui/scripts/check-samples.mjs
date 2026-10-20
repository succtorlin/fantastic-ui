#!/usr/bin/env node
/**
 * check-samples.mjs — the fantastic-ui exam (exam.mjs) applied to a folder of
 * direction samples, plus each card's result written into the comparison
 * sheet. Show nothing until every page passes.
 *
 *   node check-samples.mjs design-samples [--modules /path/to/node_modules]
 *
 * Writes <dir>/checks.json. Exit 0 only when every page passes; 1 otherwise;
 * 2 on bad input. Checks are listed in exam.mjs.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { exam, report, InputError, WIDTHS, AXE_TAGS } from "./exam.mjs";

export async function check(dir, modules) {
  const { results } = await exam({ dir, modules });
  writeFileSync(join(dir, "checks.json"), JSON.stringify({ checkedAt: new Date().toISOString(), widths: WIDTHS, axeTags: AXE_TAGS, results }, null, 2));
  stampSheet(dir, results);
  return results;
}

/** Write each card's result into the sheet, replacing the generator's marker. */
function stampSheet(dir, results) {
  const p = join(dir, "index.html");
  if (!existsSync(p)) return;
  const html = readFileSync(p, "utf8").replace(/<p class="checks(?: flag)?" data-page="([^"]+)">[\s\S]*?<\/p>/g, (_m, page) => {
    const probs = results[page] || [];
    const text = probs.length
      ? `Gates: ${probs.length} problem${probs.length > 1 ? "s" : ""} (see checks.json)`
      : "Gates: WCAG 2.2 AA (axe), targets, focus, reflow 320–1440, no-JS, preset gates, lint: all pass";
    return `<p class="checks${probs.length ? " flag" : ""}" data-page="${page}">${text}</p>`;
  });
  writeFileSync(p, html);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  let modules = null;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--modules") modules = args[++i];
    else if (args[i].startsWith("--modules=")) modules = args[i].slice(10);
    else rest.push(args[i]);
  }
  if (!rest[0]) { console.error("usage: check-samples.mjs <samples dir> [--modules <node_modules>]"); process.exit(2); }
  check(rest[0], modules).then((results) => {
    const bad = report(results);
    console.log(`details in ${join(rest[0], "checks.json")}`);
    process.exit(bad ? 1 : 0);
  }).catch((e) => {
    console.error(`check-samples: ${e.message}`);
    process.exit(e instanceof InputError ? 2 : 1);
  });
}
