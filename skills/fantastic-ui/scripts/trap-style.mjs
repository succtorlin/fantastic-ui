/**
 * trap-style.mjs — the "computed-style" trap kind.
 *
 * Some preset traps are not about a colour pairing or about two boxes
 * overlapping: they are one CSS property that must hold on every element a
 * selector matches. Three presets declare one in preset-gates.json:
 *
 *   P  clip-path is none on every control   (a clipped control loses its
 *                                            keyboard focus ring)
 *   Q  overflow-x is auto on a shelf track  (hidden makes the row
 *                                            unreachable without script)
 *   R  filter is grayscale(1) on art boxes  (one coloured picture becomes
 *                                            the accent by accident)
 *
 * A trap names a `selector`, a `property`, and either `equals` (the exact
 * computed value) or `matches` (a pattern, for values a browser may
 * normalise). `collectComputedStyle` runs in the page and only reads;
 * `judgeComputedStyle` is pure, so the decision is unit-tested without a
 * browser (trap-style.test.mjs). verify-preset.mjs wires the two together.
 *
 * NOT CHECKED: a state the page was not driven into (a clip-path applied
 * only on :hover), and elements that are not rendered when the gate runs.
 */

/** Runs IN THE PAGE (serialised by page.evaluate): the property's computed
    value on every rendered element the selector matches. */
export function collectComputedStyle(selector, property) {
  const shown = [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length);
  if (!shown.length) return { skipped: true };
  return { values: shown.map((el) => getComputedStyle(el).getPropertyValue(property).trim()) };
}

/** Judge what collectComputedStyle returned against one trap declaration. */
export function judgeComputedStyle(got, trap) {
  const exact = trap.equals != null;
  if (!exact && trap.matches == null) {
    throw new Error(`trap "${trap.id}": a computed-style trap needs "equals" or "matches"`);
  }
  if (got.skipped) return { pass: true, evidence: "element not present on this page (device unused)", note: "" };
  const pattern = exact ? null : new RegExp(trap.matches);
  const holds = (value) => (exact ? value === trap.equals : pattern.test(value));
  const off = got.values.filter((value) => !holds(value));
  const want = exact ? `be ${trap.equals}` : `match ${trap.matches}`;
  return {
    pass: off.length === 0,
    evidence: `${got.values.length} element(s); ${trap.property} must ${want}`,
    note: off.length ? `${off.length} of ${got.values.length} off: ${[...new Set(off)].slice(0, 3).join(" | ")}. ${trap.rule}` : "",
  };
}
