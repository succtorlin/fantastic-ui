// node --test skills/fantastic-ui/scripts/lint-hook.test.mjs   (Node ≥ 20, no deps)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { check, projectRoot } from "./lint-hook.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "lint-hook.mjs");
const BAD_CSS = ".kicker { text-transform: uppercase; letter-spacing: .2em; line-height: 1.2; }\n.x { animation: spin 1s infinite; }\n@keyframes spin { to { transform: rotate(1turn); } }\n";
const hook = (payload) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: "utf8" });

function project(marker) {
  const d = mkdtempSync(join(tmpdir(), "lint-hook-"));
  if (marker) writeFileSync(join(d, ".fantastic-ui"), "");
  mkdirSync(join(d, "src"));
  writeFileSync(join(d, "src", "a.css"), BAD_CSS);
  return d;
}

test("outside a fantastic-ui project the hook says nothing", () => {
  const d = project(false);
  try {
    assert.equal(projectRoot(join(d, "src", "a.css")), null);
    const r = hook({ tool_name: "Write", tool_input: { file_path: join(d, "src", "a.css") } });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("inside one it reports file-level findings on stderr with exit 2, and leaves run-level rules to the exam", () => {
  const d = project(true);
  try {
    const f = check({ tool_input: { file_path: join(d, "src", "a.css") } });
    assert.deepEqual(f.map((x) => x.rule), ["tracked-caps"]);
    const r = hook({ tool_name: "Edit", tool_input: { file_path: join(d, "src", "a.css") } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /tracked-caps/);
    assert.doesNotMatch(r.stderr, /reduced-motion-missing/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a clean file, a non-surface file and a bad payload all exit 0", () => {
  const d = project(true);
  try {
    writeFileSync(join(d, "src", "ok.css"), ".note { color: var(--muted); }\n");
    writeFileSync(join(d, "src", "notes.md"), "Trusted by — everyone\n");
    for (const file of ["ok.css", "notes.md", "missing.css"]) assert.equal(hook({ tool_input: { file_path: join(d, "src", file) } }).status, 0, file);
    assert.equal(spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" }).status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a page written before its stylesheet, and server copy in a .ts file, are not judged at the edit", () => {
  const d = project(true);
  try {
    writeFileSync(join(d, "src", "index.html"), '<link rel="stylesheet" href="styles.css"><script src="app.js"></script><p>Plain text here.</p>');
    writeFileSync(join(d, "src", "server.ts"), 'export const msg = "A powerful, seamless API \u2014 for teams";\n');
    assert.deepEqual(check({ tool_input: { file_path: join(d, "src", "index.html") } }), []);
    assert.deepEqual(check({ tool_input: { file_path: join(d, "src", "server.ts") } }), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
