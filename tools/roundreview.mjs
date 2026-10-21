// roundReview() from index.html, run in node: after a round, what he scored, what the deadline proposal would have scored
// and the best team in hindsight, all counted with the actual points (#30).
// The page is one file, so this cuts the functions out between their marker comments, as the tests do.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b));
const line = s => html.slice(html.indexOf(s), html.indexOf("\n", html.indexOf(s)));
const src = [line("const TEAMS="), "const r1=v=>Math.round(v*10)/10;", line("const FORMS="), line("const POSN="), line("const STOPS="),
  line("let D,P,byId,C,"), line("let LOOK_ON="), line("let state="),
  cut("// teamModel:begin", "// teamModel:end"), cut("// project:begin", "// project:end"), cut("// review:begin", "// review:end"),
  cut("// optimiser:begin", "// optimiser:end"), cut("// roundReview:begin", "// roundReview:end")].join("\n");
export const { roundReview } = new Function(src + "\nreturn {roundReview};")();
