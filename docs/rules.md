# Game rules: EuroLeague Fantasy Challenge, Classic mode

This is THE place for the game rules. If CLAUDE.md, README.md, GLOSSARY.md, an ADR, the site or the daily routine prompt
says something different, this file wins: fix the other place.

Source: the official rules book, https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules (Dunkest's rules link
https://www.dunkest.com/en/euroleague/fantasy-basketball/rules goes there). Read on 22 Oct 2026. Quotes below are copied
from it. Anything marked **Not in the official rules** comes from somewhere else; say so when you use it.

Before you write a game rule anywhere, find it here or in the rules book. Never write a rule from memory.

## Building the team ([Initial team](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/initial-team))
- 100 credits for 10 players and 1 head coach: 4 guards, 4 forwards, 2 centres, 1 coach.
- "Each fantasy team can insert up to 6 players from the same EuroLeague team."
- Formations of the starting five (guards-forwards-centres): **2-2-1, 1-2-2, 2-1-2, 1-3-1, 3-1-1**.
- Up to 3 fantasy teams per account.

## Scoring ([Classic mode](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules), [Players scoring](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/players-scoring))
- "The starting five players, the sixth man, and the coach get 100% of the points, while players on the bench get 50%."
- Captain: "Select a Captain from the starting five players; their score will be multiplied by 2x."
  (A search summary said the euroleaguebasketball.net article says 1.5×. That article could not be opened (HTTP 429).
  The rules book says 2×.)
- Player score, regular time plus overtime: point +1, rebound +1, assist +1, steal +1, turnover −1, block made +1,
  block suffered −1, foul drawn +1, foul committed −1, missed shot −1, missed free throw −1. These are the PIR stats.
- Team win bonus: "+10% of fantasy score that round".
- The site and the report call this score **points** (GLOSSARY: Points).

## Coach scoring ([Coach scoring](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/coach-scoring))
| Result | Points |
|---|---|
| Win by 1–10, or in overtime | +10 |
| Win by 11–20 | +20 |
| Win by 20+ | +25 |
| Loss by 1–10, or in overtime | −5 |
| Loss by 11–20 | −10 |
| Loss by 20+ | −20 |

"Even in the event of dismissal, absence or disqualification of the coach, he will get his score anyway."

## A round, its turns, and what can change between turns ([Managing your team](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/managing-your-team))
"Each Round (R) is divided into Game Turns (T1, T2, T3, etc.), which are the blocks of games played on a given day of the
championship."

"In the space between 2 turns it is possible to:
- Make field-bench subs and change the Captain, but only if the new player chosen has not yet taken the field.
- Change the team formation

Important: The player that is moved from the field to the bench halves his score (players that are placed on the bench
get 50% of their scores). Before the beginning of each Turn you can reset all the substitutions made by clicking the
appropriate button."

So, between turns:

| Allowed | Not allowed |
|---|---|
| Change the formation to any of the five. | A player who has played comes onto the court (or in as 6th man). |
| Court ↔ bench swaps, if the player coming onto the court has not played yet. | A player who has played becomes captain. |
| Move the captain to a player who has not played yet. | Any trade. |
| Move a player who has played from the court to the bench: his score then counts 50%. | |
| Undo all the turn's swaps before the turn starts. | |

- **There is no same-position rule.** A guard can go to the bench for a forward, as long as the new five is one of the
  five formations. (Corrected with Ognjen on 22 Oct 2026; the repo said "same position only" until then.)
- The rules book does not say what the first captain's score counts once he loses the armband. The site assumes it then
  counts once (×1). **Not in the official rules.**

## Trades ([Managing your team](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/managing-your-team))
"Between the end of each Round and the beginning of the next one, the trade market opens. During this time, you can sell
up to 4 players of your fantasy team and buy new ones to improve your roster (the number of trades per Round is unlimited
in the Play-ins, Playoffs and F4 phases). NOTE: also the Coach can be traded between each Round. Trading the coach does
count in the limit of 4 trades per Round (therefore every fantasy team can trade up to 3 players + the coach or 4 players)."

- No trades once the round has started (its first tip-off). The squad is fixed until the next round's deadline.

### Free-trade windows (unlimited trades) in the 2026-27 regular season
"On few specific Rounds during the Regular Season, trades will be unlimited:"

| Rules book | Free-trade round (trades before its deadline) |
|---|---|
| After R6, Oct 16 to Oct 21 | Round 7 |
| After R13, Nov 21 to Nov 24 | Round 14 |
| After R18, Dec 19 to Dec 22 | Round 19 |
| After R23, Jan 16 to Jan 21 | Round 24 |
| After R28, Feb 13 to Mar 4 | Round 29 |
| After R34, Mar 27 to Mar 31 | Round 35 |

data.json `tradeWindows.rounds` holds the right-hand column: `[7, 14, 19, 24, 29, 35]`.

## Prices ([Quotations and price variations](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/quotations-and-price-variations))
The price changes after each round, from two things: "The score obtained" and "The starting value: with the same score,
a player with a low starting value will obtain a greater capital gain than a player with a high value".

**Not in the official rules**, from FantaSheet (https://euroleague.fantasheet.com), used by the site and the report:
- Change = (points − 1.1 × price) / 25, rounded to 0.1. Break-even = 1.1 × price.
- Not playing while his team plays: −0.1. Floor: 4.0.
- Coach: (points − price) / 40.

## Postponed and moved games ([Suspended or changed games](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/suspended-or-changed-games))
- A game moved to a time between two rounds counts normally.
- A game moved into a round that is still running (or into the next one): after T1, the players and coach of both clubs
  get their season average score.
- "In case of postponed matches - where teams are put at rest - and average score awarded, the captain will NOT double his
  score." "In the case of a canceled game during an open Round, the captain will keep his score doubled."

## Joining late ([Initial team](https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules/classic-mode/initial-team))
A team made after the season started gets 100 credits + 0.3 for each round already played, and the average score for
the round in progress.
