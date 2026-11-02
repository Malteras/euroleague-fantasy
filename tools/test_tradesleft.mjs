// Trades left this round, counted from the squad that played the round before (data.json tradeBase).
// Run: node --test tools/test_tradesleft.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const { trades, swapTrades, tradeStart } = new Function(cut("// tradeCount:begin", "// tradeCount:end") + "\nreturn {trades, swapTrades, tradeStart};")();

// Round 8, 27 Oct: the squad that played Round 7, and the one saved on the morning of the deadline (4 trades made:
// Etienne→Madar, Faye→Nebo, Ndiaye→Ricci, coach Zalgiris→Crvena zvezda)
const base = { players: ["Maledon", "Feliz", "Etienne", "Ojeleye", "Faye", "Davidovac", "Bryant", "Diarra", "Ndiaye", "Jackson"], coach: "ZAL" };
const made = ["Maledon", "Feliz", "Madar", "Ojeleye", "Nebo", "Davidovac", "Bryant", "Diarra", "Ricci", "Jackson"];

test("four trades made, the coach counted", () => {
  assert.equal(trades(made, "CZV", base), 4);
});

test("selling a player bought this round changes that trade: no new one (Nebo for Hayes)", () => {
  assert.equal(swapTrades(made, "CZV", "Nebo", "Hayes", base), 0);
});

test("selling a player you started the round with is a new trade (Davidovac for Martin): the fifth", () => {
  assert.equal(swapTrades(made, "CZV", "Davidovac", "Martin", base), 1);
  assert.equal(trades(made.map(i => i === "Davidovac" ? "Martin" : i), "CZV", base), 5);
});

test("buying back a player sold this round frees a trade", () => {
  assert.equal(swapTrades(made, "CZV", "Nebo", "Faye", base), -1);
});

test("the round's start keeps its bank: with today's prices that is the team value until the deadline", () => {
  const players = [73, 91, 38, 165, 118, 8, 23, 185, 236, 361];
  assert.deepEqual(tradeStart({ round: 8, tradeBase: { round: 8, players, coach: "ZAL", bank: 0.3, from: "2026-10-23" } }),
    { players, coach: "ZAL", bank: 0.3 });
  assert.equal(tradeStart({ round: 8, tradeBase: { round: 8, players, coach: "ZAL" } }).bank, null, "an older build: bank unknown");
  assert.equal(tradeStart({ round: 9, tradeBase: { round: 8, players, coach: "ZAL", bank: 0.3 } }), null, "last round's start");
});
