// Tests for scoreRounds() in index.html: how each version of the projection did against what really happened.
// Run: node --test tools/test_scorecard.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;",
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"),
  line("const MT="), cut("// scorecard:begin", "// scorecard:end")].join("\n");
const { scoreRounds, project } = new Function(src + "\nreturn {scoreRounds,project};")();

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);
const log = (...f) => f.map((fpt, i) => ({ d: `2026-10-0${i + 1}`, fpt, min: 25, opp: "X", ha: "H", res: "" }));
const next = (opp, ha) => [{ d: "2026-10-21", el: true, oc: opp, opp, ha }, { d: "2026-10-28", el: true, oc: opp, opp, ha: ha === "H" ? "A" : "H" }];

// Round 7: PAO vs KBA. No results in the logs, so the win adjustment is 0 and the numbers can be worked by hand.
// star: own = .6×21 + .4×22 = 21.4, projection = (20 + 21.4)/2 = 20.7, KBA lets guards score +20%
// bench: own = .6×6 + .4×5 = 5.6, projection = (6 + 5.6)/2 = 5.8, PAO lets forwards score +10%
// out: did not play, so he is not scored
// noXpts: no FantaSheet xPTS, so every version uses his form, 8
const round7 = () => ({
  round: 7, fixtures: [["2026-10-21", "PAO", "KBA"]],
  defence: { KBA: { vs_g: 20, vs_f: 0, vs_c: -10 }, PAO: { vs_g: 0, vs_f: 10, vs_c: 0 } },
  teamNext: { PAO: next("KBA", "H"), KBA: next("PAO", "A") },
  players: [
    { id: 1, name: "Star", team: "PAO", pos: "G", price: 16, xpts: 20, fpt: 22, log: log(24, 18, 21) },
    { id: 2, name: "Bench", team: "KBA", pos: "F", price: 5, xpts: 6, fpt: 5, log: log(4, 6, 8) },
    { id: 3, name: "Out", team: "PAO", pos: "C", price: 10, xpts: 9, fpt: 10, status: "Out", log: log(10, 10, 10) },
    { id: 4, name: "NoXpts", team: "KBA", pos: "C", price: 9, xpts: 0, fpt: 8, log: log(8) },
  ],
  coaches: [{ team: "PAO", price: 10 }, { team: "KBA", price: 5 }],
  actual: { players: { 1: { fpt: 30, min: 30 }, 2: { fpt: 2, min: 10 }, 3: null, 4: { fpt: 10, min: 20 } }, coaches: { PAO: 10, KBA: -5 } },
});
const row = (S, key) => S.rows.find(r => r.key === key);

test("before any finished round there is nothing to score", () => {
  assert.equal(scoreRounds([]).last, null);
  const pending = round7(); delete pending.actual;
  assert.equal(scoreRounds([pending]).last, null);
});

test("today's projection: average miss and bias over the players who played", () => {
  const S = scoreRounds([round7()]);
  assert.equal(S.last, 7);
  const t = row(S, "today").last.all;
  // 20.7 vs 30, 5.8 vs 2, 8 vs 10
  assert.equal(t.n, 3);
  near(t.mae, (9.3 + 3.8 + 2) / 3);
  near(t.bias, (-9.3 + 3.8 - 2) / 3);
});

test("xPTS alone, form alone and the matchup bonus at each trust", () => {
  const S = scoreRounds([round7()]);
  near(row(S, "xpts").last.all.bias, ((20 - 30) + (6 - 2) + (8 - 10)) / 3);
  near(row(S, "form").last.all.bias, ((21.4 - 30) + (5.6 - 2) + (8 - 10)) / 3);
  // trust 0.5: star 20.7 + 2.1, bench 5.8 + 0.3; the centre plays PAO, who let centres score 0% more
  near(row(S, "m50").last.all.bias, ((22.8 - 30) + (6.1 - 2) + (8 - 10)) / 3);
  near(row(S, "m25").last.all.bias, ((21.7 - 30) + (5.9 - 2) + (8 - 10)) / 3);
  near(row(S, "m75").last.all.bias, ((23.8 - 30) + (6.2 - 2) + (8 - 10)) / 3);
});

test("split by price band: under 8, 8–14, 14+", () => {
  const t = row(scoreRounds([round7()]), "today").last;
  assert.equal(t.lo.n, 1); near(t.lo.bias, 3.8);
  assert.equal(t.mid.n, 1); near(t.mid.bias, -2);
  assert.equal(t.hi.n, 1); near(t.hi.bias, -9.3);
});

test("an Out player who still played counts as a 0 projection", () => {
  const r = round7(); r.actual.players[3] = { fpt: 6, min: 12 };
  const t = row(scoreRounds([r]), "today").last.mid;
  assert.equal(t.n, 2);
  near(t.bias, (-2 - 6) / 2);
});

test("coaches: projected points against what they scored", () => {
  const r = round7(), S = scoreRounds([r]);
  const x = Object.fromEntries(project(r).coaches.map(c => [c.team, c.x]));
  assert.equal(S.coaches.last.n, 2);
  near(S.coaches.last.bias, ((x.PAO - 10) + (x.KBA + 5)) / 2);
});

test("the look-ahead: round 7's next-round projection against round 8's actual", () => {
  const r8 = round7(); r8.round = 8; r8.actual.players = { 1: { fpt: 25, min: 30 }, 2: null, 4: null };
  const S = scoreRounds([round7(), r8]);
  assert.equal(S.last, 8);
  const la = row(S, "look").last.all;
  // star: 20.7 with next round's +20% matchup at trust 0.5 = 22.8, against 25
  assert.equal(la.n, 1);
  near(la.bias, 22.8 - 25);
  assert.equal(row(scoreRounds([round7()]), "look").last.all.n, 0);
});

test("the season adds up every finished round; last round is the latest one", () => {
  const r8 = round7(); r8.round = 8; r8.actual.players = { 1: { fpt: 20.7, min: 30 }, 2: null, 4: null };
  const S = scoreRounds([r8, round7()]);
  const t = row(S, "today");
  assert.equal(t.last.all.n, 1); near(t.last.all.mae, 0);
  assert.equal(t.season.all.n, 4);
  near(t.season.all.mae, (9.3 + 3.8 + 2 + 0) / 4);
});

test("the best version is the one with the smallest season miss, look-ahead aside", () => {
  const S = scoreRounds([round7()]);
  const maes = S.rows.filter(r => r.key !== "look").map(r => r.season.all.mae);
  near(S.best.season.all.mae, Math.min(...maes));
  assert.notEqual(S.best.key, "look");
});
