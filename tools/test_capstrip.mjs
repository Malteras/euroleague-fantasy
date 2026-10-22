// Tests for capStrip() in index.html: the captain strip on "Round N, turn by turn" for every day of a round.
// Run: node --test tools/test_capstrip.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const esc="), line("const FORMS="), cut("// capPath:begin", "// capPath:end"), cut("// capStrip:begin", "// capStrip:end")].join("\n");
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

// turnSwaps: bench swaps between turns. Court and 6th man count 100%, bench 50%; any position, if the five is a formation.
const { turnSwaps } = new Function(src + "\nreturn {turnSwaps};")();
const sq = () => {
  const B = { id: 1, short: "Bryant", pos: "G", day: W, x: 22.4 }, M = { id: 3, short: "Maledon", pos: "G", day: T, x: 20.6 },
    Fe = { id: 4, short: "Feliz", pos: "G", day: T, x: 16.2 }, O = { id: 7, short: "Ojeleye", pos: "F", day: T, x: 12.7 },
    Di = { id: 2, short: "Diarra", pos: "C", day: W, x: 15.1 }, Da = { id: 8, short: "Davidovac", pos: "F", day: T, x: 5.6 },
    E = { id: 5, short: "Etienne", pos: "G", day: F, x: 18.6 }, J = { id: 9, short: "Jackson", pos: "F", day: F, x: 8 },
    Fa = { id: 10, short: "Faye", pos: "C", day: F, x: 10.1 }, N = { id: 6, short: "Ndiaye", pos: "F", day: F, x: 17.7 };
  return { st: [B, M, Fe, O, Di], six: Da, bench: [E, J, Fa, N], days, E, M, B, O, N, J, Da };
};
const sc = (m) => p => m[p.id] ?? null;

test("swaps: on Thursday the Friday bench players wait for Thursday's games", () => {
  const S = sq(), R = turnSwaps({ ...S, score: sc({ 1: 14.3, 2: 22 }) });
  assert.deepEqual(R.swaps, []);
  assert.deepEqual(R.wait.map(p => p.short).sort(), ["Etienne", "Faye", "Jackson", "Ndiaye"]);
});

test("swaps: after Thursday, bench players come in for the players who scored under their projection", () => {
  const S = sq(), R = turnSwaps({ ...S, score: sc({ 1: 14.3, 2: 22, 3: 25, 4: 16, 7: 5, 8: 6 }) });
  const s = R.swaps.map(s => [s.in.short, s.out.short, s.gain]);
  // Ndiaye for Ojeleye: (17.7 − 5) / 2; Etienne for the 6th man Davidovac (any position): (18.6 − 6) / 2
  assert.deepEqual(s, [["Ndiaye", "Ojeleye", 6.4], ["Etienne", "Davidovac", 6.3]]);
  assert.deepEqual([R.swaps[0].from, R.swaps[0].form], [[3, 1, 1], [3, 1, 1]]);
  assert.deepEqual(R.wait, []);
});

test("swaps: a new captain on the bench comes in first, even for a small gain", () => {
  const S = sq(), R = turnSwaps({ ...S, score: sc({ 1: 14.3, 2: 22, 3: 12, 4: 16, 7: 13, 8: 6 }), capTo: S.E });
  assert.equal(R.swaps[0].in.short, "Etienne");
  assert.equal(R.swaps[0].out.short, "Maledon");
  assert.equal(R.swaps[0].cap, true);
});

test("swaps: gains under 1 point are left out", () => {
  const S = sq(), R = turnSwaps({ ...S, score: sc({ 1: 18, 2: 22, 3: 25, 4: 18, 7: 17, 8: 17.5 }) });
  assert.deepEqual(R.swaps.map(s => s.in.short), []);
});

// a five that all played on Wednesday, a bench that plays on Friday
const p5 = (id, short, pos, day, x) => ({ id, short, pos, day, x });
const wed = () => {
  const a = p5(1, "A", "G", W, 15), b = p5(2, "B", "G", W, 15), c = p5(3, "C", "F", W, 15), d = p5(4, "D", "F", W, 15),
    e = p5(5, "E", "C", W, 15), f = p5(6, "F6", "F", W, 15);
  return { st: [a, b, c, d, e], six: f, days, a, b, c, d, e, f };
};

test("swaps: a forward comes in for a guard, and the formation changes", () => {
  const S = wed(), g = p5(7, "G", "F", F, 18), h = p5(8, "H", "G", F, 3), i = p5(9, "I", "C", F, 4), j = p5(10, "J", "F", F, 5);
  const R = turnSwaps({ ...S, bench: [g, h, i, j], score: sc({ 1: 2, 2: 20, 3: 20, 4: 20, 5: 20, 6: 20 }) });
  assert.deepEqual(R.swaps.map(s => [s.in.short, s.out.short, s.gain]), [["G", "A", 8]]);
  assert.deepEqual([R.swaps[0].from, R.swaps[0].form], [[2, 2, 1], [1, 3, 1]]);
});

test("swaps: never a five that is not a formation, and a player who has played never comes in", () => {
  const S = wed(), h = p5(8, "H", "G", F, 18), i = p5(9, "I", "C", F, 6), k = p5(11, "K", "G", W, 25);
  // H for the centre E would leave no centre (3-2-0); K has played (30), so he stays on the bench
  const R = turnSwaps({ ...S, bench: [h, i, k], score: sc({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 2, 6: 20, 11: 30 }) });
  assert.deepEqual(R.swaps.map(s => [s.in.short, s.out.short, s.gain]), [["I", "E", 2]]);
});

test("swaps: each turn's five is a formation, not only the last one", () => {
  // 1-3-1 with X (F) scoring 4 and the centre E scoring 11. H (G) plays Thursday, I (C) Friday.
  // H for E and then I for X would end 2-2-1 (13.5 points), but after Thursday the five has no centre (2-3-0).
  const S = wed(), x = p5(2, "X", "F", W, 15), h = p5(8, "H", "G", T, 30), i = p5(9, "I", "C", F, 12);
  const R = turnSwaps({ ...S, st: [S.a, x, S.c, S.d, S.e], bench: [h, i], score: sc({ 1: 20, 2: 4, 3: 20, 4: 20, 5: 11, 6: 20 }) });
  assert.deepEqual(R.swaps.map(s => [s.in.short, s.out.short, s.gain, s.form.join("-")]), [["H", "X", 13, "2-2-1"]]);
});
