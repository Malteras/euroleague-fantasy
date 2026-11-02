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
