// Tests for the player drawer's compare (#51) in index.html. Run: node --test tools/test_drawercmp.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = (s) => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
// the TBC cell carries the site's tooltip, so tipPick and what it needs come along
const src = [line("const esc="), cut("// facts:begin", "// facts:end"), line("const tipTxt="), line("const tipPick="), cut("// drawerCmp:begin", "// drawerCmp:end")].join("\n");
const { cmpCandidates, cmpExtraRows } = new Function(src + "\nreturn {cmpCandidates,cmpExtraRows};")();

const club = { ASV: "LDLC ASVEL", PAN: "Panathinaikos", HTA: "Hapoel Tel Aviv" };
const pl = (id, name, team, x) => ({ id, name, team, x });
const P = [pl(1, "Madar", "PAN", 18), pl(2, "Etienne", "ASV", 22), pl(3, "LeDay", "HTA", 30), pl(4, "Bryant", "HTA", 25), pl(5, "Maledon", "ASV", 20)];
const opt = (o) => ({ self: 1, mine: [], q: "", club: (t) => club[t], sort: (a, b) => b.x - a.x, ...o });
const ids = (l) => l.map((p) => p.id);

test("all players but himself, any position and price, in the given order", () => {
  assert.deepEqual(ids(cmpCandidates(P, opt())), [3, 4, 2, 5]);
});

test("his squad first, each part in the given order", () => {
  assert.deepEqual(ids(cmpCandidates(P, opt({ mine: [5, 2, 1] }))), [2, 5, 3, 4]);
});

test("the search matches the name or the club, any case", () => {
  assert.deepEqual(ids(cmpCandidates(P, opt({ q: "etie" }))), [2]);
  assert.deepEqual(ids(cmpCandidates(P, opt({ q: "hapoel" }))), [3, 4]);
  assert.deepEqual(ids(cmpCandidates(P, opt({ q: "zzz" }))), []);
});

// a, b: {played, nx: next round's projection (null when there is no game), pir, status (HTML or ""), games, gamesTxt}
const side = (o) => ({ played: false, nx: 21.5, pir: 14.2, status: "", games: 1, gamesTxt: "1 (Turn 1)", ...o });
const row = (R, k) => R.find((r) => r[0] === k);

test("next round: both projections, bold on the higher", () => {
  const r = row(cmpExtraRows(side(), side({ nx: 18 })), "Next round");
  assert.deepEqual(r.slice(1), ["21.5 projected", "18 projected", 21.5, 18, true]);
});

test("next round is TBC for a player who has played this round, and never bold against a projection", () => {
  const r = row(cmpExtraRows(side({ played: true }), side()), "Next round");
  assert.match(r[1], /TBC/);
  assert.match(r[1], /tip-pick/);
  assert.ok(!r[1].includes("21.5"));
  assert.deepEqual(r.slice(3), [null, null, true]);
});

test("next round: no game shows a dash", () => {
  const r = row(cmpExtraRows(side({ nx: null }), side()), "Next round");
  assert.equal(r[1], "–");
  assert.equal(r[3], null);
});

test("PIR average, higher is better; a missing one is a dash and never bold", () => {
  assert.deepEqual(row(cmpExtraRows(side(), side({ pir: 9 })), "PIR average").slice(1), [14.2, 9, 14.2, 9, true]);
  assert.deepEqual(row(cmpExtraRows(side({ pir: null }), side()), "PIR average").slice(1, 4), ["–", 14.2, null]);
});

test("status: the injury news, else Fit; never bold", () => {
  const r = row(cmpExtraRows(side({ status: "<b>Out</b>" }), side()), "Status");
  assert.deepEqual(r.slice(1, 4), ["<b>Out</b>", "Fit", null]);
});

test("games this round: the text, bold on more games only", () => {
  const r = row(cmpExtraRows(side({ games: 2, gamesTxt: "2" }), side()), "Games this round");
  assert.deepEqual(r.slice(1), ["2", "1 (Turn 1)", 2, 1, true]);
  assert.equal(row(cmpExtraRows(side(), side()), "Games this round")[3], 1);
});
