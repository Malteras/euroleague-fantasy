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

## General lessons
- Before publishing, open the site with today's data and read what it tells him, card by card. Is each line possible today?
- Ask "what day is it, and which games are already played?" before giving any advice.
- Be suspicious of numbers that look too neat (a last game equal to the season average, the same numbers as the game before).
- Say "I did not check" instead of giving an unchecked number as a fact.
