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
- **When a decision is due**: before the first tip-off of the turn it belongs to, not before the player's own game.
  Turn 3 of Round 7 starts with ZAL–ASV at Fri 19:00, so moving the armband to Etienne (who plays at 20:45) is due before Fri 19:00.
  Decided with Ognjen, 22 Oct 2026: the earlier time is never wrong, a later one could be.
- **Bottom line**: one section per turn still to play, never "all done for the round" while a turn is left. The next turn's
  to-dos (captain, lineup changes, lineup, checks) can be ticked; a later turn shows what is already known and "decide after
  Thu's games" lines for what the earlier games decide. The progress line names each turn ("Turn 2: ✓ all done · Turn 3:
  after Thu's games"). The pill shows the next tip-off. Decided with Ognjen, 22 Oct 2026.
- **Lineup changes between turns** (GLOSSARY, docs/rules.md): any swap, as long as the player coming in has not played
  and the new five is one of the five formations; the formation may change. Corrected with Ognjen on 22 Oct 2026 against
  the official rules book: this bullet first said "only same position, so the formation stays", a rule nobody had checked.
  The site still suggests same-position swaps only (GitHub issue #70). Court and 6th man count 100%,
  bench 50%, so bringing in B for A gains half of (B's projection − A's score, or A's projection if he has not played).
  Shown when it gains 1 point or more. While a court player in B's position still plays before B, it waits for that game
  (Etienne could replace Bryant now, but Feliz scoring 5 on Thursday would make Etienne-for-Feliz better). A new captain on
  the bench comes into the five first. Under the turn the change is due before, in "Plan for the round" and the Bottom line.
- **Apply to My team**: each coming turn with changes has the button in "Plan for the round". It sets the captain and the
  lineup changes on My team and ticks that turn's Bottom line items. Nothing reaches the daily report until Save on My team.
- **The captain walk** starts at the round's first captain (the deadline snapshot), not the saved one, so a played turn keeps
  the captain it had after the armband moves on.
- **Your players' matchups**: only games still to play.
- **Round schedule**: a played game shows "Final" and the score; his players in it show their points (never PIR), ± % against
  the projection at the deadline (the snapshot; the live projection already includes the game) and the credit change from
  the game. The header says trades are closed.
- **A player who has played** (his club's game this round is in the logs; more players every day of the round), on every
  page (CLAUDE.md rules 6 and 7). Decided with Ognjen, 22 Oct 2026 (#57, #65, #67):
  - **Proj.**: TBC, with the site's tooltip "To be calculated after the current round is finished", sorted last. Next
    round's projection is made after the round. Never his score, never today's projection (it already includes the game).
  - **± cr / Value**: the real credit change from his game, not the estimate.
  - **Next game**: next round's game with its round ("vs Efes · R8 · Wed 28 Oct"), in the column, the line under his name,
    the player card and the picker. In his drawer, the played game is headed "This round · played".
  - **Team analysis**: a score block, like the report lists: points; % against the deadline projection, next to it; value.
  - **Last 5**: each bar's tooltip (the site's design) shows the round, date, opponent, result, points against the
    projection when one is on record, and the credit change, in green or red.
- **Watch before the deadline**: hidden. All its checks are due before trades close. It comes back with the next round's data.

## Consequences

- Every card must be checked for every day of a round: before the deadline, between turns, the last game day, after the round.
- When the builder moves data.json to the next round, `TRADES_CLOSED` is false again and the deadline cards return.
