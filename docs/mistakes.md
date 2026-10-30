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
  tools/test_capstrip.mjs (lineup changes wait for earlier games, captain first, any position the formation allows).

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
  club has played this round, a card about this round shows his points and the projection at the deadline from
  history/round-N.json, never today's projection; a Proj. column shows TBC (see the next entry). Before his game, today's
  projection. Tests: tools/test_projshown.mjs. Any new place that shows a
  projection next to a player this round goes through `projOf(p)` or `projCell(p)`, never `p.x`.

## 22 Oct 2026 · the fix for the line above put the score in the "Proj." column
- **What:** after #57 the Players table's Proj. column showed "14.3 pts" for Bryant: his score, under a header that says
  projection. The list was still sorted by today's inflated projection (#66), so Bryant, Carr (1 pt) and Moore (5 pts) sat at
  the top of "Proj.". The ± cr column and the drawer's "Exp. change" still showed an estimate after the real change was known.
- **Why:** the fix asked "what number is safe to show?" and not "what does this column's name promise?". A score is not a
  projection. The sort key was left on `p.x` because the sort shows no number.
- **Guard:** CLAUDE.md rule 7 (a label is a promise). `projCellHtml()` / `projKey()` in the projShown block: once he has
  played, Proj. is **TBC** (next round's projection comes after the round) and sorts last. `crShown()`: ± cr is the real change
  from his game. `upcoming()` / `nextG()`: Next game is next round's game once this round's is played (QA on #67: "Virtus was
  his last game, it was already played"). Each Last 5 bar has a tooltip (`gameInfo()` / `gameTipHtml()`): round, opponent,
  result, points against the projection when one is on record, credit change. Tests: tools/test_projshown.mjs, which also parses every inline script of
  the page (a name declared twice broke the whole page once and the cut-out tests could not see it).
  Before shipping a change to what a cell shows, read its header and ask: is this number what the header says, on every day
  of the round? Do the same for the sort that header drives.

## 22 Oct 2026 · QA on #65 and #67: layout and checking mistakes on the same screens
- **Crammed line (#65):** "13.5 cr · 36.3 pts +130% +0.9 cr (proj 15.8) · Turn 1" on one line. The % sat away from the
  projection it compares to, and price and value looked alike. **Guard:** group each number with what it describes, and copy
  a layout the site already has for the same data (the report's Top performers: points, then % vs proj, then value under it).
- **Checked only with the data already loaded (#65):** the team panel opened before history/round-N.json arrived and never
  redrew, so on a fresh load it had no deadline projection. My check had opened the report first, which loads it. **Guard:**
  open the page fresh, straight to the screen being changed (`#teams`, `#players`), and open the panel at once. Anything
  that loads later must redraw what is already open.
- **Fixed only the cells I touched (#67):** Proj. and ± cr were fixed, but Next game, the line under the name and the drawer
  still showed the played game as upcoming. **Guard:** when a player's state changes (he has played), read his whole row,
  card and drawer, every column, and ask rule 6 of each one.
- **Colour faded by its container (#67):** the tooltip faded its context line and footer with `opacity`, which also faded the
  green and red inside them. The tooltip's background is the theme's text colour, so the page's own green and red are wrong
  on it. **Guard:** fade grey text by colour (`color-mix`), not opacity, when colour goes inside it; tooltip colours are
  `--tip-good` / `--tip-bad`; check contrast in both themes (4.5:1 or more). A new CSS rule placed earlier in the file loses to
  an older rule of the same weight: check the computed style, not just the screenshot.
- **Dates from the browser (#67):** Chromium wrote "Wed, 28 Oct" and "29 Sept"; Node wrote "Wed 28 Oct", so tests passed
  and the page differed. **Guard:** `dayFmt()` in index.html for every date shown; check dates in the browser, not in Node.

## 23 Oct 2026 · the builder moved the deadline to the last game day: "Trades close Today" and 4 trades on Friday
- **What:** the Friday build of Round 7 wrote `deadline: "2026-10-23"`, only Friday's 3 games in `fixtures` and only Friday
  in `turns`. The site said "Trades close Today" and proposed 4 trades in a round that had started on Wednesday. The daily
  run put the three fields back by hand.
- **Why:** the builder made the round's fixtures from each player's next game. Once a club has played, its next game is
  next round's, so every played game of the round dropped out, and the deadline became the first day still to play.
- **Guard:** `round_schedule()` in tools/elbuild.py keeps the round's games from the previous data.json and the history
  snapshot (history/round-N.json) when the round is the same; the deadline is the round's first game day. A game of today
  that comes without its tip-off time keeps the time it had. Tests: tools/test_elbuild.py `RoundScheduleTest`.

## 26 Oct 2026 · 3 more trades proposed after he had made his 4
- **What:** he saved 4 Round 8 trades on My team (Faye → Nebo, Etienne → Madar, Ndiaye → Ricci, coach Masiulis → Navarro).
  The site still showed "3 / 4 trades used" and proposed Nebo → Hayes, Davidovac → da Silva and Ricci → Frisch on top: 7 trades.
- **Why:** the planner counted trades from My team, so every save started the count again at 0.
- **Guard:** the builder writes `tradeBase` (the squad that played the round before, `trade_base()` in tools/elbuild.py);
  `trades()` in index.html counts from it, so a re-trade of a player bought this round is still one trade and undoing a trade
  frees it. The Trades card lists the trades made and marks rows that change one. Tests: tools/test_optimiser.mjs (the two
  "made this round" tests) and tools/test_elbuild.py `TradeBaseTest`.

## 29 Oct 2026 · Leave out + Must have asked for 5 trades when 4 fit
- **What:** he left out Bryant, Maledon, Ojeleye and Hayes and pinned Vezenkov and Valančiūnas, 4 trades within budget
  (13.8 cr left for two guards). The planner proposed 5 (da Silva → Frisch too) and warned "Valančiūnas only fits if other
  moves free up credits. Your picks need 5 trades".
- **Why:** `searchPlan()` replaced each left-out player first with its own best affordable pick, spending the budget, and
  only then looked for a slot for each pin, so a pin pushed out a player he had not left out.
- **Guard:** pins go first, into the slot of a left-out player of the same position; the left-out players still to
  replace then get the best player the budget allows while keeping enough for the cheapest player for each slot after
  them. Test: tools/test_optimiser.mjs "left-out players make room for the pinned ones first".

## General lessons
- Before publishing, open the site with today's data and read what it tells him, card by card. Is each line possible today?
- Ask "what day is it, and which games are already played?" before giving any advice.
- Be suspicious of numbers that look too neat (a last game equal to the season average, the same numbers as the game before).
- Say "I did not check" instead of giving an unchecked number as a fact.
- For every change during a round, run the later days too (tools/test_capstrip.mjs, or fake scores on the page): the turn after next, the last turn, after the round.
- A label that counts or totals ("All done", "Round over") must be true for the whole thing it names.
- A column or field shows what its header says, and its sort uses the same number (CLAUDE.md rule 7).
- Before saying "checked": open the screen fresh, at the width and theme he uses, with today's data, on a player who has
  played and one who has not. Hover what has a tooltip.
- Group numbers with what they describe; reuse the layout the site already has for the same data.
- Tooltips use the site's design (`tipPick()` inside a `.has-tip` parent), never a browser `title` tooltip or an SVG
  `<title>`; tools/test_tooltips.mjs fails on either. The tooltip is `position:fixed` and `placeTip()` puts it under its
  parent, so a container with `overflow:hidden` or a scroll box (the trade table, a chart) no longer cuts it off (#68).
  A rule in that container that styles every `b` or `small` (`.tx-p.o b`) still reaches the tooltip: check its colours.

## 22 Oct 2026 · a game rule nobody checked: "lineup changes between turns are same position only"
- **What:** CLAUDE.md rule 1, GLOSSARY ("Lineup change"), ADR 0002, this file and `turnSwaps()` in index.html (with its tests)
  said a swap between turns must be same position, so the formation stays. It reached the daily routine prompt. The official
  rules say the opposite: any court ↔ bench swap and any of the five formations, as long as the player coming in has not played.
  The same day the routine wrote "no 2026-27 source found" for the free-trade windows, which the rules book lists, so
  Round 7 (deadline 21 Oct) was a free-trade window and nothing told him.
- **Why:** the rule was written from memory and copied from file to file. Nobody opened the official rules book.
- **Guard:** docs/rules.md is the one place for game rules, with quotes and links to the rules book. CLAUDE.md Part A: never
  write a game rule from memory. `turnSwaps()` now takes any swap that leaves a formation after each turn (#70);
  tools/test_capstrip.mjs has a cross-position swap, a swap that would leave no centre, and a five checked turn by turn.

## 22 Oct 2026 · xPTS ×3.7 for every player who had played: Blakeney's projection rose to 22.4 after he scored −3.6 (#66)
- **What:** once a player had played this round, the builder read his FantaSheet Rise % as his xPTS (Bryant 53 instead of
  21.1). His projection jumped (Bryant 22.4 → 36.7, Carr 13.9 → 27.6), and with it the tags, the optimiser and the
  next-round look-ahead.
- **Why:** after his game FantaSheet marks the price change "est." in a cell of its own, and the `parse_team()` regex counted
  cells by position. The same kind of shifted-cell bug as the "*" in the game log above. No error, no warning.
- **Guard:** the regex allows the "est." cell; tools/test_elbuild.py `ParseTeamTest` holds a real row of a player who has
  played and one who has not. `xpts_jumps()`: the builder prints a WARNING when any xPTS moved more than ×2 from the deadline
  snapshot (history/round-N.json). FantaSheet's Rise % is for his next game, so the "Rise N%" tag is not shown for a player who
  has played this round.

## 22 Oct 2026 · facts joined by " · " all over the site (#61)
- **What went wrong:** about 130 lines joined facts with a middle dot: "Hapoel · 13.5 cr · vs VIR · 29.6 min". The lines grew
  long, were hard to scan, and put unrelated facts side by side with equal weight. **Guard:** never join facts with " · ".
  Use layout: a line of its own, a column, a small label before the value, or facts side by side with space between them
  (`facts()` in index.html: most important first, `[label, value]` for a labelled fact). `tools/test_nodots.mjs` fails on
  any dot in rendered text that is not on its list of dots still to remove, and the list only shrinks. Tag names, tooltips
  and the daily report text follow the same rule.

## 22 Oct 2026 · "not merged" said without checking, twice (#86, #87)
- **What:** I told him PR #87 was not merged and asked him to merge it before the next ticket. It had been merged 18
  minutes before. Earlier the same day I said the orange tags were "on main" and called a branch preview "the live site",
  without checking either. He went looking for changes that were not where I said they were.
- **Why:** I spoke from what I remembered of the session, not from the repository. He merges PRs while I work.
- **Guard:** CLAUDE.md Part A: never say merged / not merged / live / deployed before checking right then
  (`git fetch origin main` and `git log origin/main..<branch>`, or the PR's state on GitHub). A
  `…-git-<branch>-….vercel.app` address is the branch preview, not main.

## 28 Oct 2026 · "Your players' matchups" listed players who were not his (#106)
- **What:** during Round 8 the Bottom line listed Ndiaye and Vezenkov at Beşiktaş under "Your players' matchups". Ndiaye
  had been sold and Vezenkov was never bought.
- **Why:** the card read the planner's proposal (`result.S`). Before the deadline that is the team he is about to make;
  once trades close it is a squad he can no longer get.
- **Guard:** `blMatchSquad()` in index.html: his saved team during a round, the proposal before the deadline, and the
  heading says "proposed squad" when the two differ; tools/test_bottomline.mjs covers both.

## 28 Oct 2026 · "Round 7, turn by turn" showed Ndiaye as the Turn 3 captain; Etienne was (#109)
- **What:** once Round 7 was over, the card counted a squad he never played: Madar instead of Etienne, Ndiaye on the
  bench. Its captain walk then gave Turn 3 to Ndiaye, where the site had told him Etienne during the round.
- **Why:** the history snapshot is taken on the first run of deadline day (13:18 UTC). He saved his trades from the site at
  17:08, so the snapshot kept his team from before them. During the round the card used his saved team; once he saved
  next round's team, it fell back to the stale snapshot. Round 8's snapshot had the same problem.
- **Guard:** `fill_played()` in tools/elbuild.py records `played` (his last save between the deadline and the round's last
  game day) in history/round-N.json; `turnReview()` counts it once the round is over. Rounds 7 and 8 were filled from the
  squad.json saves in git. Tests: tools/test_elbuild.py, tools/test_review.mjs. Player ids are the same in every data file;
  that was checked, not assumed.

## 29 Oct 2026 · the Look-ahead row never scored a past round (#123)
- **What:** with Rounds 7 and 8 finished, "How the projections did" showed Look-ahead "– / needs two rounds in a row".
- **Why:** `snapshot()` kept only the EuroLeague games in `teamNext` and dropped their `el`; `nextRound()` in index.html
  took only games with `el` set, so every history snapshot had no next-round opponent. Tests built their own `teamNext`
  with `el` and never one shaped like a real snapshot.
- **Guard:** `nextRound()` counts a game unless it says `el: false`; snapshots now keep `el`. Tests: tools/test_scorecard.mjs
  (a look-ahead from `teamNext` without `el` or `oc`), tools/test_elbuild.py `SnapshotTest`. A reader of history files
  works on the files as they are on disk: they are never rewritten.

## 30 Oct 2026 · "Plan for the round" walked from Feliz and listed players he did not have
- **What:** on Friday of Round 9 the card said "Feliz scored 6.6, below 26: move the armband to Vezenkov". Madar was his
  captain. Turn 1 listed Maledon and Turn 2 Strazel, Hayes and Martin, none of them in his squad.
- **Why:** `turnReview()` gave `cap.first` as the plan's first captain (the best walk from the snapshot's projections), not the
  captain he played, and `liveRound()` started the walk there. `planView()` built the turn lists from the proposal (`R.S`),
  and the coach line from the proposal's coach. `played.cap` could not stand in: the builder replaces `played` with each later
  save of the round, so its cap is where the armband has moved to (Etienne in Round 7, Vezenkov in Round 9).
- **Guard:** the builder records `played.firstCap`, the captain of his deadline-day save, and keeps it when later saves come
  (`fill_played()`; Rounds 7 to 9 filled from the squad.json saves in git and the Round 7 entry above). `turnReview()`
  starts the walk at `played.firstCap`, else the snapshot's captain, else the squad's, whichever is in his team, with that
  captain's own keep mark. During the round `planView()` lists his team; a played turn shows the roles from `played`.
  Tests: tools/test_liveplan.mjs (the real Round 9 files), tools/test_elbuild.py.
