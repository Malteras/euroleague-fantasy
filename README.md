# EuroLeague Fantasy round planner

Round planner and daily report for the EuroLeague Fantasy Challenge team **Boškovi Fazani**.

Live site: https://malteras.github.io/euroleague-fantasy/

## What's here

| File | What it is |
|---|---|
| `index.html` | The whole site: proposal, day-by-day lineup and captain plan, round report, player market, coaches, results. No build step. |
| `data.json` | Everything the page shows. Rebuilt every morning. |
| `tools/elbuild.py` | Builds `data.json` from FantaSheet (prices, EuroLeague game logs, projections, injuries, PIR allowed by position, coaches) and Sofascore (domestic league box scores for all 20 clubs). |
| `history/round-N.json` | A record of each round, to test the model's weights later: the inputs before the deadline (players with their last 5 games, defence, fixtures, each club's next 2 EuroLeague games, coaches, trade window, injuries, his squad) and, after the round, `actual`: each player's FPT and minutes (`null` = did not play) and each coach's points. |

## Sync across devices (Vercel)

The same site also runs on Vercel, which adds a tiny API in `api/`:

| Route | What it does |
|---|---|
| `GET /api/state` | Returns your planner settings (from the `state` branch) and `squad.json` (from `main`). |
| `PUT /api/state` | Saves settings, picks and the unsaved team draft to `state.json` on the `state` branch. |
| `POST /api/team` | "Save for daily report": commits `squad.json` to `main`. |

Every request needs the passcode (header `x-pass`). Each device asks for it once.
Vercel environment variables: `APP_PASS` (the passcode) and `GITHUB_TOKEN` (fine-grained token, this repo only, Contents: read and write).
`vercel.json` turns off Vercel deployments for the `state` branch. GitHub Pages keeps working without sync.

## Daily update

A scheduled Claude task runs Monday–Friday at 08:58 (Europe/Sarajevo). Monday is always a full run (weekend domestic games + next-round trades); Tuesday–Friday it only does a full run when a EuroLeague game is played that day or the day before, otherwise it sends a one-line "no games" note. A full run:

1. runs `python3 -I tools/elbuild.py <work_dir> data.json data.json.new`,
2. adds the written bits the script can't produce: EuroLeague results, news, the bottom-line summary, the free-trade windows and the injury list (`results`, `news`, `report`, `tradeWindow`, `injuries` in `data.json`),
3. runs `python3 -I tools/elbuild.py --history data.json history` on the finished `data.json`. On or before a round's deadline day it writes `history/round-N.json` once (never overwritten); after the round's last game day it fills that file's `actual` (each part only once),
4. runs `python3 -I tools/elbuild.py --alerts <previous data.json> data.json` (the previous one is `git show HEAD:data.json`). It writes `alerts`: players whose status (injury list entry, else FantaSheet flag, else Available) changed since then. The site shows his players' alerts in a "Status changed" banner at the top of My team and tags the others in the Player market,
5. commits `data.json` and `history/` to `main`. GitHub Pages republishes the site within a minute or two.

## Run it yourself

```
python3 -I tools/elbuild.py work data.json data.json.new
mv data.json.new data.json
python3 -m http.server 8000   # then open http://localhost:8000
```

The daily report's fields `results`, `news`, `report`, `tradeWindow` and `injuries` are carried over from the old `data.json` unchanged, and so are `team`, `squadNote` and the Sofascore id cache `sofaIds`.
`squad`, `budget` and `lineup` come from `squad.json` when it is there, otherwise from the old `data.json`.
Edit `squad` (FantaSheet player ids + coach team code) and `budget` when the team changes.

## Game rules the planner follows

- Squad: 4 guards, 4 forwards, 2 centres + 1 coach, 100 credits, max 6 players from one club.
- Starting five + 6th man score 100%, bench 50%, captain ×2. FPT = PIR, +10% on a win.
- A round is played in turns (game days). **Trades are only possible before the round deadline (first tip-off). There are no trades between the turns of the same round** — between turns you can only change the lineup (bench ↔ court) and move the captain to a player who has not played yet.
- Moving the captain works even after he has played: the first captain's score then counts once, and the new captain (anyone in the squad who has not played, moved into the five if needed) gets ×2. So an early captain is a free shot. The optimiser values the captain this way (`capPlan`): worked back from the last turn, each turn's captain is worth E[max(his score, what the later turns are still worth)], with his score spread taken from his own recent games.
- Up to 4 trades per round, or unlimited in the 6 free-trade windows.

## Model notes

- Projection = half FantaSheet's xPTS for the next game, half recent form (60% of the last three EuroLeague games + 40% of the season average).
- Win bonus: FPT adds 10% of |PIR| on a win, and his average already holds his club's win rate so far, so the projection moves by 0.1 × |projection| × (this game's win chance − the club's win rate so far). Small (±0.6 at most on a star, about 0 on the bench, 0 when Out). Both proposals; the look-ahead uses next game's win chance.
- Expected price change = (projection − 1.1 × price) ÷ 25. Coach: (points − price) ÷ 40.
- Coach projection: coaches score by the final margin (win by 1–10 +10, 11–20 +20, 21+ +25; lose by 1–10 −5, 11–20 −10, 21+ −20). Each club's average margin comes from the final scores in the player logs. Each club also counts six extra games at margin 0, so after six games its rating is half its raw average. Expected margin = the club's rating − the opponent's rating ± 3 for home court. The margin is taken as Normal(expected margin, 12). Win chance = the chance it is above 0, and the projection is the expected points over the six bands. The Head coaches page shows both. Code: `teamModel()` in `index.html`; tests: `node --test tools/test_teammodel.mjs`.
- Matchup bonus (Proposal 2) = projection × how much more (or less) PIR the opponent allows to his position than an average team × ½. A share of his own projection, so a player who barely plays gains almost nothing.
- Look-ahead: a trade stays after this round, so Proposal 2 also counts half of each player's next-round projection: his quality with next round's matchup (see `docs/adr/0001`). Coaches count half of their next game in both proposals. Captain, lineup and price rise use this round only. It is off when the next round is a free-trade window. Next fixtures come from `teamNext` in `data.json`.
- Coach trades: a new coach must have at least the same win chance this round as yours, so the planner never gives up this round's coach game for credits or for next round. A coach you pin yourself is your call.
- Free-trade windows: the daily report writes `tradeWindow` into `data.json` (this round and the next: unlimited or not). The "Trades this round" switch follows it; a choice made by hand sticks until the report's answer changes.
- Words: `GLOSSARY.md` lists the terms the site and the report use.
- Domestic PIR is estimated from Sofascore box scores (fouls drawn and blocks against aren't published). Domestic games don't score in fantasy.
- Picks (♥ / ⊘), budget and settings are saved in your browser only.
