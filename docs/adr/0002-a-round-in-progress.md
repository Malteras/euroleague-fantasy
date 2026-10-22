# A round in progress: after the first tip-off the site shows what happened, not a new plan

Once the first game of a round has tipped off, the squad is fixed until the next round's deadline (GLOSSARY: trade).
The data shows this by itself: a game day in the past and players with scores from it. Nobody has to say "the round has started".
Played games ARE that information. Decided with Ognjen, 22 Oct 2026, after the site kept giving deadline advice on turn 2 of Round 7.

## What every card does after the first tip-off (`roundStarted()` → `TRADES_CLOSED`, `liveRound()`)

- **Trades**: none. The planner proposes no trades and the Trades card says they are closed. A player who has played is never suggested.
- **Lineup and captain**: his own saved lineup and captain (My team), not a new pick from projections.
- **A played turn is history**: it shows the real scores and the captain he had. Never re-pick its captain or lineup,
  and never show a projection for a game that was played.
- **Keep or move the captain**: judged on his RAW score against the keep mark, never on the doubled score.
  If the first captain scores under the mark, the armband moves on and his score counts once (×1), not ×2.
- **The keep mark** for the first captain is the one set at the deadline (the history snapshot), so every card gives the same number.
  Later marks come from today's projections.
- **Where a decision goes**: under the turn it must be done BEFORE. "If Bryant scored 25+, keep him, otherwise move the
  armband to Maledon" goes under turn 2, not under turn 1. The same for turn 3.
- **Bottom line**: no trade item. The captain call for the next turn, the lineup for the next turn (players who have not
  played; played ones listed as locked), checks only for players who have not played. The pill shows the next tip-off.
- **Your players' matchups**: only games still to play.
- **Round schedule**: a played game shows "Final" and the score; his players in it show their score, PIR and ± % against
  the projection at the deadline (the snapshot; the live projection already includes the game). The header says trades are closed.
- **Watch before the deadline**: hidden. All its checks are due before trades close. It comes back with the next round's data.

## Consequences

- Every card must be checked for every day of a round: before the deadline, between turns, the last game day, after the round.
- When the builder moves data.json to the next round, `TRADES_CLOSED` is false again and the deadline cards return.
