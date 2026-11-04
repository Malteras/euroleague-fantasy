// A card redrawn on its own (outerHTML, outside render()) must bind its player and club links again,
// or clicking a name does nothing (the Round 9 review, 4 Nov 2026).
// Run: node --test tools/test_redrawlinks.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("every card redrawn with outerHTML binds its links again", () => {
  const lines = html.split("\n").filter(l => /\.outerHTML\s*=/.test(l));
  assert.ok(lines.length >= 3, "the three history cards are redrawn with outerHTML");
  for (const l of lines) assert.match(l, /bindLinks\(/, `no bindLinks() after: ${l.trim().slice(0, 120)}`);
});

test("bind() binds player and club links through bindLinks()", () => {
  const fn = html.slice(html.indexOf("function bindLinks(root){"), html.indexOf("function bind(){"));
  assert.match(fn, /root\.querySelectorAll\("\[data-open\]"\)/);
  assert.match(fn, /root\.querySelectorAll\("\[data-team\]"\)/);
  const bind = html.slice(html.indexOf("function bind(){"));
  assert.match(bind, /linkRerender=rerender;bindLinks\(document\);/);
  assert.doesNotMatch(bind.slice(0, bind.indexOf("\n}\n")), /document\.querySelectorAll\("\[data-(open|team)\]"\)/);
});
