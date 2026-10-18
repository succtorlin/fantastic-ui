// node --test scripts/direction-samples.test.mjs  (no browser needed: --no-shots)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  presetBlock, parseTokens, resolveVar, contrast, bestInk, derive, validate, run, InputError, innerDecls,
} from "./direction-samples.mjs";

const content = {
  brand: "Halden", headline: "Ride the fjord road without the hill.", cta: "Book a bike",
  stats: [["80 km", "range"]],
  section: { kind: "table", title: "Routes", columns: ["Route", "Detail", "Km"], rows: [["Flåm valley", "Waterfalls", "20"]] },
};
const fresh = ".page { --ground:#0b0b0a; --ground-2:#0e0d0a; --panel:#151309; --hair:#26241b; --ink:#f3efe6; --ink-2:#cbc5b5; --muted:#8f8873; --accent:#f2a83c; --display:serif; --sans:sans-serif; --mono:monospace; --r-card:2px; --r-panel:2px; --r-sheet:0; }";

function manifest(extra = {}) {
  return {
    out: "out", recommended: "a", content,
    directions: [
      { id: "a", name: "Instrument", tokensCss: fresh, why: "w", tradeoff: "t" },
      { id: "E", preset: "E", section: "cards" },
      { id: "L", preset: "L", hero: "statement", section: "list" },
    ],
    ...extra,
  };
}

test("every preset A–L parses and yields a readable button", () => {
  for (const L of "ABCDEFGHIJKL") {
    const { decls } = presetBlock(L);
    const map = parseTokens(decls);
    assert.ok(map.ground && map.ink, `${L} has ground and ink`);
    const d = derive(map, L);
    const cta = d.checks.find(([n]) => n === "button text")[1];
    assert.ok(cta >= 4.5, `${L} button text ${cta}`);
  }
});

test("separation and sheet are inferred from the tokens", () => {
  assert.equal(derive(parseTokens(presetBlock("E").decls), "E").sep, "shadow");
  assert.equal(derive(parseTokens(presetBlock("L").decls), "L").sep, "tone");
  assert.equal(derive(parseTokens(presetBlock("B").decls), "B").sep, "hairline");
  assert.equal(derive(parseTokens(presetBlock("A").decls), "A").sheet, true);
  assert.equal(derive(parseTokens(innerDecls(fresh)), undefined).sheet, false);
});

test("presets without an accent fall back to an ink button", () => {
  const d = derive(parseTokens(presetBlock("B").decls), "B");
  assert.equal(d.ctaBgName, "ink");
});

test("colour helpers", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.equal(contrast("not-a-colour", "#fff"), null);
  assert.equal(resolveVar("var(--a)", { a: "var(--b)", b: "#fff" }), "#fff");
  assert.equal(resolveVar("var(--x, #123456)", {}), "#123456");
  const pick = bestInk("#ffffff", ["a", "b"], { a: "#eeeeee", b: "#111111" });
  assert.equal(pick.name, "b");
});

test("validate refuses placeholder copy, wrong counts and bad ids", () => {
  assert.throws(() => validate(manifest({ directions: manifest().directions.slice(0, 1) })), InputError);
  assert.throws(() => validate({ ...manifest(), content: { ...content, headline: "Lorem ipsum dolor" } }), /placeholder/);
  assert.throws(() => validate(manifest({ recommended: "zzz" })), /recommended/);
  const dup = manifest(); dup.directions[1].id = "a";
  assert.throws(() => validate(dup), /duplicate/);
  assert.doesNotThrow(() => validate(manifest()));
});

test("run writes one page per direction plus the sheet, with real content and labelled meta", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-"));
  writeFileSync(join(dir, "m.json"), JSON.stringify(manifest()));
  const { outDir, haveShots } = await run(["node", "x", join(dir, "m.json"), "--no-shots"]);
  assert.equal(haveShots, false);
  for (const f of ["a.html", "E.html", "L.html", "index.html", "sample.css"]) assert.ok(existsSync(join(outDir, f)), f);
  const a = readFileSync(join(outDir, "a.html"), "utf8");
  assert.match(a, /Ride the fjord road/);
  assert.match(a, /--s-cta-bg: var\(--accent\)/);
  const L = readFileSync(join(outDir, "L.html"), "utf8");
  assert.match(L, /data-sep="tone"/);
  assert.match(L, /20 km/, "a bare number borrows its column name");
  const sheet = readFileSync(join(outDir, "index.html"), "utf8");
  assert.match(sheet, /Recommended/);
  assert.match(sheet, /<iframe/, "without shots the sheet embeds live pages");
  assert.doesNotMatch(a + sheet, /lorem|ipsum/i);
});

test("content is escaped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-"));
  const m = manifest(); m.content = { ...content, headline: "<script>alert(1)</script> & co" };
  writeFileSync(join(dir, "m.json"), JSON.stringify(m));
  const { outDir } = await run(["node", "x", join(dir, "m.json"), "--no-shots"]);
  const a = readFileSync(join(outDir, "a.html"), "utf8");
  assert.doesNotMatch(a, /<script>alert/);
  assert.match(a, /&lt;script&gt;/);
});

// ---- regressions from review ----
import { firstBlock, parseColor, contrastFlags, sheetHtml } from "./direction-samples.mjs";

test("only the first token rule is read; a dark block after it is reported, not merged", () => {
  const css = ":root { --ground:#ffffff; --ink:#111111; } @media (prefers-color-scheme: dark) { :root { --ground:#000000; --ink:#eeeeee; } }";
  const { decls, extra } = firstBlock(css);
  assert.equal(extra, true);
  const map = parseTokens(decls);
  assert.equal(map.ground, "#ffffff");
  assert.equal(map.ink, "#111111");
  assert.throws(() => firstBlock(":root { --a: 1; "), /unbalanced/);
});

test("helper vars are written in their own rule, never inside the injected block", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-"));
  const m = manifest();
  m.directions[0].tokensCss = fresh + " @media (prefers-color-scheme: dark) { .page { --ground:#fff; } }";
  writeFileSync(join(dir, "m.json"), JSON.stringify(m));
  const { outDir } = await run(["node", "x", join(dir, "m.json"), "--no-shots"]);
  const a = readFileSync(join(outDir, "a.html"), "utf8");
  assert.match(a, /\n\.page \{ --s-cta-bg: var\(--accent\)/);
  assert.doesNotMatch(a, /@media/);
});

test("hsl, oklch and names parse; an unparseable accent keeps its role and is flagged", () => {
  const near = (c, r, g, b) => Math.abs(c.r - r) < 2 && Math.abs(c.g - g) < 2 && Math.abs(c.b - b) < 2;
  assert.ok(near(parseColor("hsl(0 100% 50%)"), 255, 0, 0));
  assert.ok(near(parseColor("oklch(1 0 0)"), 255, 255, 255));
  assert.ok(near(parseColor("oklch(0% 0 0)"), 0, 0, 0));
  assert.ok(near(parseColor("white"), 255, 255, 255));
  const d = derive(parseTokens("--ground:#fff; --panel:#fff; --ground-2:#eee; --ink:#111; --ink-2:#444; --accent: color(display-p3 1 0 0);"));
  assert.equal(d.ctaBgName, "accent", "the accent stays the button colour even when it can't be measured");
  assert.ok(contrastFlags(d.checks).some((f) => /not measurable/.test(f)));
});

test("missing tokens are flagged as not measurable, never hidden", () => {
  const d = derive(parseTokens("--ground:#fff; --panel:#fff; --ink:#111; --accent:#0062c4;"));
  const flags = contrastFlags(d.checks);
  assert.ok(flags.some((f) => /secondary ink not measurable/.test(f)));
});

test("validate: reserved and case-colliding ids, enums, stats shape, recommended required, preset letter", () => {
  const bad = (mut, re) => { const m = manifest(); mut(m); assert.throws(() => validate(m), re); };
  bad((m) => { m.directions[0].id = "index"; m.recommended = "index"; }, /reserved/);
  bad((m) => { m.directions[1].id = "A"; }, /case-insensitively/);
  bad((m) => { m.directions[0].hero = "centered"; }, /hero must be one of/);
  bad((m) => { m.content = { ...content, stats: [{ value: 1 }] }; }, /stats must be/);
  bad((m) => { delete m.recommended; }, /recommended.*required/);
  assert.throws(() => presetBlock("."), /letter A–L/);
  const ok = manifest(); ok.content = { ...content, brand: "Acmeist Studio" };
  assert.doesNotThrow(() => validate(ok), "placeholder match is whole-word only");
});

test("the sheet puts the recommendation first and flags weak pairs in plain words", () => {
  const rows = [
    { dir: { id: "x", name: "X" }, d: { checks: [["body ink", 3.1]] } },
    { dir: { id: "y", name: "Y" }, d: { checks: [["body ink", 9]] } },
  ];
  const html = sheetHtml({ recommended: "y", content: { brand: "B" } }, rows, false);
  assert.ok(html.indexOf("<h2>Y") > 0 && html.indexOf("<h2>Y") < html.indexOf("<h2>X"));
  assert.match(html, /Below WCAG AA: body ink 3\.10:1 \(needs 4\.5:1\)/);
});

test("a missing tokensFile is an input error (exit 2), not a crash", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-"));
  const m = manifest(); delete m.directions[0].tokensCss; m.directions[0].tokensFile = "nope.css";
  writeFileSync(join(dir, "m.json"), JSON.stringify(m));
  await assert.rejects(run(["node", "x", join(dir, "m.json"), "--no-shots"]), (e) => e instanceof InputError && /tokensFile/.test(e.message));
});

test("white text never sits on an accent unless the preset declares it", () => {
  const J = derive(parseTokens(presetBlock("J").decls), "J");
  assert.notEqual(J.ctaBgName, "accent", "J's red only reads with white, so the button takes the inverted fill");
  const L = derive(parseTokens(presetBlock("L").decls), "L");
  assert.equal(L.ctaBgName, "accent-fill", "L declares its white-on-accent pairing (whiteOnAccent: declared)");
});

test("number columns get the num class; prose columns do not", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-"));
  writeFileSync(join(dir, "m.json"), JSON.stringify(manifest()));
  const { outDir } = await run(["node", "x", join(dir, "m.json"), "--no-shots", "--no-plates"]);
  const a = readFileSync(join(outDir, "a.html"), "utf8");
  assert.match(a, /<td class="num">20<\/td>/);
  assert.match(a, /<td>Waterfalls<\/td>/);
  assert.match(a, /<a class="skip" href="#main">/);
  assert.match(a, /<main id="main">/);
});

test("check-samples refuses a missing folder with exit 2", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [new URL("./check-samples.mjs", import.meta.url).pathname, "/no/such/folder"], { encoding: "utf8" });
  assert.equal(r.status, 2);
});
