// Tests for the Teams tab's EuroLeague rounds in index.html. Run: node --test tools/test_elfixtures.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// elFixtures:begin"), html.indexOf("// elFixtures:end"));
const { elFixtures, fxWindow } = new Function(src + "\nreturn {elFixtures, fxWindow};")();

// shaped like data.json's elSeason on 13 Nov (Round 11 in progress)
const season = [
  { r: 10, d: "2026-11-06", t: "20:30", h: "BAR", a: "PAO", s: "88–90" },
  { r: 11, d: "2026-11-12", t: "20:15", h: "OLY", a: "DUB", s: "101–72" },
  { r: 11, d: "2026-11-13", t: "18:30", h: "EFS", a: "VIR" },
  { r: 12, d: "2026-11-17", t: "20:30", h: "MIL", a: "CZV" },
  { r: 12, d: "2026-11-17", t: "17:00", h: "DUB", a: "EFS" },
  { r: 13, d: "2026-11-19", t: null, h: "MTA", a: "DUB" },
];
// shaped like data.json's elNext (older data without elSeason)
const elNext = {
  EFS: [{ r: 11, d: "2026-11-13", t: "18:30", oc: "VIR", ha: "H" }, { r: 12, d: "2026-11-17", t: "17:00", oc: "DUB", ha: "A" }],
  DUB: [{ r: 12, d: "2026-11-17", t: "17:00", oc: "EFS", ha: "H" }, { r: 13, d: "2026-11-19", t: "19:00", oc: "MTA", ha: "A" }],
};

test("every round of the season, played games with their score, games by day and tip-off", () => {
  const R = elFixtures(season, elNext, 11);
  assert.deepEqual(R.map((x) => x.r), [10, 11, 12, 13]);
  assert.equal(R[1].games[0].s, "101–72");
  assert.equal(R[1].games[1].s, null);
  assert.deepEqual(R[2].games.map((g) => `${g.home}-${g.away}`), ["DUB-EFS", "MIL-CZV"]);
  assert.equal(R[3].games[0].t, "", "a tip-off not confirmed yet has no time");
});

test("without elSeason: the rounds still to come from elNext, each game once, home club first", () => {
  const R = elFixtures(undefined, elNext, 12);
  assert.deepEqual(R.map((x) => x.r), [12, 13]);
  assert.deepEqual(R[0].games.map((g) => `${g.home}-${g.away}`), ["DUB-EFS"]);
  assert.deepEqual(elFixtures(undefined, undefined, 11), []);
});

test("two rounds on screen: the active round and the next one, the arrows move one round, never past either end", () => {
  const R = elFixtures(season, elNext, 11);
  assert.deepEqual(fxWindow(R, 11, null).shown.map((x) => x.r), [11, 12]);
  assert.deepEqual(fxWindow(R, 11, 10).shown.map((x) => x.r), [10, 11]);
  assert.deepEqual(fxWindow(R, 11, 13).shown.map((x) => x.r), [12, 13], "the last round keeps the one before it on screen");
  assert.deepEqual(fxWindow(R, 11, 99).shown.map((x) => x.r), [12, 13]);
  assert.deepEqual(fxWindow([], 11, null).shown, []);
});
