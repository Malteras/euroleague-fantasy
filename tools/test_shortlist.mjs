// Shortlist (#131): ☆ only remembers a player. It never changes ♥ Must have or ⊘ Leave out, the planner never reads it,
// it is saved with the other picks, and "Clear picks" keeps it. Run: node --test tools/test_shortlist.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => { const i = html.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return html.slice(i, html.indexOf("\n", i)); };

// The picks, the button and the state, with the few helpers they use
const picks = () => new Function(
  "const esc=s=>String(s);let orig={players:[1]};\n" + cut("const ICO_HEART=", "const stopIdx=") +
  "\nreturn {PICKS,pickBtn,state,toggleId};")();

test("☆ Shortlist has its own pick, with the tooltip words from the issue", () => {
  const { PICKS } = picks();
  assert.equal(PICKS.star.name, "Shortlist");
  assert.equal(PICKS.star.mine, "Remember him. The planner ignores the shortlist.");
  assert.equal(PICKS.star.other, "Remember him for later. He is not brought in; use ♥ for that.");
  assert.match(PICKS.star.ico, /^<svg viewBox="0 0 24 24" aria-hidden="true">/, "same icon frame as ♥ and ⊘");
});

test("the ☆ button uses the site tooltip and says which case it is in", () => {
  const { pickBtn } = picks();
  const mine = pickBtn("star", { id: 1 }, true), other = pickBtn("star", { id: 2 }, false);
  assert.match(mine, /class="ico star has-tip on" data-star="1" aria-pressed="true"/);
  assert.match(mine, /<span class="tip tip-pick" aria-hidden="true"><small>In your squad<\/small><b>Shortlist<\/b><span>Remember him\. The planner ignores the shortlist\.<\/span><i>On\. Tap again to undo\.<\/i>/);
  assert.match(other, /<small>Not in your squad<\/small><b>Shortlist<\/b><span>Remember him for later\. He is not brought in; use ♥ for that\.<\/span><\/span>/);
  assert.doesNotMatch(mine + other, /\stitle=/);
});

test("☆ shows wherever ♥ and ⊘ show: the market row, the drawer and Just missed", () => {
  const row = cut('const body=rows.map(p=>`<div class="mrow', '<section id="market">');
  assert.match(row, /pickBtn\("star",p,stars\.has\(p\.id\)\)/);
  assert.match(line('const icos=`<span class="dr-icos">'), /pickBtn\("star",p,state\.stars\.includes\(p\.id\)\)/);
  const i = html.indexOf("const near=(R.near||[]).length?"), near = html.slice(i, html.indexOf("\n  const ", i));
  assert.match(near, /<div class="near-r">/);
  assert.match(near, /pickBtn\("star",b,state\.stars\.includes\(b\.id\)\)/);
});

test("an older save without stars loads with an empty shortlist; a save with stars keeps them", () => {
  const a = picks().state;
  Object.assign(a, { pins: [3], avoids: [4] });
  assert.deepEqual(a.stars, []);
  const b = picks().state;
  Object.assign(b, { stars: [5, 6] });
  assert.deepEqual(b.stars, [5, 6]);
});

test("stars go into the saved prefs (localStorage and state.json)", () => {
  const { state } = picks();
  state.stars = [9];
  const prefsOut = new Function("state", line("function prefsOut(){") + "\nreturn prefsOut();");
  assert.deepEqual(prefsOut(state).stars, [9]);
});

// The click handlers, run on a fake page: each button is { dataset, onclick }
function page() {
  const m = picks(), btns = {};
  const handlers = ['document.querySelectorAll("[data-pin]")', 'document.querySelectorAll("[data-no]")',
    'document.querySelectorAll("[data-star]")', 'const cl=$("#clear")'].map(line).join("\n");
  const doc = { querySelectorAll: sel => { const k = sel.slice(6, -1); return (btns[k] = (btns[k] || [{ dataset: {} }])); } };
  const clear = { onclick: null };
  new Function("state", "toggleId", "document", "$", "rerender", handlers)(m.state, m.toggleId, doc, () => clear, () => {});
  const click = (k, id) => { const b = btns[k][0]; b.dataset[k] = String(id); b.onclick(); };
  return { state: m.state, click, clear: () => clear.onclick() };
}

test("☆ toggles only the shortlist: ♥ and ⊘ stay as they were", () => {
  const { state, click } = page();
  Object.assign(state, { pins: [1], avoids: [2] });
  click("star", 1); click("star", 2); click("star", 3);
  assert.deepEqual(state.stars, [1, 2, 3]);
  assert.deepEqual(state.pins, [1]);
  assert.deepEqual(state.avoids, [2]);
  click("star", 2);
  assert.deepEqual(state.stars, [1, 3]);
});

test("♥ and ⊘ never change ☆: a player can be shortlisted and hearted", () => {
  const { state, click } = page();
  state.stars = [1, 2];
  click("pin", 1); click("no", 2); click("pin", 2);
  assert.deepEqual(state.stars, [1, 2]);
  assert.deepEqual(state.pins, [1, 2]);
  assert.deepEqual(state.avoids, []);
});

test("Clear picks empties ♥, ⊘ and the coach, and keeps the shortlist", () => {
  const { state, clear } = page();
  Object.assign(state, { pins: [1], avoids: [2], coachPin: "PAO", stars: [1, 3] });
  clear();
  assert.deepEqual([state.pins, state.avoids, state.coachPin, state.stars], [[], [], null, [1, 3]]);
});

test("the planner never reads the shortlist", () => {
  assert.doesNotMatch(cut("// optimiser:begin", "// optimiser:end"), /stars/);
  assert.doesNotMatch(cut("// gems:begin", "// gems:end"), /stars/);
  assert.doesNotMatch(cut("// differential:begin", "// differential:end"), /stars/);
});

test("the Shortlist filter sits beside My squad & picks and shows only starred players, or says the list is empty", () => {
  const src = cut("function market(", "function coaches(");
  assert.match(src, /id="only"[^]*?<\/button>\s*<button type="button" class="chip-toggle\$\{state\.starOnly\?" on":""\}" id="starOnly" aria-pressed="\$\{!!state\.starOnly\}">Shortlist<\/button>/);
  assert.match(src, /\(!state\.starOnly\|\|stars\.has\(p\.id\)\)/);
  assert.ok(src.includes("No players on your shortlist: tap ☆ on a player to add him"));
  assert.match(line('const so1=$("#starOnly")'), /state\.starOnly=!state\.starOnly;rerender\(\);/);
});
