// No middle dot (·) between facts in what the site shows (#61): facts are grouped by layout instead, with facts().
// Run: node --test tools/test_nodots.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));

// Every dot in index.html, by the top-level declaration it sits in ("html" before the scripts). Comments do not show,
// so they are left out: whole-line // comments and /* */ blocks.
function dotsByPlace() {
  const out = {};
  let place = "html";
  const text = html.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const line of text.split("\n")) {
    const m = line.match(/^(?:async\s+)?function\s+(\w+)|^(?:const|let|var)\s+(\w+)/);
    if (m) place = m[1] || m[2];
    if (/^\s*\/\//.test(line)) continue;
    const n = (line.match(/·/g) || []).length;
    if (n) out[place] = (out[place] || 0) + n;
  }
  return out;
}

// The dots still to remove, place by place (#61 parts 2–6). This list only shrinks: when you remove dots, lower or
// delete the entry; a dot in a new place, or one more in an old place, fails here. Use facts() instead.
const LEFT = {
  // part 6: Round report, Bottom line, watch list, injury news, game tooltips, coaches
  coaches: 6, bottomLine: 3, report: 13, results: 2, alertBox: 1, gameInfo: 4, gameTipHtml: 2, watchBox: 11,
};

test("no new middle dots: every dot left is on the list, and the list is up to date", () => {
  assert.deepEqual(dotsByPlace(), LEFT);
});

test("facts() groups facts with space, skips empty ones, and labels a fact given as [label, value]", () => {
  const { facts } = new Function(cut("// facts:begin", "// facts:end") + "\nreturn {facts};")();
  assert.equal(facts("Hapoel", "13.5 cr", null, "", false, "vs VIR"),
    '<span class="facts"><span class="f">Hapoel</span><span class="f">13.5 cr</span><span class="f">vs VIR</span></span>');
  assert.equal(facts(["Next", "vs VIR Thu"], "13.5 cr"),
    '<span class="facts"><span class="f"><i>Next</i>vs VIR Thu</span><span class="f">13.5 cr</span></span>');
  assert.equal(facts(["Next", null], null), "", "nothing to show: no empty box");
});

test("tag names carry no dot", () => {
  const src = cut("function tagsFor(", "// tagFilter:begin");
  for (const [, name] of src.matchAll(/T\.push\(\["([^"]+)"/g)) assert.doesNotMatch(name, /·/, name);
});

test("a filter saved with an old tag name still finds the renamed tag", () => {
  const { tagKey } = new Function(cut("// tagFilter:begin", "// tagFilter:end") + "\nreturn {tagKey};")();
  assert.equal(tagKey("Keep · gaining"), "Keep: gaining");
  assert.equal(tagKey("Keep · price steady"), "Keep: price steady");
  assert.equal(tagKey("Buy low · back"), "Buy low: back");
});
