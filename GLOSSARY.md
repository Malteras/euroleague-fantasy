# EuroLeague Fantasy planner

A planner for one EuroLeague Fantasy team: who to trade, who to start and who to captain each round.

## Rounds and trades

**Round**:
One fantasy scoring period with one deadline (the first tip-off). Each club plays one EuroLeague game in it.
_Avoid_: Week, gameweek, matchday

**Turn**:
One game day inside a round. You can change the lineup and the captain between turns, but not trade.
_Avoid_: Day, session

**Double week**:
A calendar week holding two rounds, so every club plays twice in a few days. Each round still has its own deadline and its own trades.
_Avoid_: Double round, double-game week

**Trade**:
Swapping one squad player, or the coach, for another before a round's deadline. Up to 4 per round.
_Avoid_: Transfer, swap

**Free-trade window**:
One of the 6 rounds where trades are unlimited.
_Avoid_: Wildcard, unlimited round

## Projections

**Projection**:
The points a player or coach is expected to score in one round.
_Avoid_: xPTS (that is FantaSheet's input to it), prediction

**Matchup**:
How much the opponent lets a player's position score, as a percentage above or below an average team.
_Avoid_: Score spread, fixture difficulty

**Look-ahead**:
Counting half of a player's next-round projection, with that round's matchup, when judging a trade made this round. Covers this round and the next one only, and never changes who starts or captains this round.
_Avoid_: Horizon, fixture run, multi-round

**Proposal**:
One of the planner's two sets of suggested trades. Proposal 1 ignores player matchups; Proposal 2 adds them, with the look-ahead. Coaches are judged on both rounds' opponents in both.
_Avoid_: Plan, option
