import json
import tempfile
import unittest
from pathlib import Path
from backend.csv_utils import read_queries
from backend.reproduction import compare_rows, read_submission


class ReproductionRules(unittest.TestCase):
    def test_exact_ids_order_and_targets(self):
        reference = read_submission('example_id,target\n001,55\n002,0\n')
        self.assertTrue(compare_rows(reference, reference)['exact_match'])
        reversed_rows = list(reversed(reference))
        self.assertEqual(compare_rows(reference, reversed_rows)['id_order_mismatches'], 2)
        changed = [{'example_id': '001', 'target': 54}, reference[1]]
        self.assertEqual(compare_rows(reference, changed)['target_mismatches'], 1)
        self.assertFalse(compare_rows(reference, changed)['exact_match'])
        self.assertFalse(compare_rows(reference, reference[:1])['exact_match'])

    def test_submission_classes_and_format(self):
        self.assertEqual(read_submission('example_id,target\n001,55\n')[0]['example_id'], '001')
        for text in ['example_id,target\n1,56\n', 'example_id,target\n1,-1\n',
                     'example_id,target\n1,1.0\n', 'example_id,target\n1,0\n1,0\n',
                     'target,example_id\n55,001\n', 'example_id,target\n']:
            with self.assertRaises(ValueError):
                read_submission(text)

    def test_uploaded_dataset_statistics(self):
        stats = json.loads(Path('backend/dataset_stats.json').read_text())
        self.assertEqual(stats['training']['rows'], 16936)
        self.assertEqual(stats['test']['rows'], 4912)
        self.assertEqual(sum(c['count'] for c in stats['training']['classes']), 16936)
        self.assertEqual(stats['training']['oos_count'], 249)
        self.assertEqual(stats['reference']['oos_count'], 335)
        self.assertTrue(stats['reference']['ids_and_order_match_test'])
        self.assertEqual(stats, json.loads(Path('src/data/dataset_stats.json').read_text()))
        self.assertNotIn('query_text', json.dumps(stats))
        self.assertNotIn('example_id', json.dumps(stats))

    def test_private_analysis_does_not_export_raw_rows(self):
        from scripts.analyze_datasets import analyze
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'train.csv').write_text('example_id,query_text,target\n' +
                ''.join(f'{i},private query {i},{i}\n' for i in range(56)))
            (root / 'test.csv').write_text('example_id,query_text\n001,private test query\n')
            (root / 'ref.csv').write_text('example_id,target\n001,55\n')
            (root / 'notebook').write_text('{}')
            stats = analyze(root/'train.csv', root/'test.csv', root/'ref.csv', root/'notebook')
            self.assertEqual(stats['training']['class_count'], 56)
            self.assertNotIn('private query', json.dumps(stats))
            self.assertNotIn('private test query', json.dumps(stats))

    def test_api_row_limit_stays_10000(self):
        csv = 'example_id,query_text\n' + ''.join(f'{i},hello\n' for i in range(10001))
        with self.assertRaises(ValueError):
            read_queries(csv)
        self.assertEqual(len(read_queries(csv, max_rows=None)), 10001)


if __name__ == '__main__':
    unittest.main()