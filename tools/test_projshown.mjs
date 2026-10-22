// Tests for projShown() in index.html (#57): a card never shows today's projection for a player whose game this round
// is played, because today's projection already includes that game.
// Run: node --test tools/test_projshown.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const { projShown, projTxt, projBox, projCellHtml, projKey, gameTip, upcoming, coachPts } = new Function(cut("// projShown:begin", "// projShown:end") + "\nreturn {projShown,projTxt,projBox,projCellHtml,projKey,gameTip,upcoming,coachPts};")();

// Round 7 after Wednesday: LeDay scored 36.3 (deadline projection 21.0, today's 39.9); Maledon plays Thursday.
const W = "2026-10-21", T = "2026-10-22";
const leday = { id: 77, team: "HTA", day: W, x: 39.9 }, maledon = { id: 5, team: "ASV", day: T, x: 20.6 };
const ctx = { played: p => p.day === W, score: p => ({ 77: 36.3 })[p.id] ?? null, deadX: { 77: 21.0 }, cr: p => ({ 77: 0.9 })[p.id] ?? null };

test("played: his points and the deadline projection, never today's", () => {
  assert.deepEqual(projShown(leday, ctx), { played: true, pts: 36.3, x: 21.0, pct: 73, cr: 0.9 });
  assert.equal(projTxt(projShown(leday, ctx)), "36.3 pts (proj 21)");
});

test("played, no deadline snapshot: his points and no projection", () => {
  const s = projShown(leday, { ...ctx, deadX: {} });
  assert.deepEqual(s, { played: true, pts: 36.3, x: null, pct: null, cr: 0.9 });
  assert.equal(projTxt(s), "36.3 pts");
  assert.ok(!projTxt(s).includes("39.9"));
});

test("not played: today's projection", () => {
  assert.deepEqual(projShown(maledon, ctx), { played: false, x: 20.6 });
  assert.equal(projTxt(projShown(maledon, ctx)), "proj 20.6");
});

test("a coach is keyed by his club; with no points known the card says played", () => {
  const laso = { team: "HTA", day: W, x: 9.1 };
  const s = projShown(laso, { ...ctx, score: () => null, deadX: { "c:HTA": 7.4 }, cr: () => null });
  assert.deepEqual(s, { played: true, pts: null, x: 7.4, pct: null, cr: null });
  assert.equal(projTxt(s), "played (proj 7.4)");
});

test("coach points from the final score, home score first (README: coach projection)", () => {
  assert.equal(coachPts("W 90-81"), 10);
  assert.equal(coachPts("W 81-92"), 20);
  assert.equal(coachPts("W 70-91"), 25);
  assert.equal(coachPts("L 81-90"), -5);
  assert.equal(coachPts("L 70-85"), -10);
  assert.equal(coachPts("L 100-70"), -20);
  assert.equal(coachPts(undefined), null);
});

test("played: a score block with the points, % vs the deadline projection, then the value, in green or red", () => {
  const h = projBox(projShown(leday, ctx));
  assert.match(h, /<div class="score">36\.3<small> points<\/small><\/div><small><span class="up">\+73%<\/span> vs 21 proj<\/small><small><span class="up">\+0\.9 value<\/span><\/small>/);
  const bryant = { id: 1, team: "HTA", day: W, x: 36.7 };
  const b = projBox(projShown(bryant, { ...ctx, score: () => 14.3, deadX: { 1: 22.4 }, cr: () => -0.2 }));
  assert.match(b, /<span class="dn">−36%<\/span> vs 22\.4 proj.*<span class="dn">−0\.2 value<\/span>/);
  // no change: grey, no sign; whole points still show one decimal, like the report lists
  assert.match(projBox(projShown(leday, { ...ctx, score: () => 21, cr: () => 0 })), /21\.0<small> points.*<span class="muted">0%<\/span>.*<span class="muted">0\.0 value/);
  // not played: no block, the card keeps today's projection
  assert.equal(projBox(projShown(maledon, ctx)), "");
});

test("Proj. once he has played: TBC, next round's projection comes after this round; sorts last", () => {
  const h = projCellHtml(projShown(leday, ctx));
  assert.match(h, /^<span class="tbc" title="To be calculated after the current round is finished">TBC<\/span>$/);
  assert.ok(!h.includes("39.9") && !h.includes("36.3") && !h.includes("21"));
  assert.equal(projCellHtml(projShown(maledon, ctx)), "20.6");
  assert.equal(projKey(projShown(leday, ctx)), -999);
  assert.equal(projKey(projShown(maledon, ctx)), 20.6);
  assert.equal(projKey(projShown(leday, ctx)) - projKey(projShown(leday, ctx)), 0); // a sort comparator never gets NaN
});

test("a Last 5 bar's tooltip: date, opponent, result from his side, points vs projection when on record, credit change", () => {
  const away = { d: "2026-10-16", opp: "PAO", ha: "A", res: "W 81-91", fpt: 23.1, cr: 0.3 };
  assert.equal(gameTip(away, null), "Fri 16 Oct · @ PAO · W 91–81\n23.1 pts · no projection on record\n+0.3 cr");
  const home = { d: "2026-10-21", opp: "VIR", ha: "H", res: "W 90-81", fpt: 14.3, cr: -0.2 };
  assert.equal(gameTip(home, 22.4), "Wed 21 Oct · vs VIR · W 90–81\n14.3 pts vs 22.4 projected (−36%)\n−0.2 cr");
  assert.equal(gameTip({ ...home, cr: 0, fpt: 22.4 }, 22.4), "Wed 21 Oct · vs VIR · W 90–81\n22.4 pts vs 22.4 projected (0%)\n0.0 cr");
});

test("next game: this round's before he plays, next round's once he has played", () => {
  const p = { ...leday, opp: { opp: "VIR", ha: "H" }, next: { opp: "EFS", ha: "H", date: "2026-10-28", round: 8 } };
  assert.deepEqual(upcoming(p, true), { opp: "EFS", ha: "H", day: "2026-10-28" });
  assert.deepEqual(upcoming(p, false), { opp: "VIR", ha: "H", day: W });
  assert.equal(upcoming({ ...p, next: null }, true), null);
});


test("the whole page script parses (a name declared twice breaks the page, and the cut-out tests above can't see it)", () => {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(blocks.length >= 3);
  blocks.forEach(body => assert.doesNotThrow(() => new Function(body)));
});
