# Notes for Claude

Read this before working on this repo: the daily report, `tools/elbuild.py`, or the site (`index.html`).
The game rules are in README.md and the words the site uses are in GLOSSARY.md.

## Mistakes already made: do not repeat them

### 22 Oct 2026: the planner proposed trades after the round had started
After turn 1 of Round 7 was played (Hapoel–Virtus, Wed 21 Oct), the site's planner still proposed 7 trades.
Some of them brought in players who had already played (Carr, Alston, Baldasso, Moore).
The data already showed that the round had started: the calendar had a past game day and the players had scores from it.
Nobody had to say "the round has started". Played games ARE that information.

Rules:
- Once the first game of a round has tipped off, the squad is fixed until the next round's deadline. No trades, no new players.
  The only changes left: court/bench swaps, formation, and the captain, and only to players who have NOT played yet.
- A player who has played this round is locked. Never suggest him for anything this round.
- Everything you build or check must work for EVERY day of a round, not only the deadline day:
  before the deadline, between turns, the last game day, and after the round.
  Ask yourself "what day is it, and which games are already played?" before giving any advice.
- The planner now shows "Trades closed" after the first tip-off (`roundStarted()` / `TRADES_CLOSED` in index.html).
  After the first tip-off the plan uses HIS saved lineup and captain (My team) and the real scores of the turns played
  (`liveCapPlan` in index.html). A played turn is history: never re-pick its captain or lineup from new projections.
- A decision taken between turns ("if Bryant scored 24+, keep him, otherwise move the armband to Maledon") is shown under
  the turn it must be done BEFORE (turn 2), not under the turn that was played (turn 1).
- Before publishing, open the site with today's data and read what it tells him. If the site's advice is
  impossible or wrong for today, fix it or say so at the top of the report. Do not only check that the numbers loaded.

### 22 Oct 2026: wrong scores from the game log (Bryant 24.2 instead of 14.3)
FantaSheet marks a price change that is not final yet with a "*" in the game log row (`− 0.2 *`).
The regex in `parse_log` did not expect it, skipped that row and read into the next one. So the newest game
got the numbers of the game before it, for every player. Bryant's 14.3 became 24.2, and the report told him
to keep Bryant as captain when the rule said to move the armband to Maledon.
Fixed in `parse_log` (the "*" is removed before parsing).
Since 22 Oct the builder takes every EuroLeague score (PIR, minutes, points) from the official EuroLeague box scores
(`official_games` / `apply_official` in tools/elbuild.py). It reads only the games of the current round
(the latest round with a game played); older games do not change and stay as FantaSheet's game log has them.
The official box score is the source of the results. Read it; do not rebuild scores from other pages when it is available.

Rules:
- Never give a captain or lineup call from a score you have not checked. For his players' scores from the
  turn just played, compare at least one with a second source (the FantaSheet page row, the official box score, Sofascore).
- Be suspicious when numbers look too neat: a last game equal to the season average, the same minutes or
  points as the game before, a score that does not fit the points/minutes in the same row.
- A parser that fails on a row must fail loudly, not quietly take the next row. When you touch a parser,
  test it on the real page of the day, including the newest row.
- Check the date of the source. A score that belongs to another day is a wrong score.

### General
- Say "I don't know" or "I did not check" instead of giving an unchecked number as a fact.
- When he reports a mistake, first check the facts, then say plainly what went wrong and why, then fix it.
