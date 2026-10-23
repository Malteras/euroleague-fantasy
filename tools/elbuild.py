#!/usr/bin/env python3
"""Build data.json for the Fazani Round Planner from FantaSheet; EuroLeague scores come from the official box scores.

Usage: python3 -I elbuild.py <work_dir> <old_data.json or -> <out_data.json>
Downloads go into <work_dir>/pages (keep it separate from this script's folder).
The daily report's fields (see carried()) and squad are carried over from the old data.json; edit them afterwards.

       python3 -I elbuild.py --history <data.json> <history_dir>
Run on the finished data.json: saves history/round-N.json before the deadline and fills its actuals after the round.

       python3 -I elbuild.py --alerts <previous data.json> <data.json>
Run on the finished data.json: writes `alerts`, the players whose status changed since the previous one.
When the previous one is from the same day, its alerts are kept (the deadline-day afternoon check).
"""
import sys, os, re, json, html, subprocess, datetime
from concurrent.futures import ThreadPoolExecutor

BASE = "https://euroleague.fantasheet.com"
TEAMS = {1:"EFS",2:"MIL",3:"BJK",4:"CZV",5:"DUB",6:"BAR",7:"BAY",8:"FBT",9:"HTA",10:"KBA",
         11:"ASV",12:"MTA",13:"OLY",14:"PAO",15:"PBB",16:"PAR",17:"RMB",18:"VAL",19:"VIR",20:"ZAL"}
SHORT = {'Efes':'EFS','Baskonia':'KBA','Villeurbanne':'ASV','Maccabi':'MTA','Olympiacos':'OLY','Panathinaikos':'PAO',
         'Paris':'PBB','Partizan':'PAR','Madrid':'RMB','Valencia':'VAL','Virtus':'VIR','Milan':'MIL','Žalgiris':'ZAL',
         'Beşiktaş':'BJK','Red Star':'CZV','Dubai':'DUB','Barça':'BAR','Bayern':'BAY','Fenerbahçe':'FBT','Hapoel':'HTA'}
DOMESTIC = {'RMB':'ACB','BAR':'ACB','VAL':'ACB','KBA':'ACB','FBT':'BSL','EFS':'BSL','BJK':'BSL','OLY':'GBL','PAO':'GBL',
            'CZV':'ABA','PAR':'ABA','DUB':'ABA','MTA':'Israel','HTA':'Israel','MIL':'LBA','VIR':'LBA','BAY':'BBL',
            'PBB':'LNB','ASV':'LNB','ZAL':'LKL'}
MON = {'Sept':9,'Sep':9,'Oct':10,'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,'Aug':8}
N = r'(-?[\d.]+)'
FULL = ['Anadolu Efes Istanbul','Kosner Baskonia Vitoria-Gasteiz','LDLC ASVEL Villeurbanne','Maccabi Playtika Tel Aviv','Maccabi Rapyd Tel Aviv',
        'Olympiacos Piraeus','Panathinaikos AKTOR Athens','Paris Basketball','Partizan Mozzart Bet Belgrade','Real Madrid','Valencia Basket',
        'Virtus Segafredo Bologna','Virtus Bologna','EA7 Emporio Armani Milano','Armani Olimpia Milan','Žalgiris Kaunas','Beşiktaş Istanbul',
        'Crvena Zvezda Meridianbet Belgrade','Dubai Basketball','FC Barcelona','FC Bayern Munich','Fenerbahçe Tarfin Istanbul','Hapoel IBI Tel Aviv']

def date(d):
    dd, m = d.split(); mo = MON[m]; y = 2026 if mo >= 8 else 2027
    return f'{y}-{mo:02d}-{int(dd):02d}'
def num(s):
    s = s.replace('±','').replace('−','-').replace('+','').replace(' ','').replace('%','')
    try: return float(s)
    except ValueError: return None
def txt(p):
    t = open(p, encoding='utf-8', errors='replace').read()
    t = re.sub(r'<script.*?</script>', '', t, flags=re.S)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S)
    t = t.replace('<!-- -->', '')
    t = re.sub(r'<[^>]+>', '|', t)
    t = html.unescape(t)
    return re.sub(r'(\s*\|\s*)+', ' | ', t)
def flat(t): return re.sub(r'\s+', ' ', t.replace(' | ', ' '))

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 2000: return path
    r = subprocess.run(['curl','-sS','-L','--max-time','40','-o',path,url])
    return path if r.returncode == 0 else None

def parse_log(t, domestic=False):
    gl = t[t.find('PIR pub. Box'):t.find('Totals (')]
    gl = gl.replace(' * ', ' ')  # '*' after a provisional credit change shifted the row and mixed games
    out = []
    for g in re.finditer(r'(\d{1,2} \w+) (.+?) \1 · ([WL]) (\d+)–(\d+) (.+?) (✈️ )?[WL] \d+–\d+ '+N+' '+N+' '+N+r' (\S+) '+N+r' (\S+) (\S+) (\S+) '+N+' '+N+' '+N+' '+N+' '+N+' '+N+' '+N+' '+N+' '+N+' '+N+' ', gl):
        opp = g.group(2) if domestic else SHORT.get(g.group(2), g.group(2))
        cr = num(g.group(11)) if g.group(11) not in ('-', '—') else None
        out.append({'d':date(g.group(1)),'opp':opp,'ha':'A' if g.group(7) else 'H','res':f'{g.group(3)} {g.group(4)}-{g.group(5)}',
                    'min':num(g.group(8)),'pts':int(num(g.group(9))),'fpt':num(g.group(10)),'pir':num(g.group(12)),'cr':cr,
                    'reb':num(g.group(16)),'stl':num(g.group(21)),'tov':num(g.group(22)),'ast':num(g.group(23)),'blk':num(g.group(24))})
    return out

def parse_player(f, team_code):
    t = flat(txt(f))
    pid = int(os.path.basename(f).split('.')[0])
    seg = re.search(r'EuroLeague ?2026-27 EuroLeague (.+?) ☆', t).group(1)
    for full in FULL:
        k = seg.find(full)
        if k >= 0: seg = seg[k+len(full):]; break
    name = re.sub(r'#\d+|🔥|🧊', '', seg).strip()
    pm_ = re.search(r'☆ ⇄ Fantasy (Guard|Forward|Center)(.*?) (?:Pop|Price)', t)
    pos = {'Guard':'G','Forward':'F','Center':'C'}[pm_.group(1)]
    sm = re.search(r'\b(Out|Doubtful|Questionable|Day to day|Injured)\b', pm_.group(2))
    status = ('Out' if 'Out' in pm_.group(2) else sm.group(1)) if sm else None
    # ownership: share of fantasy teams holding him, and its change since last round
    po = re.search(r'Pop ([\d.]+) ?%(?: ?([▲▼]) ?([\d.]+))?', t)
    pop = num(po.group(1)) if po else None
    pop_chg = (-1 if po.group(2) == '▼' else 1) * num(po.group(3)) if po and po.group(2) else None
    m = re.search(r'Price \? '+N+r'( \( ?([+−-]) ?([\d.]+) ?\))?', t)
    price = num(m.group(1)) if m else None
    chg = num(m.group(3)+m.group(4)) if m and m.group(2) else None
    hist = re.findall(r'([\d.]+) ([+−±-]?[\d.]+) After R(\d+)', t)
    if chg is None and hist: chg = num(hist[-1][1])
    fm = re.search(r'FPT / game \? '+N, t); pm = re.search(r'PIR / game \? '+N, t)
    ss = t[t.find('Season stats'):t.find('Game log')]
    gp = re.search(r'GP (\d+)', ss); gp = int(gp.group(1)) if gp else 0
    def st(k):
        m = re.search(k+r' \( ?\d+ GP ?\) '+N, ss); return num(m.group(1)) if m else None
    nx = re.search(r'Next game R(\d+) · (vs|@) (.+?) · (\d+ \w+)', t)
    nxt = {'opp':SHORT.get(nx.group(3)),'ha':'H' if nx.group(2)=='vs' else 'A','date':date(nx.group(4)),'round':int(nx.group(1))} if nx else None
    p25 = re.search(r'Last season · EuroLeague 2025-26 .*?PIR (?:avg )?'+N, t)
    return {'id':pid,'status':status,'name':name,'short':name.split()[-1] if not name.split()[-1].rstrip('.') in ('Jr','III','II') else name.split()[-2],
            'team':team_code,'pos':pos,'price':price,'chg':chg,'gp':gp,
            'fpt':num(fm.group(1)) if fm else None,'pir':num(pm.group(1)) if pm else None,
            'min':st('MIN'),'pts':st('PTS'),'reb':st('REB'),'ast':st('AST'),
            'log':parse_log(t),'next':nxt,'hist':[[int(r_),num(p_),num(c_)] for p_,c_,r_ in hist],
            'start':num(re.search(r'([\d.]+) Start', t).group(1)) if re.search(r'([\d.]+) Start', t) else None,'pir2526':num(p25.group(1)) if p25 else None,
            'pop':pop,'popChg':pop_chg}

def parse_domestic(f):
    t = flat(txt(f))
    return parse_log(t, domestic=True)

def parse_team(f):
    t = txt(f)
    ids = []
    for m in re.finditer(r'href="/players/(\d+)-([^"?#]+)"', open(f, encoding='utf-8').read()):
        if (int(m.group(1)), m.group(2)) not in ids: ids.append((int(m.group(1)), m.group(2)))
    s = t[t.find('Price gap |'):]
    # Price | Δ Price | Rise % | xPTS. Once he has played this round, FantaSheet marks the price change "est." in a cell of its
    # own; without the optional (?:est\. \| ) the Rise % was read as xPTS (#66: Bryant 53 instead of 21.1)
    R = re.compile(r'☆ \| ⇄ \| (.+?) \| (?:[🔥🧊] \| )?(.+?) \| (?:[🔥🧊] \| )?([GFC]) \| \3 \| ([\d.]+) \| ([^|]+?) \| (?:est\. \| )?([^|]+?) \| ([^|]+?) \|')
    rows = {}
    for m in R.finditer(s):
        rows[m.group(2).strip()] = {'rise':num(m.group(6)),'xpts':num(m.group(7))}
    return ids, rows

def parse_team_stats(f):
    t = flat(txt(f))
    out = {}
    names = {'Olympiacos':'OLY','Valencia':'VAL','Panathinaikos':'PAO','Real Madrid':'RMB','Madrid':'RMB','Barça':'BAR','Barcelona':'BAR',
             'Fenerbahçe':'FBT','Efes':'EFS','Anadolu Efes':'EFS','Beşiktaş':'BJK','Red Star':'CZV','Crvena Zvezda':'CZV','Dubai':'DUB',
             'Bayern':'BAY','Hapoel':'HTA','Maccabi':'MTA','Milan':'MIL','Partizan':'PAR','Paris':'PBB','Villeurbanne':'ASV','ASVEL':'ASV',
             'Virtus':'VIR','Žalgiris':'ZAL','Baskonia':'KBA'}
    for m in re.finditer(r'\b\d{1,2} (\S+(?: \S+)?) (\d+) ([\d.]+) ([+−-]\d+) % ([\d.]+) ([+−-]\d+) % ([\d.]+) ([+−-]\d+) % ([\d.]+) ([+−-]\d+) % ([\d.]+) ([+−-]\d+) %', t):
        nm = m.group(1)
        code = names.get(nm) or names.get(nm.split()[-1]) or names.get(nm.split()[0])
        if code and code not in out:
            out[code] = {'pir_allowed':num(m.group(5)),'vs_g':num(m.group(8)),'vs_f':num(m.group(10)),'vs_c':num(m.group(12))}
    return out

def parse_coaches(f):
    t = txt(f)
    i = t.find('Coaches'); s = t[i:]
    out = []
    for m in re.finditer(r'\| ([^|]+?) \| ([^|]+?) \| ([\d.]+) \| ([\d.]+) \| ([+−±-]?[\d.]+) \| (-?\d+)(?= \|)', s):
        out.append({'name':m.group(1).strip(),'teamname':m.group(2).strip(),'price':num(m.group(4)),'chg':num(m.group(5)),'pts':int(m.group(6))})
    return out


SOFA = "https://api.sofascore.com/api/v1"
SOFA_Q = {'ASV':'ASVEL','BAR':'Barcelona','BAY':'Bayern','BJK':'Besiktas','CZV':'Crvena zvezda','DUB':'Dubai','EFS':'Anadolu Efes',
          'FBT':'Fenerbahce','HTA':'Hapoel Tel Aviv','KBA':'Baskonia','MIL':'Olimpia Milano','MTA':'Maccabi Tel Aviv','OLY':'Olympiacos',
          'PAO':'Panathinaikos','PAR':'Partizan','PBB':'Paris Basketball','RMB':'Real Madrid','VAL':'Valencia Basket','VIR':'Virtus Bologna','ZAL':'Zalgiris'}
def sget(path):
    r = subprocess.run(['curl','-sS','--max-time','30','-A','Mozilla/5.0',SOFA+path], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {}
def norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z ]', '', s).split()
# Official EuroLeague box scores: the source for every EuroLeague score (PIR, minutes, points).
# Only the current round's games are read; older games come from FantaSheet's game log.
EL_API = 'https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games'
EL_BOX = 'https://live.euroleague.net/api/Boxscore?seasoncode=E2026&gamecode='
EL_CODE = {'BAS':'KBA','BES':'BJK','IST':'EFS','MAD':'RMB','MUN':'BAY','PAM':'VAL','PAN':'PAO','PRS':'PBB','RED':'CZV','TEL':'MTA','ULK':'FBT'}

def el_name(s):
    return [w for w in norm(s.replace(',', ' ').replace('-', ' ')) if w not in ('jr', 'ii', 'iii', 'iv')]

def official_games(pages):
    """{(date, club): [(name words, line)]} for the finished games of the current round (the latest round with a game played).
    Older games do not change, so they stay as FantaSheet's game log has them."""
    f = get(EL_API, os.path.join(pages, 'el_games.json'))
    try: games = [g for g in json.load(open(f))['data'] if g.get('played')]
    except Exception: return {}
    if not games: return {}
    rnd = max(g['round'] for g in games)
    games = [g for g in games if g['round'] == rnd]
    def box(g):
        return g, get(EL_BOX + str(g['gameCode']), os.path.join(pages, f"el_box{g['gameCode']}.json"))
    with ThreadPoolExecutor(8) as ex: boxes = list(ex.map(box, games))
    out = {}
    for g, bf in boxes:
        try: stats = json.load(open(bf))['Stats']
        except Exception: continue
        loc, road = (EL_CODE.get(g[s]['club']['code'], g[s]['club']['code']) for s in ('local', 'road'))
        ls, rs = g['local']['score'], g['road']['score']
        d = g['date'][:10]
        for side, club, opp, ha, win in ((0, loc, road, 'H', ls > rs), (1, road, loc, 'A', rs > ls)):
            players = []
            for x in stats[side]['PlayersStats']:
                m = re.match(r'(\d+):(\d+)', str(x.get('Minutes') or ''))
                if not m: continue  # DNP
                pir = x['Valuation']
                players.append((el_name(x['Player']), {'d': d, 'opp': opp, 'ha': ha, 'res': f"{'W' if win else 'L'} {ls}-{rs}",
                    'min': round(int(m.group(1)) + int(m.group(2)) / 60, 1), 'pts': x['Points'], 'pir': float(pir),
                    'fpt': round(pir + (abs(pir) / 10 if win else 0), 1), 'reb': float(x['TotalRebounds']), 'stl': float(x['Steals']),
                    'tov': float(x['Turnovers']), 'ast': float(x['Assistances']), 'blk': float(x['BlocksFavour']), 'src': 'official'}))
            out[(d, club)] = players
    return out

def find_line(name, lines):
    """His line among one club's players in one game: same name words, else same surname and first initial, else a unique surname."""
    w = el_name(name)
    for ow, line in lines:
        if set(ow) == set(w): return line
    last = w[-1] if w else ''
    hits = [(ow, line) for ow, line in lines if last in ow]
    for ow, line in hits:
        if any(o[0] == w[0][0] for o in ow if o != last): return line
    return hits[0][1] if len(hits) == 1 else None

def apply_official(players, games):
    """Put the official numbers into each player's game log for the games read (replacing FantaSheet's row of that day)."""
    used = 0
    for p in players:
        log = {g['d']: g for g in p.get('log', [])}
        for (d, club), lines in games.items():
            if club != p['team']: continue
            line = find_line(p['name'], lines)
            if not line: continue
            fs = log.get(d, {})
            log[d] = dict(line, cr=fs.get('cr'))
            used += 1
        p['log'] = sorted(log.values(), key=lambda g: g['d'], reverse=True)
    return used

def sofa_team_id(code, cache):
    if code in cache: return cache[code]
    d = sget('/search/teams?q=' + SOFA_Q[code].replace(' ', '%20'))
    for r in d.get('results', []):
        e = r.get('entity', {})
        if e.get('sport', {}).get('slug') == 'basketball' and e.get('gender', 'M') == 'M' and not re.search(r'U\d|Women|II\b|B$', e.get('name','')):
            cache[code] = e['id']; return e['id']
    return None
def sofa_domestic(players, cache, since):
    """Domestic (non-EuroLeague) games since `since` for the 20 clubs, matched to FantaSheet players by name."""
    games, idx = [], {}
    for p in players: idx.setdefault(p['team'], []).append(p)
    def team_games(code):
        tid = sofa_team_id(code, cache)
        if not tid: return code, []
        ev = sget(f'/team/{tid}/events/last/0').get('events', [])
        out = []
        for e in ev:
            t = e.get('tournament', {}).get('name', '')
            if 'euroleague' in t.lower() or e.get('status', {}).get('type') != 'finished': continue
            d = datetime.datetime.fromtimestamp(e["startTimestamp"], datetime.timezone.utc).date().isoformat()
            if d < since: continue
            home = e['homeTeam']['id'] == tid
            lu = sget(f"/event/{e['id']}/lineups")
            out.append((e, d, home, lu, t))
        return code, out
    with ThreadPoolExecutor(6) as ex: res = list(ex.map(team_games, SOFA_Q))
    for code, evs in res:
        for e, d, home, lu, t in evs:
            hs, as_ = e.get('homeScore', {}).get('current'), e.get('awayScore', {}).get('current')
            opp = e['awayTeam' if home else 'homeTeam']['name']
            my, their = (hs, as_) if home else (as_, hs)
            win = my is not None and their is not None and my > their
            games.append({'d': d, 'comp': re.sub(r',.*', '', t), 'team': code, 'opp': opp, 'ha': 'H' if home else 'A',
                          'score': f'{hs}–{as_}', 'result': 'W' if win else 'L'})
            side = lu.get('home' if home else 'away', {}).get('players', [])
            hit = set()
            for pl in side:
                st = pl.get('statistics') or {}
                sec = st.get('secondsPlayed') or 0
                nm = norm(pl.get('player', {}).get('name', ''))
                if not nm: continue
                match = None
                for fp in idx.get(code, []):
                    fn = norm(fp['name'])
                    if fn and fn[-1] == nm[-1] and (fn[0][0] == nm[0][0] or len(fn) == 1 or len(nm) == 1):
                        match = fp; break
                if not match: continue
                hit.add(match['id'])
                g = lambda k: st.get(k) or 0
                pir = (g('points') + g('rebounds') + g('assists') + g('steals') + g('blocks')
                       - (g('fieldGoalAttempts') - g('fieldGoalsMade')) - (g('freeThrowAttempts') - g('freeThrowsMade'))
                       - g('turnovers') - g('personalFouls'))
                match['dom'].append({'d': d, 'comp': re.sub(r',.*', '', t), 'opp': opp, 'ha': 'H' if home else 'A',
                                     'res': ('W' if win else 'L') + f' {hs}-{as_}', 'min': round(sec/60, 1),
                                     'pts': g('points'), 'reb': g('rebounds'), 'ast': g('assists'),
                                     'pir': pir if sec else None, 'dnp': sec == 0})
            if side:
                for fp in idx.get(code, []):
                    if fp['id'] not in hit and fp.get('gp'):
                        fp['dom'].append({'d': d, 'comp': re.sub(r',.*', '', t), 'opp': opp, 'ha': 'H' if home else 'A',
                                          'res': ('W' if win else 'L') + f' {hs}-{as_}', 'min': 0, 'pts': 0, 'reb': 0, 'ast': 0,
                                          'pir': None, 'dnp': True, 'absent': True})
    for p in players: p['dom'].sort(key=lambda x: x['d'], reverse=True)
    return sorted(games, key=lambda x: x['d'], reverse=True)

def carried(old):
    """The parts of data.json the daily report writes; this script can't produce them, so they pass through as they are."""
    return {
        'results': old.get('results', []), 'news': old.get('news', []), 'report': old.get('report', {}),
        # free-trade windows for this round and the next; the planner sets its switch from it
        'tradeWindow': old.get('tradeWindow'),
        # the season's 6 free-trade window rounds with where they came from; null until a reliable source lists them
        'tradeWindows': old.get('tradeWindows'),
        # who is out or doubtful, for the "Watch before the deadline" card
        'injuries': old.get('injuries'),
    }

def snapshot(data):
    """The inputs the planner projects a round from, as they stood before its deadline (history/round-N.json)."""
    keep = ('id', 'name', 'team', 'pos', 'price', 'status', 'xpts', 'rise', 'fpt', 'gp', 'next', 'pop')
    lineup = data.get('lineup') or {}
    return {
        'round': data.get('round'), 'deadline': data.get('deadline'), 'taken': data.get('updated'),
        'players': [{**{k: p.get(k) for k in keep},
                     'log': [{k: g.get(k) for k in ('d', 'fpt', 'min', 'opp', 'ha', 'res')} for g in p.get('log', [])[:5]]}
                    for p in data.get('players', [])],
        'defence': data.get('defence'), 'fixtures': data.get('fixtures'), 'coaches': data.get('coaches'),
        # each club's next two EuroLeague games: this round and the look-ahead round
        'teamNext': {c: [{k: v for k, v in g.items() if k not in ('comp', 'el')} for g in gs if g.get('el')][:2]
                     for c, gs in (data.get('teamNext') or {}).items()},
        'tradeWindow': data.get('tradeWindow'), 'injuries': data.get('injuries'),
        'squad': {**(data.get('squad') or {}), **{k: lineup.get(k) for k in ('slots', 'cap', 'bank')}},
    }

def write_history(data, hist_dir):
    """Keep a record of each round: the snapshot on the first run on or before its deadline day, never overwritten."""
    os.makedirs(hist_dir, exist_ok=True)
    rnd, today = data.get('round'), data.get('updated')
    path = os.path.join(hist_dir, f'round-{rnd}.json')
    if rnd and data.get('deadline') and today <= data['deadline'] and not os.path.exists(path):
        save(path, snapshot(data))
        print(f'history: wrote {path}')
    for name in sorted(os.listdir(hist_dir)):
        if not re.fullmatch(r'round-\d+\.json', name): continue
        p = os.path.join(hist_dir, name)
        snap = json.load(open(p, encoding='utf-8'))
        if fill_actual(snap, data):
            save(p, snap)
            print(f'history: actuals in {p}')

def fill_actual(snap, data):
    """After the round's last game day, add what happened: each player's FPT, minutes and credit change (None = did not play)
    and each coach's points. Parts already filled are left alone. Returns True when something was added."""
    fixtures = snap.get('fixtures') or []
    if not fixtures or data.get('updated') <= max(f[0] for f in fixtures): return False
    actual = snap.setdefault('actual', {'players': None, 'coaches': None})
    added = False
    if actual['players'] is None:
        day = {}  # club -> date of its game this round (one EuroLeague game a day, so the date finds it in the log)
        for d, h, a, *_ in fixtures: day[h] = day[a] = d
        now = {p['id']: p for p in data.get('players', [])}
        actual['players'] = {}
        for p in snap.get('players', []):
            if p['team'] not in day: continue
            g = next((g for g in now.get(p['id'], {}).get('log', []) if g['d'] == day[p['team']]), None)
            actual['players'][str(p['id'])] = {'fpt': g['fpt'], 'min': g['min'], 'cr': g.get('cr')} if g else None
        added = True
    # coaches[].last = points in [coachRound, the round before]
    back = (data.get('coachRound') or 0) - snap.get('round', 0)
    if actual['coaches'] is None and back in (0, 1):
        actual['coaches'] = {c['team']: c['last'][back] for c in data.get('coaches', []) if len(c.get('last', [])) > back}
        added = True
    return added

def round_schedule(fixtures, rnd, *before):
    """The round's fixtures, deadline and turns. `fixtures` come from each player's next game, so once a club has played this
    round its game is gone (its next game is next round's). Games of the same round in an earlier data.json or the history
    snapshot are kept, unless the club has a game in `fixtures` (moved); a game on the day it is played may come without its
    tip-off time, which is then taken from them too. Deadline = the round's first game day."""
    clubs = {c for f in fixtures for c in f[1:3]}
    keep, times = {}, {}
    for src in before:
        if not src or src.get('round') != rnd: continue
        for f in src.get('fixtures') or []:
            if len(f) > 3: times.setdefault(tuple(f[:3]), f[3])
            if f[1] not in clubs and f[2] not in clubs: keep.setdefault(tuple(f[:3]), list(f))
    fixtures = [f + [times[tuple(f)]] if len(f) == 3 and tuple(f) in times else f for f in fixtures]
    fixtures = sorted(fixtures + list(keep.values()))
    days = sorted({f[0] for f in fixtures})
    return fixtures, (days[0] if days else None), {d: datetime.date.fromisoformat(d).strftime('%a %-d %b') for d in days}


def xpts_jumps(players, snap, factor=2.0):
    """Players whose xPTS moved more than x2 from the round's deadline snapshot: a sign the team table was misread (#66).
    Values both under 5 are left out: a bench player going from 1 to 3 is noise."""
    was = {p['id']: p.get('xpts') for p in snap.get('players', [])}
    out = []
    for p in players:
        a, b = was.get(p['id']), p.get('xpts')
        if a and b and max(a, b) >= 5 and max(a, b) > factor * min(a, b): out.append(f"{p['name']} {a} → {b}")
    return out

def status_alerts(old, new):
    """Players whose status changed since the previous data.json: [{id, name, team, from, to, src, d, mine}].
    A player's status is his entry in the daily report's injury list, else his FantaSheet flag, else Available.
    Older data has no injury list (None); then only the FantaSheet flags are compared."""
    use_inj = old.get('injuries') is not None and new.get('injuries') is not None
    def status(p, data):
        e = next((x for x in data.get('injuries') or [] if x.get('name') == p['name'] and x.get('team') == p['team']), None)
        if use_inj and e: return e.get('status'), e.get('src') or 'Injury report'
        if p.get('status'): return p['status'], 'FantaSheet'
        return 'Available', 'No longer listed'
    before = {p['id']: p for p in old.get('players', [])}
    mine = set((new.get('squad') or {}).get('players') or [])
    out = []
    for p in new.get('players', []):
        if p['id'] not in before: continue
        (was, _), (now, src) = status(before[p['id']], old), status(p, new)
        if was != now:
            out.append({'id': p['id'], 'name': p['name'], 'team': p['team'], 'from': was, 'to': now, 'src': src,
                        'd': new.get('updated'), 'mine': p['id'] in mine})
    # a second run on the same day (the deadline-day afternoon check) keeps the morning's alerts:
    # a player who changed twice gets one alert from his morning status, and none if he is back where he was
    if old.get('updated') == new.get('updated'):
        for a in old.get('alerts') or []:
            later = next((x for x in out if x['id'] == a['id']), None)
            if later: later['from'] = a['from']
            else: out.append(a)
        out = [a for a in out if a['from'] != a['to']]
    return out

def save(path, obj):
    with open(path, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))

def main():
    work, oldp, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    pages = os.path.join(work, 'pages'); os.makedirs(pages, exist_ok=True)
    old = json.load(open(oldp)) if oldp != '-' and os.path.exists(oldp) else {}
    # teams
    with ThreadPoolExecutor(8) as ex:
        tfiles = list(ex.map(lambda tid: get(f'{BASE}/teams/{tid}', os.path.join(pages, f'team{tid}.html')), TEAMS))
    roster, xp = [], {}
    for tid, f in zip(TEAMS, tfiles):
        ids, rows = parse_team(f)
        for pid, slug in ids: roster.append((pid, slug, TEAMS[tid]))
        xp.update(rows)
    seen = set(); roster = [r for r in roster if not (r[0] in seen or seen.add(r[0]))]
    def fetch(r):
        pid, slug, _ = r
        a = get(f'{BASE}/players/{pid}-{slug}', os.path.join(pages, f'{pid}.html'))
        return a, None
    with ThreadPoolExecutor(10) as ex: files = list(ex.map(fetch, roster))
    players, bad = [], []
    for (pid, slug, tc), (a, b) in zip(roster, files):
        try:
            p = parse_player(a, tc)
            p['dom'] = []
            p['domLeague'] = DOMESTIC[tc]
            x = xp.get(p['name'])
            p['xpts'] = x['xpts'] if x else None
            p['rise'] = x['rise'] if x else None
            if p['price'] is None: continue
            if p['gp'] == 0 and p['price'] < 4.5: continue
            players.append(p)
        except Exception as e:
            bad.append((pid, slug, repr(e)[:80]))
    games = official_games(pages)
    print('official box scores (current round)', len(games) // 2, 'games, player lines used', apply_official(players, games))
    cache = old.get('sofaIds', {})
    since = (datetime.date.today() - datetime.timedelta(days=12)).isoformat()
    domgames = sofa_domestic(players, cache, since)
    # team defence
    sf = get(f'{BASE}/teams/stats', os.path.join(pages, 'teamstats.html'))
    defence = parse_team_stats(sf) if sf else {}
    # coaches from latest price-changes page
    rf = get(f'{BASE}/fantasy-rounds', os.path.join(pages, 'rounds.html'))
    rnums = sorted({int(x) for x in re.findall(r'/round-(\d+)/price-changes', open(rf, encoding='utf-8').read())}) if rf else []
    coaches = old.get('coaches', [])
    if rnums:
        last = rnums[-1]
        cf = get(f'{BASE}/round-{last}/price-changes', os.path.join(pages, f'pc{last}.html'))
        tn = {'Efes':'EFS','Madrid':'RMB','Beşiktaş':'BJK','Red Star':'CZV','Dubai':'DUB','Hapoel':'HTA','Maccabi':'MTA','Virtus':'VIR',
              'Fenerbahçe':'FBT','Olympiacos':'OLY','Baskonia':'KBA','Paris':'PBB','Bayern':'BAY','Milan':'MIL','Barça':'BAR',
              'Partizan':'PAR','Valencia':'VAL','Panathinaikos':'PAO','Villeurbanne':'ASV','Žalgiris':'ZAL'}
        parsed = [c for c in parse_coaches(cf) if c['teamname'] in tn] if cf else []
        if len(parsed) >= 18:
            prev = {c['team']: c for c in coaches}
            coaches = []
            for c in parsed:
                code = tn[c['teamname']]
                p0 = prev.get(code, {}).get('last', [])
                lastpts = [c['pts']] + (p0[:1] if p0 and old.get('coachRound') != last else p0[1:2])
                coaches.append({'name':c['name'],'team':code,'price':c['price'],'chg':c['chg'],'last':lastpts})
            old['coachRound'] = last
    # fixtures from next games
    fx = {}
    for p in players:
        n = p.get('next')
        if not n or not n.get('opp'): continue
        h, a = (p['team'], n['opp']) if n['ha']=='H' else (n['opp'], p['team'])
        fx[(n['date'], h, a)] = n.get('round')
    rounds = sorted({r for r in fx.values() if r})
    nxt_round = rounds[0] if rounds else old.get('round')
    fixtures = sorted([[d, h, a] for (d, h, a), r in fx.items() if r == nxt_round])
    hp = os.path.join(os.path.dirname(os.path.abspath(outp)), 'history', f'round-{nxt_round}.json')
    snap = json.load(open(hp, encoding='utf-8')) if os.path.exists(hp) else {}
    # tip-off times for the next round + each club's upcoming fixtures (Europe/Sarajevo)
    times = {}; teamNext = {}
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo('Europe/Sarajevo')
        code_of = {tid: code for code, tid in cache.items()}  # Sofascore team id -> club code, for the opponent's code (oc)
        for code, tid in cache.items():
            evs = sget(f'/team/{tid}/events/next/0').get('events', [])
            lst = []
            for e in evs[:10]:
                tn = e.get('tournament', {}).get('name', '')
                dt = datetime.datetime.fromtimestamp(e['startTimestamp'], tz)
                home = e['homeTeam']['id'] == tid
                ot = e['awayTeam' if home else 'homeTeam']
                g = {'d': dt.date().isoformat(), 't': dt.strftime('%H:%M'), 'comp': re.sub(r',.*', '', tn),
                     'el': 'euroleague' in tn.lower(), 'opp': ot['name'], 'ha': 'H' if home else 'A'}
                if ot.get('id') in code_of: g['oc'] = code_of[ot['id']]
                lst.append(g)
                if 'euroleague' in tn.lower():
                    times.setdefault(dt.date().isoformat() + '|' + code, dt.strftime('%H:%M'))
            teamNext[code] = lst
    except Exception as ex:
        print('tip-off times failed', ex)
    for f_ in fixtures:
        t_ = times.get(f_[0] + '|' + f_[1]) or times.get(f_[0] + '|' + f_[2])
        if t_ and len(f_) == 3: f_.append(t_)
    fixtures, deadline, turns = round_schedule(fixtures, nxt_round, old, snap)
    # his team: squad.json next to data.json (written from the site's My team editor)
    squad, budget, lineup = old.get('squad'), old.get('budget', 99.6), old.get('lineup')
    sqp = os.path.join(os.path.dirname(os.path.abspath(oldp)) if oldp != '-' else '.', 'squad.json')
    if os.path.exists(sqp):
        sq = json.load(open(sqp, encoding='utf-8'))
        byid = {p['id']: p for p in players}
        squad = {'players': sq['players'], 'coach': sq['coach']}
        missing = [i for i in sq['players'] if i not in byid]
        cprice = next((c['price'] for c in coaches if c['team'] == sq['coach']), 0)
        budget = round(sum(byid[i]['price'] for i in sq['players'] if i in byid) + cprice + float(sq.get('bank', 0)), 1)
        lineup = {'slots': sq.get('slots'), 'cap': sq.get('cap'), 'bank': sq.get('bank', 0), 'updated': sq.get('updated')}
        print(f"squad.json from {sq.get('updated')}: value {budget}" + (f" missing ids {missing}" if missing else ''))
    data = {
        'updated': datetime.date.today().isoformat(), 'round': nxt_round, 'roundLabel': f'Round {nxt_round}',
        'deadline': deadline or old.get('deadline'), 'team': old.get('team','Boškovi Fazani'),
        'budget': budget, 'squad': squad, 'lineup': lineup, 'squadNote': old.get('squadNote',''),
        'turns': turns, 'fixtures': fixtures, 'players': players, 'coaches': coaches, 'defence': defence,
        'coachRound': old.get('coachRound'), 'domGames': domgames, 'sofaIds': cache, 'teamNext': teamNext,
        **carried(old),
    }
    json.dump(data, open(outp, 'w'), ensure_ascii=False, separators=(',',':'))
    print(f'domestic games {len(domgames)} lines {sum(len(p["dom"]) for p in players)} sofa ids {len(cache)}'); print(f'players {len(players)} roster {len(roster)} bad {len(bad)} fixtures {len(fixtures)} round {nxt_round} defence {len(defence)} coaches {len(coaches)} ownership {sum(p.get("pop") is not None for p in players)}')
    for b in bad[:15]: print('  bad', b)
    if snap:
        jumps = xpts_jumps(players, snap)
        if jumps: print(f'WARNING xPTS moved more than x2 since the deadline snapshot ({len(jumps)} players; FantaSheet table misread?):', '; '.join(jumps[:10]))

if __name__ == '__main__':
    if sys.argv[1:2] == ['--history']:
        write_history(json.load(open(sys.argv[2], encoding='utf-8')), sys.argv[3])
    elif sys.argv[1:2] == ['--alerts']:
        prev, cur = (json.load(open(f, encoding='utf-8')) for f in sys.argv[2:4])
        cur['alerts'] = status_alerts(prev, cur)
        save(sys.argv[3], cur)
        print(f"alerts: {len(cur['alerts'])} ({sum(a['mine'] for a in cur['alerts'])} in his squad)")
    else:
        main()
