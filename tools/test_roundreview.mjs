// Tests for roundReview() in index.html: after a round, what he scored, what the deadline proposal would have scored and the
// best team in hindsight, all counted with the actual points.
// Run: node --test tools/test_roundreview.mjs
// The functions are cut out of the page by tools/roundreview.mjs, the CLI the daily routine runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { roundReview } from "./roundreview.mjs";

// Round 7, two turns: PAO, KBA, BAR and RMB on Wednesday, OLY and ZAL on Thursday. No results in the logs and no xPTS,
// so each projection is his form f.
const W = "2026-10-21", T = "2026-10-22";
const CLUBS = ["PAO", "KBA", "OLY", "ZAL", "BAR", "RMB"];
const log = f => [1, 2, 3].map(i => ({ d: `2026-10-0${i}`, fpt: f, min: 25, opp: "X", ha: "H", res: "" }));
const pl = (id, team, pos, f, price) => ({ id, name: `P${id} Name${id}`, team, pos, price, xpts: 0, fpt: f, log: log(f) });
function snap(actual, extra = []) {
  return {
    round: 7, deadline: W, fixtures: [[W, "PAO", "KBA"], [W, "BAR", "RMB"], [T, "OLY", "ZAL"]],
    defence: {}, teamNext: {}, tradeWindow: null,
    coaches: CLUBS.map(t => ({ name: `Coach ${t}`, team: t, price: 5, last: [0, 0] })),
    players: [
      // his squad. Slots: 1-5 court, 6 sixth man, 7-10 bench; captain 1
      pl(1, "PAO", "G", 10, 10), pl(2, "KBA", "G", 9, 9), pl(3, "OLY", "G", 8, 8), pl(4, "ZAL", "G", 4, 6),
      pl(5, "PAO", "F", 10, 10), pl(6, "KBA", "F", 9, 9), pl(7, "OLY", "F", 8, 8), pl(8, "ZAL", "F", 4, 6),
      pl(9, "BAR", "C", 10, 10), pl(10, "RMB", "C", 5, 6),
      // the market: a better guard at the same price, a star he can't afford, two cheap fringe players
      pl(11, "BAR", "G", 14, 6), pl(12, "RMB", "G", 30, 40), pl(13, "BAR", "F", 3, 5), pl(14, "RMB", "C", 3, 5), ...extra,
    ],
    squad: { players: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], coach: "PAO", slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 1, bank: 2 },
    actual,
  };
}
const BUDGET = 82 + 5 + 2;
const fpts = o => ({ players: Object.fromEntries(Object.entries(o).map(([id, f]) => [id, { fpt: f, min: f == null ? null : 20 }])) });
// 3 scores 20; 11, the guard the proposal brings in, only 5
const A = { ...fpts({ 1: 10, 2: 9, 3: 20, 4: 2, 5: 10, 6: 9, 7: 8, 8: 4, 9: 10, 10: 5, 11: 5, 12: 40, 13: 3, 14: 3 }),
  coaches: { PAO: 10, KBA: 25, OLY: 0, ZAL: 0, BAR: 0, RMB: 0 } };
const OPT = { mode: "q", lam: 20 };
const ids = t => t.map(x => [x.out.id ?? x.out.team, x.in.id ?? x.in.team]);
const cost = (s, R) => R.S.reduce((a, i) => a + s.players.find(p => p.id === i).price, 0) + 5;

test("no actual points yet: nothing to review", () => {
  assert.equal(roundReview(snap(undefined), null, OPT), null);
  assert.equal(roundReview(snap({}), null, OPT), null);
});

test("what he scored: the lineup at the deadline with the actual points, captain ×2, bench ½, plus the coach", () => {
  const R = roundReview(snap(A), null, OPT);
  assert.equal(R.round, 7);
  // court 1 (×2) 2 3 4 5 = 20+9+20+2+10, 6th man 9, bench (8+4+10+5)/2, coach 10
  assert.equal(R.you.pts, 61 + 9 + 13.5 + 10);
  assert.equal(R.you.coach, "PAO");
});

test("the squad he saved during the round counts instead", () => {
  const saved = { players: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], coach: "PAO", slots: [1, 2, 9, 4, 5, 6, 7, 8, 3, 10], cap: 9, updated: W };
  // 9 to court and captain, 3 to the bench: court 10+9+20+2+10, 6th man 9, bench (8+4+20+5)/2, coach 10
  assert.equal(roundReview(snap(A), saved, OPT).you.pts, 51 + 9 + 18.5 + 10);
});

test("the proposal at the deadline, counted with the actual points: the armband moves on when the first captain falls short", () => {
  const R = roundReview(snap(A), null, OPT);
  // the planner's trade at the deadline: the better guard for the weakest one
  assert.deepEqual(ids(R.plan.trades), [[4, 11]]);
  // lineup from the projections: court 11 1 5 6 9, 6th man 2, bench 3 7 8 10. The plan captains 11 (keep at 8+);
  // he scores 5, so the armband goes to 3, who scores 20 from the bench: 5+10+10+9+10, 9, (20×2)+(8+4+5)/2, coach 10
  assert.equal(R.plan.pts, 44 + 9 + 40 + 8.5 + 10);
});

test("the best team in hindsight: actual points as projections, within budget, trades listed with the gap", () => {
  const s = snap(A), R = roundReview(s, null, OPT);
  // 12 scored 40 but costs 40: out of reach. The guard 11 beats 4, and KBA's coach scored most.
  assert.deepEqual(ids(R.best.trades), [[4, 11], ["PAO", "KBA"]]);
  assert.ok(cost(s, R.best) <= BUDGET + 1e-9);
  // best lineup 3 1 5 6 9, 6th man 2, bench 11 7 8 10, captain the top scorer 3: 20+10+10+9+10, 9, 20, (5+8+4+5)/2, coach 25
  assert.equal(R.best.pts, 59 + 9 + 20 + 11 + 25);
  assert.equal(R.gap, R.best.pts - R.you.pts);
  // each trade's own actual points
  assert.deepEqual([R.best.trades[0].out.pts, R.best.trades[0].in.pts], [2, 5]);
});

// every squad player scores 0, and five cheap market players score 10
const zero = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 12: 0 };
const five = [pl(15, "OLY", "G", 1, 5), pl(16, "OLY", "F", 1, 5)];
const A5 = { ...fpts({ ...zero, 11: 10, 13: 10, 14: 10, 15: 10, 16: 10 }), coaches: {} };

test("the hindsight team keeps to the round's trade limit: 4, or unlimited in a free-trade window", () => {
  const s = snap(A5, five);
  assert.equal(roundReview(s, null, OPT).best.trades.length, 4);
  const free = { ...s, tradeWindow: { round: 7, unlimited: true } };
  assert.equal(roundReview(free, null, OPT).best.trades.length, 5);
});

test("the hindsight team keeps to 6 players from one club", () => {
  // seven cheap BAR players who all scored 15, in a free-trade window; 9 (BAR) is already his
  const bar = [[20, "G"], [21, "G"], [22, "G"], [23, "F"], [24, "F"], [25, "F"], [26, "C"]].map(([id, pos]) => pl(id, "BAR", pos, 1, 5));
  const s = { ...snap({ ...fpts({ ...zero, 20: 15, 21: 15, 22: 15, 23: 15, 24: 15, 25: 15, 26: 15 }), coaches: {} }, bar),
    tradeWindow: { round: 7, unlimited: true } };
  const R = roundReview(s, null, OPT);
  const club = R.best.S.filter(i => s.players.find(p => p.id === i).team === "BAR").length;
  assert.equal(club, 6);
  assert.ok(cost(s, R.best) <= BUDGET + 1e-9);
});

// The daily routine's report lines (#54): node tools/roundreview.mjs history/round-N.json squad.json [state.json]
import { reviewLines } from "./roundreview.mjs";

test("report lines: his score, the proposal's and the best in hindsight, then the hindsight trades", () => {
  assert.deepEqual(reviewLines(snap(A), null, null), [
    "Round 7 review: you scored 93.5. The proposal would have scored 111.5 (+18.0), the best team in hindsight 124.0 (+30.5).",
    "Hindsight trades: Name4 (ZAL) 2.0 → Name11 (BAR) 5.0, Coach PAO (PAO) 10.0 → Coach KBA (KBA) 25.0.",
  ]);
});

test("report lines: nothing until the round's actual points are in, players and coaches both", () => {
  assert.deepEqual(reviewLines(snap(undefined), null, null), []);
  assert.deepEqual(reviewLines(snap({ players: null, coaches: null }), null, null), []);
  assert.deepEqual(reviewLines(snap({ ...A, coaches: null }), null, null), []);
});

test("report lines: the proposal at his synced setting, What matters more snapped to its stops", () => {
  const s = snap(A), R = roundReview(s, null, { mode: "m", lam: 20 });
  assert.match(reviewLines(s, null, { pmode: "m", lam: 22 })[0], new RegExp(`proposal would have scored ${R.plan.pts.toFixed(1)} `));
});

test("report lines: when his team was the best in hindsight, or the best kept his squad", () => {
  const [head, tail] = reviewLines(snap(A5, five), null, null);
  assert.match(head, /^Round 7 review: you scored 0\.0\./);
  assert.match(tail, /^Hindsight trades: /);
  // nobody outside his squad scored: the same squad was the best, so no trade line
  const still = { ...fpts({ 1: 10, 2: 9, 3: 8, 4: 4, 5: 10, 6: 9, 7: 8, 8: 4, 9: 10, 10: 5 }), coaches: { PAO: 10 } };
  const L = reviewLines(snap(still), null, null);
  assert.equal(L.length, 2);
  assert.match(L[1], /^Best in hindsight: (your team as it was|the same squad with a better lineup and captain)\.$/);
});
