// Tests for the round in progress: the captain walk starts at the captain he played, not the plan's pick.
// Run: node --test tools/test_liveplan.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), line("const esc="), line("const FORMS="), "const r1=v=>Math.round(v*10)/10;",
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"),
  cut("// capPath:begin", "// capPath:end"), cut("// capStrip:begin", "// capStrip:end"),
  cut("// review:begin", "// review:end")].join("\n");
const { turnReview, liveCapPlan } = new Function(src + "\nreturn {turnReview,liveCapPlan};")();
const json = f => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));

// Round 9 as it was on 30 Oct 2026: Thursday played, Friday to play. The snapshot's squad is an older save (captain
// Bryant, 73); he played Feliz, Madar and the rest with Madar (245) as captain, and moved the armband to Vezenkov (7).
const snap = json("../history/round-9.json"), data = json("../data.json"), saved = json("../squad.json");
const logs = Object.fromEntries(data.players.map(p => [p.id, p.log]));
const [THU, FRI] = ["2026-10-29", "2026-10-30"];

test("Round 9: the walk starts at Madar, his captain, with his own keep mark; not at the plan's Feliz", () => {
  const V = turnReview(snap, logs, saved);
  assert.equal(V.from, "saved");
  assert.equal(V.cap.first.id, 245);
  assert.equal(V.cap.scored, 17);
  assert.equal(V.cap.now.id, 7);
  // his keep mark: what Friday's best captain was worth at the deadline, from the snapshot's projections
  assert.ok(V.cap.keepAt > 17, String(V.cap.keepAt));
  assert.equal(V.cap.call, "move");
  assert.equal(V.cap.next.day, FRI);
  // every player in the review is in the team he played
  const ids = new Set(saved.slots);
  assert.ok(V.squad.every(p => ids.has(p.id)), V.squad.map(p => p.id).join());
});

test("Round 9: the live walk over his team says Madar's 17, not Feliz's 6.6, and moves the armband to a Friday player", () => {
  const V = turnReview(snap, logs, saved);
  const by = Object.fromEntries(V.squad.map(p => [p.id, p]));
  const sl = saved.slots.map(id => ({ ...by[id], short: by[id].name.split(" ").slice(-1)[0] }));
  const score = p => p.day === THU ? (logs[p.id].find(g => g.d === THU) || { fpt: 0 }).fpt : null;
  const W = liveCapPlan(sl, sl.find(p => p.id === 245), [THU, FRI], score, p => p.short, d => d, V.cap.keepAt);
  assert.deepEqual(W.held.map(p => p.id), [245, V.cap.next.id]);
  assert.equal(W.calls[0].kind, "move");
  assert.equal(W.calls[0].s, 17);
  assert.equal(W.calls[0].keepAt, Math.ceil(V.cap.keepAt));
  assert.match(W.steps[0].txt, /^Madar scored <b>17<\/b>/);
  assert.ok(!W.steps.some(s => /Feliz/.test(s.txt)));
});

// a small round: G1 plays Wednesday (projection 20, the plan's first captain), G2 Wednesday (12), F6 Thursday (18)
const W1 = "2026-10-21", T1 = "2026-10-22";
const log = f => [1, 2, 3].map(i => ({ d: `2026-10-0${i}`, fpt: f, min: 25, opp: "X", ha: "H", res: "" }));
const pl = (id, team, pos, f) => ({ id, name: `P${id} Name${id}`, team, pos, price: 10, xpts: 0, fpt: f, log: log(f) });
const mini = () => ({
  round: 7, deadline: W1, fixtures: [[W1, "PAO", "KBA"], [T1, "OLY", "ZAL"]], defence: {}, teamNext: {}, coaches: [],
  players: [pl(1, "PAO", "G", 20), pl(2, "KBA", "G", 12), pl(3, "OLY", "F", 8), pl(4, "ZAL", "F", 6), pl(5, "PAO", "C", 10),
    pl(6, "OLY", "G", 18), pl(7, "KBA", "F", 4), pl(8, "ZAL", "C", 5), pl(9, "OLY", "G", 3), pl(10, "PAO", "F", 7), pl(11, "ZAL", "G", 25)],
  squad: { slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 1, updated: "2026-10-20" },
});
const live = g => Object.fromEntries(Object.entries(g).map(([id, [d, f]]) => [id, [{ d, fpt: f, min: 20 }]]));
const wed = live({ 1: [W1, 30], 2: [W1, 9], 5: [W1, 10], 7: [W1, 4], 10: [W1, 7] });

test("played.firstCap wins over the plan, the snapshot's squad and the armband now", () => {
  const s = mini();
  s.played = { slots: [2, 1, 3, 4, 6, 5, 7, 8, 9, 10], cap: 6, firstCap: 2, updated: T1 };
  const V = turnReview(s, wed, null);
  assert.equal(V.from, "played");
  assert.equal(V.cap.first.id, 2);
  assert.equal(V.cap.scored, 9);
  // his own keep mark: Thursday's captain, 6, projected 18
  assert.equal(V.cap.keepAt, 18);
  assert.equal(V.cap.next.id, 6);
  assert.equal(V.cap.call, "move");
  assert.equal(V.cap.now.id, 6);
});

test("no firstCap: the snapshot's squad (his last save before deadline day) gives the first captain", () => {
  const s = mini();
  s.squad.cap = 2;
  s.played = { slots: [2, 1, 3, 4, 5, 6, 7, 8, 9, 10], cap: 6, updated: T1 };
  assert.equal(turnReview(s, wed, null).cap.first.id, 2);
});

test("a first captain not in his team is skipped: the snapshot's captain was sold, so his own captain counts", () => {
  const s = mini();
  // sold 1 on deadline day for 11 and made 2 captain; no deadline-day save recorded
  s.played = { slots: [2, 11, 3, 4, 5, 6, 7, 8, 9, 10], cap: 2, updated: W1 };
  assert.equal(turnReview(s, wed, null).cap.first.id, 2);
});

test("a first captain on the last turn has no keep mark: his score counts double", () => {
  const s = mini();
  s.played = { slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 6, firstCap: 6, updated: W1 };
  const V = turnReview(s, live({ 1: [W1, 30], 6: [T1, 5] }), null);
  assert.equal(V.cap.first.id, 6);
  assert.equal(V.cap.keepAt, null);
  assert.equal(V.cap.call, "keep");
});
