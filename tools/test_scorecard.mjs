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
const { scoreRounds, project, scSummary, scAt } = new Function(src + "\nreturn {scoreRounds,project,scSummary,scAt};")();

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

test("the look-ahead from a history snapshot: teamNext without el or oc, opponents by name (#123)", () => {
  // history/round-7.json keeps only EuroLeague games and drops el; it has no oc either, so the name comes from the fixtures
  const snap = (opp, name, ha) => [{ d: "2026-10-21", opp: name, ha }, { d: "2026-10-28", opp: name, ha: ha === "H" ? "A" : "H" }];
  const r7 = round7(); r7.teamNext = { PAO: snap("KBA", "Kauno Basket", "H"), KBA: snap("PAO", "Panathinaikos", "A") };
  const r8 = round7(); r8.round = 8; r8.actual.players = { 1: { fpt: 25, min: 30 }, 2: null, 4: null };
  const la = row(scoreRounds([r7, r8]), "look").last.all;
  assert.equal(la.n, 1);
  near(la.bias, 22.8 - 25);
});

test("a live domestic game (el: false) is never the look-ahead game", () => {
  const r7 = round7();
  r7.teamNext.PAO.splice(1, 0, { d: "2026-10-25", el: false, oc: "KBA", opp: "KBA", ha: "A" });
  r7.teamNext.PAO[2].oc = r7.teamNext.PAO[2].opp = "PAO";
  const { players } = project(r7);
  assert.equal(players.find(p => p.id === 1).opp2.opp, "PAO");
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

// scSummary(): the plain line under the heading (#107), on made-up numbers. maes: version → average miss per round,
// one number for every round (the last one is "last"); bias: band → today's bias over the season; n: players per band.
const made = (maes, bias = {}, n = 50) => {
  const st = (mae, b) => ({ all: { n, mae, bias: 0 }, lo: { n, mae, bias: b.lo ?? 0 }, mid: { n, mae, bias: b.mid ?? 0 }, hi: { n, mae, bias: b.hi ?? 0 } });
  const rounds = Object.values(maes)[0].map((_, i) => 7 + i), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const rows = Object.entries(maes).map(([key, a]) => ({
    key, label: key, last: st(a[a.length - 1], {}), season: st(avg(a), key === "today" ? bias : {}),
    byRound: Object.fromEntries(a.map((m, i) => [rounds[i], st(m, {})])),
  }));
  rows.push({ key: "look", label: "look", last: st(1, {}), season: st(1, {}), byRound: {} }); // left out: it would win
  return { rounds, last: rounds[rounds.length - 1], rows };
};

test("summary: versions within 0.5 points are too close to act on", () => {
  const S = made({ xpts: [6.2], today: [6.35], m50: [6.5] });
  assert.deepEqual(scSummary(S, "season", "all"), ["All versions are within 0.3 points of each other. Too early to change how the site projects."]);
});

test("summary: a clear winner needs 3 rounds and most of them", () => {
  // xpts best in rounds 7, 8, 9 and 11 (4 of 5), by about 1 point over the season
  const S = made({ xpts: [5, 5, 5, 7, 5], today: [6, 6, 6, 6, 6], m50: [6.2, 6.2, 6.2, 6.2, 6.2] });
  assert.deepEqual(scSummary(S, "season", "all"), ["xpts has missed least in 4 of 5 rounds, by about 0.6 points a player."]);
  // only two rounds: no winner yet
  const T = made({ xpts: [5, 5], today: [6, 6] });
  assert.deepEqual(scSummary(T, "season", "all"), ["xpts missed least, 1.0 point a player less than the next version. Only 2 rounds so far: too early to change how the site projects."]);
  // best overall but not in most rounds
  const U = made({ xpts: [1.5, 7, 7], today: [6, 5, 6.5], m50: [6, 6, 5] });
  assert.deepEqual(scSummary(U, "season", "all"), ["xpts missed least overall, but no version missed least in most rounds. Too early to change how the site projects."]);
  // the round view never calls a winner
  assert.deepEqual(scSummary(S, "last", "all"), ["xpts missed least in round 11, 1.0 point a player less than the next version. One round is too few to change how the site projects."]);
});

test("summary: a price band leans when today's projection is 1.5 points off over 30 players", () => {
  const S = made({ xpts: [6.2], today: [6.35] }, { lo: -2.1, mid: 1.4, hi: 3 });
  assert.deepEqual(scSummary(S, "season", "all"), ["All versions are within 0.1 points of each other. Too early to change how the site projects.",
    "Players under 8 cr are projected 2.1 points too low by today's projection.", "Players of 14 cr or more are projected 3.0 points too high by today's projection."]);
  // one band picked: only that band
  assert.deepEqual(scSummary(S, "season", "hi").slice(1), ["Players of 14 cr or more are projected 3.0 points too high by today's projection."]);
  // too few players: no lean
  assert.equal(scSummary(made({ xpts: [6.2], today: [6.35] }, { lo: -2.1 }, 29), "season", "all").length, 1);
});

test("summary for round 7's real numbers", () => {
  const H = [7].map(n => JSON.parse(readFileSync(new URL(`../history/round-${n}.json`, import.meta.url), "utf8")));
  const say = scSummary(scoreRounds(H), "season", "all");
  assert.match(say[0], /^All versions are within 0\.\d points of each other\./);
  for (const t of say) assert.doesNotMatch(t, / · /);
});

// Pace (#28): PAO plays 70 possessions a game, KBA 80, league average 75. A player's projection moves by
// x × (opponent's pace − average) ÷ (his club's pace + average), on top of the matchup at the live trust (0.5).
// star (PAO vs fast KBA): 22.8 + 22.8 × 5/145 = 23.6; bench (KBA vs slow PAO): 6.1 − 6.1 × 5/155 = 5.9; noXpts: 8 − 0.3 = 7.7
test("+ matchup + pace: the matchup at trust 0.5 plus the opponent's pace against the average", () => {
  const S = scoreRounds([round7()], { 7: { PAO: 70, KBA: 80 } });
  near(row(S, "m50").last.all.mae, (7.2 + 4.1 + 2) / 3);
  near(row(S, "pace").last.all.mae, (6.4 + 3.9 + 2.3) / 3);
  near(row(S, "pace").last.all.bias, (-6.4 + 3.9 - 2.3) / 3);
  assert.equal(row(S, "pace").label, "+ matchup + pace");
});

test("pace: the round's own snapshot comes before the pace worked out later", () => {
  const s = round7();
  s.defence.PAO.pace = 70; s.defence.KBA.pace = 80;
  near(row(scoreRounds([s], { 7: { PAO: 80, KBA: 70 } }), "pace").last.all.mae, (6.4 + 3.9 + 2.3) / 3);
});

test("pace: with no pace for the round the row is the matchup at trust 0.5", () => {
  const S = scoreRounds([round7()]);
  near(row(S, "pace").last.all.mae, row(S, "m50").last.all.mae);
});

// The round picker (Round 7 | Round 8 | All rounds): any finished round can be shown, not only the last one.
test("one round's view: every version, the coaches and the plain line show that round", () => {
  const r8 = round7(); r8.round = 8; r8.actual.players = { 1: { fpt: 20.7, min: 30 }, 2: null, 4: null };
  const S = scoreRounds([r8, round7()]);
  const v7 = scAt(S, 7);
  assert.equal(v7.last, 7);
  assert.equal(row(v7, "today").last.all.n, 3);
  near(row(v7, "today").last.all.mae, (9.3 + 3.8 + 2) / 3);
  assert.equal(v7.coaches.last.n, 2);
  assert.match(scSummary(v7, "last", "all").join(" "), /round 7|within/);
  // the season and the latest round are left as they were
  assert.equal(row(v7, "today").season.all.n, 4);
  assert.equal(row(scAt(S, 8), "today").last.all.n, 1);
  assert.equal(row(S, "today").last.all.n, 1);
});

test("one round's view: a version with no players that round shows none", () => {
  const S = scoreRounds([round7()]);
  assert.equal(row(scAt(S, 7), "look").last.all.n, 0);
});
