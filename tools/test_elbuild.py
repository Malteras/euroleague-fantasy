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


class CarriedTest(unittest.TestCase):
    def test_report_fields_pass_through_unchanged(self):
        old = {'results': [{'h': 'RMB'}], 'news': ['n'], 'report': {'bottom': 'x'},
               'tradeWindow': {'round': 7, 'unlimited': False}, 'injuries': [], 'players': [1]}
        self.assertEqual(elbuild.carried(old),
                         {k: old[k] for k in ('results', 'news', 'report', 'tradeWindow', 'injuries')})

    def test_injury_list_passes_through_unchanged(self):
        injuries = [{'name': 'Nadir Hifi', 'team': 'PBB', 'status': 'Questionable', 'note': 'ankle'}]
        self.assertEqual(elbuild.carried({'injuries': injuries})['injuries'], injuries)

    def test_missing_fields_get_empty_defaults(self):
        self.assertEqual(elbuild.carried({}),
                         {'results': [], 'news': [], 'report': {}, 'tradeWindow': None, 'injuries': None})



def game(d, opp, fpt, mins):
    return {'d': d, 'opp': opp, 'ha': 'H', 'res': 'W 80-70', 'min': mins, 'pts': 10, 'fpt': fpt, 'pir': fpt,
            'cr': 0.1, 'reb': 3.0, 'stl': 1.0, 'tov': 1.0, 'ast': 2.0, 'blk': 0.0}


def player(pid, team, log):
    return {'id': pid, 'status': None, 'name': f'P {pid}', 'short': f'{pid}', 'team': team, 'pos': 'G', 'price': 9.2,
            'chg': 0.2, 'gp': 3, 'fpt': 11.1, 'pir': 10.7, 'min': 18.4, 'pts': 15.3, 'reb': 1.3, 'ast': 3.7,
            'log': log, 'next': {'opp': 'BJK', 'ha': 'H', 'date': '2026-10-22', 'round': 7}, 'hist': [[6, 9.0, 0.2]],
            'start': 9.0, 'pir2526': None, 'domLeague': 'BSL', 'dom': [{'d': '2026-10-18'}], 'xpts': 8.3, 'rise': 29.0}


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
        self.assertEqual(sorted(p), ['fpt', 'gp', 'id', 'log', 'name', 'next', 'pos', 'price', 'rise', 'status', 'team', 'xpts'])
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
        self.assertEqual(actual['players'], {'654': {'fpt': 17.5, 'min': 28.3}, '655': None})
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
        self.assertEqual(actual['players']['654'], {'fpt': 17.5, 'min': 28.3})
        self.assertEqual(actual['coaches'], {'EFS': 20})


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
