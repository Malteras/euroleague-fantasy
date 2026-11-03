// Tests for the Coaches page's Next 5 games (#63): coachFive(), coachBands(), coachKind() in index.html.
// Run: node --test tools/test_coachfive.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const { teamModel, coachFive, coachBands, coachKind } = new Function(line("const r1=") + "\n" + cut("// teamModel:begin", "// teamModel:end")
  + "\n" + cut("// coachFive:begin", "// coachFive:end") + "\nreturn {teamModel,coachFive,coachBands,coachKind};")();

// A fixed season: PAO wins by 15 a game, KBA loses by 10, HTA and VIR are even.
const games = { PAO: ["W 90-75", "W 85-70", "W 80-65"], KBA: ["L 70-80", "L 60-70", "L 75-85"], HTA: ["W 80-79", "L 79-80"], VIR: ["W 81-80", "L 80-81"] };
const data = {
  round: 10, fixtures: [["2026-11-05", "PAO", "KBA", "20:15"], ["2026-11-06", "HTA", "VIR", "19:00"]],
  players: Object.entries(games).map(([t, r], k) => ({ id: k, team: t, log: r.map((res, i) => ({ d: `2026-10-0${i + 1}`, res })) })),
  elNext: {
    PAO: [{ r: 11, d: "2026-11-12", t: "20:00", oc: "HTA", ha: "A" }, { r: 12, d: "2026-11-17", t: "20:00", oc: "VIR", ha: "H" },
          { r: 13, d: "2026-11-20", t: "20:00", oc: "KBA", ha: "A" }, { r: 14, d: "2026-11-27", t: "20:00", oc: "HTA", ha: "H" },
          { r: 15, d: "2026-12-02", t: "20:00", oc: "VIR", ha: "A" }],
  },
};
const TM = teamModel(data);
const pao = { team: "PAO", day: "2026-11-05", opp: { opp: "KBA", ha: "H" } };
Object.assign(pao, { x: TM.coachPts("PAO", pao.opp), pw: TM.winP("PAO", pao.opp), mg: TM.margin("PAO", pao.opp) });

test("five rounds: this round's game, then the next four from elNext; points and win chance from the team model", () => {
  const F = coachFive(pao, { played: false, x: pao.x }, data, TM);
  assert.deepEqual(F.G.map(g => g.r), [10, 11, 12, 13, 14]);
  assert.equal(F.G[0].x, pao.x);
  assert.equal(F.G[0].t, "20:15");
  assert.equal(F.G[1].x, TM.coachPts("PAO", { opp: "HTA", ha: "A" }));
  assert.equal(F.G[2].pw, TM.winP("PAO", { opp: "VIR", ha: "H" }));
  assert.equal(F.tot, Math.round(F.G.reduce((a, g) => a + g.x, 0) * 10) / 10);
  assert.ok(Math.abs(F.ew - F.G.reduce((a, g) => a + g.pw, 0)) < 1e-9);
});

test("a played game counts his real points and 1 win or 0, never a projection", () => {
  const F = coachFive(pao, { played: true, pts: 20, x: 9.1 }, data, TM);
  assert.equal(F.G[0].pl, true);
  assert.equal(F.G[0].v, 20);
  assert.equal(F.G[0].w, 1);
  assert.equal(F.G[0].x, undefined);
  const L = coachFive(pao, { played: true, pts: -5, x: 9.1 }, data, TM);
  assert.equal(L.G[0].w, 0);
  assert.equal(L.tot, Math.round((-5 + L.G.slice(1).reduce((a, g) => a + g.x, 0)) * 10) / 10);
});

test("older data without elNext: teamNext's EuroLeague games with a code, after this round's game", () => {
  const old = { ...data, elNext: undefined, teamNext: { PAO: [
    { d: "2026-11-05", el: true, oc: "KBA", ha: "H" }, { d: "2026-11-09", el: false, opp: "Aris", ha: "H" },
    { d: "2026-11-12", el: true, oc: "HTA", ha: "A", t: "20:00" }, { d: "2026-11-17", el: true, oc: "VIR", ha: "H" }] } };
  const F = coachFive(pao, { played: false, x: pao.x }, old, TM);
  assert.deepEqual(F.G.map(g => [g.r, g.opp]), [[10, "KBA"], [11, "HTA"], [12, "VIR"]]);
  assert.equal(F.n, 3);
});

test("the chance of each result adds up to 1, and the points they average are the team model's projection", () => {
  for (const mg of [-12, -1.9, 0, 4.1, 15]) {
    const B = coachBands(mg);
    const sum = B.reduce((a, b) => a + b.win.pr + b.lose.pr, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `mg ${mg}: ${sum}`);
    const ev = B.reduce((a, b) => a + b.win.p * b.win.pr + b.lose.p * b.lose.pr, 0);
    assert.deepEqual(B.map(b => [b.m, b.win.p, b.lose.p]), [["1–10", 10, -5], ["11–20", 20, -10], ["21+", 25, -20]]);
    // 3 Nov 2026: Navarro @ Olympiacos, expected to lose by 1.9, averages +1.4
    if (mg === -1.9) assert.equal(Math.round(ev * 10) / 10, 1.4);
  }
});

test("cell colours: green a win expected, orange a loss expected above 0, red below 0, grey a played game", () => {
  assert.equal(coachKind({ pl: true }), "pl");
  assert.equal(coachKind({ x: -0.6, pw: 0.37 }), "neg");
  assert.equal(coachKind({ x: 1.4, pw: 0.44 }), "lossx");
  assert.equal(coachKind({ x: 3.4, pw: 0.51 }), "win1");
  assert.equal(coachKind({ x: 5.6, pw: 0.58 }), "win2");
  assert.equal(coachKind({ x: 12.3, pw: 0.79 }), "win3");
});
