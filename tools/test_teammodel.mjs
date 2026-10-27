// Tests for teamModel() in index.html. Run: node --test tools/test_teammodel.mjs
// The page is one file, so the test cuts the function out between its marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// teamModel:begin"), html.indexOf("// teamModel:end"));
const teamModel = new Function(src + "\nreturn teamModel;")();

// A fixed season, not the live data.json (which changes every round): each club's final scores from its own side.
// PAO 5-1, +15.0 a game; KBA 1-5, -10.0 a game; HTA and VIR one point a game either side of even.
const games = {
  PAO: ["W 90-70", "W 85-65", "W 100-80", "W 77-57", "W 95-75", "L 70-80"],
  KBA: ["W 80-75", "L 70-83", "L 60-73", "L 77-90", "L 67-80", "L 75-88"],
  HTA: ["W 82-80", "L 79-80"],
  VIR: ["W 80-79", "L 80-82"],
};
const day = i => `2026-10-${String(1 + 3 * i).padStart(2, "0")}`;
const log = res => res.map((r, i) => ({ d: day(i), res: r }));
const D = { players: [
  ...Object.entries(games).map(([team, res]) => ({ team, log: log(res) })),
  { team: "PAO", log: log(games.PAO) },                       // a teammate's log holds the same games: counted once
  { team: "KBA", log: [{ d: "2026-09-28", res: "" }, { d: "2026-09-29" }] }, // no final score (DNP, not played): skipped
] };

test("records come from the player logs, one game per club and date", () => {
  const M = teamModel(D);
  assert.deepEqual(M.rec("PAO"), { w: 5, n: 6 });
  assert.deepEqual(M.rec("KBA"), { w: 1, n: 6 });
  assert.equal(M.rec("XXX"), undefined);
});

test("no opponent means a coin flip", () => {
  assert.equal(teamModel(D).winP("PAO", undefined), 0.5);
});

// Coach scoring: win by 1-10 +10, 11-20 +20, 21+ +25; lose by 1-10 -5, 11-20 -10, 21+ -20.
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test("average margins are shrunk halfway after six games, plus 3 for home court", () => {
  const M = teamModel(D);
  // PAO +15.0 a game, KBA -10.0: (7.5) - (-5) + 3
  near(M.margin("PAO", { opp: "KBA", ha: "H" }), 15.5);
  near(M.margin("KBA", { opp: "PAO", ha: "A" }), -15.5);
  near(M.margin("PAO", undefined), 0);
});

test("win chance is the chance the margin is above 0 (spread 12)", () => {
  const M = teamModel(D);
  near(M.winP("PAO", { opp: "KBA", ha: "H" }), 0.9017, 1e-3);
  near(M.winP("KBA", { opp: "PAO", ha: "A" }), 0.0983, 1e-3);
  assert.equal(M.winP("PAO", undefined), 0.5);
});

test("a coin flip projects 3.3 coach points", () => {
  assert.equal(teamModel(D).coachPts("PAO", undefined), 3.3);
});

test("a big favourite projects clearly above a narrow one", () => {
  const M = teamModel(D);
  const big = M.coachPts("PAO", { opp: "KBA", ha: "H" });
  const narrow = M.coachPts("HTA", { opp: "VIR", ha: "H" });
  assert.ok(big >= 15, `big favourite ${big}`);
  assert.ok(big - narrow >= 8, `${big} vs ${narrow}`);
  assert.ok(M.coachPts("KBA", { opp: "PAO", ha: "A" }) < -8);
});

// Player win bonus: FPT = PIR + 10% of |PIR| on a win. His average already holds his club's win rate so far,
// so the projection moves by 0.1 × |projection| × (this game's win chance − win rate so far).
test("win adjustment: a star on a big underdog loses a little, on a big favourite gains a little", () => {
  const M = teamModel(D);
  // KBA 1-5, win chance @ PAO 0.098: 0.1 × 20 × (0.098 − 0.167)
  near(M.winAdj("KBA", { opp: "PAO", ha: "A" }, 20), -0.137, 2e-3);
  // PAO 5-1, win chance vs KBA 0.902: 0.1 × 20 × (0.902 − 0.833)
  near(M.winAdj("PAO", { opp: "KBA", ha: "H" }, 20), 0.137, 2e-3);
});

test("win adjustment is a share of the projection: about 0 for a bench player, 0 when Out", () => {
  const M = teamModel(D);
  assert.ok(Math.abs(M.winAdj("KBA", { opp: "PAO", ha: "A" }, 2)) < 0.02);
  assert.equal(M.winAdj("KBA", { opp: "PAO", ha: "A" }, 0), 0);
});

test("win adjustment is 0 with no game or no record", () => {
  const M = teamModel(D);
  assert.equal(M.winAdj("PAO", undefined, 20), 0);
  assert.equal(M.winAdj("XXX", { opp: "PAO", ha: "H" }, 20), 0);
});
