// Tests for capPath() in index.html: the captain plan worked back from the last turn, with no page globals.
// Run: node --test tools/test_cappath.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const { capPath } = new Function(cut("// capPath:begin", "// capPath:end") + "\nreturn {capPath};")();

const days = ["2026-10-21", "2026-10-22"];
const p = (id, day, x, extra = {}) => ({ id, day, x, sd: 5, ...extra });

test("one turn: the best projection, nothing to keep against", () => {
  const C = capPath([p(1, days[0], 10), p(2, days[0], 14)], days);
  assert.deepEqual(C.path.map(s => [s.p.id, s.keepAt]), [[2, null]]);
  assert.equal(C.v, 14);
});

test("two turns: the early captain is kept if he beats what the late one is worth", () => {
  const C = capPath([p(1, days[0], 12), p(2, days[1], 15), p(3, days[1], 9, { out: true })], days);
  assert.deepEqual(C.path.map(s => s.p.id), [1, 2]);
  assert.equal(C.path[0].keepAt, 15);
  assert.equal(C.path[1].keepAt, null);
  assert.ok(C.v > 15);
});

test("no one plays: no captain", () => {
  assert.deepEqual(capPath([], days), { v: 0, path: [] });
});
