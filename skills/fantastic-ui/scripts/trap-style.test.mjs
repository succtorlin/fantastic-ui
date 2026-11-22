// node --test scripts/trap-style.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judgeComputedStyle, collectComputedStyle } from "./trap-style.mjs";

const clip = { id: "cut-never-clips-the-focus-ring", property: "clip-path", equals: "none", rule: "the control keeps clip-path: none" };

test("passes when every matching element holds the value", () => {
  const v = judgeComputedStyle({ values: ["none", "none", "none"] }, clip);
  assert.equal(v.pass, true);
  assert.match(v.evidence, /3 element\(s\); clip-path must be none/);
  assert.equal(v.note, "");
});

test("fails on one element that does not, and names the value it found", () => {
  const v = judgeComputedStyle({ values: ["none", "polygon(0px 0px, 100% 0px, 100% 60%, 0px 100%)"] }, clip);
  assert.equal(v.pass, false);
  assert.match(v.note, /1 of 2 off: polygon\(/);
  assert.match(v.note, /the control keeps clip-path: none/);
});

test("a device the page does not use is a pass, and says so", () => {
  const v = judgeComputedStyle({ skipped: true }, clip);
  assert.equal(v.pass, true);
  assert.match(v.evidence, /not present/);
});

test("`matches` is a pattern, for values the browser may normalise", () => {
  const grey = { id: "g", property: "filter", matches: "^grayscale\\((1|100%)\\)$", rule: "r" };
  assert.equal(judgeComputedStyle({ values: ["grayscale(1)", "grayscale(100%)"] }, grey).pass, true);
  assert.equal(judgeComputedStyle({ values: ["none"] }, grey).pass, false);
  assert.equal(judgeComputedStyle({ values: ["grayscale(0.4)"] }, grey).pass, false);
});

test("a trap with neither `equals` nor `matches` is a broken declaration, not a pass", () => {
  assert.throws(() => judgeComputedStyle({ values: ["none"] }, { id: "x", property: "filter" }), /needs "equals" or "matches"/);
});

test("collectComputedStyle is self-contained, so it can be serialised into the page", () => {
  const src = collectComputedStyle.toString();
  assert.doesNotMatch(src, /judgeComputedStyle|import\(/);
  assert.match(src, /getComputedStyle/);
});

test("every computed-style trap in preset-gates.json is well formed", () => {
  const gates = JSON.parse(readFileSync(new URL("./preset-gates.json", import.meta.url), "utf8"));
  const traps = Object.values(gates.presets).flatMap((p) => p.traps || []).filter((t) => t.kind === "computed-style");
  assert.ok(traps.length >= 3, "P, Q and R each declare one");
  for (const t of traps) {
    assert.ok(t.selector && t.property && t.rule, `${t.id} names a selector, a property and a rule`);
    assert.doesNotThrow(() => judgeComputedStyle({ values: [] }, t));
  }
});
