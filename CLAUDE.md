# Notes for Claude

Two kinds of work happen here. Read Part A always. Read Part B only when you change code (`index.html`, `tools/`, `api/`).
**The daily report run reads Part A only** and skips Part B, docs/mistakes.md and the design notes, unless that run has to
fix the builder or the site.

Game rules: docs/rules.md (from the official rules book; it wins over every other file). Words the site and the report use: GLOSSARY.md. Why the planner works as it does: docs/adr/.

## Part A · Every run, including the daily report: advice and numbers

Rules that must never be broken:
1. Ask "what day is it, and which games are already played?" before any advice. Played games mean the round has started:
   no trades until the next deadline. A player who has played never comes onto the court and never becomes captain; he
   can go from the court to the bench (his score then counts 50%). Any swap and any of the five formations is allowed;
   there is no same-position rule (docs/rules.md, docs/adr/0002-a-round-in-progress.md).
2. Scores come from the official EuroLeague box scores. Never give a captain or lineup call from a number you did not check.
3. Keep or move the captain is judged on the raw score against the keep mark, never on the doubled score.
4. A played turn is history: show what happened, never re-pick it from new projections.
5. Before publishing, open the site with today's data and read every card. If a line is impossible today, fix it or say so.
6. A player who has played this round: report his score and his real credit change from the game. Never give a projection
   for a game that is played (today's projection already includes it), and his next game is next round's. Next round's
   projection is not known until this round is finished. Every day of the round more players are in this state.

Never write a game rule from memory: find it in docs/rules.md or the official rules book first.

Never say a PR, branch or commit is merged, not merged, live, deployed or waiting, before you check it right then:
`git fetch origin main`, then `git log origin/main..<branch>` (empty means all of it is in main), or the PR's state on
GitHub. What you saw earlier in the session is out of date: he merges PRs while you work. A preview address
(`…-git-<branch>-….vercel.app`) is the branch, not main. If you did not check, do not say it.

Every round's results are kept, so rounds can be compared later (is the matchup important?). The first run after a round's
last game day fills `actual` in history/round-N.json (`elbuild.py --history`: each player's points, minutes and credit
change; each coach's points) and commits it. "Round N, turn by turn" shows past rounds from these files and the matchup
line pools them. Never delete, rewrite or skip a history file; if a round's actuals are missing, fill them and say so.

The report text (summary, news, injuries, anything written into data.json) never joins facts with " · ": write a
sentence, or one fact per line (docs/mistakes.md, #61).

Be suspicious of numbers that look too neat (a last game equal to the season average, the same numbers as the game
before). Say "I did not check" instead of giving an unchecked number as a fact.

## Part B · Only when changing the site or the builder: code and design

Read docs/mistakes.md first: mistakes already made and what stops them.

7. A label is a promise: a column, field or line shows only what its name says. "Proj." holds a projection, never a score;
   "± cr" or "Exp. change" holds a credit change; "Next game" holds a game not yet played. For a player who has played this
   round (his club's game is in the logs): "Proj." is TBC; this round's deadline projection appears only beside his score
   ("14.3 pts vs 22.4 projected"); his next game is next round's; his credit change is the real one. Today's projection
   (`p.x`) is never shown or sorted on for him. Use `shown(p)` / `projCell` / `projKey` / `crShown` / `nextG` in
   index.html, never `p.x`, `p.exp`, `p.opp` or `p.day` directly, for anything a reader sees this round.
8. "Checked" means: the page opened fresh, straight to the screen changed; his width, dark and light; a player who has
   played and one who has not, every column of their row, card and drawer; every tooltip hovered.
9. Tooltips: always the site's own tooltip (`tipPick()` → `.tip.tip-pick`: context line, title, text, footer, on a
   `.has-tip` parent that also opens it on keyboard focus). Never a browser tooltip: no `title` attribute, no SVG `<title>`.
