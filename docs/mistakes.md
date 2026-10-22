# Mistakes made, and what now stops them

Each entry: what went wrong, why, and the guard. Read this before changing the builder or the site.

## 22 Oct 2026 · wrong scores: Bryant 24.2 instead of 14.3
- **What:** the newest game of every player had the numbers of the game before it. The report told him to keep Bryant
  as captain; the real score (14.3) meant moving the armband to Maledon.
- **Why:** FantaSheet marks a price change that is not final with a "*" (`− 0.2 *`). The game-log regex did not allow it,
  skipped that row and ran on into the next row, keeping the date of the first. No error, no warning.
  And the number was used without anyone checking it.
- **Guard:** the builder takes the scores of the current round from the official EuroLeague box scores
  (`official_games` / `apply_official` in tools/elbuild.py; tests in tools/test_elbuild.py). It reads only the games played
  in the current round. Never give a captain or lineup call from a score that was not checked.

## 22 Oct 2026 · trades proposed after the round had started
- **What:** after turn 1 of Round 7 the planner proposed 7 trades, some for players who had already played (Carr, Alston, Baldasso).
- **Why:** the planner was built only for the deadline. Nothing used the played games to see that the round had started.
- **Guard:** docs/adr/0002-a-round-in-progress.md; `roundStarted()` / `TRADES_CLOSED` in index.html.

## 22 Oct 2026 · the plan re-picked a played turn
- **What:** after turn 1 the plan made Diarra the turn-1 captain (because he scored 22) instead of showing Bryant, the real captain,
  with his 14.3. The "keep or move" decision was shown under turn 1 instead of turn 2.
- **Why:** the plan was recomputed from today's projections, which already include the played game.
- **Guard:** `liveRound()` / `liveCapPlan()` in index.html use his saved lineup and the real scores; decisions go under the turn
  they must be made before (ADR 0002).

## 22 Oct 2026 · the Bottom line and other cards stayed on deadline mode
- **What:** "Trades close Wed 21 Oct 18:00" on Thursday, "No trades" as a task, "Captain Diarra 34.5 projected" for a played game,
  a lineup that was not his, matchups for played games, a "Watch before the deadline" card after the deadline,
  two different keep marks (24 and 26) on two cards, and the turn card counting Bryant ×2 after the plan moved the armband.
- **Why:** every card was built for the deadline only; the keep mark was computed in two places from different projections.
- **Guard:** ADR 0002 lists what each card does during a round; `blLiveItems()`, the turn card's "C moved ×1",
  one keep mark from the deadline snapshot.

## 22 Oct 2026 · the captain walk and the turn table were wrong once later turns were played (found before it showed)
- **What:** (1) `liveCapPlan()` left out players who had already played when it picked the next captain, so a walk from the
  first captain jumped over a played turn (Bryant → Etienne once Thursday was played). (2) The turn table tagged whoever held
  the armband in the saved lineup "C moved ×1" when the first captain was moved, so a Maledon who kept it would count once.
  (3) A played turn's keep mark moved when a later game changed today's projections (19 → 21).
- **Why:** each was written for the day it was looked at; nobody ran the later days of the round.
- **Guard:** tools/test_capstrip.mjs walks every day of a round (keep, move, armband not moved, last turn, round over);
  tools/test_review.mjs has the moved-armband case. Players who have played keep their deadline projection in the strip.

## 22 Oct 2026 · the Bottom line said "All done for Round 7" with Turn 3 still to play
- **What:** the checklist held only the next turn's to-dos, but its progress line named the round. Between turns the plan
  gave a generic "swap in X, Y, Z for anyone who scored below his projection" instead of a real lineup change.
- **Why:** the checklist was built for the deadline (one set of to-dos per round) and only patched for a round in progress.
- **Guard:** ADR 0002 (Bottom line per turn, lineup changes, Apply to My team); `blLiveItems()` / `turnSwaps()`;
  tools/test_capstrip.mjs (lineup changes wait for earlier games, same position only, captain first).

## 22 Oct 2026 · the round schedule showed PIR next to the points
- **What:** "Bryant 14.3 −36% (PIR 13, proj 22.4)". PIR is not the score; points are PIR +10% on a win (GLOSSARY: Points).
- **Guard:** the schedule shows points and the projection only. Never show raw PIR as a player's score.

## 22 Oct 2026 · a played turn lost its captain after the armband moved on
- **What:** "Plan for the round" walked the captain from the saved one, so once the armband was on Etienne, Turn 2 showed no captain.
- **Guard:** `liveRound()` starts the walk at the round's first captain; history text shows no projection for a played game.

## 22 Oct 2026 · team analysis showed a projection made after the game: LeDay "proj 39.9" after he scored 36.3
- **What:** the Virtus card "This round: attack Virtus with Hapoel forwards" showed LeDay proj 39.9 and Coffey proj 21.7 on
  Thursday. Both had played on Wednesday. Those numbers were never on the site before the game, so it looked like we had
  predicted his score.
- **Why:** the card used today's projection (`p.x`). After a game it is rebuilt with that game in his form, so it moves
  toward the score. The same was true of the market, the player cards and drawer, the coaches page and the replace drawer.
- **Guard:** `projShown()` / `projOf()` / `projCell()` in index.html (CLAUDE.md rule 4: a played turn is history). Once his
  club has played this round, a card shows his points and the projection at the deadline from history/round-N.json, never
  today's projection. Before his game, today's projection. Tests: tools/test_projshown.mjs. Any new place that shows a
  projection next to a player this round goes through `projOf(p)` or `projCell(p)`, never `p.x`.

## 22 Oct 2026 · the fix for the line above put the score in the "Proj." column
- **What:** after #57 the Players table's Proj. column showed "14.3 pts" for Bryant: his score, under a header that says
  projection. The list was still sorted by today's inflated projection (#66), so Bryant, Carr (1 pt) and Moore (5 pts) sat at
  the top of "Proj.". The ± cr column and the drawer's "Exp. change" still showed an estimate after the real change was known.
- **Why:** the fix asked "what number is safe to show?" and not "what does this column's name promise?". A score is not a
  projection. The sort key was left on `p.x` because the sort shows no number.
- **Guard:** CLAUDE.md rule 6 (a label is a promise). `projCellHtml()` / `projKey()` in the projShown block: once he has
  played, Proj. is **TBC** (next round's projection comes after the round) and sorts last. `crShown()`: ± cr is the real change
  from his game. `upcoming()` / `nextG()`: Next game is next round's game once this round's is played (QA on #67: "Virtus was
  his last game, it was already played"). Each Last 5 bar has a tooltip (`gameTip()`): opponent, result, points against the
  projection when one is on record, credit change. Tests: tools/test_projshown.mjs, which also parses every inline script of
  the page (a name declared twice broke the whole page once and the cut-out tests could not see it).
  Before shipping a change to what a cell shows, read its header and ask: is this number what the header says, on every day
  of the round? Do the same for the sort that header drives.

## General lessons
- Before publishing, open the site with today's data and read what it tells him, card by card. Is each line possible today?
- Ask "what day is it, and which games are already played?" before giving any advice.
- Be suspicious of numbers that look too neat (a last game equal to the season average, the same numbers as the game before).
- Say "I did not check" instead of giving an unchecked number as a fact.
- For every change during a round, run the later days too (tools/test_capstrip.mjs, or fake scores on the page): the turn after next, the last turn, after the round.
- A label that counts or totals ("All done", "Round over") must be true for the whole thing it names.
- A column or field shows what its header says, and its sort uses the same number (CLAUDE.md rule 6).
- Tooltips use the site's design (`tipPick()`), never a browser `title` tooltip. A container with `overflow:hidden` cuts
  them off: round its first and last rows instead (`.mkt`).
