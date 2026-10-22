# Notes for Claude

Read before working on this repo (the daily report, `tools/elbuild.py`, `index.html`).
Game rules: README.md. Words the site uses: GLOSSARY.md. Why the planner works as it does: docs/adr/.
Mistakes already made and what stops them: docs/mistakes.md. Read it before changing the builder or the site.

Six rules that must never be broken:
1. Ask "what day is it, and which games are already played?" before any advice. Played games mean the round has started:
   no trades until the next deadline. A player who has played never comes onto the court; he can only go to the bench
   for a same-position player who has not played (docs/adr/0002-a-round-in-progress.md).
2. Scores come from the official EuroLeague box scores. Never give a captain or lineup call from a number you did not check.
3. Keep or move the captain is judged on the raw score against the keep mark, never on the doubled score.
4. A played turn is history: show what happened, never re-pick it from new projections.
5. Before publishing, open the site with today's data and read every card. If a line is impossible today, fix it or say so.
6. A label is a promise: a column, field or line shows only what its name says. "Proj." holds a projection, never a score;
   "± cr" or "Exp. change" holds a credit change. Once a player has played this round, his projection is the one from the
   deadline (history/round-N.json) and never moves again; today's projection (`p.x`) is never shown or sorted on for him.
   His score and his real credit change go in fields named for them ("scored", "points", "value"). Use `shown(p)` /
   `projCell` / `projKey` / `crShown` in index.html, never `p.x` or `p.exp`, for anything a reader sees this round.
