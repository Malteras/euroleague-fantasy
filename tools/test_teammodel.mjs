// Tests for teamModel() in index.html. Run: node --test tools/test_teammodel.mjs
// The page is one file, so the test cuts the function out between its marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// teamModel:begin"), html.indexOf("// teamModel:end"));
const teamModel = new Function(src + "\nreturn teamModel;")();
const D = JSON.parse(readFileSync(new URL("../data.json", import.meta.url), "utf8"));

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
