// The day-one lineup: as many players of the earliest turn on the court and as 6th man as a formation allows.
// Run: node --test tools/test_dayone.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const FORMS = [[2, 2, 1], [1, 2, 2], [2, 1, 2], [1, 3, 1], [3, 1, 1]];
const dayKeys = ["2026-10-27", "2026-10-28"];
const { dayOneLineup } = new Function("FORMS", "dayKeys", cut("// dayOne:begin", "// dayOne:end") + "\nreturn {dayOneLineup};")(FORMS, dayKeys);

// Round 8, 27 Oct: six of his players play Tuesday (turn 1), four Wednesday, both centres among them
const T1 = "2026-10-27", T2 = "2026-10-28";
const P = (short, pos, x, day, out = false) => ({ short, pos, x, day, out });
const squad = [P("Maledon", "G", 20.2, T1), P("Feliz", "G", 18.7, T1), P("Madar", "G", 14.8, T1), P("Ojeleye", "F", 14.6, T1),
  P("Silva", "F", 11.7, T1), P("Davidovac", "F", 5, T1), P("Bryant", "G", 21.4, T2), P("Hayes", "C", 13.8, T2),
  P("Diarra", "C", 12.2, T2), P("Jackson", "F", 7.5, T2)];
const names = L => [...L.st.map(p => p.short), L.six.short];

test("turn-1 players fill the court and 6th man; a turn-2 player only where the formation needs one (a centre)", () => {
  const L = dayOneLineup(squad);
  assert.deepEqual(names(L).sort(), ["Feliz", "Hayes", "Madar", "Maledon", "Ojeleye", "Silva"]);
  assert.ok(!names(L).includes("Bryant"), "Bryant plays turn 2: he waits on the bench and comes on after turn 1 if needed");
});

test("a player listed Out counts as playing last", () => {
  const s = squad.map(p => p.short === "Silva" ? { ...p, out: true } : p);
  const L = dayOneLineup(s);
  assert.ok(!names(L).includes("Silva"));
  assert.ok(names(L).includes("Davidovac"), "the next turn-1 player takes his place");
});

// Round 13, 19 Nov (#152): both centres play Thursday. A 2-2-1 with Valančiūnas the only centre on the court and Kamenjaš
// as 6th man locks Valančiūnas in: once Thursday is played no legal swap takes him off. The 2-1-2 starts as many Thursday
// players and keeps a way out for each of them.
const R13 = ["2026-11-19", "2026-11-20"];
const r13 = new Function("FORMS", "dayKeys", cut("// dayOne:begin", "// dayOne:end") + "\nreturn {dayOneLineup};")(FORMS, R13).dayOneLineup;
const [TH, FR] = R13;
const team13 = [P("Valančiūnas", "C", 22.2, TH), P("Kamenjaš", "C", 13.9, TH), P("Frisch", "F", 8.9, TH), P("Herrera", "G", 7.4, TH),
  P("Vezenkov", "F", 28, FR), P("Maledon", "G", 20.5, FR), P("Robinson", "G", 17.4, FR), P("Feliz", "G", 16, FR),
  P("Procida", "F", 9.5, FR), P("Abalde", "F", 8.9, FR)];

test("both centres play turn 1: both start, so either can be benched after his game (#152)", () => {
  const L = r13(team13);
  const st = L.st.map(p => p.short);
  assert.ok(st.includes("Valančiūnas") && st.includes("Kamenjaš"), `court: ${st}`);
  assert.equal(L.st.filter(p => p.pos === "C").length, 2);
  assert.deepEqual(names(L).filter(n => ["Valančiūnas", "Kamenjaš", "Frisch", "Herrera"].includes(n)).length, 4, "all four Thursday players count 100%");
  assert.equal(L.six.day, FR, "the 6th man is a Friday player");
});

test("a lone centre is fine when a later centre can come on for him", () => {
  const s = team13.map(p => p.short === "Kamenjaš" ? { ...p, day: FR } : p);
  const L = r13(s);
  assert.equal(L.st.filter(p => p.pos === "C").length, 1, "Kamenjaš plays Friday: one centre on the court, he can replace Valančiūnas");
  assert.equal(L.st.find(p => p.pos === "C").short, "Valančiūnas");
});
