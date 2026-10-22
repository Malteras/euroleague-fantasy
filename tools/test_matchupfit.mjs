// Tests for matchupFit() in tools/roundreview.mjs: after a round, how strongly the matchup at the deadline goes with the
// result against the deadline projection (#58). Run: node --test tools/test_matchupfit.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitLine, matchupPairs, matchupLine } from "./roundreview.mjs";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test("Pearson r and the least-squares slope on a hand-made sample", () => {
  // y = 2x + 1 exactly: r = 1, slope 2
  const F = fitLine([[0, 1], [1, 3], [2, 5], [3, 7]]);
  near(F.r, 1); near(F.slope, 2); assert.equal(F.n, 4);
  // x 1..5, y 2,4,5,4,5: r = 0.7745966692, slope 0.6
  const G = fitLine([[1, 2], [2, 4], [3, 5], [4, 4], [5, 5]]);
  near(G.r, 0.7745966692, 1e-9); near(G.slope, 0.6);
});

test("fewer than three players, or no spread in the matchups: no fit", () => {
  assert.equal(fitLine([[1, 2], [2, 3]]), null);
  assert.equal(fitLine([[5, 1], [5, 2], [5, 3]]), null);
});

// Round 7: PAO hosts KBA. KBA lets guards score +30, PAO lets forwards score −20.
const W = "2026-10-21";
const log = f => [1, 2, 3].map(i => ({ d: `2026-10-0${i}`, fpt: f, min: 25, opp: "X", ha: "H", res: "" }));
const pl = (id, team, pos, f) => ({ id, name: `P${id} N${id}`, team, pos, price: 10, xpts: 0, fpt: f, log: log(f) });
const snap = (actual) => ({
  round: 7, deadline: W, fixtures: [[W, "PAO", "KBA"]], teamNext: {}, coaches: [], tradeWindow: null,
  defence: { KBA: { vs_g: 30, vs_f: 0, vs_c: 0 }, PAO: { vs_g: 0, vs_f: -20, vs_c: null } },
  players: [pl(1, "PAO", "G", 10), pl(2, "KBA", "F", 20), pl(3, "KBA", "C", 10), pl(4, "PAO", "F", 4), pl(5, "KBA", "G", 10)],
  actual: { players: actual, coaches: {} },
});

test("pairs: each player who played, projected 5 or more, with a matchup: [matchup, (points − projection) ÷ projection]", () => {
  // 1: guard vs KBA +30, proj 10, scored 13 → +0.3. 2: forward vs PAO −20, proj 20, scored 15 → −0.25.
  // 3: centre vs PAO, no matchup number: left out. 4: projected 4: left out. 5: did not play (null): left out.
  const pairs = matchupPairs(snap({ 1: { fpt: 13 }, 2: { fpt: 15 }, 3: { fpt: 30 }, 4: { fpt: 20 }, 5: { fpt: null } }));
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map(([m]) => m), [30, -20]);
  near(pairs[0][1], 0.3, 1e-6); near(pairs[1][1], -0.25, 1e-6);
});

test("before the round's actual points are in: no pairs", () => {
  assert.deepEqual(matchupPairs({ ...snap({}), actual: undefined }), []);
});

test("the report line: rounds, players, r and % per matchup point; a first look while there is one round", () => {
  const s = snap({ 1: { fpt: 13 }, 2: { fpt: 15 } });
  s.players.push(pl(6, "KBA", "G", 10)); s.actual.players[6] = { fpt: 12 };  // a guard vs PAO, matchup 0, 20% over his projection
  assert.equal(matchupLine([s]),
    "Matchup vs result, Round 7 (3 players who played, projected 5+): r = 0.89; each matchup point went with +1.0% against the projection. One round only: a first look.");
  const s8 = { ...s, round: 8 };
  assert.match(matchupLine([s, s8]), /^Matchup vs result, Rounds 7–8 \(6 players who played, projected 5\+\): r = 0\.89;.*projection\.$/);
  assert.equal(matchupLine([snap({})]), null);
});

test("a fit that rounds to zero prints 0.00 and 0.0%, never −0.00; a negative r prints with a minus", () => {
  // matchups 0, 30, −30 against results 0, −0.0001, +0.0001: a hair under zero
  const s = snap({ 1: { fpt: 10 }, 5: { fpt: 10 } });
  s.defence.PAO.vs_g = 0; s.defence.KBA.vs_g = 30;
  s.players.push(pl(7, "KBA", "F", 10)); s.actual.players[7] = { fpt: 10.001 };  // forward vs PAO, −20
  s.actual.players[1] = { fpt: 9.999 };
  const L = matchupLine([s]);
  assert.match(L, /r = −0\.9\d; each matchup point went with 0\.0% against/);
  assert.doesNotMatch(L, /-0\.0|−0\.0%/);
});
