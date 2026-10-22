// Tests for projShown() in index.html (#57): a card never shows today's projection for a player whose game this round
// is played, because today's projection already includes that game.
// Run: node --test tools/test_projshown.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const { projShown, projTxt, projHtml, coachPts } = new Function(cut("// projShown:begin", "// projShown:end") + "\nreturn {projShown,projTxt,projHtml,coachPts};")();

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

test("played, as HTML: points, % above or under the deadline projection and the credit change, in green or red", () => {
  const h = projHtml(projShown(leday, ctx));
  assert.match(h, /36\.3 pts <span class="up">\+73%<\/span> <span class="up">\+0\.9 cr<\/span> <small>\(proj 21\)<\/small>/);
  const bryant = { id: 1, team: "HTA", day: W, x: 36.7 };
  const b = projHtml(projShown(bryant, { ...ctx, score: () => 14.3, deadX: { 1: 22.4 }, cr: () => -0.2 }));
  assert.match(b, /14\.3 pts <span class="dn">−36%<\/span> <span class="dn">−0\.2 cr<\/span>/);
  assert.equal(projHtml(projShown(maledon, ctx)), "proj 20.6");
  // no change: grey, no sign, like the round schedule
  assert.match(projHtml(projShown(leday, { ...ctx, score: () => 21, cr: () => 0 })), /21 pts <span class="muted">0%<\/span> <span class="muted">0\.0 cr<\/span>/);
});
