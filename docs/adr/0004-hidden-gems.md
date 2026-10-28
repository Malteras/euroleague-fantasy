# Hidden gems: a tag, a list, and an "Include hidden gems" tie-break

A cheap player whose role has just grown is projected on his season so far, so the projection lags behind. Agreed with
Ognjen, 28 Oct 2026 (#64).

## What a hidden gem is (`gemOf()` in index.html)

All of these:
- costs under 6 cr (`GEM_PRICE`);
- his last 3 EuroLeague games average at least 3 minutes more than his season average (`GEM_MIN`); fewer than 3 games on
  record means not known, so no;
- this round's opponent allows his position at least 10% more PIR than an average team (`GEM_MU`). Plus is soft, as
  everywhere on the site. 10% is a little under the Soft matchup tag's 15%, so the list is not empty most rounds;
- domestic form counts only when known: if he has domestic games on record they must be good (the Domestic form tag's
  rule, `domGood()`); if none, the rule is skipped and the tooltip says "no domestic games on record";
- never Out or Doubtful (Day to day may play), and never a player who has played this round: his round is history (CLAUDE.md
  rule 4) and he can no longer be traded in.

Ownership is not a rule: few owners is the differential's job (ADR 0003). The numbers are constants in one place, to tune
after a few rounds.

## What is built

- A **Hidden gem** tag (Player market, drawer, report rows; the market's tag filter lists it). Its tooltip names the rules
  and his numbers: price, minutes season → last 3, matchup, domestic PIR or that none is known.
- **This round's hidden gems** in the Round report, beside the other player lists, best projection first.
- **Include hidden gems**, a setting off by default and saved with the other planner settings. A tie-break only, built like
  Chase rank: the search runs as before, then each incoming player who is not a gem himself is swapped for the best gem
  that could take his place (`gemTrades()`): the differential's pool (same position, no dearer, room at his club, not left
  out, not played) and at most `DIFF_PTS` projected points less, look-ahead included. Pinned players and his own stay.
  A bonus that changes picks beyond near-ties was rejected, as for Chase rank.
- With Chase rank also on, gems go first and Chase rank leaves the players they brought in alone: one step from the
  planner's pick, never two, so no pick gives up more than `DIFF_PTS`.
- Only at the deadline; a past round's review (`withRound`) runs with it off.
- Where it swapped, the line under the player says "Hidden gem: X over Y".

## Consequences

- A gem near-tied with a dearer pick is also good value, so the planner often takes him on its own; the setting changes
  the proposal rarely. The tag and the list are the main use.
- Today's data has no domestic games for any player, so the domestic rule is skipped for everyone until the builder
  brings them.
