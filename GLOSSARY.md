# EuroLeague Fantasy planner

A planner for one EuroLeague Fantasy team: who to trade, who to start and who to captain each round.

## Rounds and trades

> ## ⚠️ NO TRADES BETWEEN TURNS. EVERY TRADE (THE 10 PLAYERS AND THE COACH) IS MADE BEFORE THE ROUND'S DEADLINE.
>
> **Once the first game of the round tips off, the squad is fixed until the next round.** Between turns you can only move players between bench and court and move the captain.
>
> So anything that decides a trade (an injury, a teammate who might be out, a doubtful player) must be checked **before the deadline**, never on the player's own game day. A check that says "before Fri" for a trade decision is wrong.

**Round**:
One fantasy scoring period with one deadline (the first tip-off). Each club plays one EuroLeague game in it.
_Avoid_: Week, gameweek, matchday

**Turn**:
One game day inside a round. You can change the lineup and the captain between turns, but not trade.
A turn starts at its first tip-off (the first game of that day, whoever plays in it): every lineup and captain change for the turn is done before then, never "before my player's game".
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

**Must have** (♥):
Your pick that a player is in the proposal. For a player not in your squad: bring him in, and the other trades are rebuilt around him to make room and find the credits. The planner decides who goes out for him. For one of your players: keep him, so no trade sends him out.
_Avoid_: Pin, lock, favourite

**Leave out** (⊘):
Your pick that a player is not in the proposal. For one of your players: remove him from your team this round, and the planner picks the best replacement it can afford. For a player not in your squad: don't include him in this round's trades.
_Avoid_: Ban, block, exclude

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
