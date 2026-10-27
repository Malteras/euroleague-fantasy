// "Day to day" is shown as DTD with the site's tooltip (#59); the data keeps "Day to day".
// Run: node --test tools/test_dtd.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const { stTxt, stHtml, dtdWhat } = new Function([line("const esc="), cut("// facts:begin", "// facts:end"), line("const tipTxt="),
  line("const tipPick="), line("const PLAY_CHANCE="), cut("const stTxt=", "// \"Leave out injured")].join("\n") + "\nreturn {stTxt,stHtml,dtdWhat};")();

test("DTD for Day to day, every other status as it is", () => {
  assert.equal(stTxt("Day to day"), "DTD");
  assert.equal(stTxt("Doubtful"), "Doubtful");
});

test("the tooltip text follows PLAY_CHANCE", () => {
  assert.equal(dtdWhat(), "Day to day: he may play; decided close to the game. The site counts 75% of his projection.");
});

test("DTD opens the site's tooltip on hover and on keyboard focus, inside the box it is given", () => {
  assert.equal(stHtml("Day to day", "wt-t warn"), '<span class="wt-t warn dtd has-tip" tabindex="0">DTD<span class="tip tip-pick" role="tooltip">'
    + '<small>Injury news</small><b>DTD</b><span>Day to day: he may play; decided close to the game. The site counts 75% of his projection.</span></span></span>');
  assert.doesNotMatch(stHtml("Day to day"), /title=/);
  assert.equal(stHtml("Doubtful", "tag Doubtful"), '<span class="tag Doubtful">Doubtful</span>');
  assert.equal(stHtml("A<b"), "A&lt;b");
});
