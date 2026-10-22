// Tests for the Teams tab order in index.html. Run: node --test tools/test_teamorder.mjs
// The page is one file, so the test cuts the function out between its marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// teamOrder:begin"), html.indexOf("// teamOrder:end"));
const { teamOrder } = new Function(src + "\nreturn {teamOrder};")();

// Round 7: Hapoel–Virtus played on Wednesday; Thursday and Friday still to play
const fixtures = [
  ["2026-10-23", "ZAL", "ASV", "19:00"],
  ["2026-10-22", "MTA", "RMB", "20:05"],
  ["2026-10-21", "HTA", "VIR", "18:00"],
  ["2026-10-22", "EFS", "BJK", "19:30"],
  ["2026-10-22", "PAR", "CZV", "20:05"],
];
const logs = { HTA: [{ d: "2026-10-21", res: "W 90-81", ha: "H", opp: "VIR" }], VIR: [{ d: "2026-10-21", res: "W 90-81", ha: "A", opp: "HTA" }] };
const gameOf = (t, d) => (logs[t] || []).find((g) => g.d === d && g.res) || null;

test("teams that played this round come first, then the rest in game order (day, then tip-off)", () => {
  const o = teamOrder(["ZAL", "ASV", "MTA", "RMB", "HTA", "VIR", "EFS", "BJK", "XXX"], fixtures, gameOf);
  assert.deepEqual(o.map((x) => x.t), ["HTA", "VIR", "EFS", "BJK", "MTA", "RMB", "ZAL", "ASV", "XXX"]);
});

test("a played team carries its game; a team to play carries its fixture from its side", () => {
  const o = teamOrder(["VIR", "RMB"], fixtures, gameOf);
  assert.equal(o[0].g.res, "W 90-81");
  assert.deepEqual(o[0].f, { d: "2026-10-21", time: "18:00", ha: "A", opp: "HTA" });
  assert.equal(o[1].g, null);
  assert.deepEqual(o[1].f, { d: "2026-10-22", time: "20:05", ha: "A", opp: "MTA" });
});

test("a team without a game this round goes last, with no fixture", () => {
  const o = teamOrder(["XXX", "HTA"], fixtures, gameOf);
  assert.deepEqual(o.map((x) => [x.t, x.f, x.g && x.g.res]), [["HTA", { d: "2026-10-21", time: "18:00", ha: "H", opp: "VIR" }, "W 90-81"], ["XXX", null, null]]);
});

test("the two clubs of a game sit together, home club first, even with another game at the same tip-off", () => {
  const o = teamOrder(["CZV", "RMB", "PAR", "MTA"], fixtures, gameOf);
  assert.deepEqual(o.map((x) => x.t), ["MTA", "RMB", "PAR", "CZV"]);
});
