// A differential (#26, docs/adr/0003): a pick about as good as the planner's, owned by far fewer teams. Display only.
// Run: node --test tools/test_differential.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const { differential, lessOwned, diffHtml } = new Function([line("const esc="), line("const r1="), cut("// facts:begin", "// facts:end"),
  line("const tipTxt="), line("const tipPick="), cut("// differential:begin", "// differential:end")].join("\n")
  + "\nreturn {differential,lessOwned,diffHtml};")();

const pl = (short, x, pop, more = {}) => ({ short, x, pop, ...more });

test("far less owned: at most half the share and at least 5 points of share less", () => {
  assert.equal(lessOwned(pl("A", 20, 40), pl("B", 20, 20)), true);
  assert.equal(lessOwned(pl("A", 20, 40), pl("B", 20, 21)), false, "more than half");
  assert.equal(lessOwned(pl("A", 20, 6), pl("B", 20, 2)), false, "half, but only 4 points of share less");
  assert.equal(lessOwned(pl("A", 20, 40), pl("B", 20, null)), false, "unknown ownership is never a differential");
  assert.equal(lessOwned(pl("A", 20, null), pl("B", 20, 1)), false);
});

test("a star with a cheaper, far less owned player within 4 points: that player", () => {
  const star = pl("Star", 24, 40), alt = pl("Alt", 20.5, 3), close = pl("Close", 23, 30), far = pl("Far", 19.9, 1);
  const d = differential(star, [star, close, far, alt]);
  assert.equal(d.p, alt);
  assert.equal(d.less, 3.5);
});

test("the best projection wins among differentials; equal projections go to the less owned", () => {
  const pick = pl("Pick", 20, 50), a = pl("A", 18, 10), b = pl("B", 19, 20), c = pl("C", 19, 4);
  assert.equal(differential(pick, [a, b, c]).p, c);
});

test("more than 4 points less, an Out player, or the pick himself: no differential", () => {
  const pick = pl("Pick", 20, 50);
  assert.equal(differential(pick, [pick, pl("Low", 15.9, 1), pl("Out", 22, 1, { out: true })]), null);
});

test("a bench player owned by almost nobody has no differential: nobody is far less owned", () => {
  const bench = pl("Bench", 4, 0.3);
  assert.equal(differential(bench, [pl("Other", 4, 0)]), null);
});

test("val decides what counts as projected points (a trade adds the look-ahead)", () => {
  const pick = pl("Pick", 20, 40, { nx: 6 }), alt = pl("Alt", 20, 2, { nx: 0 });
  assert.equal(differential(pick, [alt]).p, alt, "on this round's projection alone");
  assert.equal(differential(pick, [alt], p => p.x + p.nx), null, "6 points less with the look-ahead");
});

test("the hint: name, points, ownership, and the site's tooltip (no title attribute, no middle dot)", () => {
  const pick = pl("Moore", 16.6, 40), alt = pl("Hayes", 15.2, 3);
  const h = diffHtml(pick, differential(pick, [alt]), "Captain");
  assert.match(h, /^<span class="diff has-tip" tabindex="0">Differential: Hayes, 1.4 pts less, owned by 3% vs 40%<span class="tip tip-pick"/);
  assert.match(h, /<b>Hayes instead of Moore<\/b>/);
  assert.match(h, /Captain: projected 15.2 against 16.6\. Owned by 3% of teams against 40%\./);
  assert.match(h, /A hint only: the plan does not change\./);
  assert.doesNotMatch(h, /title=| · /);
  const more = diffHtml(pick, differential(pick, [pl("Up", 17, 2)]), "Trade");
  assert.match(more, /Differential: Up, 0.4 pts more,/);
  assert.match(diffHtml(pl("P", 20, 40), differential(pl("P", 20, 40), [pl("Q", 17, 2)]), "Trade"), /Differential: Q, 3.0 pts less,/);
  assert.match(diffHtml(pick, differential(pick, [pl("Same", 16.6, 2)]), "Trade"), /Differential: Same, same projection,/);
  // the gap is the one between the two numbers shown, not the unrounded ones (19.64 − 18.76 would read 0.9)
  const r = diffHtml(pl("N", 19.64, 13.5), differential(pl("N", 19.64, 13.5), [pl("S", 18.76, 3.2)]), "Trade");
  assert.match(r, /Differential: S, 0.8 pts less,/);
  assert.match(r, /projected 18.8 against 19.6\./);
  assert.match(diffHtml(pl("A<b", 10, 40), differential(pl("A<b", 10, 40), [pl("C&d", 10, 1)]), "Trade"), /Differential: C&amp;d,/);
});
