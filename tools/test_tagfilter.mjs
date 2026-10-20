// Tests for the Player market tag filter in index.html. Run: node --test tools/test_tagfilter.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// tagFilter:begin"), html.indexOf("// tagFilter:end"));
const { tagKey, tagCounts, hasTag } = new Function(src + "\nreturn {tagKey,tagCounts,hasTag};")();

const p = (...names) => ({ tags: names.map((t) => [t, "good"]) });

test("Rise tags with different percentages count as one", () => {
  assert.equal(tagKey("Rise 63%"), "Rise %");
  assert.equal(tagKey("Credit gainer"), "Credit gainer");
});

test("counts every tag in the data, most common first, then by name", () => {
  const P = [p("Credit gainer", "Rise 63%"), p("Credit gainer", "Rise 71%"), p("Buy low · back"), p("Out")];
  assert.deepEqual(tagCounts(P), [["Credit gainer", 2], ["Rise %", 2], ["Buy low · back", 1], ["Out", 1]]);
});

test("a player matches a tag by its grouped name; no tag picked matches everyone", () => {
  assert.equal(hasTag(p("Rise 63%"), "Rise %"), true);
  assert.equal(hasTag(p("Credit gainer"), "Buy low · back"), false);
  assert.equal(hasTag(p(), null), true);
});
