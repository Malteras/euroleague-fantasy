// A hidden gem (#64, docs/adr/0004): a cheap player whose minutes are rising, with a soft matchup this round.
// Run: node --test tools/test_gems.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const { gemOf, GEM_PRICE, GEM_MIN, GEM_MU } = new Function([line("const r1="), line("const avg="), line("function domRecent("),
  cut("// gems:begin", "// gems:end")].join("\n") + "\nreturn {gemOf,GEM_PRICE,GEM_MIN,GEM_MU};")();

// a cheap guard whose last three games averaged 20 minutes against 14 on the season
const pl = (more = {}) => ({ short: "Joseph", pos: "G", price: 5.4, min: 14, status: null,
  log: [22, 20, 18, 8, 8].map(min => ({ min })), dom: [], ...more });

test("the thresholds sit in one place: under 6 cr, last 3 games +3 min, matchup +10%", () => {
  assert.deepEqual([GEM_PRICE, GEM_MIN, GEM_MU], [6, 3, 10]);
});

test("cheap, minutes rising, soft matchup: a gem, with his numbers", () => {
  assert.deepEqual(gemOf(pl(), 18, false), { price: 5.4, min: 14, m3: 20, mu: 18, dom: null });
});

test("6 cr or more is not cheap", () => {
  assert.equal(gemOf(pl({ price: 6 }), 18, false), null);
  assert.ok(gemOf(pl({ price: 5.9 }), 18, false));
});

test("minutes: the last 3 games must average at least 3 more than the season", () => {
  assert.ok(gemOf(pl({ min: 17 }), 18, false), "20 against 17: exactly +3");
  assert.equal(gemOf(pl({ min: 17.1 }), 18, false), null);
  assert.equal(gemOf(pl({ log: [{ min: 30 }, { min: 30 }] }), 18, false), null, "fewer than 3 games: not known");
  assert.equal(gemOf(pl({ min: null }), 18, false), null, "no season average");
});

test("matchup: his opponent this round allows his position at least 10% more than average", () => {
  assert.ok(gemOf(pl(), 10, false));
  assert.equal(gemOf(pl(), 9, false), null);
  assert.equal(gemOf(pl(), -20, false), null);
  assert.equal(gemOf(pl(), null, false), null, "no game or no defence table");
});

test("domestic form counts only when known: then it must be good", () => {
  const dom = pirs => pirs.map(pir => ({ pir }));
  // good: 1.1 × price + 3 = 8.94
  assert.deepEqual(gemOf(pl({ dom: dom([10, 9]) }), 18, false).dom, 9.5);
  assert.equal(gemOf(pl({ dom: dom([4, 6]) }), 18, false), null, "known and poor");
  assert.ok(gemOf(pl({ dom: [{ dnp: true }] }), 18, false), "no domestic game played: the rule is skipped");
});

test("Out, Doubtful, or played this round: never a gem", () => {
  assert.equal(gemOf(pl({ out: true, status: "Out" }), 18, false), null);
  assert.equal(gemOf(pl({ status: "Doubtful" }), 18, false), null);
  assert.ok(gemOf(pl({ status: "Day to day" }), 18, false), "Day to day may play");
  assert.equal(gemOf(pl(), 18, true), null);
});

const tip = new Function([line("const POSN="), line("const r1="), line("const avg="), line("function domRecent("),
  cut("// gems:begin", "// gems:end")].join("\n") + "\nreturn gemTip;")();

test("the tag's tooltip: the rules in words, his numbers in the footer", () => {
  const [ctx, text, foot] = tip(pl(), { price: 5.4, min: 14.1, m3: 20, mu: 18, dom: null }, "Hapoel");
  assert.equal(ctx, "Cheap pick");
  assert.match(text, /^Costs under 6 cr, his last 3 EuroLeague games averaged 3\+ minutes more than his season, and Hapoel allow guards 10%\+ more PIR than an average team\./);
  assert.match(text, /projection may not have caught up/);
  assert.deepEqual(foot, ["5.4 cr", "minutes 14.1 → 20", "+18% vs guards", "no domestic games on record"]);
  assert.equal(tip(pl(), { price: 5.4, min: 14, m3: 20, mu: 18, dom: 9.5 }, "Hapoel")[2][3], "domestic PIR 9.5");
});

const swapHtml = new Function([line("const esc="), line("const POSN="), line("const r1="), line("const avg="), line("function domRecent("),
  cut("// facts:begin", "// facts:end"), line("const tipTxt="), line("const tipPick="),
  cut("// gems:begin", "// gems:end")].join("\n") + "\nreturn gemSwapHtml;")();

test("the trade line when Include hidden gems took him: whom over whom, the points, the site's tooltip", () => {
  const pick = { short: "Moore" }, gem = { short: "Joseph" };
  const h = swapHtml(pick, { p: gem, v: 15.2, v0: 16.6 }, "Trade");
  assert.match(h, /^<span class="diff has-tip" tabindex="0">Hidden gem: Joseph over Moore, 1.4 pts less<span class="tip tip-pick"/);
  assert.match(h, /<b>Joseph instead of Moore<\/b>/);
  assert.match(h, /Trade: projected 15.2 against 16.6\./);
  assert.match(h, /Include hidden gems is on, so the planner took him\./);
  assert.doesNotMatch(h, /title=| · /);
});
