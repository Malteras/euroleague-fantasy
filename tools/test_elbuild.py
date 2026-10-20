"""Run: python3 -I -m unittest discover -s tools"""
import os, tempfile, unittest
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


if __name__ == '__main__':
    unittest.main()
