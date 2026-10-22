// Tests for capStrip() in index.html: the captain strip on "Round N, turn by turn" for every day of a round.
// Run: node --test tools/test_capstrip.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const esc="), cut("// capPath:begin", "// capPath:end"), cut("// capStrip:begin", "// capStrip:end")].join("\n");
const { capStrip } = new Function(src + "\nreturn {capStrip};")();

// Round 7 as it was: Bryant on Wednesday (keep mark 25 from the deadline), Maledon on Thursday, Etienne on Friday.
const [W, T, F] = ["2026-10-21", "2026-10-22", "2026-10-23"], days = [W, T, F];
const pl = (id, short, day, x) => ({ id, short, day, x });
const ps = [pl(1, "Bryant", W, 22.4), pl(2, "Diarra", W, 15.1), pl(3, "Maledon", T, 20.6), pl(4, "Feliz", T, 16.2),
  pl(5, "Etienne", F, 18.6), pl(6, "Ndiaye", F, 17.7)];
const tips = { [W]: "18:00", [T]: "19:30", [F]: "19:00" };
// scores: id → points; a day is played when anyone has a score on it
const run = (scores, nowId) => {
  const played = d => ps.some(p => p.day === d && scores[p.id] != null);
  return capStrip({ ps, days, first: ps[0], firstKeep: 25, score: p => played(p.day) ? (scores[p.id] ?? 0) : null,
    nowId, played, tipOf: d => tips[d] });
};
const names = S => S.stops.map(s => s.p.short);

test("after turn 1, armband moved: nothing to do, the rule for after Maledon's game, due before Friday's first tip-off", () => {
  const S = run({ 1: 14.3, 2: 22 }, 3);
  assert.deepEqual(names(S), ["Bryant", "Maledon", "Etienne"]);
  assert.deepEqual(S.stops.map(s => s.res), ["moved", null, null]);
  assert.equal(S.stops[0].keep, 25);
  assert.equal(S.stops[2].last, true);
  assert.equal(S.top.k, "if");
  assert.equal(S.top.who.short, "Maledon");
  assert.equal(S.top.alt.short, "Etienne");
  assert.equal(S.top.by, "19:00");
  assert.equal(S.stops[1].keep, S.top.keep);
  assert.equal(S.bonus, 0);
  assert.equal(S.holdId, 3);
});

test("after turn 1, armband still on Bryant: a to-do to move it before Thursday's first tip-off", () => {
  const S = run({ 1: 14.3, 2: 22 }, 1);
  assert.equal(S.top.k, "todo");
  assert.equal(S.top.who.short, "Maledon");
  assert.equal(S.top.by, "19:30");
  assert.equal(S.holdId, 1);
});

test("keep or move is judged on the raw score: 24.9 is under 25, 25 keeps", () => {
  assert.equal(run({ 1: 24.9 }, 3).stops[0].res, "moved");
  const S = run({ 1: 25 }, 1);
  assert.equal(S.stops[0].res, "kept");
  assert.deepEqual(names(S), ["Bryant", "Maledon", "Etienne"]);
  assert.ok(S.stops.slice(1).every(s => s.gone));
  assert.equal(S.top.k, "kept");
  assert.equal(S.bonus, 25);
});

test("Maledon over his keep mark: he keeps it, his score is the bonus", () => {
  const S = run({ 1: 14.3, 3: 30 }, 3);
  assert.deepEqual(S.stops.map(s => s.res), ["moved", "kept", null]);
  assert.equal(S.top.k, "kept");
  assert.equal(S.bonus, 30);
});

test("Maledon under his keep mark: move to Etienne before Friday's first tip-off; once moved, Etienne is the last captain", () => {
  const todo = run({ 1: 14.3, 3: 5 }, 3);
  assert.equal(todo.top.k, "todo");
  assert.equal(todo.top.who.short, "Etienne");
  assert.equal(todo.top.by, "19:00");
  const done = run({ 1: 14.3, 3: 5 }, 5);
  assert.equal(done.top.k, "last");
  assert.equal(done.stops[2].last, true);
});

test("after the round: the last captain counts double whatever he scores", () => {
  const S = run({ 1: 14.3, 3: 5, 5: 9, 6: 12 }, 5);
  assert.equal(S.top.k, "over");
  assert.equal(S.top.who.short, "Etienne");
  assert.deepEqual(S.stops.map(s => s.res), ["moved", "moved", "kept"]);
  assert.equal(S.bonus, 9);
  assert.equal(S.holdId, 5);
});

test("after a keep, the later turn still shows, faded, with no armband", () => {
  const S = run({ 1: 14.3, 3: 30 }, 3);
  assert.deepEqual(names(S), ["Bryant", "Maledon", "Etienne"]);
  assert.equal(S.stops[2].gone, true);
  assert.equal(S.stops[2].last, false);
  assert.equal(S.top.k, "kept");
});
