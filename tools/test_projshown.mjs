// Tests for projShown() in index.html (#57): a card never shows today's projection for a player whose game this round
// is played, because today's projection already includes that game.
// Run: node --test tools/test_projshown.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const { projShown, projTxt, projBox, projCellHtml, projKey, gameInfo, tipPick, upcoming, roundOf, coachPts } = new Function(line("const esc=") + "\n" + cut("// projShown:begin", "// projShown:end") + "\nreturn {projShown,projTxt,projBox,projCellHtml,projKey,gameInfo,tipPick,upcoming,roundOf,coachPts};")();

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

test("Proj. once he has played: TBC with the site's tooltip, next round's projection comes after this round; sorts last", () => {
  const h = projCellHtml(projShown(leday, ctx));
  assert.match(h, /^<span class="tbc has-tip" tabindex="0">TBC<span class="tip tip-pick" role="tooltip"><small>Projection<\/small><b>TBC<\/b><span>To be calculated after the current round is finished\.<\/span><\/span><\/span>$/);
  assert.ok(!h.includes("title=") && !h.includes("39.9") && !h.includes("36.3"));
  assert.equal(projCellHtml(projShown(maledon, ctx)), "20.6");
  assert.equal(projKey(projShown(leday, ctx)), -999);
  assert.equal(projKey(projShown(maledon, ctx)), 20.6);
  assert.equal(projKey(projShown(leday, ctx)) - projKey(projShown(leday, ctx)), 0); // a sort comparator never gets NaN
});

test("tipPick: the site's tooltip (context, title, text, footer), escaped, never a title attribute", () => {
  assert.equal(tipPick("Wed 21 Oct", "14.3 points", "a < b", "−0.2 cr"),
    '<span class="tip tip-pick" role="tooltip"><small>Wed 21 Oct</small><b>14.3 points</b><span>a &lt; b</span><i>−0.2 cr</i></span>');
  assert.equal(tipPick("A", "B", "C"), '<span class="tip tip-pick" role="tooltip"><small>A</small><b>B</b><span>C</span></span>');
});

test("a Last 5 bar: date, opponent, result from his side, points vs projection when on record, credit change", () => {
  const away = { d: "2026-10-16", opp: "PAO", ha: "A", res: "W 81-91", fpt: 23.1, cr: 0.3 };
  assert.deepEqual(gameInfo(away, null, 6), { when: "R6 · Fri 16 Oct · @ PAO · W 91–81", pts: "23.1 points", vs: "No projection on record", cr: "+0.3 cr value" });
  const home = { d: "2026-10-21", opp: "VIR", ha: "H", res: "W 90-81", fpt: 14.3, cr: -0.2 };
  assert.deepEqual(gameInfo(home, 22.4, 7), { when: "R7 · Wed 21 Oct · vs VIR · W 90–81", pts: "14.3 points", vs: "22.4 projected · −36%", cr: "−0.2 cr value" });
  assert.equal(gameInfo({ ...home, cr: 0, fpt: 22.4 }, 22.4).vs, "22.4 projected · 0%");
  assert.equal(gameInfo({ ...home, cr: 0 }, 22.4).cr, "0.0 cr value");
  assert.equal(gameInfo(home, 22.4, null).when, "Wed 21 Oct · vs VIR · W 90–81"); // round unknown: left out, never guessed
});

test("next game: this round's before he plays, next round's once he has played", () => {
  const p = { ...leday, opp: { opp: "VIR", ha: "H" }, next: { opp: "EFS", ha: "H", date: "2026-10-28", round: 8 } };
  assert.deepEqual(upcoming(p, true, 7), { opp: "EFS", ha: "H", day: "2026-10-28", round: 8 });
  assert.deepEqual(upcoming(p, false, 7), { opp: "VIR", ha: "H", day: W, round: 7 });
  assert.equal(upcoming({ ...p, next: null }, true, 7), null);
});

test("the round of a game in the log: a club plays once a round, so its games count back from this round", () => {
  // Hapoel: played R7 on Wed 21 Oct; checked against the "EuroLeague R6" labels in data.json results (20 of 20)
  const hta = ["2026-10-21", "2026-10-16", "2026-10-14", "2026-10-08", "2026-10-01"];
  assert.equal(roundOf(hta, "2026-10-21", 7, true), 7);
  assert.equal(roundOf(hta, "2026-10-16", 7, true), 6);
  assert.equal(roundOf(hta, "2026-10-01", 7, true), 3);
  // Real Madrid has not played R7 yet: its latest game is R6
  const rmb = ["2026-10-15", "2026-10-13", "2026-10-08", "2026-10-01", "2026-09-29"];
  assert.equal(roundOf(rmb, "2026-10-15", 7, false), 6);
  assert.equal(roundOf(rmb, "2026-09-29", 7, false), 2);
  assert.equal(roundOf(rmb, "2026-10-20", 7, false), null);
});


test("the whole page script parses (a name declared twice breaks the page, and the cut-out tests above can't see it)", () => {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(blocks.length >= 3);
  blocks.forEach(body => assert.doesNotThrow(() => new Function(body)));
});
