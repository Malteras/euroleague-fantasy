"""Run: python3 -I -m unittest discover -s tools"""
import unittest
import elbuild


class CarriedTest(unittest.TestCase):
    def test_report_fields_pass_through_unchanged(self):
        old = {'results': [{'h': 'RMB'}], 'news': ['n'], 'report': {'bottom': 'x'},
               'tradeWindow': {'round': 7, 'unlimited': False}, 'players': [1]}
        self.assertEqual(elbuild.carried(old), {k: old[k] for k in ('results', 'news', 'report', 'tradeWindow')})

    def test_missing_fields_get_empty_defaults(self):
        self.assertEqual(elbuild.carried({}), {'results': [], 'news': [], 'report': {}, 'tradeWindow': None})


if __name__ == '__main__':
    unittest.main()
