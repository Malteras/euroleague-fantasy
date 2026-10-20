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

test("win chance and coach points, Round 7", () => {
  const M = teamModel(D);
  const pao = { opp: "KBA", ha: "H" };
  assert.ok(Math.abs(M.winP("PAO", pao) - 0.8033) < 1e-3);
  assert.equal(M.coachPts("PAO", pao), 8.9);
  const pbb = { opp: "VAL", ha: "H" };
  assert.ok(Math.abs(M.winP("PBB", pbb) - 0.395) < 1e-3);
  assert.equal(M.coachPts("PBB", pbb), 0.3);
});
