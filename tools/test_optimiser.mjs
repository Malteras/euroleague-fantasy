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
  // Chase rank uses the differential rule; at the deadline nobody has played this round
  cut("// differential:begin", "// differential:end"), "const shown=()=>({played:false});",
  // Include hidden gems (#64) uses the gem rule
  line("const avg="), line("function domRecent("), cut("// gems:begin", "// gems:end"),
  "const setState=o=>Object.assign(state,o),closeTrades=v=>{TRADES_CLOSED=v;};",
  // the live globals, set the way init() sets them
  `function setLive(data,squad,budget){D=data;const R=project(data);P=R.players;dayKeys=R.dayKeys;LOOK_ON=R.look;
    byId=Object.fromEntries(P.map(p=>[p.id,p]));C=R.coaches;coachByTeam=Object.fromEntries(C.map(c=>[c.team,c]));
    orig={players:squad.players,coach:squad.coach};P.forEach(p=>{p.sd=spreadOf(p);});state.budget=budget;}`,
  "const live=()=>({D,P,orig,state:{...state}});"].join("\n");
const load = () => new Function(src + "\nreturn {project,withRound,withMode,optimise,tradePairs,setLive,live,spreadOf,setState,closeTrades,DIFF_PTS,byId:()=>byId};")();

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

// 26 Oct 2026: he had saved his 4 Round 8 trades on My team and the planner proposed 3 more on top (#90).
// Trades count from the squad when the round's market opened (data.json tradeBase), not from My team.
function madeWorld(m, startPlayers, cur) {
  const d = round();
  d.players.push({ id: 15, name: "P15 Name15", team: "OLY", pos: "G", price: 6, xpts: 0, fpt: 2, log: log(2) });
  // the round's budget: the start squad's value and bank (selling and buying moves credits, it does not change the total)
  const value = budget({ ...d, squad: { ...d.squad, players: startPlayers || cur } });
  d.squad = { ...d.squad, players: cur, slots: cur };
  return { ...world(m, d), budget: value, start: startPlayers && { players: startPlayers, coach: "PAO" }, maxT: 1, lam: 0 };
}
const has = (r, id) => r.S.includes(id);

test("a trade made this round uses up the limit: the best other trade is not proposed", () => {
  const m = load();
  // without a start the one trade goes on the better guard (4 → 11)
  const free = m.withRound(madeWorld(m, null, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), () => m.withMode("q", m.optimise));
  assert.ok(has(free, 11) && !has(free, 4));
  // he already traded 15 → 1: re-trading 1 (15 → 11 in all) is still the one trade, 4 stays
  const W = madeWorld(m, [15, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = m.withRound(W, () => m.withMode("q", m.optimise));
  assert.ok(has(r, 4), "4 stays: no second trade");
  assert.equal(r.used, 1);
  assert.deepEqual(m.withRound(W, () => m.tradePairs(r)), [[1, 11]]);
});

test("undoing a trade made this round frees it for a better one", () => {
  const m = load();
  // he traded 1 → 15 (a worse guard): bringing 1 back and trading 4 → 11 is still one trade
  const W = madeWorld(m, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [15, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = m.withRound(W, () => m.withMode("q", m.optimise));
  assert.ok(has(r, 1) && has(r, 11) && !has(r, 4) && !has(r, 15));
  assert.equal(r.used, 1);
  assert.equal(r.trades, 2);
});

// Chase rank (#102, docs/adr/0003 (c)): on a near-tie the far less owned player wins; never more than DIFF_PTS less per pick.
// The round's market guard 11 (form 14) is the trade; ownership and a few more guards are added here.
function chaseRound(extra = [], pop = {}) {
  const d = round();
  d.players.push(...extra.map(([id, team, f, price, more]) => ({ id, name: `P${id} Name${id}`, team, pos: "G", price, xpts: 0, fpt: f, log: log(f), ...more })));
  d.players.forEach(p => { p.pop = pop[p.id] ?? 30; });
  return d;
}
// one trade allowed, so the planner's own pick is 4 → 11 and nothing else
const run = (m, d, chase, more = {}) => { m.setLive(d, d.squad, budget(d)); m.setState({ chase, maxT: 1, lam: 20, pins: [], ...more }); return m.withMode("q", m.optimise); };
const x = (m, id) => m.byId()[id].x;

test("Chase rank off: the proposal is the one without the setting", () => {
  const m = load(), d = chaseRound([[15, "OLY", 12, 6]], { 11: 40, 15: 3 });
  const base = run(m, d, undefined), off = run(m, d, false);
  assert.deepEqual(sig(off), sig(base));
  assert.equal(off.ev.cap.path[0].p.id, base.ev.cap.path[0].p.id);
  assert.equal(off.chase, null);
  assert.ok(has(off, 11) && !has(off, 15), "the planner's own pick is the better guard");
});

test("Chase rank on: a star trade goes to the far less owned guard within DIFF_PTS", () => {
  const m = load(), d = chaseRound([[15, "OLY", 12, 6]], { 11: 40, 15: 3 });
  const off = run(m, d, false), on = run(m, d, true);
  assert.ok(has(on, 15) && !has(on, 11));
  assert.equal(on.used, off.used, "no extra trade");
  assert.ok(on.cost <= budget(d) + 1e-9);
  assert.deepEqual(on.chase.swaps.map(w => [w.from, w.to]), [[11, 15]]);
  const lost = x(m, 11) - x(m, 15);
  assert.ok(lost > 0 && lost <= m.DIFF_PTS, `gave up ${lost}`);
});

test("Chase rank never takes an Out player, one more than DIFF_PTS worse, or a dearer one", () => {
  const m = load();
  const d = chaseRound([[15, "OLY", 14, 6, { status: "Out" }], [16, "OLY", 3, 5], [17, "OLY", 14, 7]], { 11: 40, 15: 1, 16: 1, 17: 1 });
  const off = run(m, d, false), on = run(m, d, true);
  assert.ok(x(m, 11) - x(m, 16) > m.DIFF_PTS);
  assert.ok(has(off, 11));
  assert.deepEqual(sig(on), sig(off));
  assert.deepEqual(on.chase.swaps, []);
});

test("Chase rank leaves a pick nobody is far less owned than (a bench-type pick owned by 2%)", () => {
  const m = load(), d = chaseRound([[15, "OLY", 12, 6]], { 11: 2, 15: 0 });
  const off = run(m, d, false), on = run(m, d, true);
  assert.ok(has(off, 11));
  assert.deepEqual(sig(on), sig(off));
});

test("Chase rank leaves a pinned incoming player alone", () => {
  const m = load(), d = chaseRound([[15, "OLY", 12, 6]], { 11: 40, 15: 3 });
  const on = run(m, d, true, { pins: [11] });
  assert.ok(has(on, 11) && !has(on, 15));
});

test("Chase rank on: the first captain goes to a far less owned squad player of his turn within DIFF_PTS", () => {
  const m = load(), d = chaseRound([], { 1: 50, 5: 50, 9: 4, 11: 50 });
  d.players[8].fpt = 8; d.players[8].log = log(8); // the centre (BAR, turn 1) a little under the other turn-1 players
  d.players[10].fpt = 1; d.players[10].log = log(1); // no guard worth a trade: the captain comes from his squad
  const off = run(m, d, false), on = run(m, d, true);
  const c0 = off.ev.cap.path[0].p;
  assert.notEqual(c0.id, 9);
  assert.equal(on.cap.path[0].p.id, 9);
  assert.equal(on.ev.cap.path[0].p.id, 9);
  assert.equal(on.chase.cap.from.id, c0.id);
  assert.ok(c0.x - x(m, 9) <= m.DIFF_PTS);
  assert.deepEqual(sig(on), sig(off), "the trades stay");
  assert.equal(on.cap.path[0].keepAt, off.ev.cap.path[0].keepAt, "the later turns stay");
  assert.ok(on.ev.pts < off.ev.pts && off.ev.pts - on.ev.pts <= m.DIFF_PTS);
});

test("Chase rank does nothing once the round has started, and nothing in a past round's review", () => {
  const m = load(), d = chaseRound([[15, "OLY", 12, 6]], { 1: 50, 5: 50, 9: 4, 11: 40, 15: 3 });
  m.closeTrades(true);
  const off = run(m, d, false), on = run(m, d, true);
  m.closeTrades(false);
  assert.deepEqual(sig(on), sig(off));
  assert.equal(on.chase, null);
  assert.equal(on.ev.cap.path[0].p.id, off.ev.cap.path[0].p.id);
  m.setState({ chase: true });
  const W = { ...world(m, d), lam: 20, maxT: 1 };
  const r = m.withRound(W, () => m.withMode("q", m.optimise));
  assert.equal(r.chase, null);
  assert.ok(has(r, 11) && !has(r, 15));
});

// Include hidden gems (#64, docs/adr/0004): on a near-tie a hidden gem wins; never more than DIFF_PTS less per pick.
// Guard 15 (OLY, 5.5 cr) plays 25 minutes lately against 20 on the season, and ZAL are soft on guards: a gem.
function gemRound(extra = [], pop = {}) {
  const d = chaseRound([[15, "OLY", 12, 5.5, { min: 20 }], ...extra], pop);
  d.defence = { ZAL: { vs_g: 15 } };
  return d;
}
const runG = (m, d, gems, more = {}) => run(m, d, false, { gems, ...more });

test("Include hidden gems off: the proposal is the one without the setting", () => {
  const m = load(), d = gemRound();
  const base = run(m, d, false), off = runG(m, d, false);
  assert.deepEqual(sig(off), sig(base));
  assert.equal(off.gems, null);
  assert.ok(has(off, 11) && !has(off, 15), "the planner's own pick is the better guard");
});

test("Include hidden gems on: the trade goes to the gem within DIFF_PTS, same trades, within budget", () => {
  const m = load(), d = gemRound();
  const off = runG(m, d, false), on = runG(m, d, true);
  assert.ok(has(on, 15) && !has(on, 11));
  assert.deepEqual(on.gems.map(w => [w.from, w.to]), [[11, 15]]);
  assert.equal(on.used, off.used);
  assert.ok(on.cost <= budget(d) + 1e-9);
  const lost = x(m, 11) - x(m, 15);
  assert.ok(lost > 0 && lost <= m.DIFF_PTS, `gave up ${lost}`);
});

test("Include hidden gems takes nobody whose minutes are flat, or who is more than DIFF_PTS worse", () => {
  const m = load();
  const flat = gemRound(); flat.players.find(p => p.id === 15).min = 25;
  assert.deepEqual(runG(m, flat, true).gems, []);
  const weak = gemRound(); Object.assign(weak.players.find(p => p.id === 15), { fpt: 3, log: log(3) });
  const on = runG(m, weak, true);
  assert.ok(x(m, 11) - x(m, 15) > m.DIFF_PTS);
  assert.ok(has(on, 11) && !has(on, 15));
});

test("Include hidden gems leaves a pinned incoming player alone, and does nothing once the round has started", () => {
  const m = load(), d = gemRound();
  assert.ok(has(runG(m, d, true, { pins: [11] }), 11));
  m.closeTrades(true);
  const off = runG(m, d, false), on = runG(m, d, true);
  m.closeTrades(false);
  assert.equal(on.gems, null);
  assert.deepEqual(sig(on), sig(off));
});

test("with Chase rank also on, a gem it brought in stays: one step from the planner's pick, never two", () => {
  const m = load(), d = gemRound([[16, "OLY", 11, 5]], { 11: 40, 15: 30, 16: 1 });
  const on = run(m, d, true, { gems: true });
  assert.ok(has(on, 15) && !has(on, 16));
  assert.deepEqual(on.gems.map(w => [w.from, w.to]), [[11, 15]]);
  assert.deepEqual(on.chase.swaps, []);
});

// Leave out + Must have together (29 Oct, Round 9): he left out Bryant, Maledon (guards), Ojeleye (forward) and Hayes
// (centre) and pinned Vezenkov (forward) and Valančiūnas (centre): 4 trades. The planner first gave each left-out player
// its own best replacement, spent the budget, then had to send out da Silva for a pin: 5 trades, "Valančiūnas only fits
// if other moves free up credits". The pins go into the left-out slots first; the rest of the budget fills the others.
function pinRound() {
  const d = round();
  nid = 14;
  d.players.push(
    pl("OLY", "F", 25, 15),  // 15: the pinned forward
    pl("ZAL", "C", 20, 14),  // 16: the pinned centre
    pl("PAO", "G", 30, 14),  // 17: a star guard the planner liked, too dear once the pins are in
    pl("RMB", "G", 12, 6),   // 18
    pl("OLY", "G", 11, 6),   // 19
    pl("BAR", "F", 20, 12),  // 20: a forward the planner would have taken for the left-out forward
    pl("KBA", "C", 18, 12),  // 21: likewise a centre
  );
  return d;
}
test("left-out players make room for the pinned ones first: 4 trades, not 5, and no warning", () => {
  const m = load(), d = pinRound();
  m.setLive(d, d.squad, budget(d));
  // out: guards 1 and 2, forward 5, centre 9 (39 cr + 2 in the bank); in: 15 and 16 (29 cr), so 12 cr for two guards
  m.setState({ maxT: 4, lam: 0, pins: [15, 16], avoids: [1, 2, 5, 9] });
  const r = m.withMode("q", m.optimise);
  assert.ok(has(r, 15) && has(r, 16), "both pins in");
  for (const id of [1, 2, 5, 9]) assert.ok(!has(r, id), `${id} left out`);
  assert.equal(r.used, 4);
  assert.deepEqual(r.warnings, []);
  // the best two guards 12 cr buys: the round's market guard 11 (form 14, 6 cr) and 18 (form 12, 6 cr); 17 (14 cr) is out of reach
  assert.deepEqual(r.S.filter(i => [11, 17, 18, 19].includes(i)).sort((a, b) => a - b), [11, 18]);
});
