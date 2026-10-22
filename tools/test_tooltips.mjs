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
