// Tests for project() in index.html: the round's projections from one data file, with no page globals.
// Run: node --test tools/test_project.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const teams = html.slice(html.indexOf("const TEAMS="), html.indexOf("\n", html.indexOf("const TEAMS=")));
const src = [teams, "const r1=v=>Math.round(v*10)/10;",
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end")].join("\n");
// no D, P, turnOf … in scope: project() must not need them
const { project, matchup } = new Function(src + "\nreturn {project,matchup};")();
const D = JSON.parse(readFileSync(new URL("../data.json", import.meta.url), "utf8"));

test("projection is half FantaSheet xPTS, half form, plus the win adjustment", () => {
  const R = project(D);
  const p = R.players.find(p => p.xpts > 0 && !p.status && p.log.length >= 3);
  const l3 = p.log.slice(0, 3).reduce((a, g) => a + g.fpt, 0) / 3;
  const own = Math.round((0.6 * l3 + 0.4 * p.fpt) * 10) / 10;
  assert.equal(p.own, own);
  assert.equal(p.src, "FantaSheet");
  assert.equal(p.x, Math.round((Math.round((0.5 * p.xpts + 0.5 * own) * 10) / 10 + p.wa) * 10) / 10);
});

test("an Out player projects 0", () => {
  const p = project(D).players.find(p => p.status === "Out");
  assert.ok(p, "data.json has an Out player");
  assert.equal(p.x, 0);
});

test("a Doubtful or Day to day player counts only his chance to play", () => {
  const players = D.players.filter(p => p.log && p.log.length && !p.status).slice(0, 2);
  const data = { ...D, players: [{ ...players[0], status: "Doubtful" }, { ...players[1], status: "Day to day" }, ...players] };
  const R = project(data);
  const full = id => R.players.filter(p => p.id === id).find(p => !p.status);
  const [d, t] = R.players;
  assert.equal(d.play, 0.3);
  assert.equal(t.play, 0.75);
  const f0 = full(d.id), f1 = full(t.id);
  assert.ok(Math.abs((d.x - d.wa) - 0.3 * (f0.x - f0.wa)) <= 0.11, `${d.x} vs ${f0.x}`);
  assert.ok(Math.abs((t.x - t.wa) - 0.75 * (f1.x - f1.wa)) <= 0.11, `${t.x} vs ${f1.x}`);
});

test("every club playing this round has an opponent and a turn; matchup comes from the data's defence table", () => {
  const R = project(D);
  for (const [d, h, a] of D.fixtures) {
    assert.deepEqual(R.oppOf[h], { opp: a, ha: "H" });
    assert.equal(R.turnOf[a], d);
  }
  const p = R.players.find(p => p.opp && D.defence[p.opp.opp]);
  assert.equal(p.mu, matchup(p, p.opp, D.defence));
});

test("coaches get a projection from the win chance", () => {
  const c = project(D).coaches.find(c => c.opp);
  assert.equal(typeof c.x, "number");
  assert.ok(c.pw > 0 && c.pw < 1);
});

test("leaves the data it was given alone", () => {
  const before = JSON.stringify(D), copy = JSON.parse(before);
  project(copy);
  assert.equal(JSON.stringify(copy), before);
});

// "Count new signings' domestic games" (17 Nov: Kamenjaš, new at Baskonia, 22 PIR in 24 min in the ACB, projected 0).
// A synthetic signing on the live data: no EuroLeague game, no FantaSheet xPTS, domestic games only.
const signing = (more = {}) => {
  const d = JSON.parse(JSON.stringify(D)), club = d.fixtures[0][1];
  d.players.push({ id: 99999, name: "New Signing", short: "Signing", team: club, pos: "C", price: 4.8, status: null, gp: 0, fpt: null,
    xpts: null, log: [], dom: [
      { d: "2026-11-15", pir: 22, min: 23.8, dnp: false },
      { d: "2026-11-11", pir: 30, min: 6, dnp: false },   // under 10 minutes: not counted
      { d: "2026-11-08", pir: 14, min: 20, dnp: false },
      { d: "2026-11-01", pir: 40, min: 30, dnp: false },  // a third game: only the last two count
    ], ...more });
  return d;
};
const sg = (d, opt) => project(d, opt).players.find(p => p.id === 99999);

test("off: a player with no EuroLeague game and no xPTS projects 0, whatever his domestic games", () => {
  const p = sg(signing());
  assert.equal(p.own, 0);
  assert.equal(p.src, "form");
});

test("on: he projects 70% of his PIR over his last two domestic games of 10+ minutes", () => {
  const p = sg(signing(), { dom: true });
  assert.equal(p.src, "domestic");
  assert.equal(p.own, 12.6); // 0.7 × (22 + 14) / 2
  assert.equal(p.x, Math.round((p.own + p.wa) * 10) / 10);
});

test("on: a player with a EuroLeague game, a FantaSheet xPTS or an Out status keeps the usual projection", () => {
  const g = { d: "2026-11-13", fpt: 6, min: 12, opp: "X", ha: "H", res: "" };
  assert.equal(sg(signing({ log: [g], fpt: 6 }), { dom: true }).src, "form");
  assert.equal(sg(signing({ xpts: 9 }), { dom: true }).src, "FantaSheet");
  assert.equal(sg(signing({ status: "Out" }), { dom: true }).x, 0);
  // no domestic game of 10+ minutes: nothing to go on
  assert.equal(sg(signing({ dom: [{ d: "2026-11-15", pir: 22, min: 5 }] }), { dom: true }).own, 0);
});
