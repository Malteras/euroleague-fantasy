# Differential picks: hints first, a "Chase rank" tie-break later

Ognjen is last in his league. Copying the popular picks keeps the gap; climbing needs points that few other teams get.
So on a close call, a player few teams own is worth more for rank. Decided with Ognjen, 28 Oct 2026 (#26).

## What a differential is (`differential()` / `lessOwned()` in index.html)

A pick about as good as the planner's, owned by far fewer teams:
- **About as good**: at most 4 projected points less (`DIFF_PTS`). Ognjen chose 4 over 2 or 10%: more hints, at a cost he accepts.
- **Far fewer teams**: at most half the ownership share (`DIFF_SHARE`) and at least 5 points of share less (`DIFF_GAP`), so
  0.4% against 1.1% is not a differential. Unknown ownership never is.
- Ownership is FantaSheet's share of all its teams, not his league's: it is the only ownership number we have.
- The rule's numbers are constants in one place, to tune after a few rounds.

## What is built

- **(a) Captain hint**: under "Set the lineup", the best differential among squad players of the first captain's turn
  (the same turn, so the armband's walk does not change). Only at the deadline: once the round has started the captain
  is his own and moved by the turn-by-turn plan (ADR 0002).
- **(b) Trade hint**: under each incoming player, the best differential the optimiser could also have picked there:
  same position, no dearer, room at his club, not left out by him (✕ or "Leave out injured"), not played this round.
  Judged on the same projected points as the trade, look-ahead included in Proposal 2.
- Both are **hints only**: the proposal, its trades and its captain stay the same. Each has the site's tooltip with the numbers.

## Decided, not built yet: (c) "Chase rank"

A setting that lets the optimiser itself prefer the differential, as a **tie-break only**: among picks within `DIFF_PTS`,
the far less owned one wins. It never gives up more than `DIFF_PTS` projected points for a pick. A bonus that changes picks
beyond near-ties was rejected for now. Built in its own ticket, after these hints have been seen for a few rounds.

## Consequences

- With most proposals already bringing in players owned by under 10%, the hints are rare; that is expected. They show most
  for a popular captain or a popular incoming star.
- A hint never names a player who has played this round, is Out, or whose ownership is unknown.
