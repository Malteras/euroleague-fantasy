// Tests for the "next free-trade window" line under the trades switch in index.html.
// Run: node --test tools/test_tradewindows.mjs
// The page is one file, so the test cuts the function out between its marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// nextWindow:begin"), html.indexOf("// nextWindow:end"));
const { nextWindow } = new Function(src + "\nreturn {nextWindow};")();

const tw = (...rounds) => ({ rounds, source: "test", checked: "2026-10-20" });

test("names the next window and how many rounds away it is", () => {
  assert.equal(nextWindow(tw(4, 9, 15, 22, 28, 34), 7), "Next free-trade window: round 9 (in 2 rounds).");
});

test("says so when the window is next round or this round", () => {
  assert.equal(nextWindow(tw(4, 8, 15), 7), "Next free-trade window: round 8 (next round).");
  assert.equal(nextWindow(tw(4, 7, 15), 7), "Next free-trade window: round 7 (this round).");
});

test("the rounds do not have to be in order", () => {
  assert.equal(nextWindow(tw(34, 15, 4, 9), 10), "Next free-trade window: round 15 (in 5 rounds).");
});

test("not known yet when the daily report has no list", () => {
  for (const t of [null, undefined, {}, { rounds: [] }, { rounds: "9" }])
    assert.equal(nextWindow(t, 7), "Next free-trade window: not known yet.");
});

test("says when every window has passed", () => {
  assert.equal(nextWindow(tw(2, 4, 6), 7), "No free-trade windows left this season.");
});
