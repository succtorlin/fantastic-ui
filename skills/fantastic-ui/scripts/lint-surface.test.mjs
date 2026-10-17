// node --test skills/fantastic-ui/scripts/lint-surface.test.mjs   (Node ≥ 20, no deps)
// The clean fixture obeys every rule. Each mutation copies it to a temp dir,
// introduces exactly one violation, and asserts that rule fires (and that the
// clean copy has zero findings for it).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { lint, RULES } from "./lint-surface.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CLEAN = join(here, "fixtures", "lint-surface", "clean");
const CLI = join(here, "lint-surface.mjs");

function copyClean() { const d = mkdtempSync(join(tmpdir(), "lint-surface-")); cpSync(CLEAN, d, { recursive: true }); return d; }
function mutate(dir, file, from, to) {
  const p = join(dir, file), s = readFileSync(p, "utf8");
  assert.ok(s.includes(from), `fixture ${file} must contain ${JSON.stringify(from)}`);
  writeFileSync(p, s.replace(from, to));
}
const run = (dir) => lint([dir], { cwd: dir });
const rulesOf = (r) => [...new Set(r.findings.map((f) => f.rule))];
const cli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

describe("clean fixture", () => {
  test("has zero findings for every rule", () => {
    const r = run(CLEAN);
    assert.equal(r.files.length, 4);
    assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
    assert.equal(r.p0, 0);
  });
});

const MUTATIONS = [
  ["dead-local-ref", "P0", "index.html", 'src="mark.svg"', 'src="missing.svg"'],
  ["dead-local-ref", "P0", "card.tsx", 'import "./styles.css";', 'import "./gone.css";'],
  ["overflow-hidden-kills-sticky", "P0", "styles.css", "body { margin: 0; overflow-x: clip; }", "html, body { margin: 0; overflow-x: hidden; }"],
  ["overflow-hidden-kills-sticky", "P0", "styles.css", "body { margin: 0; overflow-x: clip; }", "body { margin: 0; overflow-x: hidden; }\nhtml { overflow: hidden; }"],
  ["overflow-hidden-kills-sticky", "P0", "styles.css", "  background: var(--ground);\n  color: var(--ink);\n}", "  background: var(--ground);\n  color: var(--ink);\n  overflow-x: hidden;\n}"],
  ["dead-local-ref", "P0", "styles.css", ".card img { display: block;", ".card { background: url(./missing.png) no-repeat; }\n.card img { display: block;"],
  ["dead-local-ref", "P0", "index.html", '<span class="live" data-reveal>', '<span class="live" style="background-image: url(\'../a.webp\')" data-reveal>'],
  ["reduced-motion-missing", "P0", "styles.css", "@media (prefers-reduced-motion: reduce) {", "@media (max-width: 1px) {"],
  ["zoom-blocked", "P0", "index.html", 'initial-scale=1"', 'initial-scale=1, maximum-scale=1"'],
  ["zoom-blocked", "P0", "index.html", 'initial-scale=1"', 'initial-scale=1, user-scalable=no"'],
  ["opacity-on-text", "P1", "styles.css", ".note { color: var(--muted); }", ".note { color: var(--ink); opacity: .6; }"],
  ["opacity-on-text", "P1", "card.tsx", 'className="font-semibold tracking-tight"', 'className="font-semibold tracking-tight opacity-60"'],
  ["opacity-on-text", "P1", "card.tsx", 'className="text-[color:var(--muted)]"', 'className="text-white/60"'],
  ["color-literal-outside-tokens", "P1", "styles.css", ".note { color: var(--muted); }", ".note { color: #6a6a70; }"],
  ["color-literal-outside-tokens", "P1", "card.tsx", "text-[color:var(--ink)]", "text-[#1b1b1d]"],
  ["color-literal-outside-tokens", "P1", "index.html", '<span class="live" data-reveal>', '<span class="live" style="color: rgb(20 20 20)" data-reveal>'],
  ["ai-default-palette", "P1", "card.tsx", "rounded-sm border", "rounded-sm bg-indigo-500 border"],
  ["ai-default-palette", "P1", "card.tsx", 'className="font-semibold tracking-tight"', 'className="font-semibold bg-gradient-to-r bg-clip-text text-transparent"'],
  ["ai-default-palette", "P1", "styles.css", ".headline { font:", ".headline { background: linear-gradient(90deg, var(--ink), var(--accent)); -webkit-background-clip: text; color: transparent; font:"],
  ["transition-all", "P1", "styles.css", "transition: opacity 200ms;", "transition: all 200ms;"],
  ["transition-all", "P1", "card.tsx", "rounded-sm px-3", "rounded-sm transition-all motion-reduce:transition-none px-3"],
  ["uppercase-tight-leading", "P1", "styles.css", "letter-spacing: .08em; line-height: 1.2;", "letter-spacing: .08em; line-height: 0.9;"],
  ["two-sticky-top0", "P1", "styles.css", ".chapter { position: sticky; top: var(--nav-h);", ".chapter { position: sticky; top: 0;"],
  ["bare-1fr-image-grid", "P1", "styles.css", "repeat(3, minmax(0, 1fr))", "repeat(3, 1fr)"],
  ["root-relative-ref", "P2", "index.html", 'src="mark.svg"', 'src="/mark.svg"'],
  ["copy-buzzword", "P2", "index.html", "Track every position", "Seamlessly track every position"],
  ["copy-buzzword", "P2", "card.tsx", '"Within limits"', '"Within limits, a powerful signal"'],
  ["copy-em-dash", "P2", "index.html", "at the close. Nothing", "at the close — nothing"],
  ["button-label-vague", "P2", "index.html", ">Add a ticker</button>", ">Submit</button>"],
];

describe("each rule fires on a one-violation mutation of the clean fixture", () => {
  const clean = run(CLEAN);
  for (const [rule, sev, file, from, to] of MUTATIONS) {
    test(`${rule} (${file}: ${to.slice(0, 50)})`, () => {
      assert.equal(clean.findings.filter((f) => f.rule === rule).length, 0);
      const d = copyClean();
      try {
        mutate(d, file, from, to);
        const r = run(d);
        const hits = r.findings.filter((f) => f.rule === rule);
        assert.ok(hits.length >= 1, `${rule} did not fire: ${JSON.stringify(r.findings)}`);
        assert.ok(hits.every((h) => h.severity === sev && h.file === file && h.line > 0 && h.message.length > 20));
        assert.deepEqual(rulesOf(r), [rule], `only ${rule} should fire, got ${rulesOf(r)}`);
      } finally { rmSync(d, { recursive: true, force: true }); }
    });
  }
  test("every rule in RULES has at least one mutation (suppression rule tested below)", () => {
    const covered = new Set(MUTATIONS.map((m) => m[0]).concat("suppression-without-reason"));
    for (const r of RULES) assert.ok(covered.has(r.id), r.id);
  });
});

describe("run-level and severity behaviour", () => {
  test("reduced motion is judged per run: keyframes in a.css, guard in b.css → no finding", () => {
    const d = mkdtempSync(join(tmpdir(), "lint-surface-rm-"));
    try {
      writeFileSync(join(d, "a.css"), ".x { animation: spin 1s linear infinite; }\n@keyframes spin { to { transform: rotate(1turn); } }\n");
      writeFileSync(join(d, "b.css"), "@media (prefers-reduced-motion: reduce) { .x { animation: none; } }\n");
      assert.equal(lint([join(d, "a.css"), join(d, "b.css")], { cwd: d }).findings.length, 0);
      const alone = lint([join(d, "a.css")], { cwd: d });
      assert.deepEqual(rulesOf(alone), ["reduced-motion-missing"]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("requestAnimationFrame counts as motion", () => {
    const d = mkdtempSync(join(tmpdir(), "lint-surface-raf-"));
    try {
      writeFileSync(join(d, "a.js"), "function tick() { requestAnimationFrame(tick); }\n");
      assert.deepEqual(rulesOf(lint([d], { cwd: d })), ["reduced-motion-missing"]);
      writeFileSync(join(d, "a.js"), "const still = matchMedia('(prefers-reduced-motion: reduce)').matches;\nfunction tick() { if (!still) requestAnimationFrame(tick); }\n");
      assert.equal(lint([d], { cwd: d }).findings.length, 0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("root-relative ref is P2, never P0, and is named in notCovered", () => {
    const d = copyClean();
    try {
      mutate(d, "index.html", 'src="mark.svg"', 'src="/nowhere.svg"');
      const r = run(d);
      assert.equal(r.p0, 0);
      assert.ok(r.findings.every((f) => f.severity === "P2"));
      assert.ok(r.notCovered[0].includes("root-relative"));
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("--root-selector replaces the defaults", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", ".chapter { position: sticky;", ".shell { overflow-x: hidden; }\n.chapter { position: sticky;");
      assert.equal(lint([d], { cwd: d }).findings.length, 0);
      assert.deepEqual(rulesOf(lint([d], { cwd: d, rootSelectors: [".shell"] })), ["overflow-hidden-kills-sticky"]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("--token-file and --token-selector allow literals", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", ".note { color: var(--muted); }", ".note { color: #6a6a70; }");
      assert.equal(lint([d], { cwd: d, tokenFiles: [join(d, "styles.css")] }).findings.length, 0);
      assert.equal(lint([d], { cwd: d, tokenSelectors: [".note"] }).findings.length, 0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("regressions", () => {
  const noFinding = (file, from, to, rule) => {
    const d = copyClean();
    try { mutate(d, file, from, to); const r = run(d); assert.deepEqual(r.findings.filter((f) => !rule || f.rule === rule), [], JSON.stringify(r.findings)); return r; }
    finally { rmSync(d, { recursive: true, force: true }); }
  };
  test("body overflow-x: hidden alone keeps sticky (propagates to the viewport)", () => {
    noFinding("styles.css", "body { margin: 0; overflow-x: clip; }", "body { margin: 0; overflow-x: hidden; }");
  });
  test("html overflow hidden alone keeps sticky", () => {
    noFinding("styles.css", "html { color-scheme: light; }", "html { color-scheme: light; overflow: hidden; }");
  });
  test("a scroll-lock class on body is not a root", () => {
    noFinding("styles.css", "html { color-scheme: light; }", "html { color-scheme: light; overflow: hidden; }\nbody.modal-open { overflow: hidden; }\nbody[data-lock] { overflow: hidden; }");
  });
  test("main is not a default root", () => {
    noFinding("styles.css", "html { color-scheme: light; }", "html { color-scheme: light; }\nmain { overflow-x: hidden; }");
  });
  test("concatenated and template dynamic imports are not dead refs", () => {
    noFinding("card.tsx", 'import "./styles.css";', 'import "./styles.css";\nconst load = (name: string) => import("./pages/" + name);\nconst two = (n: string) => import(`./x/${n}`);\nconst dir = require("./widgets/");');
  });
  test("import syntax inside a string literal is data, not an import", () => {
    noFinding("card.tsx", 'import "./styles.css";', 'import "./styles.css";\nexport const SAMPLE = \'import x from "./missing.js"\';\nexport const MARKUP = \'<img src="gone.png">\';');
  });
  test("data:, http(s), # and root-relative url() are not P0", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", ".card img { display: block;", ".card { background: url(data:image/png;base64,AAAA), url(https://x.test/a.png), url(#grad), url(/img/a.png); }\n.card img { display: block;");
      const r = run(d);
      assert.equal(r.p0, 0);
      assert.deepEqual(rulesOf(r), ["root-relative-ref"]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("broken symlinks and symlink loops are skipped and named in notCovered", () => {
    const d = copyClean();
    try {
      symlinkSync(join(d, "nope.css"), join(d, "broken.css"));
      symlinkSync(d, join(d, "loop"));
      const r = run(d);
      assert.deepEqual(r.findings, []);
      assert.equal(r.files.length, 4);
      assert.match(r.notCovered[0], /skipped/);
      assert.match(r.notCovered[0], /broken symlink/);
      assert.equal(cli([d]).status, 0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("suppressions", () => {
  const BAD = "html, body { margin: 0; overflow: hidden; }";
  test("an allow comment with a reason moves the finding to suppressed", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", "body { margin: 0; overflow-x: clip; }", `/* lint-surface-allow: overflow-hidden-kills-sticky — the phone frame scrolls inside #app */\n${BAD}`);
      const r = run(d);
      assert.deepEqual(r.findings, []);
      assert.equal(r.suppressed.length, 1);
      assert.deepEqual(Object.keys(r.suppressed[0]).sort(), ["file", "line", "reason", "rule"]);
      assert.equal(r.suppressed[0].rule, "overflow-hidden-kills-sticky");
      assert.equal(r.suppressed[0].reason, "the phone frame scrolls inside #app");
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("a comment above a multi-line selector covers the block (phone-surfaces lock)", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", "body { margin: 0; overflow-x: clip; }", "/* lint-surface-allow: overflow-hidden-kills-sticky \u2014 the phone frame scrolls inside #app */\nhtml, body {\n  height: 100%;\n  overflow: hidden;\n}");
      const r = run(d);
      assert.deepEqual(r.findings, []);
      assert.equal(r.suppressed.length, 1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("same-line HTML and JS allow comments work", () => {
    const d = copyClean();
    try {
      mutate(d, "index.html", '<button class="btn" type="button">Add a ticker</button>', '<button class="btn" type="button">OK</button><!-- lint-surface-allow: button-label-vague - modal confirm, label set by the OS -->');
      mutate(d, "card.tsx", '"Within limits";', '"Within limits, a powerful signal"; // lint-surface-allow: copy-buzzword - quoting a competitor');
      const r = run(d);
      assert.deepEqual(r.findings, []);
      assert.deepEqual(r.suppressed.map((s) => s.rule).sort(), ["button-label-vague", "copy-buzzword"]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test("an allow comment with no reason still suppresses but raises a P2", () => {
    const d = copyClean();
    try {
      mutate(d, "styles.css", "body { margin: 0; overflow-x: clip; }", `/* lint-surface-allow: overflow-hidden-kills-sticky */\n${BAD}`);
      const r = run(d);
      assert.equal(r.suppressed.length, 1);
      assert.deepEqual(r.findings.map((f) => [f.rule, f.severity]), [["suppression-without-reason", "P2"]]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe("CLI", () => {
  test("--json shape", () => {
    const res = cli(["--json", CLEAN]);
    assert.equal(res.status, 0);
    const r = JSON.parse(res.stdout);
    assert.deepEqual(Object.keys(r).sort(), ["files", "findings", "notCovered", "p0", "suppressed"]);
    assert.ok(Array.isArray(r.files) && Array.isArray(r.findings) && Array.isArray(r.notCovered) && r.notCovered.length > 3);
    assert.equal(r.p0, 0);
  });
  test("exit codes: default 0 with a P0, --strict 1 with a P0, --strict 0 with only P1", () => {
    const d = copyClean();
    try {
      mutate(d, "index.html", 'src="mark.svg"', 'src="missing.svg"');
      assert.equal(cli([d]).status, 0);
      const strict = cli(["--strict", "--json", d]);
      assert.equal(strict.status, 1);
      const f = JSON.parse(strict.stdout).findings[0];
      assert.deepEqual(Object.keys(f).sort(), ["file", "line", "message", "rule", "severity"]);
    } finally { rmSync(d, { recursive: true, force: true }); }
    const e = copyClean();
    try {
      mutate(e, "styles.css", ".note { color: var(--muted); }", ".note { color: #6a6a70; }");
      assert.equal(cli(["--strict", e]).status, 0);
    } finally { rmSync(e, { recursive: true, force: true }); }
  });
  test("text report always prints notCovered; --rules lists every rule; bad usage exits 2", () => {
    const out = cli([CLEAN]).stdout;
    assert.match(out, /Not covered by a static pass/);
    assert.match(out, /plate-check/);
    const rules = cli(["--rules"]).stdout;
    for (const r of RULES) assert.ok(rules.includes(r.id));
    assert.equal(cli([]).status, 2);
    assert.equal(cli(["--bogus", CLEAN]).status, 2);
    assert.equal(cli(["/no/such/path"]).status, 2);
  });
});
