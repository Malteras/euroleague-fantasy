// The site's tooltip only (CLAUDE.md rule 9, #68): no title attribute and no SVG <title> anywhere in index.html,
// so the browser never shows its own tooltip. Use tipPick() inside a .has-tip parent instead.
// Run: node --test tools/test_tooltips.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const lines = html.split("\n").map((s, i) => [i + 1, s]);
const hits = re => lines.filter(([, s]) => re.test(s)).map(([n, s]) => `${n}: ${s.trim().slice(0, 100)}`);

test("no title attribute", () => {
  assert.deepEqual(hits(/\stitle=["'$]/), []);
});

test("no title set from script", () => {
  assert.deepEqual(hits(/\.title\s*=[^=]|setAttribute\(["']title/), []);
});

test("no <title> but the page's own", () => {
  assert.deepEqual(hits(/<title>/).filter(s => !s.includes("<title>Fazani Round Planner</title>")), []);
});

// #46: Must have / Leave out use the site's tooltip, so placeTip() opens it above the button when there is no room below
test("Must have / Leave out buttons use the site tooltip", () => {
  const src = html.slice(html.indexOf("function pickBtn("), html.indexOf("let state="));
  assert.match(src, /class="ico \$\{k\} has-tip/);
  assert.match(src, /"ico[^"]*has-tip[^"]*"[^>]*>\$\{P_\.ico\}<span class="tip tip-pick"/);
});

// #47: Player market tags carry the drawer's tooltip, and sit outside the row's button, so a tap on a tag
// does not open the player drawer
test("Player market tags have their tooltip, outside the row's open button", () => {
  const row = html.slice(html.indexOf('const body=rows.map(p=>`<div class="mrow'), html.indexOf('<section id="market">'));
  const btn = row.slice(row.indexOf('<button type="button" class="who"'), row.indexOf("</button>", row.indexOf('class="who"')));
  assert.ok(btn.length > 0, "the market row's .who button");
  assert.doesNotMatch(btn, /ptags|tagHtml|tagTipHtml/);
  assert.match(row, /<span class="ptags">\$\{tagTipHtml\(p,3\)\}<\/span>/);
});
