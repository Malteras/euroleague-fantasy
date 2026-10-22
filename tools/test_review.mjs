// Tests for turnReview() in index.html: the squad's scores after each turn of a round, against the projections.
// Run: node --test tools/test_review.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;",
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"),
  cut("// capPath:begin", "// capPath:end"), cut("// review:begin", "// review:end")].join("\n");
const { turnReview, actualLogs } = new Function(src + "\nreturn {turnReview,actualLogs};")();

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);
// no results in the logs and no xPTS, so each projection is his form: .6 × (average of the last 3) + .4 × fpt
const log = f => [1, 2, 3].map(i => ({ d: `2026-10-0${i}`, fpt: f, min: 25, opp: "X", ha: "H", res: "" }));
const pl = (id, team, pos, f, extra = {}) => ({ id, name: `P${id} Name${id}`, team, pos, price: 10, xpts: 0, fpt: f, log: log(f), ...extra });
const W = "2026-10-21", T = "2026-10-22";
// Round 7, two turns: PAO and KBA on Wednesday, OLY and ZAL on Thursday.
// Slots: 1-5 court, 6 sixth man, 7-10 bench. Captain 1 (Wed, projection 20); the plan's Thursday captain is 6 (projection 18).
const snap = () => ({
  round: 7, deadline: W, fixtures: [[W, "PAO", "KBA"], [T, "OLY", "ZAL"]],
  defence: {}, teamNext: {}, coaches: [],
  players: [pl(1, "PAO", "G", 20), pl(2, "KBA", "G", 10), pl(3, "OLY", "F", 8), pl(4, "ZAL", "F", 6), pl(5, "PAO", "C", 12),
    pl(6, "OLY", "G", 18), pl(7, "KBA", "F", 4), pl(8, "ZAL", "C", 5), pl(9, "OLY", "G", 3), pl(10, "PAO", "F", 7, { status: "Out" })],
  squad: { slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 1, updated: "2026-10-20" },
});
// the live player logs: who has played this round so far
const live = games => Object.fromEntries(Object.entries(games).map(([id, g]) => [id, g ? [{ d: g[0], fpt: g[1], min: 20 }] : []]));
const wed = { 1: [W, 25], 2: [W, 6], 5: [W, 14], 7: [W, 8], 10: [W, 0] };

test("before the first turn is played there is nothing to review", () => {
  assert.equal(turnReview(snap(), live({}), null), null);
});

test("after the first turn: that turn's players, counted with the game's multipliers", () => {
  const R = turnReview(snap(), live(wed), null);
  assert.equal(R.round, 7);
  assert.deepEqual(R.turns.map(t => t.d), [W]);
  const rows = Object.fromEntries(R.turns[0].rows.map(r => [r.id, r]));
  assert.deepEqual(Object.keys(rows).map(Number).sort((a, b) => a - b), [1, 2, 5, 7, 10]);
  assert.equal(rows[1].short, "Name1");
  // captain on court ×2, court ×1, bench ×0.5
  assert.equal(rows[1].mult, 2); assert.equal(rows[1].counted, 50); assert.equal(rows[1].px, 40);
  assert.equal(rows[2].mult, 1); assert.equal(rows[2].counted, 6);
  assert.equal(rows[7].mult, 0.5); assert.equal(rows[7].counted, 4); assert.equal(rows[7].px, 2);
  // an Out player is projected at 0
  assert.equal(rows[10].px, 0);
  near(R.got, 50 + 6 + 14 + 4 + 0);
  near(R.projSoFar, 40 + 10 + 12 + 2 + 0);
});

test("a player whose club played but who did not counts 0", () => {
  const R = turnReview(snap(), live({ ...wed, 2: null }), null);
  const r = R.turns[0].rows.find(r => r.id === 2);
  assert.equal(r.fpt, null); assert.equal(r.counted, 0);
});

test("later turns add to it; the round total keeps every turn's projection", () => {
  const R = turnReview(snap(), live({ ...wed, 3: [T, 10], 4: [T, 2], 6: [T, 20], 8: [T, 6], 9: [T, 1] }), null);
  assert.deepEqual(R.turns.map(t => t.d), [W, T]);
  near(R.got, 74 + 10 + 2 + 20 + 3 + 0.5);
  // the whole round projected: 20×2 + 10 + 8 + 6 + 12 + 18 + (4 + 5 + 3)×0.5 + 0
  near(R.projRound, 40 + 10 + 8 + 6 + 12 + 18 + 6);
  near(R.projSoFar, R.projRound);
});

test("the lineup he saved counts while it is from this round", () => {
  const saved = { slots: [1, 2, 3, 4, 7, 6, 5, 8, 9, 10], cap: 5, updated: "2026-10-21" };
  // 7 moved to court, 5 to the bench
  const R = turnReview(snap(), live(wed), { ...saved, cap: 1 });
  const rows = Object.fromEntries(R.turns[0].rows.map(r => [r.id, r]));
  assert.equal(R.from, "saved");
  assert.equal(rows[7].mult, 1); assert.equal(rows[5].mult, 0.5);
  // saved after the round's last turn: that is next round's team, so the deadline snapshot's lineup counts
  const later = turnReview(snap(), live(wed), { ...saved, updated: "2026-10-24" });
  assert.equal(later.from, "snapshot");
  assert.equal(later.turns[0].rows.find(r => r.id === 7).mult, 0.5);
});

test("captain call: the plan's keep threshold against what he scored, and what you did", () => {
  const R = turnReview(snap(), live(wed), null);
  assert.equal(R.cap.first.id, 1);
  assert.equal(R.cap.next.id, 6);
  // keep him if he beats what Thursday's captain is still worth: his projection, 18
  assert.equal(R.cap.keepAt, 18);
  assert.equal(R.cap.scored, 25);
  assert.equal(R.cap.call, "keep");
  assert.equal(R.cap.now.id, 1);
  // a quiet game: the plan says move it, and the saved squad shows it moved to the Thursday captain
  const quiet = turnReview(snap(), live({ ...wed, 1: [W, 9] }), { slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => i === 0 ? 6 : i === 5 ? 1 : v), cap: 6, updated: W });
  assert.equal(quiet.cap.call, "move");
  assert.equal(quiet.cap.now.id, 6);
});

test("a captain whose club played but who did not scores 0, so the plan says move it", () => {
  const R = turnReview(snap(), live({ ...wed, 1: null }), null);
  assert.equal(R.cap.scored, 0);
  assert.equal(R.cap.call, "move");
});

test("the armband moved to the Thursday captain: his own score counts double, not once", () => {
  // first captain 1 scores 9 (under the keep mark), the saved lineup has the armband on 6, who then scores 30
  const saved = { slots: [6, 2, 3, 4, 5, 1, 7, 8, 9, 10], cap: 6, updated: W };
  const R = turnReview(snap(), live({ ...wed, 1: [W, 9], 3: [T, 10], 4: [T, 2], 6: [T, 30], 8: [T, 6], 9: [T, 1] }), saved);
  const r6 = R.turns[1].rows.find(r => r.id === 6), r1 = R.turns[0].rows.find(r => r.id === 1);
  assert.equal(r6.cap, true); assert.equal(r6.moved, undefined); assert.equal(r6.counted, 60);
  assert.equal(r1.mult, 1); assert.equal(r1.counted, 9);
});

test("each row carries his matchup at the deadline: the snapshot's allowance of his opponent for his position (#58)", () => {
  // KBA allows guards +30 and PAO allows centres −17; PAO's guard 1 faces KBA, KBA's guard 2 faces PAO (no number: null)
  const s = { ...snap(), defence: { KBA: { vs_g: 30, vs_f: 2, vs_c: 5 }, PAO: { vs_g: null, vs_f: -4, vs_c: -17 } } };
  const R = turnReview(s, live({ 1: [W, 22], 2: [W, 14], 5: [W, 10], 7: [W, 3], 10: null }), null);
  const mu = Object.fromEntries(R.turns[0].rows.map(r => [r.id, r.mu]));
  assert.deepEqual(mu, { 1: 30, 2: null, 5: 5, 7: -4, 10: 2 });
});

test("a finished round reads its games from the round's own actuals, not the live logs (#58)", () => {
  // the history file after the round: 1 scored 22 (+0.5 cr), 2 did not play, 3 on Thursday scored 8; 6 has no entry
  const s = { ...snap(), actual: { players: { 1: { fpt: 22, min: 30, cr: 0.5 }, 2: null, 3: { fpt: 8, min: 20, cr: null } }, coaches: {} } };
  const L = actualLogs(s);
  assert.deepEqual(L, { 1: [{ d: W, fpt: 22, min: 30, cr: 0.5 }], 2: [], 3: [{ d: T, fpt: 8, min: 20 }] });
  assert.equal(actualLogs(snap()), null);
  // the review built from them: both turns played, 1's real score and credit change
  const R = turnReview(s, L, null);
  assert.deepEqual(R.turns.map(t => t.d), [W, T]);
  const r1 = R.turns[0].rows.find(r => r.id === 1);
  assert.equal(r1.fpt, 22); assert.equal(r1.val, 0.5);
});
