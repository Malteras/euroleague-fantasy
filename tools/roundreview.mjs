// roundReview() from index.html, run in node: after a round, what he scored, what the deadline proposal would have scored
// and the best team in hindsight, all counted with the actual points (#30).
// The page is one file, so this cuts the functions out between their marker comments, as the tests do.
// Run: node tools/roundreview.mjs history/round-N.json squad.json [state.json]
// It prints the daily routine's 1–2 report lines (#54), or nothing until the round's actual points are in. state.json, his
// synced planner settings from the state branch, sets the proposal (Proposal 1 or 2, What matters more) as the site shows it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;", line("const FORMS="), line("const POSN="), line("const STOPS="),
  line("let D,P,byId,C,"), line("let LOOK_ON="), line("let state="),
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"), cut("// review:begin", "// review:end"),
  cut("// optimiser:begin", "// optimiser:end"), cut("// roundReview:begin", "// roundReview:end")].join("\n");
export const { roundReview, STOPS } = new Function(src + "\nreturn {roundReview,STOPS};")();

// snap: history/round-N.json; saved: squad.json; prefs: state.json (pmode, lam), or null for the site's defaults.
// No lines until the players' and the coaches' actual points are both in, so the routine reports the round once, complete.
export function reviewLines(snap, saved, prefs) {
  const A = snap.actual;
  if (!A || !A.players || !A.coaches) return [];
  const want = prefs?.lam ?? 20, lam = STOPS.reduce((b, l) => Math.abs(l - want) < Math.abs(b - want) ? l : b, STOPS[0]);
  const V = roundReview(snap, saved, { mode: prefs?.pmode === "m" ? "m" : "q", lam });
  if (!V) return [];
  const f = v => v.toFixed(1), d = v => (Math.round(v * 10) < 0 ? "-" : "+") + f(Math.abs(v));
  const side = s => `${s.short} (${s.team}) ${f(s.pts)}`;
  const head = `Round ${V.round} review: you scored ${f(V.you.pts)}. The proposal would have scored ${f(V.plan.pts)} ` +
    `(${d(V.plan.pts - V.you.pts)}), the best team in hindsight ${f(V.best.pts)} (${d(V.gap)}).`;
  const tail = V.best.trades.length ? `Hindsight trades: ${V.best.trades.map(t => `${side(t.out)} → ${side(t.in)}`).join(", ")}.`
    : V.gap < .05 ? "Best in hindsight: your team as it was." : "Best in hindsight: the same squad with a better lineup and captain.";
  return [head, tail];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [snapPath, squadPath, statePath] = process.argv.slice(2);
  if (!snapPath) { console.error("usage: node tools/roundreview.mjs history/round-N.json [squad.json] [state.json]"); process.exit(2); }
  const read = p => p ? JSON.parse(readFileSync(p, "utf8")) : null;
  reviewLines(read(snapPath), read(squadPath), read(statePath)).forEach(l => console.log(l));
}
