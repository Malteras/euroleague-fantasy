// Trades left this round, counted from the squad that played the round before (data.json tradeBase).
// Run: node --test tools/test_tradesleft.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const { trades, swapTrades } = new Function(cut("// tradeCount:begin", "// tradeCount:end") + "\nreturn {trades, swapTrades};")();

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
