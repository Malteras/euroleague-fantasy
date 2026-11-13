// Tests for the Teams tab's next EuroLeague rounds in index.html. Run: node --test tools/test_elfixtures.mjs
// The page is one file, so the test cuts the function out between its marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// elFixtures:begin"), html.indexOf("// elFixtures:end"));
const { elFixtures } = new Function(src + "\nreturn {elFixtures};")();

// shaped like data.json's elNext on 13 Nov (Round 11 in progress)
const elNext = {
  EFS: [{ r: 11, d: "2026-11-13", t: "18:30", oc: "VIR", ha: "H" }, { r: 12, d: "2026-11-17", t: "17:00", oc: "DUB", ha: "A" }, { r: 13, d: "2026-11-20", t: "18:30", oc: "ASV", ha: "H" }, { r: 14, d: "2026-11-25", t: "20:30", oc: "KBA", ha: "A" }],
  DUB: [{ r: 12, d: "2026-11-17", t: "17:00", oc: "EFS", ha: "H" }, { r: 13, d: "2026-11-19", t: "19:00", oc: "MTA", ha: "A" }],
  BJK: [{ r: 12, d: "2026-11-18", t: "18:45", oc: "RMB", ha: "H" }],
  ASV: [{ r: 12, d: "2026-11-17", t: "20:30", oc: "FBT", ha: "A" }],
};

test("the two rounds after this one, each game once with the home club first", () => {
  const R = elFixtures(elNext, 11, 2);
  assert.deepEqual(R.map((x) => x.r), [12, 13]);
  assert.deepEqual(R[0].games.map((g) => `${g.home}-${g.away}`), ["DUB-EFS", "FBT-ASV", "BJK-RMB"]);
  assert.deepEqual(R[1].games.map((g) => `${g.home}-${g.away}`), ["MTA-DUB", "EFS-ASV"]);
});

test("games sort by day, then tip-off", () => {
  const g = elFixtures(elNext, 11, 1)[0].games;
  assert.deepEqual(g.map((x) => [x.d, x.t]), [["2026-11-17", "17:00"], ["2026-11-17", "20:30"], ["2026-11-18", "18:45"]]);
});

test("this round's games and played rounds are left out; no data gives no rounds", () => {
  assert.ok(elFixtures(elNext, 11, 5).every((x) => x.r > 11));
  assert.deepEqual(elFixtures(undefined, 11), []);
  assert.deepEqual(elFixtures({}, 11), []);
});
