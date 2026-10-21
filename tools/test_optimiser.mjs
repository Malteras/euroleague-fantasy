// Tests for the optimiser in index.html run on another round's players with withRound().
// Run: node --test tools/test_optimiser.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;", line("const FORMS="), line("const POSN="), line("const STOPS="),
  line("let D,P,byId,C,"), line("let LOOK_ON="), line("let state="),
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"), cut("// optimiser:begin", "// optimiser:end"),
  // the live globals, set the way init() sets them
  `function setLive(data,squad,budget){D=data;const R=project(data);P=R.players;dayKeys=R.dayKeys;LOOK_ON=R.look;
    byId=Object.fromEntries(P.map(p=>[p.id,p]));C=R.coaches;coachByTeam=Object.fromEntries(C.map(c=>[c.team,c]));
    orig={players:squad.players,coach:squad.coach};P.forEach(p=>{p.sd=spreadOf(p);});state.budget=budget;}`,
  "const live=()=>({D,P,orig,state:{...state}});"].join("\n");
const load = () => new Function(src + "\nreturn {project,withRound,withMode,optimise,tradePairs,setLive,live,spreadOf};")();

// A small round: two turns, six clubs, each player with three games behind him at his form f.
const W = "2026-10-21", T = "2026-10-22";
const CLUBS = ["PAO", "KBA", "OLY", "ZAL", "BAR", "RMB"];
const log = f => [1, 2, 3].map(i => ({ d: `2026-10-0${i}`, fpt: f, min: 25, opp: "X", ha: "H", res: "" }));
let nid = 0;
const pl = (team, pos, f, price) => ({ id: ++nid, name: `P${nid} Name${nid}`, team, pos, price, xpts: 0, fpt: f, log: log(f) });
function round() {
  nid = 0;
  const players = [
    // his squad: 4 guards, 4 forwards, 2 centres
    pl("PAO", "G", 10, 10), pl("KBA", "G", 9, 9), pl("OLY", "G", 8, 8), pl("ZAL", "G", 4, 6),
    pl("PAO", "F", 10, 10), pl("KBA", "F", 9, 9), pl("OLY", "F", 8, 8), pl("ZAL", "F", 4, 6),
    pl("BAR", "C", 10, 10), pl("RMB", "C", 5, 6),
    // the market: one clearly better guard at the same price, one star he can't afford
    pl("BAR", "G", 14, 6), pl("RMB", "G", 30, 40), pl("BAR", "F", 3, 5), pl("RMB", "C", 3, 5),
  ];
  return {
    round: 7, deadline: W, fixtures: [[W, "PAO", "KBA"], [W, "BAR", "RMB"], [T, "OLY", "ZAL"]],
    defence: {}, teamNext: {}, tradeWindow: null,
    coaches: CLUBS.map(t => ({ name: `Coach ${t}`, team: t, price: 5, last: [0, 0] })),
    players, squad: { players: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], coach: "PAO", slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 1, bank: 2 },
  };
}
const budget = d => d.squad.players.reduce((a, i) => a + d.players.find(p => p.id === i).price, 0) + 5 + d.squad.bank;
function world(m, d) {
  const R = m.project(d);
  R.players.forEach(p => { p.sd = m.spreadOf(p); });
  return { key: "snap:7", data: d, P: R.players, C: R.coaches, dayKeys: R.dayKeys, look: R.look,
    orig: { players: d.squad.players, coach: d.squad.coach }, budget: budget(d), maxT: 4, lam: 0 };
}
const sig = r => [r.S.slice().sort((a, b) => a - b).join(), r.coach];

test("withRound gives the same plan as the live globals set to the same round", () => {
  const m = load(), d = round();
  m.setLive(d, d.squad, budget(d));
  const A = m.withMode("q", m.optimise);
  // different live data, then the same round through withRound
  const other = round(); other.players.forEach(p => { p.fpt = 1; p.log = log(1); });
  m.setLive(other, other.squad, 50);
  const B = m.withRound({ ...world(m, d), lam: 20 }, () => m.withMode("q", m.optimise));
  assert.deepEqual(sig(B), sig(A));
  // the better guard comes in for the weakest one
  assert.deepEqual(m.withRound({ ...world(m, d), lam: 20 }, () => m.tradePairs(B)), [[4, 11]]);
});

test("withRound puts the live players and settings back", () => {
  const m = load(), d = round(), other = round();
  m.setLive(other, other.squad, 50);
  const before = m.live();
  m.withRound(world(m, d), () => m.withMode("m", m.optimise));
  const after = m.live();
  assert.equal(after.D, before.D); assert.equal(after.P, before.P); assert.equal(after.orig, before.orig);
  assert.deepEqual(after.state, before.state);
});

test("a round's plan is cached apart from the live one", () => {
  const m = load(), d = round();
  m.setLive(d, d.squad, budget(d));
  const live = m.withMode("q", m.optimise);
  // same squad and settings, but the snapshot's guard is now useless: the cache must not hand back the live plan
  const d2 = round(); d2.players[10].fpt = 1; d2.players[10].log = log(1);
  const snap = m.withRound({ ...world(m, d2), lam: 20 }, () => m.withMode("q", m.optimise));
  assert.notDeepEqual(sig(snap), sig(live));
});
