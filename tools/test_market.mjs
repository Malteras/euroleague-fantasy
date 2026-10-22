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

// QA on #76: on a phone the next game, the credit change and the ownership are labelled facts that never break
// inside, with the drawer's words (Exp. change before his game, Value after it), not one line joined by dots.
// They are built with facts() (#82), not a hand-made copy of it.
test("phone facts under the name are labelled facts(), with no dot separators", () => {
  const m = row.match(/<span class="mfacts mobile-only">\$\{facts\(([\s\S]*?)\)\}<\/span>/);
  assert.ok(m, "a facts() call in the .mfacts block of the row");
  const f = m[1];
  for (const label of ["Next", "Owned"]) assert.ok(f.includes(`["${label}",`), label);
  assert.match(f, /\[shown\(p\)\.played&&shown\(p\)\.cr!=null\?"Value":"Exp\. change",/, "Value after his game, Exp. change before");
  assert.doesNotMatch(f, /·/);
  assert.match(f, /crShown\(p\)/, "the credit change goes through crShown (CLAUDE.md rule 7)");
  assert.match(f, /nextG\(p\)/, "the next game goes through nextG (CLAUDE.md rule 7)");
});
