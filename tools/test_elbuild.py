"""Run: python3 -I -m unittest discover -s tools"""
import json, os, subprocess, sys, tempfile, unittest
import elbuild


class ParseCoachesTest(unittest.TestCase):
    def test_reads_every_row_not_every_other_one(self):
        rows = ''.join(f'<tr><td>Coach {i}</td><td>Club {i}</td><td>5.0</td><td>5.{i}</td><td>+0.{i}</td><td>{i}</td></tr>'
                       for i in range(4))
        with tempfile.TemporaryDirectory() as d:
            f = os.path.join(d, 'pc.html')
            open(f, 'w', encoding='utf-8').write(f'<h2>Coaches</h2><table>{rows}</table>')
            got = elbuild.parse_coaches(f)
        self.assertEqual([c['teamname'] for c in got], ['Club 0', 'Club 1', 'Club 2', 'Club 3'])
        self.assertEqual(got[2], {'name': 'Coach 2', 'teamname': 'Club 2', 'price': 5.2, 'chg': 0.2, 'pts': 2})


class OfficialScoresTest(unittest.TestCase):
    # 21 Oct 2026, Hapoel 90-81 Virtus: the official box score gives Bryant PIR 13 in 24:22 (FantaSheet's log was misread as 24.2)
    def games(self):
        line = lambda pir, win: {'d': '2026-10-21', 'opp': 'VIR', 'ha': 'H', 'res': 'W 90-81', 'min': 24.4, 'pts': 12, 'pir': float(pir),
                                 'fpt': round(pir + (abs(pir) / 10 if win else 0), 1), 'src': 'official'}
        return {('2026-10-21', 'HTA'): [(['bryant', 'elijah'], line(13, True)), (['horton', 'tucker', 'talen'], line(-4, True))]}

    def test_official_line_replaces_the_fantasheet_row_of_that_day(self):
        p = {'name': 'Elijah Bryant', 'team': 'HTA', 'log': [
            {'d': '2026-10-21', 'fpt': 24.2, 'min': 27.7, 'pts': 14, 'cr': -0.2},
            {'d': '2026-10-16', 'fpt': 24.2, 'min': 27.7, 'pts': 14, 'cr': 0.2}]}
        elbuild.apply_official([p], self.games())
        self.assertEqual([(g['d'], g['fpt'], g['min'], g['pts']) for g in p['log']],
                         [('2026-10-21', 14.3, 24.4, 12), ('2026-10-16', 24.2, 27.7, 14)])
        self.assertEqual(p['log'][0]['cr'], -0.2)

    def test_a_game_missing_from_the_fantasheet_log_is_added(self):
        p = {'name': 'Elijah Bryant', 'team': 'HTA', 'log': []}
        elbuild.apply_official([p], self.games())
        self.assertEqual([g['d'] for g in p['log']], ['2026-10-21'])

    def test_hyphenated_name_and_negative_pir_after_a_win(self):
        p = {'name': 'Talen Horton-Tucker', 'team': 'HTA', 'log': []}
        elbuild.apply_official([p], self.games())
        self.assertEqual(p['log'][0]['fpt'], -3.6)

    def test_other_clubs_games_are_not_used(self):
        p = {'name': 'Elijah Bryant', 'team': 'VIR', 'log': []}
        elbuild.apply_official([p], self.games())
        self.assertEqual(p['log'], [])


class OfficialNextTest(unittest.TestCase):
    # 27 Oct 2026: Sofascore refused every request, so no club had a next game and Round 9 read "no game found" for all
    def games(self):
        g = lambda rnd, utc, loc, road, played=False: {'round': rnd, 'utcDate': utc, 'played': played,
            'local': {'club': {'code': loc, 'name': {'VIR': 'Virtus Bologna', 'BES': 'Besiktas', 'DUB': 'Dubai Basketball',
                                                     'PRS': 'Paris Basketball', 'ZAL': 'Zalgiris Kaunas'}[loc]}},
            'road': {'club': {'code': road, 'name': {'BES': 'Besiktas', 'PRS': 'Paris Basketball', 'ZAL': 'Zalgiris Kaunas',
                                                     'VIR': 'Virtus Bologna'}[road]}}}
        return [g(9, '2026-10-30T19:30:00Z', 'VIR', 'BES'), g(8, '2026-10-27T16:00:00Z', 'DUB', 'PRS'),
                g(8, '2026-10-28T19:30:00Z', 'VIR', 'ZAL'), g(7, '2026-10-21T18:00:00Z', 'ZAL', 'VIR', True)]

    def test_unplayed_games_in_order_in_banja_luka_time_with_club_codes(self):
        nxt = elbuild.official_next(self.games())
        self.assertEqual(nxt['VIR'], [
            {'d': '2026-10-28', 't': '20:30', 'comp': 'EuroLeague R8', 'el': True, 'opp': 'Zalgiris Kaunas', 'ha': 'H', 'oc': 'ZAL'},
            {'d': '2026-10-30', 't': '20:30', 'comp': 'EuroLeague R9', 'el': True, 'opp': 'Besiktas', 'ha': 'H', 'oc': 'BJK'}])
        self.assertEqual(nxt['PBB'], [{'d': '2026-10-27', 't': '17:00', 'comp': 'EuroLeague R8', 'el': True,
                                       'opp': 'Dubai Basketball', 'ha': 'A', 'oc': 'DUB'}])

    def test_fills_only_clubs_without_a_euroleague_game_and_gives_tip_off_times(self):
        team_next = {'VIR': [], 'DUB': [{'d': '2026-10-27', 't': '17:00', 'comp': 'EuroLeague', 'el': True, 'opp': 'Paris', 'ha': 'H'}],
                     'ZAL': [{'d': '2026-10-25', 't': '18:00', 'comp': 'LKL', 'el': False, 'opp': 'Rytas', 'ha': 'A'}]}
        times = {}
        filled = elbuild.fill_next(team_next, times, elbuild.official_next(self.games()))
        self.assertEqual(sorted(filled), ['BJK', 'PBB', 'VIR', 'ZAL'])
        self.assertEqual([g['oc'] for g in team_next['VIR']], ['ZAL', 'BJK'])
        self.assertEqual(team_next['DUB'][0]['opp'], 'Paris')  # Sofascore's list is kept when it has a EuroLeague game
        self.assertEqual([g['d'] for g in team_next['ZAL']], ['2026-10-28'])
        self.assertEqual(times['2026-10-27|DUB'], '17:00')
        self.assertEqual(times['2026-10-28|VIR'], '20:30')


class ParsePlayerTest(unittest.TestCase):
    def parse(self, header):
        with tempfile.TemporaryDirectory() as d:
            f = os.path.join(d, '654.html')
            open(f, 'w', encoding='utf-8').write(
                '<p>EuroLeague 2026-27 EuroLeague Anadolu Efes Istanbul #22 Cameron Payne ☆ ⇄ Fantasy Guard</p>'
                f'<p>{header}</p><p>Price ? 9.2 (+0.2)</p>')
            return elbuild.parse_player(f, 'EFS')

    def test_reads_ownership_and_its_rise(self):
        p = self.parse('Pop 1.4% ▲1.1')
        self.assertEqual((p['pop'], p['popChg']), (1.4, 1.1))
        self.assertEqual((p['pos'], p['price']), ('G', 9.2))

    def test_a_fall_is_negative(self):
        p = self.parse('Pop 12.5% ▼0.3')
        self.assertEqual((p['pop'], p['popChg']), (12.5, -0.3))

    def test_no_arrow_means_no_change(self):
        p = self.parse('Pop 0.2%')
        self.assertEqual((p['pop'], p['popChg']), (0.2, None))

    def test_no_ownership_on_the_page(self):
        p = self.parse('')
        self.assertEqual((p['pop'], p['popChg']), (None, None))


class ParseTeamTest(unittest.TestCase):
    """The FantaSheet team table (/teams/N), rows as they were on 22 Oct 2026."""
    HEAD = ('Price gap | Player | Pos | Price | Δ Price | Rise % | xPTS | Value | FPT | PIR | GP | MIN | PTS | 2P | 2P% | 3P | 3P% | '
            'FT | FT% | REB | OREB | DREB | PF | FD | STL | TOV | AST | BLK | BLKA | PIR 25-26 | Floor | Ceiling | Price gap | ')
    # he has played this round: FantaSheet adds an "est." cell after the price change (#66)
    PLAYED = ('☆ | ⇄ | E. Bryant | Elijah Bryant | G | G | 17.4 | −0.2 | est. | 53% | 21.1 | 1.39 | 24.2 | 22.4 | 7 | 29.5 | 14.9 | '
              '3.6/7.3 | 49.0% | 1.0/3.3 | 30.4% | 4.7/5.4 | 86.8% | 6.6 | 1.0 | 5.6 | 2.1 | 6.7 | 1.0 | 1.6 | 3.6 | 0.1 | 0.0 | '
              '19.6 | 14.8 | 28.6 | −1.1 | ')
    NOT_PLAYED = ('☆ | ⇄ | C. Edwards | Carsen Edwards | G | G | 11.5 | −0.3 | 49% | 13.6 | 1.14 | 13.1 | 12.7 | 6 | 23.9 | 17.2 | '
                  '3.0/7.5 | 40.0% | 2.8/7.2 | 39.5% | 2.7/2.7 | 100.0% | 1.2 | 0.2 | 1.0 | 1.3 | 3.8 | 1.2 | 2.2 | 2.7 | 0.0 | 1.0 | '
                  '11.0 | 7.2 | 21.2 | −0.2 | ')

    def parse(self, *rows):
        with tempfile.TemporaryDirectory() as d:
            f = os.path.join(d, 'team.html')
            cells = (self.HEAD + ''.join(rows) + '☆ | ⇄ | end').split(' | ')
            open(f, 'w', encoding='utf-8').write(''.join(f'<td>{c}</td>' for c in cells))
            return elbuild.parse_team(f)[1]

    def test_a_player_who_has_not_played(self):
        self.assertEqual(self.parse(self.NOT_PLAYED)['Carsen Edwards'], {'rise': 49.0, 'xpts': 13.6})

    def test_a_player_who_has_played_reads_xpts_not_the_rise_chance(self):
        self.assertEqual(self.parse(self.PLAYED, self.NOT_PLAYED),
                         {'Elijah Bryant': {'rise': 53.0, 'xpts': 21.1}, 'Carsen Edwards': {'rise': 49.0, 'xpts': 13.6}})


class RoundScheduleTest(unittest.TestCase):
    """Fri 23 Oct 2026, last game day of Round 7: players' next games gave only Friday's 3 games, so the build wrote
    deadline 2026-10-23 and the site said "Trades close Today" and proposed 4 trades."""
    ROUND7 = [['2026-10-21', 'HTA', 'VIR', '18:00'], ['2026-10-22', 'BAY', 'DUB', '20:00'], ['2026-10-22', 'EFS', 'BJK', '19:30'],
              ['2026-10-22', 'MIL', 'BAR', '20:30'], ['2026-10-22', 'MTA', 'RMB', '20:05'], ['2026-10-22', 'PAO', 'KBA', '20:15'],
              ['2026-10-22', 'PAR', 'CZV', '20:45'], ['2026-10-23', 'OLY', 'FBT', '20:15'], ['2026-10-23', 'PBB', 'VAL', '20:45'],
              ['2026-10-23', 'ZAL', 'ASV', '19:00']]
    FRIDAY = [['2026-10-23', 'OLY', 'FBT'], ['2026-10-23', 'PBB', 'VAL'], ['2026-10-23', 'ZAL', 'ASV']]
    TURNS = {'2026-10-21': 'Wed 21 Oct', '2026-10-22': 'Thu 22 Oct', '2026-10-23': 'Fri 23 Oct'}

    def test_mid_round_keeps_the_played_games_and_the_first_tip_off(self):
        old = {'round': 7, 'deadline': '2026-10-21', 'fixtures': self.ROUND7}
        fixtures, deadline, turns = elbuild.round_schedule([list(f) for f in self.FRIDAY], 7, old, {})
        self.assertEqual(deadline, '2026-10-21')
        self.assertEqual(turns, self.TURNS)
        # Friday's games came without tip-off times (the game is today): they keep the ones they had
        self.assertEqual(fixtures, sorted(self.ROUND7))

    def test_the_history_snapshot_fills_in_when_the_old_data_lost_them(self):
        broken = {'round': 7, 'deadline': '2026-10-23', 'fixtures': self.FRIDAY}
        snap = {'round': 7, 'deadline': '2026-10-21', 'fixtures': self.ROUND7}
        fixtures, deadline, turns = elbuild.round_schedule([list(f) for f in self.FRIDAY], 7, broken, snap)
        self.assertEqual((len(fixtures), deadline, turns), (10, '2026-10-21', self.TURNS))

    def test_before_the_round_only_the_new_fixtures(self):
        old = {'round': 6, 'deadline': '2026-10-14', 'fixtures': [['2026-10-14', 'HTA', 'OLY', '18:00']]}
        new = [list(f[:3]) for f in self.ROUND7]
        fixtures, deadline, turns = elbuild.round_schedule(new, 7, old, {})
        self.assertEqual((fixtures, deadline, turns), (sorted(new), '2026-10-21', self.TURNS))

    def test_a_moved_game_takes_its_new_date(self):
        old = {'round': 7, 'fixtures': self.ROUND7}
        fixtures, _, turns = elbuild.round_schedule([['2026-10-24', 'OLY', 'FBT']], 7, old, {})
        self.assertEqual([f for f in fixtures if 'OLY' in f], [['2026-10-24', 'OLY', 'FBT']])
        self.assertEqual(len(fixtures), 10)
        self.assertIn('2026-10-24', turns)


class TradeBaseTest(unittest.TestCase):
    """Mon 26 Oct 2026, before Round 8's deadline: he had saved 4 trades and the planner proposed 3 more on top."""
    PLAYED_R7 = {'players': [73, 91, 38, 165, 118, 8, 23, 185, 236, 361], 'coach': 'ZAL'}

    def test_first_build_of_a_round_takes_the_squad_that_played_the_round_before(self):
        old = {'round': 7, 'deadline': '2026-10-21', 'updated': '2026-10-23', 'squad': self.PLAYED_R7}
        self.assertEqual(elbuild.trade_base(old, 8), {'round': 8, **self.PLAYED_R7, 'from': '2026-10-23'})

    def test_the_bank_when_the_market_opened_is_kept_too(self):
        # 27 Oct: a bank 0.1 too high on My team let the proposal spend credits he did not have; with the bank of the
        # squad that played Round 7, the team value during the market is known (prices do not move then)
        old = {'round': 7, 'deadline': '2026-10-21', 'updated': '2026-10-23', 'squad': self.PLAYED_R7, 'lineup': {'bank': 0.3}}
        self.assertEqual(elbuild.trade_base(old, 8), {'round': 8, **self.PLAYED_R7, 'bank': 0.3, 'from': '2026-10-23'})

    def test_kept_for_the_rest_of_the_round_whatever_he_saves(self):
        base = {'round': 8, **self.PLAYED_R7, 'from': '2026-10-23'}
        old = {'round': 8, 'updated': '2026-10-26', 'tradeBase': base,
               'squad': {'players': [23, 38, 245, 165, 285, 361, 73, 118, 358, 185], 'coach': 'CZV'}}
        self.assertEqual(elbuild.trade_base(old, 8), base)

    def test_unknown_when_the_old_data_is_not_the_round_before(self):
        self.assertIsNone(elbuild.trade_base({'round': 8, 'squad': self.PLAYED_R7}, 8))
        self.assertIsNone(elbuild.trade_base({'round': 6, 'squad': self.PLAYED_R7}, 8))
        self.assertIsNone(elbuild.trade_base({}, 8))


class XptsJumpTest(unittest.TestCase):
    """The builder warns when a player's xPTS moved more than x2 from the deadline snapshot (#66)."""
    def test_flags_a_jump_or_a_drop_of_more_than_double(self):
        snap = {'players': [{'id': 1, 'name': 'Elijah Bryant', 'xpts': 21.9}, {'id': 2, 'name': 'Zach LeDay', 'xpts': 16.0},
                            {'id': 3, 'name': 'Low One', 'xpts': 10.0}]}
        now = [{'id': 1, 'name': 'Elijah Bryant', 'xpts': 53.0}, {'id': 2, 'name': 'Zach LeDay', 'xpts': 17.4},
               {'id': 3, 'name': 'Low One', 'xpts': 4.0}]
        self.assertEqual(elbuild.xpts_jumps(now, snap), ['Elijah Bryant 21.9 → 53.0', 'Low One 10.0 → 4.0'])

    def test_tiny_values_and_missing_ones_are_left_alone(self):
        snap = {'players': [{'id': 1, 'name': 'A', 'xpts': 1.0}, {'id': 2, 'name': 'B', 'xpts': None}, {'id': 3, 'name': 'C', 'xpts': 9.0}]}
        now = [{'id': 1, 'name': 'A', 'xpts': 3.0}, {'id': 2, 'name': 'B', 'xpts': 20.0}, {'id': 4, 'name': 'D', 'xpts': 20.0}]
        self.assertEqual(elbuild.xpts_jumps(now, snap), [])


class CarriedTest(unittest.TestCase):
    def test_report_fields_pass_through_unchanged(self):
        old = {'results': [{'h': 'RMB'}], 'news': ['n'], 'report': {'bottom': 'x'},
               'tradeWindow': {'round': 7, 'unlimited': False}, 'injuries': [], 'players': [1],
               'tradeWindows': {'rounds': [4, 9, 15, 22, 28, 34], 'source': 'https://example.org', 'checked': '2026-10-20'}}
        self.assertEqual(elbuild.carried(old),
                         {k: old[k] for k in ('results', 'news', 'report', 'tradeWindow', 'tradeWindows', 'injuries')})

    def test_injury_list_passes_through_unchanged(self):
        injuries = [{'name': 'Nadir Hifi', 'team': 'PBB', 'status': 'Questionable', 'note': 'ankle'}]
        self.assertEqual(elbuild.carried({'injuries': injuries})['injuries'], injuries)

    def test_missing_fields_get_empty_defaults(self):
        self.assertEqual(elbuild.carried({}),
                         {'results': [], 'news': [], 'report': {}, 'tradeWindow': None, 'tradeWindows': None,
                          'injuries': None})



def game(d, opp, fpt, mins):
    return {'d': d, 'opp': opp, 'ha': 'H', 'res': 'W 80-70', 'min': mins, 'pts': 10, 'fpt': fpt, 'pir': fpt,
            'cr': 0.1, 'reb': 3.0, 'stl': 1.0, 'tov': 1.0, 'ast': 2.0, 'blk': 0.0}


def player(pid, team, log):
    return {'id': pid, 'status': None, 'name': f'P {pid}', 'short': f'{pid}', 'team': team, 'pos': 'G', 'price': 9.2,
            'chg': 0.2, 'gp': 3, 'fpt': 11.1, 'pir': 10.7, 'min': 18.4, 'pts': 15.3, 'reb': 1.3, 'ast': 3.7,
            'log': log, 'next': {'opp': 'BJK', 'ha': 'H', 'date': '2026-10-22', 'round': 7}, 'hist': [[6, 9.0, 0.2]],
            'start': 9.0, 'pir2526': None, 'pop': 1.4, 'popChg': 1.1, 'domLeague': 'BSL', 'dom': [{'d': '2026-10-18'}], 'xpts': 8.3, 'rise': 29.0}


def data_for(updated, players=(), coaches=(), coach_round=None):
    return {
        'updated': updated, 'round': 7, 'deadline': '2026-10-21',
        'fixtures': [['2026-10-21', 'HTA', 'VIR', '18:00'], ['2026-10-22', 'EFS', 'BJK', '19:30']],
        'players': list(players), 'coaches': list(coaches), 'coachRound': coach_round,
        'defence': {'EFS': {'pir_allowed': 90.5, 'vs_g': 23.0, 'vs_f': -36.0, 'vs_c': 0.0}},
        'teamNext': {'EFS': [
            {'d': '2026-10-22', 't': '19:30', 'comp': 'Euroleague', 'el': True, 'opp': 'Besiktas', 'ha': 'H', 'oc': 'BJK'},
            {'d': '2026-10-25', 't': '18:00', 'comp': 'BSL', 'el': False, 'opp': 'Tofas', 'ha': 'A'},
            {'d': '2026-10-27', 't': '20:00', 'comp': 'Euroleague', 'el': True, 'opp': 'Bayern', 'ha': 'A', 'oc': 'BAY'},
            {'d': '2026-10-30', 't': '20:00', 'comp': 'Euroleague', 'el': True, 'opp': 'Paris', 'ha': 'H', 'oc': 'PBB'}]},
        'squad': {'players': [654], 'coach': 'EFS'},
        'lineup': {'slots': [654], 'cap': 654, 'bank': 1.3, 'updated': '2026-10-18'},
        'tradeWindow': {'round': 7, 'unlimited': False}, 'injuries': [{'name': 'P 1', 'status': 'Out'}],
        'domGames': [{'d': '2026-10-18'}], 'news': ['n'],
    }


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        log = [game(f'2026-10-{d:02d}', 'ZAL', 10.0 + i, 20.0) for i, d in enumerate((16, 14, 9, 7, 2, 1))]
        self.snap = elbuild.snapshot(data_for('2026-10-21', [player(654, 'EFS', log)]))

    def test_keeps_the_round_inputs_and_nothing_domestic(self):
        self.assertEqual(sorted(self.snap), ['coaches', 'deadline', 'defence', 'fixtures', 'injuries', 'players',
                                             'round', 'squad', 'taken', 'teamNext', 'tradeWindow'])
        self.assertEqual((self.snap['round'], self.snap['deadline'], self.snap['taken']), (7, '2026-10-21', '2026-10-21'))

    def test_player_keeps_listed_fields_and_last_five_games(self):
        p = self.snap['players'][0]
        self.assertEqual(sorted(p), ['fpt', 'gp', 'id', 'log', 'name', 'next', 'pop', 'pos', 'price', 'rise', 'status', 'team', 'xpts'])
        self.assertEqual(len(p['log']), 5)
        self.assertEqual(p['log'][0], {'d': '2026-10-16', 'fpt': 10.0, 'min': 20.0, 'opp': 'ZAL', 'ha': 'H', 'res': 'W 80-70'})

    def test_team_next_keeps_two_euroleague_games(self):
        self.assertEqual(self.snap['teamNext']['EFS'],
                         [{'d': '2026-10-22', 't': '19:30', 'opp': 'Besiktas', 'ha': 'H', 'oc': 'BJK'},
                          {'d': '2026-10-27', 't': '20:00', 'opp': 'Bayern', 'ha': 'A', 'oc': 'BAY'}])

    def test_squad_is_the_saved_team(self):
        self.assertEqual(self.snap['squad'], {'players': [654], 'coach': 'EFS', 'slots': [654], 'cap': 654, 'bank': 1.3})



class WriteHistoryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = os.path.join(self.tmp.name, 'history')
        self.path = os.path.join(self.dir, 'round-7.json')

    def tearDown(self):
        self.tmp.cleanup()

    def read(self):
        return json.load(open(self.path, encoding='utf-8'))

    def test_writes_the_snapshot_on_deadline_day(self):
        elbuild.write_history(data_for('2026-10-21', [player(654, 'EFS', [])]), self.dir)
        self.assertEqual(self.read()['taken'], '2026-10-21')

    def test_no_snapshot_after_the_deadline(self):
        elbuild.write_history(data_for('2026-10-22'), self.dir)
        self.assertFalse(os.path.exists(self.path))

    def test_never_overwrites_an_existing_snapshot(self):
        elbuild.write_history(data_for('2026-10-19', [player(654, 'EFS', [])]), self.dir)
        elbuild.write_history(data_for('2026-10-21'), self.dir)
        self.assertEqual(self.read()['taken'], '2026-10-19')
        self.assertEqual(len(self.read()['players']), 1)


    def after_round(self, updated, log654, coach_round=None):
        """Snapshot before the deadline (654 and 655 at EFS, 656 at RMB, which has no game), then a later run."""
        elbuild.write_history(data_for('2026-10-20', [player(654, 'EFS', []), player(655, 'EFS', []),
                                                      player(656, 'RMB', [])]), self.dir)
        later = [player(654, 'EFS', log654), player(655, 'EFS', [game('2026-10-16', 'ZAL', 4.0, 9.0)])]
        coaches = [{'name': 'Laso', 'team': 'EFS', 'price': 6.4, 'chg': 0.4, 'last': [20, -5]}]
        elbuild.write_history(data_for(updated, later, coaches, coach_round), self.dir)
        return self.read().get('actual')

    def test_actuals_after_the_last_game_day(self):
        actual = self.after_round('2026-10-26', [game('2026-10-22', 'BJK', 17.5, 28.3), game('2026-10-16', 'ZAL', 9.0, 20.0)], 7)
        # cr: his credit change from the game, kept for the Value column of past rounds (#58)
        self.assertEqual(actual['players'], {'654': {'fpt': 17.5, 'min': 28.3, 'cr': 0.1}, '655': None})
        self.assertEqual(actual['coaches'], {'EFS': 20})

    def test_no_actuals_on_the_last_game_day(self):
        self.assertIsNone(self.after_round('2026-10-22', [game('2026-10-22', 'BJK', 17.5, 28.3)], 7))

    def test_coach_points_wait_for_the_round_price_changes(self):
        self.assertIsNone(self.after_round('2026-10-26', [game('2026-10-22', 'BJK', 17.5, 28.3)], 6)['coaches'])

    def test_coach_points_one_round_later_come_from_the_previous_entry(self):
        self.assertEqual(self.after_round('2026-10-26', [], 8)['coaches'], {'EFS': -5})

    def test_rerun_keeps_filled_actuals_and_fills_only_what_was_missing(self):
        self.after_round('2026-10-26', [game('2026-10-22', 'BJK', 17.5, 28.3)], 6)
        coaches = [{'name': 'Laso', 'team': 'EFS', 'price': 6.4, 'chg': 0.4, 'last': [20, -5]}]
        elbuild.write_history(data_for('2026-10-27', [player(654, 'EFS', [game('2026-10-22', 'BJK', 99.0, 40.0)])],
                                       coaches, 7), self.dir)
        actual = self.read()['actual']
        self.assertEqual(actual['players']['654'], {'fpt': 17.5, 'min': 28.3, 'cr': 0.1})
        self.assertEqual(actual['coaches'], {'EFS': 20})

    # played: the team he played the round with, saved from the site after the snapshot was taken (#109)
    def run_with_save(self, updated, saved, slots=(655, 654), cap=655):
        d = data_for(updated)
        d['squad'] = {'players': [654, 655], 'coach': 'RMB'}
        d['lineup'] = {'slots': list(slots), 'cap': cap, 'bank': 0.4, 'updated': saved}
        elbuild.write_history(d, self.dir)
        return self.read().get('played')

    def test_a_save_during_the_round_is_the_team_he_played(self):
        elbuild.write_history(data_for('2026-10-20', [player(654, 'EFS', [])]), self.dir)
        self.assertEqual(self.run_with_save('2026-10-22', '2026-10-21'),
                         {'players': [654, 655], 'coach': 'RMB', 'slots': [655, 654], 'cap': 655, 'bank': 0.4, 'updated': '2026-10-21'})
        self.assertEqual(self.read()['squad']['players'], [654])  # the snapshot itself is never rewritten

    def test_a_save_before_the_deadline_or_after_the_round_is_not_the_team_he_played(self):
        elbuild.write_history(data_for('2026-10-20', [player(654, 'EFS', [])]), self.dir)
        self.assertIsNone(self.run_with_save('2026-10-20', '2026-10-20'))
        self.assertIsNone(self.run_with_save('2026-10-24', '2026-10-23'))

    def test_the_latest_save_of_the_round_wins_and_an_older_one_never_comes_back(self):
        elbuild.write_history(data_for('2026-10-20', [player(654, 'EFS', [])]), self.dir)
        self.run_with_save('2026-10-21', '2026-10-21')
        self.assertEqual(self.run_with_save('2026-10-22', '2026-10-22', cap=654)['cap'], 654)
        self.assertEqual(self.run_with_save('2026-10-23', '2026-10-21')['updated'], '2026-10-22')


    def test_command_line_reads_a_data_file(self):
        src = os.path.join(self.tmp.name, 'data.json')
        json.dump(data_for('2026-10-21', [player(654, 'EFS', [])]), open(src, 'w', encoding='utf-8'))
        script = os.path.join(os.path.dirname(os.path.abspath(elbuild.__file__)), 'elbuild.py')
        r = subprocess.run([sys.executable, '-I', script, '--history', src, self.dir], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.read()['round'], 7)



def alert_data(updated, statuses, injuries=None, squad=(654,)):
    """statuses: {id: FantaSheet flag or None}; injuries: the daily report's list or None (older data has none)."""
    return {'updated': updated, 'squad': {'players': list(squad), 'coach': 'EFS'}, 'injuries': injuries,
            'players': [{'id': i, 'name': f'P {i}', 'team': 'EFS', 'status': st} for i, st in statuses.items()]}


class StatusAlertsTest(unittest.TestCase):
    def test_no_change_no_alert(self):
        old = alert_data('2026-10-19', {654: 'Out', 655: None}, [])
        self.assertEqual(elbuild.status_alerts(old, alert_data('2026-10-21', {654: 'Out', 655: None}, [])), [])

    def test_fantasheet_flag_change_gives_one_alert(self):
        got = elbuild.status_alerts(alert_data('2026-10-19', {654: None, 655: None}, []),
                                    alert_data('2026-10-21', {654: 'Doubtful', 655: None}, []))
        self.assertEqual(got, [{'id': 654, 'name': 'P 654', 'team': 'EFS', 'from': 'Available', 'to': 'Doubtful',
                                'src': 'FantaSheet', 'd': '2026-10-21', 'mine': True}])

    def test_injury_report_entry_wins_over_the_flag_and_gives_its_source(self):
        inj = [{'name': 'P 655', 'team': 'EFS', 'status': 'Out', 'reason': 'ankle', 'ret': '', 'src': 'BasketNews 21 Oct'}]
        got = elbuild.status_alerts(alert_data('2026-10-19', {655: 'Questionable'}, []),
                                    alert_data('2026-10-21', {655: 'Questionable'}, inj))
        self.assertEqual([(a['id'], a['from'], a['to'], a['src'], a['mine']) for a in got],
                         [(655, 'Questionable', 'Out', 'BasketNews 21 Oct', False)])

    def test_back_to_available(self):
        inj = [{'name': 'P 654', 'team': 'EFS', 'status': 'Out', 'src': 'BasketNews 19 Oct'}]
        got = elbuild.status_alerts(alert_data('2026-10-19', {654: 'Out'}, inj), alert_data('2026-10-21', {654: None}, []))
        self.assertEqual([(a['from'], a['to'], a['src']) for a in got], [('Out', 'Available', 'No longer listed')])

    def test_old_data_without_injury_list_compares_flags_only(self):
        inj = [{'name': 'P 654', 'team': 'EFS', 'status': 'Doubtful', 'src': 'BasketNews 21 Oct'}]
        self.assertEqual(elbuild.status_alerts(alert_data('2026-10-19', {654: 'Questionable'}, None),
                                               alert_data('2026-10-21', {654: 'Questionable'}, inj)), [])

    def test_new_or_dropped_players_give_no_alert(self):
        self.assertEqual(elbuild.status_alerts(alert_data('2026-10-19', {654: None}, []),
                                               alert_data('2026-10-21', {655: 'Out'}, [])), [])

    def test_same_day_rerun_keeps_the_morning_alerts(self):
        morning = {**alert_data('2026-10-21', {654: 'Out', 655: None}, []),
                   'alerts': [{'id': 654, 'name': 'P 654', 'team': 'EFS', 'from': 'Doubtful', 'to': 'Out',
                               'src': 'FantaSheet', 'd': '2026-10-21', 'mine': True}]}
        got = elbuild.status_alerts(morning, alert_data('2026-10-21', {654: 'Out', 655: 'Doubtful'}, []))
        self.assertEqual([(a['id'], a['from'], a['to']) for a in got], [(655, 'Available', 'Doubtful'), (654, 'Doubtful', 'Out')])

    def test_same_day_rerun_joins_two_changes_of_one_player(self):
        morning = {**alert_data('2026-10-21', {654: 'Doubtful'}, []),
                   'alerts': [{'id': 654, 'name': 'P 654', 'team': 'EFS', 'from': 'Available', 'to': 'Doubtful',
                               'src': 'FantaSheet', 'd': '2026-10-21', 'mine': True}]}
        got = elbuild.status_alerts(morning, alert_data('2026-10-21', {654: 'Out'}, []))
        self.assertEqual([(a['from'], a['to']) for a in got], [('Available', 'Out')])

    def test_same_day_change_back_drops_the_alert(self):
        morning = {**alert_data('2026-10-21', {654: 'Doubtful'}, []),
                   'alerts': [{'id': 654, 'name': 'P 654', 'team': 'EFS', 'from': 'Available', 'to': 'Doubtful',
                               'src': 'FantaSheet', 'd': '2026-10-21', 'mine': True}]}
        self.assertEqual(elbuild.status_alerts(morning, alert_data('2026-10-21', {654: None}, [])), [])

    def test_alerts_from_an_earlier_day_are_not_kept(self):
        old = {**alert_data('2026-10-19', {654: 'Out'}, []),
               'alerts': [{'id': 654, 'name': 'P 654', 'team': 'EFS', 'from': 'Doubtful', 'to': 'Out',
                           'src': 'FantaSheet', 'd': '2026-10-19', 'mine': True}]}
        self.assertEqual(elbuild.status_alerts(old, alert_data('2026-10-21', {654: 'Out'}, [])), [])

    def test_command_line_writes_alerts_into_the_data_file(self):
        with tempfile.TemporaryDirectory() as d:
            prev, cur = os.path.join(d, 'prev.json'), os.path.join(d, 'data.json')
            json.dump(alert_data('2026-10-19', {654: None}, []), open(prev, 'w', encoding='utf-8'))
            json.dump(alert_data('2026-10-21', {654: 'Out'}, []), open(cur, 'w', encoding='utf-8'))
            script = os.path.join(os.path.dirname(os.path.abspath(elbuild.__file__)), 'elbuild.py')
            r = subprocess.run([sys.executable, '-I', script, '--alerts', prev, cur], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            got = json.load(open(cur, encoding='utf-8'))
        self.assertEqual([(a['id'], a['to']) for a in got['alerts']], [(654, 'Out')])
        self.assertEqual(got['updated'], '2026-10-21')


if __name__ == '__main__':
    unittest.main()
