"""Create aggregate-only public statistics; never copy competition rows to the app."""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.csv_utils import read_queries
from backend.inference import norm, script_of
from backend.reproduction import file_sha256, read_submission


def query_summary(rows):
    scripts = Counter(script_of(r['query_text']) for r in rows)
    return {
        'rows': len(rows), 'unique_ids': len({r['example_id'] for r in rows}),
        'scripts': [{'script': key, 'count': scripts[key]} for key in
                    ['Devanagari', 'Latin / Romanized', 'Devanagari + Latin', 'Other']],
        'empty_after_normalization': sum(not norm(r['query_text']) for r in rows),
        'duplicate_normalized_queries': len(rows) - len({norm(r['query_text']) for r in rows}),
    }


def analyze(train_path, test_path, reference_path, notebook_path):
    train = read_queries(Path(train_path).read_text(encoding='utf-8-sig'), max_rows=None)
    test = read_queries(Path(test_path).read_text(encoding='utf-8-sig'))
    reference = read_submission(Path(reference_path).read_text(encoding='utf-8-sig'))
    if any('target' not in r or not r['target'].isascii() or not r['target'].isdigit()
           or not 0 <= int(r['target']) <= 55 for r in train):
        raise ValueError('Training targets must be integer class IDs 0–55.')
    counts = Counter(int(r['target']) for r in train)
    if set(counts) != set(range(56)):
        raise ValueError('Training data must contain all 56 classes, 0–55.')
    if any(len(rows) != len({r['example_id'] for r in rows}) for rows in [train, test]):
        raise ValueError('Duplicate dataset IDs are not allowed.')
    ref_counts = Counter(r['target'] for r in reference)
    return {
        'source': 'Owner-uploaded competition artifacts; aggregate statistics only',
        'training': {**query_summary(train), 'class_count': len(counts),
                     'oos_count': counts[55],
                     'classes': [{'id': i, 'count': counts[i]} for i in range(56)]},
        'test': query_summary(test),
        'reference': {'rows': len(reference), 'oos_count': ref_counts[55],
                      'ids_and_order_match_test': [r['example_id'] for r in reference] ==
                                                 [r['example_id'] for r in test],
                      'classes': [{'id': i, 'count': ref_counts[i]} for i in range(56)],
                      'prediction_comparison': 'Pending recreated checkpoint; ID alignment is not prediction reproduction'},
        'sha256': {key: file_sha256(path) for key, path in
                   [('train', train_path), ('test', test_path),
                    ('reference', reference_path), ('notebook', notebook_path)]},
    }


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for key in ['train', 'test', 'reference', 'notebook']:
        p.add_argument('--' + key, required=True)
    p.add_argument('--output', default='backend/dataset_stats.json')
    args = p.parse_args()
    stats = analyze(args.train, args.test, args.reference, args.notebook)
    Path(args.output).write_text(json.dumps(stats, indent=2) + '\n', encoding='utf-8')
    print(f"Aggregate report saved: {stats['training']['rows']} training / {stats['test']['rows']} test rows. No raw rows exported.")