// Tests for the Bottom line checklist in index.html: the to-do items built from the live proposal.
// Run: node --test tools/test_bottomline.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// bottomLine:begin"), html.indexOf("// bottomLine:end"));
const { blItems, blGainers, blTicks, blMatchups } = new Function(src + "\nreturn {blItems,blGainers,blTicks,blMatchups};")();

const pl = (id, short, x, price, day = "2026-10-21") => ({ id, short, x, price, day });
const Bryant = pl(73, "Bryant", 23.4, 17.4), Maledon = pl(23, "Maledon", 19.8, 15, "2026-10-22"), Madar = pl(91, "Madar", 18.1, 14, "2026-10-22");
const Feliz = pl(8, "Feliz", 9.3, 6.2), Etienne = pl(245, "Etienne", 13.5, 6.8);
const base = {
  round: 7, deadline: "Wed 18:00", trades: [], near: null, bar: 3, why: "every player in your squad is at or above break-even",
  cap: [{ p: Bryant, keepAt: 21.6 }, { p: Maledon, keepAt: 18.4 }, { p: Madar, keepAt: null }],
  lineup: { st: [Bryant, Maledon, Madar, pl(165, "Ndiaye", 12.6, 9), pl(118, "Diarra", 14.2, 10)], six: Feliz, form: [3, 1, 1] },
  checks: [], dayName: d => ({ "2026-10-21": "Wed", "2026-10-22": "Thu" })[d],
};
const text = it => it.detail.map(([, t]) => t).join("");

test("a trade: who goes out and in, the points it adds and what it does to the bank", () => {
  const items = blItems({ ...base, trades: [{ out: Feliz, in: Etienne }] });
  const t = items[0];
  assert.equal(t.kind, "trade");
  assert.equal(t.title, "Trade Feliz → Etienne");
  assert.equal(text(t), "+4.2 pts this round, −0.6 cr bank");
  assert.deepEqual(t.detail.filter(([c]) => c).map(([c]) => c), ["pts", "cr"]);
  assert.equal(t.id, "7:trade:8>245");
});

test("no trades: names the best trade that just missed the bar", () => {
  const t = blItems({ ...base, near: { g: 1.43 } })[0];
  assert.equal(t.kind, "none");
  assert.equal(t.title, "No trades");
  assert.equal(text(t), "Best trade adds +1.4 pts, under the 3-point bar");
  assert.equal(t.id, "7:none");
});

test("no trades and no near miss: the proposal's reason", () => {
  const t = blItems(base)[0];
  assert.equal(text(t), "every player in your squad is at or above break-even");
  assert.deepEqual(t.detail.map(([c]) => c), [""]);
});

test("captain: his projection and day, then the fallbacks if he scores under the keep-at score", () => {
  const t = blItems(base).find(i => i.kind === "captain");
  assert.equal(t.title, "Captain Bryant");
  assert.equal(text(t), "23.4 projected, best on Wed\nUnder 22+ → Maledon 19.8 → Madar 18.1");
  assert.equal(t.id, "7:captain:73");
});

test("captain with no later turn: no fallbacks", () => {
  const t = blItems({ ...base, cap: [{ p: Bryant, keepAt: null }] }).find(i => i.kind === "captain");
  assert.equal(text(t), "23.4 projected, best on Wed");
});

test("a new captain is a new item, so an old tick does not carry over", () => {
  const a = blItems(base).find(i => i.kind === "captain").id;
  const b = blItems({ ...base, cap: [{ p: Maledon, keepAt: null }] }).find(i => i.kind === "captain").id;
  assert.notEqual(a, b);
});

test("lineup: the five starters, their projected total, formation and 6th man", () => {
  const t = blItems(base).find(i => i.kind === "lineup");
  assert.equal(t.title, "Start Bryant, Maledon, Madar, Ndiaye, Diarra");
  assert.equal(text(t), "88.1 pts projected from the five\n3-1-1, 6th man Feliz");
  assert.equal(t.id, "7:lineup:73,23,91,165,118");
});

test("check: the player, the points at risk, why, and who to swap in", () => {
  const items = blItems({ ...base, checks: [{ p: Madar, why: [["", "missed Maccabi's Sunday game"]], swap: pl(38, "Ojeleye", 8, 5) }] });
  const t = items.find(i => i.kind === "check");
  assert.equal(t.title, "Check Madar before Wed 18:00");
  assert.equal(text(t), "18.1 pts at risk: missed Maccabi's Sunday game\nIf he is out, start Ojeleye");
  assert.equal(t.id, "7:check:91");
  assert.deepEqual(items.map(i => i.kind), ["none", "captain", "lineup", "check"]);
});

test("check with nobody to swap in", () => {
  const t = blItems({ ...base, checks: [{ p: Madar, why: [["st", "Doubtful"]], swap: null }] }).find(i => i.kind === "check");
  assert.equal(text(t), "18.1 pts at risk: Doubtful");
});

test("a check's status is its own part, so the card can show Day to day as DTD with its tooltip (#59)", () => {
  const t = blItems({ ...base, checks: [{ p: Madar, why: [["st", "Day to day"], ["", " (hamstring)"]], swap: null }] }).find(i => i.kind === "check");
  assert.deepEqual(t.detail, [["pts", "18.1 pts"], ["", " at risk: "], ["st", "Day to day"], ["", " (hamstring)"]]);
});

test("credit gainers from the routine's line: name, club, price and why", () => {
  const g = blGainers(["Lineup: start Bryant.", "Credit gainers to watch: Edwin Jackson (ASV, 4.5) 26 min and 14 FPT in his first EuroLeague game; Kamar Baldwin (BAY, 7.1) avg 10.2."]);
  assert.deepEqual(g, { rows: [
    { name: "Edwin Jackson", team: "ASV", price: 4.5, why: "26 min and 14 FPT in his first EuroLeague game" },
    { name: "Kamar Baldwin", team: "BAY", price: 7.1, why: "avg 10.2" }], text: null });
});

test("credit gainers that can't be split are kept as one sentence; none at all is null", () => {
  assert.deepEqual(blGainers(["Credit gainers to watch: nobody stands out this week."]), { rows: [], text: "nobody stands out this week." });
  assert.equal(blGainers(["Lineup: start Bryant."]), null);
  assert.equal(blGainers(undefined), null);
});

test("only this round's ticks count", () => {
  assert.deepEqual([...blTicks(["6:captain:73", "7:captain:73", "7:none"], 7)], ["7:captain:73", "7:none"]);
  assert.equal(blTicks(undefined, 7).size, 0);
});

test("a trade made for next round (Proposal 2) also says what it adds then", () => {
  const out = { ...Feliz, nx: 3.0 }, inn = { ...Etienne, x: 7.0, nx: 9.1 };
  const t = blItems({ ...base, trades: [{ out, in: inn }] })[0];
  assert.equal(text(t), "−2.3 pts this round, +6.1 next round, −0.6 cr bank");
});

// No trades between turns: a check that decides a trade is due before trades close, not on the player's game day.
const Hifi = pl(500, "Hifi", 0, 16, "2026-10-23"), EtienneFri = pl(245, "Etienne", 18.6, 6.8, "2026-10-23");
const deadline = { ...base, deadline: "Wed 18:00" };

test("a trade that depends on a teammate: one check on him before trades close, with both calls", () => {
  const items = blItems({ ...deadline, trades: [{ out: Madar, in: EtienneFri, ifOut: Hifi }] });
  assert.deepEqual(items.map(i => i.kind), ["check", "trade", "captain", "lineup"]);
  const [c, t] = items;
  assert.equal(c.title, "Check Hifi before Wed 18:00");
  assert.equal(text(c), "100% out → trade Madar → Etienne\nUncertain or plays → keep Madar");
  assert.equal(c.id, "7:ifout:500:245");
  assert.equal(t.title, "Trade Madar → Etienne");
  assert.equal(text(t), "Only if Hifi is 100% out\n+0.5 pts this round, +7.2 cr bank");
});

test("every check is due before trades close, even for a player you keep", () => {
  const t = blItems({ ...deadline, checks: [{ p: Madar, why: "Doubtful", swap: null }] }).find(i => i.kind === "check");
  assert.equal(t.title, "Check Madar before Wed 18:00");
});

test("no to-do separates its pieces with dots: one piece of information per line", () => {
  const all = [
    ...blItems({ ...deadline, trades: [{ out: Madar, in: EtienneFri, ifOut: Hifi }], checks: [{ p: Maledon, why: "Doubtful", swap: Feliz }] }),
    ...blItems({ ...base, near: { g: 1.4 } }),
  ];
  for (const it of all) assert.ok(!text(it).includes("·") && !it.title.includes("·"), `${it.title}: ${text(it)}`);
});

// The matchups card (#106)
const mp = (id, short, m, extra = {}) => ({ id, short, m, opp: { opp: "BES", ha: "A" }, ...extra });
const mOf = p => p.m;

test("matchups: ±15% and more, best first; out, no game and played are left out", () => {
  const sq = [mp(1, "A", 10), mp(2, "B", -20), mp(3, "C", 15), mp(4, "D", 30, { out: true }), mp(5, "E", 25, { opp: null }), mp(6, "F", 40), mp(7, "G", null), undefined];
  const rows = blMatchups(sq, p => p.id === 6, mOf);
  assert.deepEqual(rows.map(r => [r.p.short, r.m]), [["C", 15], ["B", -20]]);
});
