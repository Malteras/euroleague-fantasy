// Tests for the player tags in index.html: a player who has played this round gets no tag that reads today's projection
// (it includes his game) and is never a captain option (CLAUDE.md rules 1 and 7). Run: node --test tools/test_tags.mjs
// The page is one file, so the test cuts the functions out between their marker comments and passes in what they read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// tagsFor:begin"), html.indexOf("// tagsFor:end"));
const DEPS = ["orig", "capOpt", "shown", "avg", "domRecent", "alertOf", "buyLow", "matchup"];
const make = (deps) => new Function(...DEPS, src + "\nreturn {capOptions,tagsFor};")(...DEPS.map((k) => deps[k]));

// Round 7 after Wednesday: LeDay (Hapoel) played Hapoel–Virtus on Wed 21 Oct; Maledon plays Thursday.
const W = "2026-10-21", T = "2026-10-22";
const base = { log: [], be: 10, price: 13.5, gp: 5, rise: 70, pos: "F", out: false, status: null };
const leday = { ...base, id: 77, team: "HTA", day: W, x: 39.9, exp: 0.9 };
const maledon = { ...base, id: 5, team: "ASV", day: T, x: 20.6, exp: 0.2 };
const bench = { ...base, id: 9, team: "ASV", day: T, x: 8.0, exp: 0.0 };
const played = (p) => p.day === W;
const deps = (capOpt) => ({
  orig: { players: [] }, capOpt, shown: (p) => ({ played: played(p) }),
  avg: (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null),
  domRecent: () => [], alertOf: () => null, buyLow: () => false, matchup: () => null,
});
const names = (T) => T.map((t) => t[0]);

test("captain options leave out a player who has played; the next best of that day takes no place", () => {
  const { capOptions } = make(deps(new Set()));
  const S = capOptions([leday, maledon, bench], [W, T], played);
  assert.deepEqual([...S].sort(), [5, 9]);
});

test("a player who has played: no Captain option, Must have, Consider for next round or Rise tag", () => {
  const { tagsFor } = make(deps(new Set([77, 5])));
  const t = names(tagsFor(leday));
  for (const n of ["Captain option", "Must have", "Consider for next round", "Rise 70%"]) assert.ok(!t.includes(n), n);
});

test("a player who has not played keeps them", () => {
  const { tagsFor } = make(deps(new Set([77, 5])));
  assert.deepEqual(names(tagsFor(maledon)).filter((n) => /Captain|Must|Consider|Rise/.test(n)), ["Must have", "Captain option", "Rise 70%"]);
  const fringe = { ...maledon, id: 6, x: 12, exp: 0.13 };
  assert.ok(names(tagsFor(fringe)).includes("Consider for next round"));
});
