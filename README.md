# EuroLeague Fantasy round planner

Round planner and daily report for the EuroLeague Fantasy Challenge team **Boškovi Fazani**.

Live site: https://malteras.github.io/euroleague-fantasy/

## What's here

| File | What it is |
|---|---|
| `index.html` | The whole site: proposal, day-by-day lineup and captain plan, round report, player market, coaches, results. No build step. |
| `data.json` | Everything the page shows. Rebuilt every morning. |
| `tools/elbuild.py` | Builds `data.json` from FantaSheet (prices, EuroLeague game logs, projections, injuries, PIR allowed by position, coaches) and Sofascore (domestic league box scores for all 20 clubs). |

## Daily update

A scheduled Claude task runs every day at 08:58 (Europe/Sarajevo). It:

1. runs `python3 -I tools/elbuild.py <work_dir> data.json data.json.new`,
2. adds the written bits the script can't produce: EuroLeague results, news and the bottom-line summary (`results`, `news`, `report` in `data.json`),
3. commits `data.json` to `main`. GitHub Pages republishes the site within a minute or two.

## Run it yourself

```
python3 -I tools/elbuild.py work data.json data.json.new
mv data.json.new data.json
python3 -m http.server 8000   # then open http://localhost:8000
```

`results`, `news`, `report`, `squad` and `budget` are carried over from the old `data.json`.
Edit `squad` (FantaSheet player ids + coach team code) and `budget` when the team changes.

## Model notes

- Projection = half FantaSheet's xPTS for the next game, half recent form (60% of the last three EuroLeague games + 40% of the season average).
- Expected price change = (projection − 1.1 × price) ÷ 25. Coach: (points − price) ÷ 40.
- Domestic PIR is estimated from Sofascore box scores (fouls drawn and blocks against aren't published). Domestic games don't score in fantasy.
- Picks (★ / ✕), budget and settings are saved in your browser only.
