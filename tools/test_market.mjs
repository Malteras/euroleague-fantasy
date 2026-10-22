// Player market rows: the header and every row carry the same hooks for Price and Proj., so the phone layout
// can place them in the same columns (#48). Run: node --test tools/test_market.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("function market("), html.indexOf("function coaches("));
const head = src.slice(src.indexOf('const head=`<div class="mrow head">'), src.indexOf("const body="));
const row = src.slice(src.indexOf("const body="), src.indexOf('<section id="market">'));

test("Price and Proj. have the same hook in the header and the rows", () => {
  for (const part of [head, row]) {
    assert.equal((part.match(/class="cell-num[^"]*\bc-pr\b/g) || []).length, 1, "one Price cell");
    assert.equal((part.match(/class="cell-num[^"]*\bc-pj\b/g) || []).length, 1, "one Proj. cell");
  }
});
