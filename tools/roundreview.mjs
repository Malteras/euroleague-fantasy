// roundReview() from index.html, run in node: after a round, what he scored, what the deadline proposal would have scored
// and the best team in hindsight, all counted with the actual points (#30).
// The page is one file, so this cuts the functions out between their marker comments, as the tests do.
// Run: node tools/roundreview.mjs history/round-N.json squad.json [state.json]
// It prints the daily routine's 1–2 report lines (#54), and a third, matchup vs result (#58), or nothing until the round's actual points are in. state.json, his
// synced planner settings from the state branch, sets the proposal (Proposal 1 or 2, What matters more) as the site shows it.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;", line("const FORMS="), line("const POSN="), line("const STOPS="),
  line("let D,P,byId,C,"), line("let LOOK_ON="), line("let state="),
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"), cut("// review:begin", "// review:end"),
  cut("// optimiser:begin", "// optimiser:end"), cut("// roundReview:begin", "// roundReview:end")].join("\n");
export const { roundReview, STOPS, project } = new Function(src + "\nreturn {roundReview,STOPS,project};")();

// Matchup vs result (#58): for each player who played, his matchup at the deadline (the snapshot's defence) against
// (points − deadline projection) ÷ deadline projection. Players projected under MIN_X are left out: a tiny projection turns
// a few points into hundreds of percent.
const MIN_X = 5;
export function matchupPairs(snap) {
  const A = snap.actual && snap.actual.players;
  if (!A) return [];
  return project(snap).players.filter(p => A[p.id] && A[p.id].fpt != null && p.x >= MIN_X && p.mu != null)
    .map(p => [p.mu, (A[p.id].fpt - p.x) / p.x]);
}
// Pearson r and the least-squares slope of y on x; null with fewer than 3 points or no spread
export function fitLine(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const mx = pairs.reduce((a, [x]) => a + x, 0) / n, my = pairs.reduce((a, [, y]) => a + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return null;
  return { n, r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx };
}
// The report line, pooled over every round on record with actual points; null until there is a fit
export function matchupLine(snaps) {
  const done = snaps.filter(s => matchupPairs(s).length).sort((a, b) => a.round - b.round);
  const F = fitLine(done.flatMap(matchupPairs));
  if (!F) return null;
  const rs = done.map(s => s.round), one = rs.length === 1;
  // a number that rounds to zero gets no sign; minus is the real minus sign, as on the site
  const sg = (v, d, plus) => { const t = Math.abs(v).toFixed(d); return (+t === 0 ? "" : v < 0 ? "−" : plus ? "+" : "") + t; };
  return `Matchup vs result, ${one ? `Round ${rs[0]}` : `Rounds ${rs[0]}–${rs[rs.length - 1]}`} (${F.n} players who played, projected ${MIN_X}+): ` +
    `r = ${sg(F.r, 2)}; each matchup point went with ${sg(100 * F.slope, 1, true)}% against the projection.` +
    (one ? " One round only: a first look." : "");
}

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
  const snap = read(snapPath), lines = reviewLines(snap, read(squadPath), read(statePath));
  // once the round is reviewed, the matchup line, pooled over this round and every earlier one in the same folder (#58)
  if (lines.length) {
    const dir = dirname(snapPath), others = readdirSync(dir).filter(f => /^round-\d+\.json$/.test(f)).map(f => read(join(dir, f)));
    const m = matchupLine([snap, ...others.filter(s => s.round < snap.round)]);
    if (m) lines.push(m);
  }
  lines.forEach(l => console.log(l));
}
